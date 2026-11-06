import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, filter } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { LocalSecurityReport, LocalSecurityReportService } from "./local-security-report.service";

describe("LocalSecurityReportService", () => {
  const userId = "00000000-0000-4000-8000-000000000001" as UserId;
  let account$: BehaviorSubject<Account | null>;
  let ciphers$: BehaviorSubject<CipherView[]>;
  let status$: BehaviorSubject<AuthenticationStatus>;
  const riskService = mock<CipherRiskService>();
  let service: LocalSecurityReportService;

  function login(id: string, name = "Login") {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.name = name;
    cipher.login.password = "secret";
    return cipher;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    account$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    ciphers$ = new BehaviorSubject<CipherView[]>([]);
    status$ = new BehaviorSubject(AuthenticationStatus.Unlocked);
    riskService.buildPasswordReuseMap.mockResolvedValue({});
    riskService.computeRiskForCiphers.mockResolvedValue([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { activeAccount$: account$ } },
        { provide: AuthService, useValue: { activeAccountStatus$: status$ } },
        { provide: CipherService, useValue: { cipherViews$: () => ciphers$ } },
        { provide: CipherRiskService, useValue: riskService },
      ],
    });
    service = TestBed.inject(LocalSecurityReportService);
  });

  it("reports weak, reused passwords and HTTP logins without checking breaches online", async () => {
    const cipher = login("00000000-0000-4000-8000-000000000002");
    const uri = new LoginUriView();
    uri.uri = "http://example.com";
    cipher.login.uris = [uri];
    ciphers$.next([cipher]);
    riskService.computeRiskForCiphers.mockResolvedValue([
      {
        id: asUuid(cipher.id),
        password_strength: 1,
        reuse_count: 2,
        exposed_result: { type: "NotChecked" },
      },
    ]);
    const result = await firstValueFrom(service.report$.pipe(filter((report) => !report.loading)));
    expect(result.findings).toEqual([
      { id: cipher.id, name: "Login", weak: true, reused: true, insecure: true },
    ]);
    expect(result.checked).toBe(1);
    expect(riskService.computeRiskForCiphers).toHaveBeenCalledWith([cipher], userId, {
      passwordMap: {},
      checkExposed: false,
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("excludes deleted, hidden, reprompt-protected and undecryptable items", async () => {
    const hidden = login("hidden");
    hidden.viewPassword = false;
    const deleted = login("deleted");
    deleted.deletedDate = new Date();
    const protectedLogin = login("protected");
    protectedLogin.reprompt = CipherRepromptType.Password;
    const broken = login("broken");
    broken.decryptionFailure = true;
    ciphers$.next([hidden, deleted, protectedLogin, broken]);
    const result = await firstValueFrom(service.report$.pipe(filter((report) => !report.loading)));
    expect(result.checked).toBe(0);
    expect(riskService.buildPasswordReuseMap).toHaveBeenCalledWith([], userId);
  });

  it("clears findings immediately on sign out and ignores an older account's pending result", async () => {
    ciphers$.next([login("pending")]);
    let resolve!: (value: []) => void;
    riskService.computeRiskForCiphers.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const results: LocalSecurityReport[] = [];
    const subscription = service.report$.subscribe((report) => results.push(report));
    await Promise.resolve();
    account$.next(null);
    expect(results.at(-1)).toEqual({ loading: false, failed: false, checked: 0, findings: [] });
    resolve([]);
    await Promise.resolve();
    expect(results.at(-1)?.checked).toBe(0);
    subscription.unsubscribe();
  });

  it("clears report data immediately when the vault locks", async () => {
    const cipher = login("00000000-0000-4000-8000-000000000002");
    ciphers$.next([cipher]);
    riskService.computeRiskForCiphers.mockResolvedValue([
      {
        id: asUuid(cipher.id),
        password_strength: 1,
        reuse_count: 1,
        exposed_result: { type: "NotChecked" },
      },
    ]);
    const results: LocalSecurityReport[] = [];
    const subscription = service.report$.subscribe((report) => results.push(report));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(results.at(-1)?.findings).toHaveLength(1);
    status$.next(AuthenticationStatus.Locked);
    expect(results.at(-1)).toEqual({ loading: false, failed: false, checked: 0, findings: [] });
    subscription.unsubscribe();
  });

  it("returns a recoverable empty error state when analysis fails", async () => {
    riskService.buildPasswordReuseMap.mockRejectedValue(new Error("SDK unavailable"));
    const result = await firstValueFrom(service.report$.pipe(filter((report) => !report.loading)));
    expect(result).toEqual({ loading: false, failed: true, checked: 0, findings: [] });
  });
});
