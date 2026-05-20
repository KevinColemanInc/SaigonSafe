import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LogService } from "@bitwarden/logging";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../browser/browser-api";

import { BrowserActionsService } from "./browser-actions.service";

const MAIN_SIDE_PANEL_PATH = "popup/index.html?uilocation=sidebar";

jest.mock("../../auth/popup/utils/auth-popout-window", () => ({
  openUnlockPopout: jest.fn(),
}));

describe("BrowserActionsService", () => {
  let authService: MockProxy<AuthService>;
  let logService: MockProxy<LogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let service: BrowserActionsService;
  let chromeWithSidePanel: typeof chrome & { sidePanel?: any };

  beforeEach(() => {
    authService = mock<AuthService>();
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    logService = mock<LogService>();
    platformUtilsService = mock<PlatformUtilsService>();
    service = new BrowserActionsService(logService, platformUtilsService, authService);
    chromeWithSidePanel = chrome as typeof chrome & { sidePanel?: any };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete chromeWithSidePanel.sidePanel;
  });

  it("registers a Chrome toolbar click handler that opens the side panel in the clicked window", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.ChromeExtension);
    const addListener = jest.fn();
    jest.spyOn(BrowserApi, "getBrowserAction").mockReturnValue({
      onClicked: { addListener },
    } as unknown as ReturnType<typeof BrowserApi.getBrowserAction>);
    jest.spyOn(BrowserApi, "setSidePanelOptions").mockResolvedValue(undefined);

    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };

    service.init();

    const onClickedListener = addListener.mock.calls[0][0];
    await onClickedListener({ id: 8, windowId: 37 });

    expect(BrowserApi.setSidePanelOptions).toHaveBeenCalledWith({
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
      tabId: 8,
    });
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 8, windowId: 37 });
  });

  it("opens the Chrome side panel on repeated toolbar clicks instead of toggling it closed", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.ChromeExtension);
    const addListener = jest.fn();
    jest.spyOn(BrowserApi, "getBrowserAction").mockReturnValue({
      onClicked: { addListener },
    } as unknown as ReturnType<typeof BrowserApi.getBrowserAction>);
    jest.spyOn(BrowserApi, "setSidePanelOptions").mockResolvedValue(undefined);

    const sidePanelClose = jest.fn().mockResolvedValue(undefined);
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    chromeWithSidePanel.sidePanel = {
      close: sidePanelClose,
      open: sidePanelOpen,
    };

    service.init();

    const onClickedListener = addListener.mock.calls[0][0];
    await onClickedListener({ id: 8, windowId: 37 });
    await onClickedListener({ id: 8, windowId: 37 });

    expect(BrowserApi.setSidePanelOptions).toHaveBeenNthCalledWith(1, {
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
      tabId: 8,
    });
    expect(BrowserApi.setSidePanelOptions).toHaveBeenNthCalledWith(2, {
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
      tabId: 8,
    });
    expect(sidePanelClose).not.toHaveBeenCalled();
    expect(sidePanelOpen).toHaveBeenNthCalledWith(1, { tabId: 8, windowId: 37 });
    expect(sidePanelOpen).toHaveBeenNthCalledWith(2, { tabId: 8, windowId: 37 });
  });

  it("opens the Chrome side panel in the current window when triggered programmatically", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.ChromeExtension);
    jest.spyOn(BrowserApi, "setSidePanelOptions").mockResolvedValue(undefined);
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue({
      id: 11,
      windowId: 12,
    } as chrome.tabs.Tab);

    await service.openPopup();

    expect(BrowserApi.setSidePanelOptions).toHaveBeenCalledWith({
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
      tabId: 11,
    });
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 11, windowId: 12 });
  });

  it("falls back to the current window when triggered programmatically without an active tab", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.ChromeExtension);
    jest.spyOn(BrowserApi, "setSidePanelOptions").mockResolvedValue(undefined);
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "getCurrentWindow").mockResolvedValue({
      id: 12,
    } as chrome.windows.Window);

    await service.openPopup();

    expect(BrowserApi.setSidePanelOptions).toHaveBeenCalledWith({
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
    });
    expect(sidePanelOpen).toHaveBeenCalledWith({ windowId: 12 });
  });

  it("opens the Firefox sidebar when triggered programmatically", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);
    const sidebarOpen = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "getSidebarAction").mockReturnValue({
      open: sidebarOpen,
    } as unknown as ReturnType<typeof BrowserApi.getSidebarAction>);

    await service.openPopup();

    expect(sidebarOpen).toHaveBeenCalled();
  });

  it("toggles the Firefox sidebar when the toolbar icon is clicked", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);
    const addListener = jest.fn();
    const sidebarOpen = jest.fn().mockResolvedValue(undefined);
    const sidebarToggle = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "getBrowserAction").mockReturnValue({
      onClicked: { addListener },
    } as unknown as ReturnType<typeof BrowserApi.getBrowserAction>);
    jest.spyOn(BrowserApi, "getSidebarAction").mockReturnValue({
      open: sidebarOpen,
      toggle: sidebarToggle,
    } as unknown as ReturnType<typeof BrowserApi.getSidebarAction>);

    service.init();

    const onClickedListener = addListener.mock.calls[0][0];
    await onClickedListener({ id: 11, windowId: 12 });

    expect(sidebarToggle).toHaveBeenCalled();
    expect(sidebarOpen).not.toHaveBeenCalled();
  });

  it("opens the Firefox unlock popout instead of the sidebar when locked", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);
    const sidebarOpen = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "getSidebarAction").mockReturnValue({
      open: sidebarOpen,
    } as unknown as ReturnType<typeof BrowserApi.getSidebarAction>);
    jest.spyOn(BrowserApi, "getBrowserAction").mockReturnValue({
      onClicked: { addListener: jest.fn() },
    } as unknown as ReturnType<typeof BrowserApi.getBrowserAction>);
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue({
      id: 11,
      windowId: 12,
    } as chrome.tabs.Tab);

    service.init();
    await service.openPopup();

    expect(sidebarOpen).not.toHaveBeenCalled();
    expect(openUnlockPopout).toHaveBeenCalledWith({ id: 11, windowId: 12 });
  });
});
