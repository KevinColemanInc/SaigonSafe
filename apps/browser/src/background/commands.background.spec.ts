import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../platform/browser/browser-api";

import CommandsBackground from "./commands.background";
import type MainBackground from "./main.background";

const MAIN_SIDE_PANEL_PATH = "popup/index.html?uilocation=sidebar";

jest.mock("../auth/popup/utils/auth-popout-window", () => ({
  openUnlockPopout: jest.fn(),
}));

jest.mock("../platform/browser/browser-api", () => ({
  BrowserApi: {
    getSidebarAction: jest.fn(),
    closePopup: jest.fn(),
    getExtensionViews: jest.fn(),
    setSidePanelOptions: jest.fn(),
    getTabFromCurrentWindowId: jest.fn(),
    messageListener: jest.fn(),
    tabSendMessageData: jest.fn(),
  },
}));

describe("CommandsBackground", () => {
  let main: MainBackground;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let authService: MockProxy<AuthService>;
  let accountService: MockProxy<AccountService>;
  let lockService: MockProxy<LockService>;
  let sut: CommandsBackground;
  let chromeWithSidePanel: typeof chrome & { sidePanel?: any };
  let logService: MockProxy<LogService>;

  const createSut = () =>
    new CommandsBackground(
      main,
      platformUtilsService,
      authService,
      () => of("generated-password"),
      accountService,
      lockService,
    );
  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    logService = mock<LogService>();
    main = {
      collectPageDetailsForContentScript: jest.fn(),
      openPopup: jest.fn(),
      logService,
    } as unknown as MainBackground;

    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.isVivaldi.mockReturnValue(false);
    platformUtilsService.isChrome.mockReturnValue(false);
    platformUtilsService.isFirefox.mockReturnValue(false);

    authService = mock<AuthService>();
    authService.activeAccountStatus$ = of(AuthenticationStatus.LoggedOut);
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of(null);
    lockService = mock<LockService>();

    sut = createSut();

    chromeWithSidePanel = chrome as typeof chrome & { sidePanel?: any };
    delete chromeWithSidePanel.sidePanel;

    (BrowserApi.setSidePanelOptions as jest.Mock).mockResolvedValue(undefined);
    (BrowserApi.tabSendMessageData as jest.Mock).mockResolvedValue(undefined);
    (BrowserApi.getSidebarAction as jest.Mock).mockReturnValue(null);
    (BrowserApi.getExtensionViews as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete chromeWithSidePanel.sidePanel;
  });

  it("uses the tab provided by the command listener when handling autofill shortcuts", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(BrowserApi.getTabFromCurrentWindowId).not.toHaveBeenCalled();
  });

  it("does not open the Firefox sidebar for the autofill login shortcut when unlocked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidebarOpen = jest.fn().mockResolvedValue(undefined);
    platformUtilsService.isFirefox.mockReturnValue(true);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    (BrowserApi.getSidebarAction as jest.Mock).mockReturnValue({ open: sidebarOpen });
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(authService.getAuthStatus).not.toHaveBeenCalled();
    expect(sidebarOpen).not.toHaveBeenCalled();
    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(BrowserApi.tabSendMessageData).not.toHaveBeenCalled();
    expect(openUnlockPopout).not.toHaveBeenCalled();
  });

  it("opens the Firefox unlock popout for the autofill login shortcut when locked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidebarOpen = jest.fn().mockResolvedValue(undefined);
    platformUtilsService.isFirefox.mockReturnValue(true);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);
    (BrowserApi.getSidebarAction as jest.Mock).mockReturnValue({ open: sidebarOpen });
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(authService.getAuthStatus).not.toHaveBeenCalled();
    expect(sidebarOpen).not.toHaveBeenCalled();
    expect(BrowserApi.tabSendMessageData).not.toHaveBeenCalled();
    expect(openUnlockPopout).toHaveBeenCalledWith(tab, {
      commandToRetry: {
        message: {
          command: ExtensionCommand.AutofillLogin,
          closeActivityBarAfterAutofill: true,
        },
        sender: { tab },
      },
      target: "commands.background",
    });
  });

  it("does not open the Chrome side panel for the autofill login shortcut when unlocked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(authService.getAuthStatus).not.toHaveBeenCalled();
    expect(BrowserApi.setSidePanelOptions).not.toHaveBeenCalled();
    expect(sidePanelOpen).not.toHaveBeenCalled();
    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(openUnlockPopout).not.toHaveBeenCalled();
  });

  it("does not open the Chrome side panel for the autofill login shortcut when logged out", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    authService.activeAccountStatus$ = of(AuthenticationStatus.LoggedOut);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(authService.getAuthStatus).not.toHaveBeenCalled();
    expect(BrowserApi.setSidePanelOptions).not.toHaveBeenCalled();
    expect(sidePanelOpen).not.toHaveBeenCalled();
    expect(openUnlockPopout).toHaveBeenCalledWith(tab, {
      commandToRetry: {
        message: {
          command: ExtensionCommand.AutofillLogin,
          closeActivityBarAfterAutofill: true,
        },
        sender: { tab },
      },
      target: "commands.background",
    });
  });

  it("always opens the Chrome side panel for the autofill login shortcut and queues the retry when locked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(authService.getAuthStatus).not.toHaveBeenCalled();
    expect(BrowserApi.setSidePanelOptions).toHaveBeenCalledWith({
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
      tabId: 7,
    });
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 7, windowId: 3 });
    expect(BrowserApi.tabSendMessageData).toHaveBeenNthCalledWith(
      1,
      tab,
      "addToLockedVaultPendingNotifications",
      {
        commandToRetry: {
          message: {
            command: ExtensionCommand.AutofillLogin,
            closeActivityBarAfterAutofill: true,
          },
          sender: { tab },
        },
        target: "commands.background",
      },
    );
    expect(BrowserApi.tabSendMessageData).toHaveBeenNthCalledWith(
      2,
      tab,
      "bgUnlockPopoutOpened",
      {},
    );
    expect(openUnlockPopout).not.toHaveBeenCalled();
  });

  it("keeps the active auth status cached and skips shortcut side panel opens when unlocked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidePanelOpen = jest.fn().mockResolvedValue(undefined);
    const activeAccountStatus$ = new BehaviorSubject(AuthenticationStatus.Locked);
    authService.activeAccountStatus$ = activeAccountStatus$;
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    chromeWithSidePanel.sidePanel = {
      open: sidePanelOpen,
    };
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();
    activeAccountStatus$.next(AuthenticationStatus.Unlocked);

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(authService.getAuthStatus).not.toHaveBeenCalled();
    expect(BrowserApi.setSidePanelOptions).not.toHaveBeenCalled();
    expect(sidePanelOpen).not.toHaveBeenCalled();
    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(BrowserApi.tabSendMessageData).not.toHaveBeenCalled();
  });

  it("uses the runtime unlocked message to avoid opening the Firefox sidebar on the next autofill shortcut", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const sidebarOpen = jest.fn().mockResolvedValue(undefined);
    const activeAccountStatus$ = new BehaviorSubject(AuthenticationStatus.Locked);
    platformUtilsService.isFirefox.mockReturnValue(true);
    authService.activeAccountStatus$ = activeAccountStatus$;
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    (BrowserApi.getSidebarAction as jest.Mock).mockReturnValue({ open: sidebarOpen });
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const messageHandler = (BrowserApi.messageListener as jest.Mock).mock.calls[0][1];
    messageHandler({ command: "unlocked" });

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(sidebarOpen).not.toHaveBeenCalled();
    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(BrowserApi.tabSendMessageData).not.toHaveBeenCalled();
    expect(openUnlockPopout).not.toHaveBeenCalled();
  });

  it("autofills and closes the Chrome side panel after a shortcut unlock retry", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const sidePanelClose = jest.fn().mockResolvedValue(undefined);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    chromeWithSidePanel.sidePanel = {
      close: sidePanelClose,
    };
    sut = createSut();

    sut.init();

    const messageHandler = (BrowserApi.messageListener as jest.Mock).mock.calls[0][1];
    messageHandler({
      command: "unlockCompleted",
      data: {
        target: "commands.background",
        commandToRetry: {
          message: {
            command: ExtensionCommand.AutofillLogin,
            closeActivityBarAfterAutofill: true,
          },
          sender: { tab },
        },
      },
    });
    await flushPromises();

    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(sidePanelClose).toHaveBeenCalledWith({ windowId: 3 });
  });

  it("autofills and closes Firefox activitybar views after a shortcut unlock retry", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const activityBarView = {
      location: { href: "moz-extension://extension-id/popup/index.html?uilocation=sidebar#/lock" },
    } as unknown as Window;
    const nonActivityBarView = {
      location: { href: "moz-extension://extension-id/background.html" },
    } as unknown as Window;
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    (BrowserApi.getExtensionViews as jest.Mock).mockReturnValue([
      activityBarView,
      nonActivityBarView,
    ]);
    sut = createSut();

    sut.init();

    const messageHandler = (BrowserApi.messageListener as jest.Mock).mock.calls[0][1];
    messageHandler({
      command: "unlockCompleted",
      data: {
        target: "commands.background",
        commandToRetry: {
          message: {
            command: ExtensionCommand.AutofillLogin,
            closeActivityBarAfterAutofill: true,
          },
          sender: { tab },
        },
      },
    });
    await flushPromises();

    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(BrowserApi.getExtensionViews).toHaveBeenCalledWith({ windowId: 3 });
    expect(BrowserApi.closePopup).toHaveBeenCalledWith(activityBarView);
    expect(BrowserApi.closePopup).not.toHaveBeenCalledWith(nonActivityBarView);
  });

  it("does not close the activitybar after an ordinary unlock retry", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const sidePanelClose = jest.fn().mockResolvedValue(undefined);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    chromeWithSidePanel.sidePanel = {
      close: sidePanelClose,
    };
    sut = createSut();

    sut.init();

    const messageHandler = (BrowserApi.messageListener as jest.Mock).mock.calls[0][1];
    messageHandler({
      command: "unlockCompleted",
      data: {
        target: "commands.background",
        commandToRetry: {
          message: { command: ExtensionCommand.AutofillLogin },
          sender: { tab },
        },
      },
    });
    await flushPromises();

    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(sidePanelClose).not.toHaveBeenCalled();
    expect(BrowserApi.getExtensionViews).not.toHaveBeenCalled();
  });

  it("never opens the unlock popout in Firefox when the sidebar cannot be opened", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    platformUtilsService.isFirefox.mockReturnValue(true);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(logService.error).toHaveBeenCalledWith(
      "[CommandsBackground] Firefox sidebarAction.open is unavailable for autofill shortcut.",
    );
    expect(openUnlockPopout).not.toHaveBeenCalled();
    expect(BrowserApi.tabSendMessageData).not.toHaveBeenCalled();
  });

  it("logs Firefox sidebar open rejections without opening the unlock popout", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    const error = new Error("sidebar rejected");
    const sidebarOpen = jest.fn().mockRejectedValue(error);
    platformUtilsService.isFirefox.mockReturnValue(true);
    authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);
    (BrowserApi.getSidebarAction as jest.Mock).mockReturnValue({ open: sidebarOpen });
    sut = createSut();
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    listener(ExtensionCommand.AutofillLogin, tab);
    await flushPromises();

    expect(sidebarOpen).toHaveBeenCalled();
    expect(logService.error).toHaveBeenCalledWith(
      "[CommandsBackground] Firefox failed to open sidebar for autofill shortcut.",
      error,
    );
    expect(openUnlockPopout).not.toHaveBeenCalled();
  });

  it("opens the side panel for the active tab and queues the retry when autofill is triggered while locked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    chromeWithSidePanel.sidePanel = {
      open: jest.fn().mockResolvedValue(undefined),
    };

    await (sut as any).processCommand(ExtensionCommand.AutofillLogin, { tab });

    expect(BrowserApi.setSidePanelOptions).toHaveBeenCalledWith({
      enabled: true,
      path: MAIN_SIDE_PANEL_PATH,
      tabId: 7,
    });
    expect(chromeWithSidePanel.sidePanel.open).toHaveBeenCalledWith({ tabId: 7, windowId: 3 });
    expect(BrowserApi.tabSendMessageData).toHaveBeenNthCalledWith(
      1,
      tab,
      "addToLockedVaultPendingNotifications",
      {
        commandToRetry: {
          message: { command: ExtensionCommand.AutofillLogin },
          sender: { tab },
        },
        target: "commands.background",
      },
    );
    expect(BrowserApi.tabSendMessageData).toHaveBeenNthCalledWith(
      2,
      tab,
      "bgUnlockPopoutOpened",
      {},
    );
    expect(openUnlockPopout).not.toHaveBeenCalled();
    expect(main.openPopup).not.toHaveBeenCalled();
    expect(main.collectPageDetailsForContentScript).not.toHaveBeenCalled();
  });

  it("falls back to the unlock popout when the locked extension view is unavailable", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);

    await (sut as any).processCommand(ExtensionCommand.AutofillLogin, { tab });

    expect(logService.warning).toHaveBeenCalledWith(
      "[CommandsBackground] No side panel/sidebar API available for locked autofill shortcut.",
    );
    expect(openUnlockPopout).toHaveBeenCalledWith(tab, {
      commandToRetry: {
        message: { command: ExtensionCommand.AutofillLogin },
        sender: { tab },
      },
      target: "commands.background",
    });
    expect(main.openPopup).not.toHaveBeenCalled();
    expect(BrowserApi.tabSendMessageData).not.toHaveBeenCalled();
  });

  it("falls back to the unlock popout when opening the extension view fails", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const error = new Error("user gesture required");
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    chromeWithSidePanel.sidePanel = {
      open: jest.fn().mockRejectedValue(error),
    };

    await (sut as any).processCommand(ExtensionCommand.AutofillLogin, { tab });

    expect(logService.error).toHaveBeenCalledWith(
      "[CommandsBackground] Failed to open side panel/sidebar for locked autofill shortcut.",
      error,
    );
    expect(openUnlockPopout).toHaveBeenCalledWith(tab, {
      commandToRetry: {
        message: { command: ExtensionCommand.AutofillLogin },
        sender: { tab },
      },
      target: "commands.background",
    });
  });

  it("logs side panel options failures to the console", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const error = new Error("setOptions failed");
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    chromeWithSidePanel.sidePanel = {
      open: jest.fn().mockResolvedValue(undefined),
    };
    (BrowserApi.setSidePanelOptions as jest.Mock).mockRejectedValue(error);

    await (sut as any).processCommand(ExtensionCommand.AutofillLogin, { tab });
    await Promise.resolve();

    expect(logService.error).toHaveBeenCalledWith(
      "[CommandsBackground] Failed to enable side panel options for locked autofill shortcut.",
      error,
    );
  });
});
