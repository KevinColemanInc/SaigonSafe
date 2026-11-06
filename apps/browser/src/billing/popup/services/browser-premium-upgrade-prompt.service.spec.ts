import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { BrowserPremiumUpgradePromptService } from "./browser-premium-upgrade-prompt.service";

describe("BrowserPremiumUpgradePromptService", () => {
  it("opens the local tools instead of a purchase dialog", async () => {
    const router = mock<Router>();
    TestBed.configureTestingModule({
      providers: [BrowserPremiumUpgradePromptService, { provide: Router, useValue: router }],
    });
    await TestBed.inject(BrowserPremiumUpgradePromptService).promptForPremium();
    expect(router.navigate).toHaveBeenCalledWith(["/local-security"]);
  });
});
