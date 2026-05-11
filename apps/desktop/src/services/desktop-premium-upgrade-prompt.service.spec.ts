import { TestBed } from "@angular/core/testing";

import { DesktopPremiumUpgradePromptService } from "./desktop-premium-upgrade-prompt.service";

describe("DesktopPremiumUpgradePromptService", () => {
  let service: DesktopPremiumUpgradePromptService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [DesktopPremiumUpgradePromptService],
    }).compileComponents();

    service = TestBed.inject(DesktopPremiumUpgradePromptService);
  });

  it("does not open an upgrade flow", async () => {
    await expect(service.promptForPremium()).resolves.toBeUndefined();
  });
});
