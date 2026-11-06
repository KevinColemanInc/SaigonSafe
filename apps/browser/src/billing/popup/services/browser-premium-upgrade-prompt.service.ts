import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { EMPTY, Observable } from "rxjs";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

/** Shows free local tools and explains which operations require server support. */
export class BrowserPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private readonly router = inject(Router);
  readonly upgradeConfirmed$: Observable<boolean> = EMPTY;

  async promptForPremium() {
    await this.router.navigate(["/local-security"]);
  }
}
