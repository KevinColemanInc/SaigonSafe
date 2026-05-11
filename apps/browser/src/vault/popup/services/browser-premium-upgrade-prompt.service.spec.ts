import { TestBed } from "@angular/core/testing";

import { BrowserPremiumUpgradePromptService } from "./browser-premium-upgrade-prompt.service";

describe("BrowserPremiumUpgradePromptService", () => {
  let service: BrowserPremiumUpgradePromptService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [BrowserPremiumUpgradePromptService],
    }).compileComponents();

    service = TestBed.inject(BrowserPremiumUpgradePromptService);
  });

  it("does not open an upgrade flow", async () => {
    await expect(service.promptForPremium()).resolves.toBeUndefined();
  });
});
