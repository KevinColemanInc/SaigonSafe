import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

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

jest.mock("../auth/popup/utils/auth-popout-window", () => ({
  openUnlockPopout: jest.fn(),
}));

jest.mock("../platform/browser/browser-api", () => ({
  BrowserApi: {
    getSidebarAction: jest.fn(),
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
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of(null);
    lockService = mock<LockService>();

    sut = new CommandsBackground(
      main,
      platformUtilsService,
      authService,
      () => of("generated-password"),
      accountService,
      lockService,
    );

    chromeWithSidePanel = chrome as typeof chrome & { sidePanel?: any };
    delete chromeWithSidePanel.sidePanel;

    (BrowserApi.tabSendMessageData as jest.Mock).mockResolvedValue(undefined);
    (BrowserApi.getSidebarAction as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete chromeWithSidePanel.sidePanel;
  });

  it("uses the tab provided by the command listener when handling autofill shortcuts", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    const addListener = jest.fn();
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    (chrome as any).commands = {
      ...(chrome.commands as any),
      onCommand: { addListener },
    } as any;

    sut.init();

    const listener = addListener.mock.calls[0][0];
    await listener(ExtensionCommand.AutofillLogin, tab);

    expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
      tab,
      ExtensionCommand.AutofillCommand,
    );
    expect(BrowserApi.getTabFromCurrentWindowId).not.toHaveBeenCalled();
  });

  it("opens the side panel for the active tab and queues the retry when autofill is triggered while locked", async () => {
    const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    chromeWithSidePanel.sidePanel = {
      open: jest.fn().mockResolvedValue(undefined),
    };

    await (sut as any).processCommand(ExtensionCommand.AutofillLogin, { tab });

    expect(chromeWithSidePanel.sidePanel.open).toHaveBeenCalledWith({ tabId: 7 });
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

    expect(logService.error).toHaveBeenCalledWith(error);
    expect(openUnlockPopout).toHaveBeenCalledWith(tab, {
      commandToRetry: {
        message: { command: ExtensionCommand.AutofillLogin },
        sender: { tab },
      },
      target: "commands.background",
    });
  });
});
