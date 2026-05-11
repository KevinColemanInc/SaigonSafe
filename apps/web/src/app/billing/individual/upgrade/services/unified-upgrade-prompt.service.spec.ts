import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { PremiumUpsellService } from "@bitwarden/angular/vault";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import { UnifiedUpgradeDialogComponent } from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

import { UnifiedUpgradePromptService } from "./unified-upgrade-prompt.service";

describe("UnifiedUpgradePromptService", () => {
  let sut: UnifiedUpgradePromptService;
  const mockAccountService = mock<AccountService>();
  const mockSyncService = mock<SyncService>();
  const mockDialogService = mock<DialogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockStateProvider = mock<StateProvider>();
  const mockLogService = mock<LogService>();
  const mockPremiumUpsellService = mock<PremiumUpsellService>();
  const mockDialogOpen = jest.spyOn(UnifiedUpgradeDialogComponent, "open");

  const mockAccount: Account = {
    id: "test-user-id",
  } as Account;
  const accountSubject = new BehaviorSubject<Account | null>(mockAccount);

  beforeEach(() => {
    mockDialogOpen.mockReset();
    mockAccountService.activeAccount$ = accountSubject.asObservable();

    sut = new UnifiedUpgradePromptService(
      mockAccountService,
      mockSyncService,
      mockDialogService,
      mockOrganizationService,
      mockPlatformUtilsService,
      mockStateProvider,
      mockLogService,
      mockPremiumUpsellService,
    );
  });

  it("does not show the unified upgrade dialog", async () => {
    await expect(sut.displayUpgradePromptConditionally()).resolves.toBeNull();
    expect(mockDialogOpen).not.toHaveBeenCalled();
    expect(mockStateProvider.setUserState).not.toHaveBeenCalled();
  });
});
