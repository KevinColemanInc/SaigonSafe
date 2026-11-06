import { inject, Injectable } from "@angular/core";
import {
  catchError,
  combineLatest,
  concat,
  defer,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

export type LocalSecurityFinding = {
  id: string;
  name: string;
  weak: boolean;
  reused: boolean;
  insecure: boolean;
};

export type LocalSecurityReport = {
  loading: boolean;
  failed: boolean;
  checked: number;
  findings: LocalSecurityFinding[];
};

const emptyReport: LocalSecurityReport = {
  loading: false,
  failed: false,
  checked: 0,
  findings: [],
};

/** Computes reports in memory. Passwords and report results are never uploaded or persisted. */
@Injectable({ providedIn: "root" })
export class LocalSecurityReportService {
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly cipherService = inject(CipherService);
  private readonly riskService = inject(CipherRiskService);

  readonly report$ = combineLatest([
    this.accountService.activeAccount$,
    this.authService.activeAccountStatus$,
  ]).pipe(
    switchMap(([account, status]) => {
      if (!account || status !== AuthenticationStatus.Unlocked) {
        return of(emptyReport);
      }
      return this.cipherService.cipherViews$(account.id).pipe(
        switchMap((ciphers) => {
          // Respect collection permissions and omit deleted or undecryptable items.
          const logins = (ciphers ?? []).filter(
            (cipher) =>
              cipher.type === CipherType.Login &&
              !cipher.isDeleted &&
              !cipher.decryptionFailure &&
              cipher.viewPassword &&
              cipher.reprompt === CipherRepromptType.None,
          );
          return concat(
            // Clear the previous account/revision's findings while computing.
            of({ ...emptyReport, loading: true }),
            defer(async () => {
              const passwordMap = await this.riskService.buildPasswordReuseMap(logins, account.id);
              const risks = await this.riskService.computeRiskForCiphers(logins, account.id, {
                passwordMap,
                checkExposed: false,
              });
              const byId = new Map(risks.map((risk) => [uuidAsString(risk.id), risk]));
              const findings = logins.flatMap((cipher) => {
                const risk = byId.get(cipher.id);
                const finding: LocalSecurityFinding = {
                  id: cipher.id,
                  name: cipher.name,
                  weak: risk != null && risk.password_strength < 3,
                  reused: (risk?.reuse_count ?? 1) > 1,
                  insecure:
                    cipher.login?.uris?.some((uri) => /^http:\/\//i.test(uri.uri ?? "")) ?? false,
                };
                return finding.weak || finding.reused || finding.insecure ? [finding] : [];
              });
              return { ...emptyReport, checked: logins.length, findings };
            }).pipe(catchError(() => of({ ...emptyReport, failed: true }))),
          );
        }),
        catchError(() => of({ ...emptyReport, failed: true })),
        startWith({ ...emptyReport, loading: true }),
      );
    }),
    map((report): LocalSecurityReport => report),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
