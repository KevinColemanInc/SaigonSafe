import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

@Injectable()
export class WebVaultPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private readonly _upgradeConfirmed$ = new Subject<boolean>();
  readonly upgradeConfirmed$ = this._upgradeConfirmed$.asObservable();

  /**
   * Prompts the user for a premium upgrade.
   */
  async promptForPremium(organizationId?: OrganizationId) {
    this._upgradeConfirmed$.next(false);
    return;
  }
}
