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

const MAIN_SIDE_PANEL_PATH = "popup/index.html?uilocation=sidebar";

type ChromeSidePanelApi = {
  open?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
  close?: (options: { windowId: number }) => Promise<void>;
};

type CommandProcessingOptions = {
  extensionViewOpenAttempt?: {
    attempted: boolean;
    activeAuthStatus: AuthenticationStatus | null;
  };
  closeActivityBarAfterAutofill?: boolean;
};

type ActiveAccountAuthStatusCache = {
  status: AuthenticationStatus | null;
};

const activeAccountAuthStatusCache: ActiveAccountAuthStatusCache = {
  status: null,
};

export default class CommandsBackground {
  private isSafari: boolean;
  private isVivaldi: boolean;
  private isFirefox: boolean;

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
    this.isFirefox = this.platformUtilsService.isFirefox() || this.hasFirefoxSidebarAction();
    this.setCachedActiveAuthStatus(null);
  }

  init() {
    this.authService.activeAccountStatus$.subscribe((status) => {
      this.setCachedActiveAuthStatus(status);
    });

    BrowserApi.messageListener("commands.background", (msg: any) => {
      this.updateCachedAuthStatusFromMessage(msg);

      if (msg.command === "unlockCompleted" && msg.data?.target === "commands.background") {
        const commandToRetry = msg.data.commandToRetry;
        this.processCommand(
          commandToRetry.message.command,
          commandToRetry.sender,
          {
            closeActivityBarAfterAutofill:
              commandToRetry.message.closeActivityBarAfterAutofill === true,
          },
        ).catch((error) => this.main.logService.error(error));
      }
    });

    const commandListener = (command: string, tab?: chrome.tabs.Tab) => {
      const activeAuthStatus = this.getCachedActiveAuthStatus();
      const extensionViewOpenAttempt = this.shouldOpenExtensionViewForCommand(
        command,
        activeAuthStatus,
      )
        ? { attempted: this.openExtensionViewForCommand(tab), activeAuthStatus }
        : undefined;

      void this.processCommand(
        command,
        tab ? ({ tab } as chrome.runtime.MessageSender) : undefined,
        { extensionViewOpenAttempt },
      ).catch((error) => this.main.logService.error(error));
    };

    if (this.isFirefox && typeof browser !== "undefined" && browser.commands?.onCommand) {
      browser.commands.onCommand.addListener(commandListener);
    } else if (chrome?.commands) {
      chrome.commands.onCommand.addListener(commandListener);
    }
  }

  private async processCommand(
    command: string,
    sender?: chrome.runtime.MessageSender,
    options: CommandProcessingOptions = {},
  ) {
    switch (command) {
      case ExtensionCommand.GeneratePassword:
        await firstValueFrom(this.generatePasswordToClipboard(), { defaultValue: undefined });
        break;
      case ExtensionCommand.AutofillLogin:
        await this.triggerAutofillCommand(
          sender ? sender.tab : null,
          ExtensionCommand.AutofillCommand,
          options,
        );
        break;
      case ExtensionCommand.AutofillCard:
        await this.triggerAutofillCommand(
          sender ? sender.tab : null,
          ExtensionCommand.AutofillCard,
          options,
        );
        break;
      case ExtensionCommand.AutofillIdentity:
        await this.triggerAutofillCommand(
          sender ? sender.tab : null,
          ExtensionCommand.AutofillIdentity,
          options,
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
    options: CommandProcessingOptions = {},
  ) {
    if (!tab) {
      tab = await BrowserApi.getTabFromCurrentWindowId();
    }

    if (tab == null || !commandSender) {
      return;
    }

    const authStatus =
      options.extensionViewOpenAttempt?.activeAuthStatus ??
      this.getCachedActiveAuthStatus() ??
      (await this.authService.getAuthStatus());

    if (authStatus < AuthenticationStatus.Unlocked) {
      const pendingNotification = this.buildLockedVaultPendingNotification(
        tab,
        commandSender,
        options.extensionViewOpenAttempt?.attempted === true || this.isFirefox,
      );

      if (options.extensionViewOpenAttempt != null) {
        if (options.extensionViewOpenAttempt.attempted) {
          await this.queueLockedVaultPendingNotification(tab, pendingNotification);
        }
        return;
      }

      if (
        authStatus === AuthenticationStatus.Locked &&
        !this.isFirefox &&
        (await this.openLockedExtensionView(tab, pendingNotification))
      ) {
        return;
      }

      if (this.isFirefox) {
        await openUnlockPopout(tab, pendingNotification);
        return;
      }

      await openUnlockPopout(tab, pendingNotification);
      return;
    }

    await this.main.collectPageDetailsForContentScript(tab, commandSender);

    if (options.closeActivityBarAfterAutofill) {
      await this.closeActivityBarAfterAutofillForTab(tab);
    }
  }

  private buildLockedVaultPendingNotification(
    tab: chrome.tabs.Tab,
    commandSender: ExtensionCommandType,
    closeActivityBarAfterAutofill = false,
  ): LockedVaultPendingNotificationsData {
    const message = {
      command:
        commandSender === ExtensionCommand.AutofillCommand
          ? ExtensionCommand.AutofillLogin
          : commandSender,
      ...(closeActivityBarAfterAutofill ? { closeActivityBarAfterAutofill: true } : {}),
    };

    return {
      commandToRetry: {
        message,
        sender: { tab: tab },
      },
      target: "commands.background",
    };
  }

  private getCachedActiveAuthStatus(): AuthenticationStatus | null {
    return activeAccountAuthStatusCache.status;
  }

  private setCachedActiveAuthStatus(status: AuthenticationStatus | null) {
    activeAccountAuthStatusCache.status = status;
  }

  private updateCachedAuthStatusFromMessage(msg: { command?: string }) {
    switch (msg.command) {
      case "loggedIn":
      case "unlocked":
        this.setCachedActiveAuthStatus(AuthenticationStatus.Unlocked);
        break;
      case "locked":
        this.setCachedActiveAuthStatus(AuthenticationStatus.Locked);
        break;
      case "doneLoggingOut":
      case "loggedOut":
        this.setCachedActiveAuthStatus(AuthenticationStatus.LoggedOut);
        break;
      default:
        break;
    }
  }

  private shouldOpenExtensionViewForCommand(
    command: string,
    activeAuthStatus: AuthenticationStatus | null,
  ): boolean {
    return (
      command === ExtensionCommand.AutofillLogin &&
      activeAuthStatus === AuthenticationStatus.Locked &&
      this.hasChromeSidePanel()
    );
  }

  private hasFirefoxSidebarAction(): boolean {
    return typeof browser !== "undefined" && typeof browser.sidebarAction?.open === "function";
  }

  private hasChromeSidePanel(): boolean {
    if (typeof chrome === "undefined") {
      return false;
    }

    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: ChromeSidePanelApi;
    };

    return typeof chromeWithSidePanel.sidePanel?.open === "function";
  }

  private openExtensionViewForCommand(tab?: chrome.tabs.Tab): boolean {
    if (this.isFirefox) {
      return this.openFirefoxSidebarForCommand();
    }

    return this.openChromeSidePanelForCommand(tab);
  }

  private openFirefoxSidebarForCommand(): boolean {
    const sidebarAction =
      (BrowserApi.getSidebarAction(this.getExtensionGlobal()) as {
        open?: () => Promise<void>;
      } | null) ?? (this.hasFirefoxSidebarAction() ? browser.sidebarAction : null);

    if (typeof sidebarAction?.open !== "function") {
      this.main.logService.error(
        "[CommandsBackground] Firefox sidebarAction.open is unavailable for autofill shortcut.",
      );
      return false;
    }

    try {
      void sidebarAction
        .open()
        .catch((error) =>
          this.main.logService.error(
            "[CommandsBackground] Firefox failed to open sidebar for autofill shortcut.",
            error,
          ),
        );
      return true;
    } catch (error) {
      this.main.logService.error(
        "[CommandsBackground] Firefox failed to open sidebar for autofill shortcut.",
        error,
      );
      return false;
    }
  }

  private openChromeSidePanelForCommand(tab?: chrome.tabs.Tab): boolean {
    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: ChromeSidePanelApi;
    };

    if (typeof chromeWithSidePanel.sidePanel?.open !== "function") {
      this.main.logService.warning(
        "[CommandsBackground] Chrome sidePanel.open is unavailable for autofill shortcut.",
      );
      return false;
    }

    const openOptions = this.buildChromeSidePanelOpenOptions(tab);
    if (openOptions == null) {
      this.logMissingSidePanelTarget(tab);
      return false;
    }

    void BrowserApi.setSidePanelOptions({
      path: MAIN_SIDE_PANEL_PATH,
      enabled: true,
      ...(tab?.id != null ? { tabId: tab.id } : {}),
    }).catch((error) =>
      this.main.logService.error(
        "[CommandsBackground] Failed to enable side panel options for autofill shortcut.",
        error,
      ),
    );

    try {
      void chromeWithSidePanel.sidePanel
        .open(openOptions)
        .catch((error) =>
          this.main.logService.error(
            "[CommandsBackground] Chrome failed to open side panel for autofill shortcut.",
            error,
          ),
        );
      return true;
    } catch (error) {
      this.main.logService.error(
        "[CommandsBackground] Chrome failed to open side panel for autofill shortcut.",
        error,
      );
      return false;
    }
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
      this.main.logService.error(
        "[CommandsBackground] Failed to open side panel/sidebar for locked autofill shortcut.",
        error,
      );
      return false;
    }

    await this.queueLockedVaultPendingNotification(tab, pendingNotification);
    return true;
  }

  private async queueLockedVaultPendingNotification(
    tab: chrome.tabs.Tab,
    pendingNotification: LockedVaultPendingNotificationsData,
  ) {
    await BrowserApi.tabSendMessageData(
      tab,
      "addToLockedVaultPendingNotifications",
      pendingNotification,
    );
    await BrowserApi.tabSendMessageData(tab, "bgUnlockPopoutOpened", {});
  }

  private async openExtensionViewForLockedCommand(tab: chrome.tabs.Tab): Promise<boolean> {
    const sidebarAction = BrowserApi.getSidebarAction(this.getExtensionGlobal()) as {
      open?: () => Promise<void>;
    } | null;

    if (typeof sidebarAction?.open === "function") {
      await sidebarAction.open();
      return true;
    }

    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: ChromeSidePanelApi;
    };

    if (typeof chromeWithSidePanel.sidePanel?.open !== "function") {
      this.main.logService.warning(
        "[CommandsBackground] No side panel/sidebar API available for locked autofill shortcut.",
      );
      return false;
    }

    // Dispatch options update in the same turn so Chrome preserves the command gesture for `open`.
    void BrowserApi.setSidePanelOptions({
      path: MAIN_SIDE_PANEL_PATH,
      enabled: true,
      ...(tab.id != null ? { tabId: tab.id } : {}),
    }).catch((error) =>
      this.main.logService.error(
        "[CommandsBackground] Failed to enable side panel options for locked autofill shortcut.",
        error,
      ),
    );

    if (tab.id != null) {
      await chromeWithSidePanel.sidePanel.open(
        tab.windowId != null ? { tabId: tab.id, windowId: tab.windowId } : { tabId: tab.id },
      );
      return true;
    }

    if (tab.windowId != null) {
      await chromeWithSidePanel.sidePanel.open({ windowId: tab.windowId });
      return true;
    }

    this.logMissingSidePanelTarget(tab);
    return false;
  }

  private buildChromeSidePanelOpenOptions(
    tab?: chrome.tabs.Tab,
  ): { tabId?: number; windowId?: number } | null {
    if (tab?.id != null) {
      return tab.windowId != null ? { tabId: tab.id, windowId: tab.windowId } : { tabId: tab.id };
    }

    if (tab?.windowId != null) {
      return { windowId: tab.windowId };
    }

    return null;
  }

  private logMissingSidePanelTarget(tab?: chrome.tabs.Tab) {
    this.main.logService.warning(
      "[CommandsBackground] Missing tab and window identifiers for autofill shortcut.",
      { tabId: tab?.id, windowId: tab?.windowId },
    );
  }

  private async closeActivityBarAfterAutofillForTab(tab: chrome.tabs.Tab) {
    if (await this.closeChromeSidePanelForTab(tab)) {
      return;
    }

    this.closeExtensionActivityBarViews(tab);
  }

  private async closeChromeSidePanelForTab(tab: chrome.tabs.Tab): Promise<boolean> {
    if (tab.windowId == null || typeof chrome === "undefined") {
      return false;
    }

    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: ChromeSidePanelApi;
    };

    if (typeof chromeWithSidePanel.sidePanel?.close !== "function") {
      return false;
    }

    try {
      await chromeWithSidePanel.sidePanel.close({ windowId: tab.windowId });
      return true;
    } catch (error) {
      this.main.logService.error(
        "[CommandsBackground] Failed to close side panel after autofill shortcut unlock.",
        error,
      );
      return false;
    }
  }

  private closeExtensionActivityBarViews(tab: chrome.tabs.Tab) {
    const extensionViews = BrowserApi.getExtensionViews(
      tab.windowId != null ? { windowId: tab.windowId } : undefined,
    );

    for (const view of extensionViews) {
      if (!this.isActivityBarExtensionView(view)) {
        continue;
      }

      try {
        BrowserApi.closePopup(view);
      } catch (error) {
        this.main.logService.error(
          "[CommandsBackground] Failed to close activitybar after autofill shortcut unlock.",
          error,
        );
      }
    }
  }

  private isActivityBarExtensionView(view: Window): boolean {
    return (
      view.location.href.includes("uilocation=sidebar") ||
      view.location.href.includes("uilocation=sidepanel")
    );
  }

  private getExtensionGlobal(): Window & typeof globalThis {
    return (typeof self !== "undefined" ? self : globalThis) as Window & typeof globalThis;
  }

  private async openPopup() {
    // Chrome APIs cannot open popup
    if (!this.isSafari) {
      return;
    }

    await this.main.openPopup();
  }
}
