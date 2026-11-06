import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../platform/browser/browser-api";

import { ToolbarBackground, VAULT_SIDE_PANEL_PATH } from "./toolbar.background";

describe("ToolbarBackground", () => {
  const log = mock<LogService>();
  let click: () => void;
  let sidebarOpen: jest.Mock;
  let setPanelBehavior: jest.Mock;

  beforeEach(() => {
    jest.spyOn(BrowserApi, "getBrowserAction").mockReturnValue({
      onClicked: { addListener: (listener: () => void) => (click = listener) },
    } as unknown as typeof chrome.action);
    jest.spyOn(BrowserApi, "isSidePanelApiSupported", "get").mockReturnValue(false);
    jest.spyOn(BrowserApi, "setSidePanelOptions").mockResolvedValue(undefined);
    sidebarOpen = jest.fn().mockResolvedValue(undefined);
    setPanelBehavior = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      value: { sidebarAction: { open: sidebarOpen } },
    });
    Object.defineProperty(chrome, "sidePanel", {
      configurable: true,
      value: { setPanelBehavior },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "browser");
    Reflect.deleteProperty(chrome, "sidePanel");
    jest.clearAllMocks();
  });

  it("enables Chrome's native toolbar side panel behavior", async () => {
    jest.spyOn(BrowserApi, "isSidePanelApiSupported", "get").mockReturnValue(true);
    new ToolbarBackground(log).init();
    await Promise.resolve();

    expect(BrowserApi.setSidePanelOptions).toHaveBeenCalledWith({
      path: VAULT_SIDE_PANEL_PATH,
      enabled: true,
    });
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
    click();
    expect(sidebarOpen).not.toHaveBeenCalled();
  });

  it("opens Firefox's sidebar synchronously within the toolbar gesture", () => {
    new ToolbarBackground(log).init();
    click();

    expect(sidebarOpen).toHaveBeenCalledTimes(1);
  });

  it("opens a full tab on browsers without a side pane", async () => {
    Reflect.deleteProperty(globalThis, "browser");
    jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);
    const createTab = jest
      .spyOn(BrowserApi, "createNewTab")
      .mockResolvedValue({} as chrome.tabs.Tab);
    new ToolbarBackground(log).init();
    click();
    await Promise.resolve();

    expect(createTab).toHaveBeenCalledWith("chrome-extension://id/popup/index.html?uilocation=tab");
  });

  it("focuses an existing full vault tab on subsequent clicks", async () => {
    Reflect.deleteProperty(globalThis, "browser");
    jest
      .spyOn(BrowserApi, "tabsQuery")
      .mockResolvedValue([{ id: 7, windowId: 3 } as chrome.tabs.Tab]);
    const focusWindow = jest.spyOn(BrowserApi, "focusWindow").mockResolvedValue(undefined);
    const focusTab = jest.spyOn(BrowserApi, "focusTab").mockResolvedValue(undefined);
    const createTab = jest.spyOn(BrowserApi, "createNewTab");
    new ToolbarBackground(log).init();
    click();
    await Promise.resolve();
    await Promise.resolve();

    expect(focusWindow).toHaveBeenCalledWith(3);
    expect(focusTab).toHaveBeenCalledWith(7);
    expect(createTab).not.toHaveBeenCalled();
  });
});
