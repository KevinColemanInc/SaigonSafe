import { TestBed } from "@angular/core/testing";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { WebVaultExtensionPromptService } from "./web-vault-extension-prompt.service";

describe("WebVaultExtensionPromptService", () => {
  let service: WebVaultExtensionPromptService;

  const mockUserId = "user-123" as UserId;
  const getUser = jest.fn().mockReturnValue({ state$: { pipe: jest.fn() } });

  beforeEach(() => {
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        WebVaultExtensionPromptService,
        {
          provide: StateProvider,
          useValue: {
            getUser,
          },
        },
      ],
    });

    service = TestBed.inject(WebVaultExtensionPromptService);
  });

  it("does not open the extension prompt", async () => {
    await expect(service.conditionallyPromptUserForExtension(mockUserId)).resolves.toBe(false);
  });

  it("returns the SingleUserState for the dialog dismissed state", () => {
    service.getDialogDismissedState(mockUserId);

    expect(getUser).toHaveBeenCalledWith(mockUserId, expect.anything());
  });
});
