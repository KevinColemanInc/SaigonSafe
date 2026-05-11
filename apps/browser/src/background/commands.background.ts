// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Observable } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ExtensionCommand, ExtensionCommandType } from "@bitwarden/common/autofill/constants";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../auth/popup/utils/auth-popout-window";
import type { LockedVaultPendingNotificationsData } from "../autofill/background/abstractions/notification.background";
import { BrowserApi } from "../platform/browser/browser-api";

import MainBackground from "./main.background";

export default class CommandsBackground {
  private isSafari: boolean;
  private isVivaldi: boolean;

  constructor(
    private main: MainBackground,
    private platformUtilsService: PlatformUtilsService,
    private authService: AuthService,
    private generatePasswordToClipboard: () => Observable<string>,
    private accountService: AccountService,
    private lockService: LockService,
  ) {
    this.isSafari = this.platformUtilsService.isSafari();
    this.isVivaldi = this.platformUtilsService.isVivaldi();
  }

  init() {
    BrowserApi.messageListener("commands.background", (msg: any) => {
      if (msg.command === "unlockCompleted" && msg.data.target === "commands.background") {
        this.processCommand(
          msg.data.commandToRetry.message.command,
          msg.data.commandToRetry.sender,
        ).catch((error) => this.main.logService.error(error));
      }
    });

    if (chrome && chrome.commands) {
      chrome.commands.onCommand.addListener(async (command: string, tab?: chrome.tabs.Tab) => {
        await this.processCommand(
          command,
          tab ? ({ tab } as chrome.runtime.MessageSender) : undefined,
        );
      });
    }
  }

  private async processCommand(command: string, sender?: chrome.runtime.MessageSender) {
    switch (command) {
      case ExtensionCommand.GeneratePassword:
        await firstValueFrom(this.generatePasswordToClipboard(), { defaultValue: undefined });
        break;
      case ExtensionCommand.AutofillLogin:
        await this.triggerAutofillCommand(
          sender ? sender.tab : null,
          ExtensionCommand.AutofillCommand,
        );
        break;
      case ExtensionCommand.AutofillCard:
        await this.triggerAutofillCommand(
          sender ? sender.tab : null,
          ExtensionCommand.AutofillCard,
        );
        break;
      case ExtensionCommand.AutofillIdentity:
        await this.triggerAutofillCommand(
          sender ? sender.tab : null,
          ExtensionCommand.AutofillIdentity,
        );
        break;
      case ExtensionCommand.OpenPopup:
        await this.openPopup();
        break;
      case ExtensionCommand.LockVault: {
        const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        await this.lockService.lock(activeUserId);
        break;
      }
      default:
        break;
    }
  }

  private async triggerAutofillCommand(
    tab?: chrome.tabs.Tab,
    commandSender?: ExtensionCommandType,
  ) {
    if (!tab) {
      tab = await BrowserApi.getTabFromCurrentWindowId();
    }

    if (tab == null || !commandSender) {
      return;
    }

    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      const pendingNotification = this.buildLockedVaultPendingNotification(tab, commandSender);

      if (await this.openLockedExtensionView(tab, pendingNotification)) {
        return;
      }

      await openUnlockPopout(tab, pendingNotification);
      return;
    }

    await this.main.collectPageDetailsForContentScript(tab, commandSender);
  }

  private buildLockedVaultPendingNotification(
    tab: chrome.tabs.Tab,
    commandSender: ExtensionCommandType,
  ): LockedVaultPendingNotificationsData {
    return {
      commandToRetry: {
        message: {
          command:
            commandSender === ExtensionCommand.AutofillCommand
              ? ExtensionCommand.AutofillLogin
              : commandSender,
        },
        sender: { tab: tab },
      },
      target: "commands.background",
    };
  }

  private async openLockedExtensionView(
    tab: chrome.tabs.Tab,
    pendingNotification: LockedVaultPendingNotificationsData,
  ): Promise<boolean> {
    try {
      const extensionViewOpened = await this.openExtensionViewForLockedCommand(tab);
      if (!extensionViewOpened) {
        return false;
      }
    } catch (error) {
      this.main.logService.error(error);
      return false;
    }

    await BrowserApi.tabSendMessageData(
      tab,
      "addToLockedVaultPendingNotifications",
      pendingNotification,
    );
    await BrowserApi.tabSendMessageData(tab, "bgUnlockPopoutOpened", {});
    return true;
  }

  private async openExtensionViewForLockedCommand(tab: chrome.tabs.Tab): Promise<boolean> {
    const sidebarAction = BrowserApi.getSidebarAction(self) as {
      open?: () => Promise<void>;
    } | null;

    if (typeof sidebarAction?.open === "function") {
      await sidebarAction.open();
      return true;
    }

    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: {
        open?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
      };
    };

    if (typeof chromeWithSidePanel.sidePanel?.open !== "function") {
      return false;
    }

    if (tab.id != null) {
      await chromeWithSidePanel.sidePanel.open({ tabId: tab.id });
      return true;
    }

    if (tab.windowId != null) {
      await chromeWithSidePanel.sidePanel.open({ windowId: tab.windowId });
      return true;
    }

    return false;
  }

  private async openPopup() {
    // Chrome APIs cannot open popup
    if (!this.isSafari) {
      return;
    }

    await this.main.openPopup();
  }
}
