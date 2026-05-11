import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { GeneratedLoginItemService } from "./generated-login-item.service";
import { VaultPopupAutofillService } from "./vault-popup-autofill.service";

describe("GeneratedLoginItemService", () => {
  let service: GeneratedLoginItemService;

  const userId = Utils.newGuid() as UserId;
  const accountService = mockAccountServiceWith(userId);
  const cipherService = mock<CipherService>();
  const i18nService = mock<I18nService>();
  const messagingService = mock<MessagingService>();
  const passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
  const toastService = mock<ToastService>();
  const vaultPopupAutofillService = mock<VaultPopupAutofillService>();

  beforeEach(() => {
    i18nService.t.mockImplementation((key) => key);
    passwordGenerationService.getOptions.mockResolvedValue([{}] as any);
    passwordGenerationService.generatePassword.mockResolvedValue("generated-password");
    vaultPopupAutofillService.doAutofill.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: cipherService },
        { provide: I18nService, useValue: i18nService },
        { provide: MessagingService, useValue: messagingService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: ToastService, useValue: toastService },
        { provide: VaultPopupAutofillService, useValue: vaultPopupAutofillService },
      ],
    });

    service = TestBed.inject(GeneratedLoginItemService);
    jest.spyOn(Utils, "getHostname").mockReturnValue("example.com");
    jest.spyOn(BrowserApi, "sendMessage").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates a login, saves it, and autofills it", async () => {
    const savedCipher = new CipherView();
    savedCipher.id = "cipher-1";
    cipherService.createWithServer.mockResolvedValue(savedCipher);

    const result = await service.createAndAutofillLogin(
      "user@example.com",
      {
        folderId: "folder-1",
        organizationId: "org-1" as any,
        collectionId: "col-1" as any,
      },
      { url: "https://example.com/login" } as chrome.tabs.Tab,
    );

    expect(result).toBe(true);
    expect(passwordGenerationService.getOptions).toHaveBeenCalled();
    expect(passwordGenerationService.generatePassword).toHaveBeenCalledWith({});
    expect(cipherService.createWithServer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CipherType.Login,
        name: "example.com",
        folderId: "folder-1",
        organizationId: "org-1",
        collectionIds: ["col-1"],
        login: expect.objectContaining({
          username: "user@example.com",
          password: "generated-password",
          uris: [expect.objectContaining({ uri: "https://example.com/login" })],
        }),
      }),
      userId,
    );
    expect(messagingService.send).toHaveBeenCalledWith("addedCipher");
    expect(BrowserApi.sendMessage).toHaveBeenCalledWith("addEditCipherSubmitted");
    expect(vaultPopupAutofillService.doAutofill).toHaveBeenCalledWith(savedCipher);
  });

  it("uses the most popular username from login history when no default email is configured", async () => {
    const savedCipher = new CipherView();
    savedCipher.id = "cipher-1";
    cipherService.createWithServer.mockResolvedValue(savedCipher);
    cipherService.getAllDecrypted.mockResolvedValue([
      {
        type: CipherType.Login,
        login: { username: "fallback@example.com" },
        localData: { lastUsedDate: 100 },
      },
      {
        type: CipherType.Login,
        login: { username: "popular@example.com" },
        localData: { lastUsedDate: 200 },
      },
      {
        type: CipherType.Login,
        login: { username: "popular@example.com" },
        localData: { lastUsedDate: 300 },
      },
    ] as CipherView[]);

    const result = await service.createAndAutofillLogin("   ", undefined, {
      url: "https://example.com/login",
    } as chrome.tabs.Tab);

    expect(result).toBe(true);
    expect(cipherService.createWithServer).toHaveBeenCalledWith(
      expect.objectContaining({
        login: expect.objectContaining({
          username: "popular@example.com",
        }),
      }),
      userId,
    );
  });

  it("shows an error toast when the current page cannot be used for generation", async () => {
    expect(await service.createAndAutofillLogin("user@example.com", undefined, undefined)).toBe(
      false,
    );
    expect(await service.createAndAutofillLogin("user@example.com", undefined, null)).toBe(false);

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "generateLoginInvalidPage",
    });
    expect(cipherService.createWithServer).not.toHaveBeenCalled();
  });

  it("shows an error toast when no username is available from settings or login history", async () => {
    cipherService.getAllDecrypted.mockResolvedValue([]);

    const result = await service.createAndAutofillLogin("   ", undefined, {
      url: "https://example.com/login",
    } as chrome.tabs.Tab);

    expect(result).toBe(false);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "generateLoginMissingUsername",
    });
    expect(cipherService.createWithServer).not.toHaveBeenCalled();
  });

  it("shows an error toast when saving fails", async () => {
    cipherService.createWithServer.mockRejectedValue(new Error("save failed"));

    const result = await service.createAndAutofillLogin("user@example.com", undefined, {
      url: "https://example.com/login",
    } as chrome.tabs.Tab);

    expect(result).toBe(false);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "unexpectedError",
    });
  });
});
