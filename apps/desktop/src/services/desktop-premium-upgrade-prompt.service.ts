import { Injectable } from "@angular/core";
import { EMPTY, Observable } from "rxjs";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

/**
 * This class handles the premium upgrade process for the desktop.
 */
@Injectable()
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  readonly upgradeConfirmed$: Observable<boolean> = EMPTY;

  async promptForPremium() {
    return;
  }
}
