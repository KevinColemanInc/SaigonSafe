import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../platform/browser/browser-api";

export const VAULT_SIDE_PANEL_PATH = "popup/index.html?uilocation=sidepanel";

/** Opens the vault in a persistent, full-height surface from the toolbar. */
export class ToolbarBackground {
  constructor(private logService: LogService) {}

  init(): void {
    // Register synchronously so MV3 can wake the worker for toolbar clicks.
    BrowserApi.getBrowserAction().onClicked.addListener(() => {
      void this.openVault().catch((error) => this.logService.error(error));
    });

    if (BrowserApi.isSidePanelApiSupported) {
      void this.configureSidePanel().catch((error) => this.logService.error(error));
    }
  }

  private async configureSidePanel(): Promise<void> {
    await BrowserApi.setSidePanelOptions({ path: VAULT_SIDE_PANEL_PATH, enabled: true });
    // Chrome handles the gesture itself, including when waking a suspended worker.
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  private async openVault(): Promise<void> {
    if (BrowserApi.isSidePanelApiSupported) {
      return; // The browser's native toolbar behavior opens the panel.
    }

    if (typeof browser !== "undefined" && browser.sidebarAction?.open) {
      // Invoke before any await to preserve Firefox's user gesture.
      await browser.sidebarAction.open();
      return;
    }

    // Browsers without a sidebar use a full tab, reusing an existing vault tab.
    const url = BrowserApi.getRuntimeURL("popup/index.html?uilocation=tab");
    const [tab] = await BrowserApi.tabsQuery({ url: `${url}*` });
    if (tab?.id != null) {
      await BrowserApi.focusWindow(tab.windowId);
      await BrowserApi.focusTab(tab.id);
    } else {
      await BrowserApi.createNewTab(url);
    }
  }
}
