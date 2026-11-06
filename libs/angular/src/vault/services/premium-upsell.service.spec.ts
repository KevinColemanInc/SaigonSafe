import { PremiumUpsellService } from "./premium-upsell.service";

describe("PremiumUpsellService", () => {
  it("disables subscription promotions without reading account or vault data", () => {
    expect(new PremiumUpsellService().showUpsell()).toBe(false);
  });
});
