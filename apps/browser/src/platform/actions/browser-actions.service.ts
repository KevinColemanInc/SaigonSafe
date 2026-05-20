import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions/actions-service";
import { LogService } from "@bitwarden/logging";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { SafariApp } from "../../browser/safariApp";
import { BrowserApi } from "../browser/browser-api";

const MAIN_SIDE_PANEL_PATH = "popup/index.html?uilocation=sidebar";

type ChromeSidePanelApi = {
  open?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
};

export class BrowserActionsService implements ActionsService {
  private activeAccountStatus: AuthenticationStatus | null = null;

  constructor(
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private authService: AuthService,
  ) {}

  init(): void {
    const deviceType = this.platformUtilsService.getDevice();
    if (deviceType !== DeviceType.ChromeExtension && deviceType !== DeviceType.FirefoxExtension) {
      return;
    }

    this.authService.activeAccountStatus$.subscribe((status) => {
      this.activeAccountStatus = status;
    });

    const browserAction = BrowserApi.getBrowserAction();
    browserAction.onClicked?.addListener((tab) => {
      void this.openExtensionView(tab, true);
    });
  }

  async openPopup(): Promise<void> {
    const deviceType = this.platformUtilsService.getDevice();

    try {
      switch (deviceType) {
        case DeviceType.FirefoxExtension:
        case DeviceType.ChromeExtension:
          await this.openExtensionView();
          return;
        case DeviceType.SafariExtension:
          await SafariApp.sendMessageToApp("showPopover", null, true);
          return;
        default:
          this.logService.warning(
            `Tried to open the popup from an unsupported device type: ${DeviceType[deviceType]}`,
          );
      }
    } catch (e) {
      this.logService.error(
        `Failed to open the popup on ${DeviceType[deviceType]} with manifest ${BrowserApi.manifestVersion} and error: ${e}`,
      );
    }
  }

  private async openExtensionView(
    tab?: chrome.tabs.Tab,
    toggleFirefoxSidebarOnClick = false,
  ): Promise<void> {
    const deviceType = this.platformUtilsService.getDevice();

    switch (deviceType) {
      case DeviceType.ChromeExtension:
        await this.openChromeSidePanel(tab);
        return;
      case DeviceType.FirefoxExtension:
        if (this.activeAccountStatus != null && this.activeAccountStatus < AuthenticationStatus.Unlocked) {
          await this.openFirefoxUnlockPopout(tab);
          return;
        }
        if (toggleFirefoxSidebarOnClick) {
          await this.toggleFirefoxSidebar();
          return;
        }
        await this.openFirefoxSidebar();
        return;
      default:
        return;
    }
  }

  private async openChromeSidePanel(tab?: chrome.tabs.Tab): Promise<void> {
    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: ChromeSidePanelApi;
    };

    if (typeof chromeWithSidePanel.sidePanel?.open !== "function") {
      this.logService.warning("No sidePanel.open function found on the Chrome extension runtime.");
      return;
    }

    const currentTab = tab ?? (await BrowserApi.getTabFromCurrentWindow());
    const targetTabId = currentTab?.id;
    const targetWindowId = currentTab?.windowId ?? (await BrowserApi.getCurrentWindow())?.id;
    if (targetWindowId == null) {
      this.logService.warning(
        "Unable to determine the current browser window for side panel open.",
      );
      return;
    }

    // Dispatch options update in the same turn so Chrome preserves the user gesture for `open`.
    void BrowserApi.setSidePanelOptions({
      path: MAIN_SIDE_PANEL_PATH,
      enabled: true,
      ...(targetTabId != null ? { tabId: targetTabId } : {}),
    });

    await chromeWithSidePanel.sidePanel.open(
      targetTabId != null
        ? { tabId: targetTabId, windowId: targetWindowId }
        : { windowId: targetWindowId },
    );
  }

  private async openFirefoxSidebar(): Promise<void> {
    const sidebarAction = BrowserApi.getSidebarAction(self);
    if (typeof (sidebarAction as FirefoxSidebarAction | null)?.open !== "function") {
      this.logService.warning(
        "No sidebarAction.open function found on the Firefox extension runtime.",
      );
      return;
    }

    await (sidebarAction as FirefoxSidebarAction).open();
  }

  private async toggleFirefoxSidebar(): Promise<void> {
    const sidebarAction = BrowserApi.getSidebarAction(self) as FirefoxSidebarAction | null;
    if (typeof sidebarAction?.toggle === "function") {
      await sidebarAction.toggle();
      return;
    }

    if (typeof sidebarAction?.isOpen === "function" && typeof sidebarAction?.close === "function") {
      if (await sidebarAction.isOpen({})) {
        await sidebarAction.close();
        return;
      }
    }

    await this.openFirefoxSidebar();
  }

  private async openFirefoxUnlockPopout(tab?: chrome.tabs.Tab): Promise<void> {
    const currentTab = tab ?? (await BrowserApi.getTabFromCurrentWindow());

    if (currentTab == null) {
      this.logService.warning("Unable to determine the current tab for Firefox unlock popout.");
      return;
    }

    await openUnlockPopout(currentTab);
  }
}
