// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Overlay } from "@angular/cdk/overlay";
import { inject, Injectable } from "@angular/core";
import { concat, firstValueFrom, NEVER, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService } from "@bitwarden/components";
import { CredentialGeneratorService, Profile } from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";
import { CipherFormGenerationService } from "@bitwarden/vault";

import { VaultGeneratorDialogComponent } from "../components/vault/vault-generator-dialog/vault-generator-dialog.component";

@Injectable()
export class BrowserCipherFormGenerationService implements CipherFormGenerationService {
  private dialogService = inject(DialogService);
  private overlay = inject(Overlay);
  private accountService = inject(AccountService);
  private generatorService = inject(CredentialGeneratorService);
  private generatorHistoryService = inject(GeneratorHistoryService);
  private logService = inject(LogService);

  async generatePasswordInPlace(): Promise<string | null> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return null;
    }
    // State-backed settings remain active while this account stream is open.
    const account$ = concat(of(account), NEVER);
    const algorithm = await firstValueFrom(
      this.generatorService.preferredAlgorithm$("password", { account$ }),
    );
    // generate$ loads the account's saved settings and enforces generator policies.
    const generated = await firstValueFrom(
      this.generatorService.generate$({
        account$,
        // Keep the request stream alive until the async generator emits its result.
        on$: concat(
          of({
            source: "cipher form inline",
            algorithm: algorithm.id,
            profile: Profile.account,
          }),
          NEVER,
        ),
      }),
    );
    try {
      await this.generatorHistoryService.track(
        account.id,
        generated.credential,
        generated.category,
        generated.generationDate,
      );
    } catch (error) {
      this.logService.error(error);
    }
    return generated.credential;
  }

  async generatePassword(): Promise<string> {
    const dialogRef = VaultGeneratorDialogComponent.open(this.dialogService, this.overlay, {
      data: { type: "password" },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue;
  }

  async generateUsername(uri: string): Promise<string> {
    const dialogRef = VaultGeneratorDialogComponent.open(this.dialogService, this.overlay, {
      data: { type: "username", uri: uri },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue;
  }
}
