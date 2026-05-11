import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { BrowserApi } from "../../../platform/browser/browser-api";
import type { NewItemInitialValues } from "../components/vault/new-item-dropdown/new-item-dropdown.component";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";

@Injectable({
  providedIn: "root",
})
export class GeneratedLoginItemService {
  private static readonly invalidPageToastMessageKey = "generateLoginInvalidPage";
  private static readonly missingUsernameToastMessageKey = "generateLoginMissingUsername";

  constructor(
    private accountService: AccountService,
    private cipherService: CipherService,
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private toastService: ToastService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
  ) {}

  async createAndAutofillLogin(
    defaultEmail: string,
    initialValues: NewItemInitialValues | undefined,
    tab: chrome.tabs.Tab | null | undefined,
  ): Promise<boolean> {
    const tabUrl = tab?.url;
    const hostname = tabUrl ? Utils.getHostname(tabUrl) : null;

    if (!tabUrl || !hostname) {
      this.showInvalidPageToast();
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const username = await this.resolveUsername(defaultEmail, activeUserId);

      if (!username) {
        this.showMissingUsernameToast();
        return false;
      }

      const [passwordOptions] = await this.passwordGenerationService.getOptions();
      const generatedPassword =
        await this.passwordGenerationService.generatePassword(passwordOptions);

      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.name = hostname;
      cipher.folderId = initialValues?.folderId;
      cipher.organizationId = initialValues?.organizationId;
      cipher.collectionIds = initialValues?.collectionId ? [initialValues.collectionId] : [];
      cipher.login = new LoginView();
      cipher.login.username = username;
      cipher.login.password = generatedPassword;

      const loginUri = new LoginUriView();
      loginUri.uri = tabUrl;
      cipher.login.uris = [loginUri];

      const savedCipher = await this.cipherService.createWithServer(cipher, activeUserId);

      this.messagingService.send("addedCipher");
      await BrowserApi.sendMessage("addEditCipherSubmitted");

      return await this.vaultPopupAutofillService.doAutofill(savedCipher);
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("unexpectedError"),
      });
      return false;
    }
  }

  private async resolveUsername(
    defaultEmail: string,
    activeUserId: UserId,
  ): Promise<string | null> {
    const trimmedDefaultEmail = defaultEmail.trim();
    if (trimmedDefaultEmail) {
      return trimmedDefaultEmail;
    }

    const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
    const usernameStats = new Map<string, { count: number; lastUsedDate: number }>();

    for (const cipher of ciphers) {
      if (cipher.type !== CipherType.Login) {
        continue;
      }

      const username = cipher.login?.username?.trim();
      if (!username) {
        continue;
      }

      const lastUsedDate = cipher.localData?.lastUsedDate ?? 0;
      const stats = usernameStats.get(username);

      usernameStats.set(username, {
        count: (stats?.count ?? 0) + 1,
        lastUsedDate: Math.max(stats?.lastUsedDate ?? 0, lastUsedDate),
      });
    }

    const [mostPopularUsername] =
      [...usernameStats.entries()].sort((a, b) => {
        if (a[1].count !== b[1].count) {
          return b[1].count - a[1].count;
        }

        if (a[1].lastUsedDate !== b[1].lastUsedDate) {
          return b[1].lastUsedDate - a[1].lastUsedDate;
        }

        return a[0].localeCompare(b[0]);
      })[0] ?? [];

    return mostPopularUsername ?? null;
  }

  private showMissingUsernameToast() {
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t(GeneratedLoginItemService.missingUsernameToastMessageKey),
    });
  }

  private showInvalidPageToast() {
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t(GeneratedLoginItemService.invalidPageToastMessageKey),
    });
  }
}
