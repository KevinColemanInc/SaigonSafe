import { Injectable } from "@angular/core";

/** SaigonSafe does not display subscription promotions. */
@Injectable({ providedIn: "root" })
export class PremiumUpsellService {
  showUpsell() {
    return false;
  }
}
