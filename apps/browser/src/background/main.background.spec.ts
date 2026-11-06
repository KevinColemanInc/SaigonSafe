import { DeepMockProxy, mockDeep } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import MainBackground from "./main.background";

// This test skips all the initialization of the background script and just
// focuses on making sure we don't accidentally delete the initialization of
// background vault syncing. This has happened before!
describe("MainBackground sync task scheduling", () => {
  it("includes code to schedule the sync interval task", () => {
    // Get the bootstrap method source code as string
    const bootstrapSource = MainBackground.prototype.bootstrap.toString();

    // Check that the source includes the critical sync interval scheduling code
    expect(bootstrapSource).toContain("this.backgroundSyncService.init();");
  });
});

describe("MainBackground logout", () => {
  const activeUserId = "active-user" as UserId;
  const otherUserId = "other-user" as UserId;
  let background: DeepMockProxy<MainBackground>;
  let authStatus: BehaviorSubject<AuthenticationStatus>;

  beforeEach(() => {
    // Exercise the real logout method without bootstrapping the browser background.
    background = mockDeep<MainBackground>();
    background.accountService.activeAccount$ = of({
      id: activeUserId,
      email: "active@example.com",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    });
    background.accountService.accounts$ = of({
      [activeUserId]: {
        email: "active@example.com",
        emailVerified: true,
        name: undefined,
        creationDate: undefined,
      },
      [otherUserId]: {
        email: "other@example.com",
        emailVerified: true,
        name: undefined,
        creationDate: undefined,
      },
    });
    background.accountService.nextUpAccount$ = of(null);
    authStatus = new BehaviorSubject(AuthenticationStatus.Locked);
    background.authService.authStatusFor$.mockReturnValue(authStatus);
    background.tokenService.clearTokens.mockImplementation(async () => {
      authStatus.next(AuthenticationStatus.LoggedOut);
    });
  });

  afterEach(() => {
    authStatus.complete();
  });

  it.each<[UserId | undefined, string, UserId]>([
    [undefined, "active@example.com", activeUserId],
    [activeUserId, "active@example.com", activeUserId],
    [otherUserId, "other@example.com", otherUserId],
  ])(
    "clears remembered 2FA for the account being logged out (%s)",
    async (userId, email, expectedUserId) => {
      background.switchAccount.mockImplementation(async () => {
        expect(background.tokenService.clearTwoFactorToken).toHaveBeenCalledWith(email);
      });
      background.accountService.clean.mockImplementation(async () => {
        expect(background.tokenService.clearTwoFactorToken).toHaveBeenCalledWith(email);
      });

      await MainBackground.prototype.logout.call(background, undefined, userId);

      expect(background.tokenService.clearTwoFactorToken).toHaveBeenCalledTimes(1);
      expect(background.tokenService.clearTwoFactorToken).toHaveBeenCalledWith(email);
      expect(background.tokenService.clearTokens).toHaveBeenCalledWith(expectedUserId);
      expect(background.messagingService.send).toHaveBeenCalledWith("doneLoggingOut", {
        logoutReason: undefined,
        userId: expectedUserId,
      });
    },
  );

  it("completes logout when the account no longer has an email", async () => {
    background.accountService.accounts$ = of({});

    await MainBackground.prototype.logout.call(background, "sessionExpired", activeUserId);

    expect(background.tokenService.clearTwoFactorToken).not.toHaveBeenCalled();
    expect(background.tokenService.clearTokens).toHaveBeenCalledWith(activeUserId);
  });
});
