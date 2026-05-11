import { MockProxy, mock } from "jest-mock-extended";

import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LogService } from "@bitwarden/logging";

import { BrowserApi } from "../browser/browser-api";

import { BrowserActionsService } from "./browser-actions.service";

describe("BrowserActionsService", () => {
  let logService: MockProxy<LogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let service: BrowserActionsService;
  let chromeWithSidePanel: typeof chrome & { sidePanel?: any };

  beforeEach(() => {
    logService = mock<LogService>();
    platformUtilsService = mock<PlatformUtilsService>();
    service = new BrowserActionsService(logService, platformUtilsService);
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

    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };

    service.init();

    const onClickedListener = addListener.mock.calls[0][0];
    await onClickedListener({ windowId: 37 });

    expect(sidePanelOpen).toHaveBeenCalledWith({ windowId: 37 });
  });

  it("opens the Chrome side panel in the current window when triggered programmatically", async () => {
    platformUtilsService.getDevice.mockReturnValue(DeviceType.ChromeExtension);
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    jest.spyOn(BrowserApi, "getCurrentWindow").mockResolvedValue({
      id: 12,
    } as chrome.windows.Window);

    await service.openPopup();

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
});
