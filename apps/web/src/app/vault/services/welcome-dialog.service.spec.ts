import { TestBed } from "@angular/core/testing";

import { VaultWelcomeDialogComponent } from "../components/vault-welcome-dialog/vault-welcome-dialog.component";

import { WelcomeDialogService } from "./welcome-dialog.service";

describe("WelcomeDialogService", () => {
  let service: WelcomeDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WelcomeDialogService],
    });

    service = TestBed.inject(WelcomeDialogService);
  });

  it("does not show the welcome dialog", async () => {
    const openSpy = jest.spyOn(VaultWelcomeDialogComponent, "open").mockImplementation();

    await service.conditionallyShowWelcomeDialog();

    expect(openSpy).not.toHaveBeenCalled();
  });
});
