import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions/actions-service";
import { LogService } from "@bitwarden/logging";

import { SafariApp } from "../../browser/safariApp";
import { BrowserApi } from "../browser/browser-api";

type ChromeSidePanelApi = {
  open?: (options: { windowId: number }) => Promise<void>;
};

export class BrowserActionsService implements ActionsService {
  constructor(
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  init(): void {
    const deviceType = this.platformUtilsService.getDevice();
    if (deviceType !== DeviceType.ChromeExtension && deviceType !== DeviceType.FirefoxExtension) {
      return;
    }

    const browserAction = BrowserApi.getBrowserAction();
    browserAction.onClicked?.addListener((tab) => {
      void this.openExtensionView(tab?.windowId);
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

  private async openExtensionView(windowId?: number): Promise<void> {
    const deviceType = this.platformUtilsService.getDevice();

    switch (deviceType) {
      case DeviceType.ChromeExtension:
        await this.openChromeSidePanel(windowId);
        return;
      case DeviceType.FirefoxExtension:
        await this.openFirefoxSidebar();
        return;
      default:
        return;
    }
  }

  private async openChromeSidePanel(windowId?: number): Promise<void> {
    const chromeWithSidePanel = chrome as typeof chrome & {
      sidePanel?: ChromeSidePanelApi;
    };

    if (typeof chromeWithSidePanel.sidePanel?.open !== "function") {
      this.logService.warning("No sidePanel.open function found on the Chrome extension runtime.");
      return;
    }

    const targetWindowId = windowId ?? (await BrowserApi.getCurrentWindow())?.id;
    if (targetWindowId == null) {
      this.logService.warning(
        "Unable to determine the current browser window for side panel open.",
      );
      return;
    }

    await chromeWithSidePanel.sidePanel.open({ windowId: targetWindowId });
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
}
