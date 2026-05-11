import { inject, Injectable } from "@angular/core";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider, UserKeyDefinition, WELCOME_EXTENSION_DIALOG_DISK } from "@bitwarden/state";

export const WELCOME_EXTENSION_DIALOG_DISMISSED = new UserKeyDefinition<boolean>(
  WELCOME_EXTENSION_DIALOG_DISK,
  "vaultWelcomeExtensionDialogDismissed",
  {
    deserializer: (dismissed) => dismissed,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class WebVaultExtensionPromptService {
  private stateProvider = inject(StateProvider);

  /**
   * Conditionally prompts the user to install the web extension
   */
  async conditionallyPromptUserForExtension(userId: UserId) {
    return false;
  }

  /** Returns the SingleUserState for the dialog dismissed state */
  getDialogDismissedState(userId: UserId) {
    return this.stateProvider.getUser(userId, WELCOME_EXTENSION_DIALOG_DISMISSED);
  }
}
