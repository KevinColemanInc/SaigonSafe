import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

@Component({
  selector: "app-premium-badge",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class PremiumBadgeComponent {
  readonly organizationId = input<string>();
  protected readonly iconOnly = input<boolean>(false);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);

  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }
}
