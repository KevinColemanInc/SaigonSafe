import { Component, input } from "@angular/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-premium-badge",
  template: ``,
  imports: [],
})
export class PremiumBadgeComponent {
  readonly organizationId = input<string>();

  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }
}
