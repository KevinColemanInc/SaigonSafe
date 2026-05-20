import { Observable, firstValueFrom, map, combineLatest } from "rxjs";

import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ActiveUserState, GlobalState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import {
  BIOMETRIC_UNLOCK_ENABLED,
  BIOMETRIC_ENROLLED_KEY_ID,
  BIOMETRIC_UNLOCK_SESSION_READY,
  ENCRYPTED_CLIENT_KEY_HALF,
  REQUIRE_PASSWORD_ON_START,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
  FINGERPRINT_VALIDATED,
  LAST_PROCESS_RELOAD,
} from "./biometric.state";

export abstract class BiometricStateService {
  /**
   * Returns whether biometric unlock is enabled for a user.
   * @param userId The user id to check. If not provided, returns the state for the currently active user.
   * @returns An observable that emits `true` if the user has elected to store a biometric key to unlock their vault.
   */
  abstract biometricUnlockEnabled$(userId?: UserId): Observable<boolean>;
  /**
   * Returns whether the user allows biometric unlock immediately after client restart.
   * Defaults to true when the setting has not been configured.
   */
  abstract allowBiometricUnlockOnRestart$(userId?: UserId): Observable<boolean>;
  /**
   * Returns whether the user has already unlocked once in the current client session.
   * This is only relevant when restart-time biometric unlock is disabled.
   */
  abstract biometricUnlockSessionReady$(userId?: UserId): Observable<boolean>;
  /**
   * If the user has elected to require a password on first unlock of an application instance, this key will store the
   * encrypted client key half used to unlock the vault.
   *
   * Tracks the currently active user
   */
  abstract encryptedClientKeyHalf$: Observable<EncString | null>;
  /**
   * Whether the user has cancelled the biometric prompt.
   *
   * tracks the currently active user
   */
  abstract promptCancelled$: Observable<boolean>;
  /**
   * Whether the user has elected to automatically prompt for biometrics.
   *
   * tracks the currently active user
   */
  abstract promptAutomatically$: Observable<boolean>;
  /**
   * Whether or not IPC fingerprint has been validated by the user this session.
   */
  abstract fingerprintValidated$: Observable<boolean>;

  /**
   * Updates the biometric unlock enabled state for the currently active user.
   * @param enabled whether or not to store a biometric key to unlock the vault
   */
  abstract setBiometricUnlockEnabled(enabled: boolean): Promise<void>;
  abstract setAllowBiometricUnlockOnRestart(
    enabled: boolean,
    userId?: UserId,
  ): Promise<void>;
  abstract getAllowBiometricUnlockOnRestart(userId?: UserId): Promise<boolean>;
  abstract setBiometricUnlockSessionReady(ready: boolean, userId?: UserId): Promise<void>;
  abstract getBiometricUnlockSessionReady(userId?: UserId): Promise<boolean>;

  /**
   * Gets the biometric unlock enabled state for the given user.
   * @deprecated Use {@link biometricUnlockEnabled$} instead
   * @param userId user Id to check
   */
  abstract getBiometricUnlockEnabled(userId: UserId): Promise<boolean>;

  abstract setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId?: UserId): Promise<void>;

  abstract getEncryptedClientKeyHalf(userId: UserId): Promise<EncString | null>;

  abstract getBiometricEnrolledKeyId(userId: UserId): Promise<string | null>;

  abstract setBiometricEnrolledKeyId(userId: UserId, keyId: string | null): Promise<void>;

  /**
   * Updates the active user's state to reflect that they've cancelled the biometric prompt.
   */
  abstract setUserPromptCancelled(): Promise<void>;

  /**
   * Resets the given user's state to reflect that they haven't cancelled the biometric prompt.
   * @param userId the user to reset the prompt cancelled state for. If not provided, the currently active user will be used.
   */
  abstract resetUserPromptCancelled(userId?: UserId): Promise<void>;

  /**
   * Resets all user's state to reflect that they haven't cancelled the biometric prompt.
   */
  abstract resetAllPromptCancelled(): Promise<void>;

  /**
   * Updates the currently active user's setting for auto prompting for biometrics on application start and lock
   * @param prompt Whether or not to prompt for biometrics on application start.
   */
  abstract setPromptAutomatically(prompt: boolean): Promise<void>;

  /**
   * Updates whether or not IPC has been validated by the user this session
   * @param validated the value to save
   */
  abstract setFingerprintValidated(validated: boolean): Promise<void>;

  abstract updateLastProcessReload(): Promise<void>;

  abstract getLastProcessReload(): Promise<Date | null>;

  abstract logout(userId: UserId): Promise<void>;
}

export class DefaultBiometricStateService implements BiometricStateService {
  private biometricUnlockEnabledState: ActiveUserState<boolean>;
  private requirePasswordOnStartState: ActiveUserState<boolean>;
  private biometricUnlockSessionReadyState: ActiveUserState<boolean>;
  private encryptedClientKeyHalfState: ActiveUserState<EncryptedString>;
  private promptCancelledState: GlobalState<Record<UserId, boolean>>;
  private promptAutomaticallyState: ActiveUserState<boolean>;
  private fingerprintValidatedState: GlobalState<boolean>;
  private lastProcessReloadState: GlobalState<Date>;
  private activeAllowBiometricUnlockOnRestart$: Observable<boolean>;
  private activeBiometricUnlockSessionReady$: Observable<boolean>;
  encryptedClientKeyHalf$: Observable<EncString | null>;
  promptCancelled$: Observable<boolean>;
  promptAutomatically$: Observable<boolean>;
  fingerprintValidated$: Observable<boolean>;
  lastProcessReload$: Observable<Date | null>;

  constructor(private stateProvider: StateProvider) {
    this.biometricUnlockEnabledState = this.stateProvider.getActive(BIOMETRIC_UNLOCK_ENABLED);
    this.requirePasswordOnStartState = this.stateProvider.getActive(REQUIRE_PASSWORD_ON_START);
    this.activeAllowBiometricUnlockOnRestart$ = this.requirePasswordOnStartState.state$.pipe(
      map((requirePasswordOnStart) => requirePasswordOnStart !== true),
    );
    this.biometricUnlockSessionReadyState = this.stateProvider.getActive(
      BIOMETRIC_UNLOCK_SESSION_READY,
    );
    this.activeBiometricUnlockSessionReady$ = this.biometricUnlockSessionReadyState.state$.pipe(
      map(Boolean),
    );

    this.encryptedClientKeyHalfState = this.stateProvider.getActive(ENCRYPTED_CLIENT_KEY_HALF);
    this.encryptedClientKeyHalf$ = this.encryptedClientKeyHalfState.state$.pipe(
      map(encryptedClientKeyHalfToEncString),
    );

    this.promptCancelledState = this.stateProvider.getGlobal(PROMPT_CANCELLED);
    this.promptCancelled$ = combineLatest([
      this.stateProvider.activeUserId$,
      this.promptCancelledState.state$,
    ]).pipe(
      map(([userId, record]) => {
        return userId != null ? (record?.[userId] ?? false) : false;
      }),
    );
    this.promptAutomaticallyState = this.stateProvider.getActive(PROMPT_AUTOMATICALLY);
    this.promptAutomatically$ = this.promptAutomaticallyState.state$.pipe(map(Boolean));

    this.fingerprintValidatedState = this.stateProvider.getGlobal(FINGERPRINT_VALIDATED);
    this.fingerprintValidated$ = this.fingerprintValidatedState.state$.pipe(map(Boolean));

    this.lastProcessReloadState = this.stateProvider.getGlobal(LAST_PROCESS_RELOAD);
    this.lastProcessReload$ = this.lastProcessReloadState.state$;
  }

  async setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
    await this.biometricUnlockEnabledState.update(() => enabled);
  }

  biometricUnlockEnabled$(userId?: UserId): Observable<boolean> {
    if (userId != null) {
      return this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_ENABLED).state$.pipe(map(Boolean));
    }
    // Backwards compatibility for active user state
    // TODO remove with https://bitwarden.atlassian.net/browse/PM-12043
    return this.biometricUnlockEnabledState.state$.pipe(map(Boolean));
  }

  allowBiometricUnlockOnRestart$(userId?: UserId): Observable<boolean> {
    if (userId != null) {
      return this.stateProvider
        .getUser(userId, REQUIRE_PASSWORD_ON_START)
        .state$.pipe(map((requirePasswordOnStart) => requirePasswordOnStart !== true));
    }
    return this.activeAllowBiometricUnlockOnRestart$;
  }

  biometricUnlockSessionReady$(userId?: UserId): Observable<boolean> {
    if (userId != null) {
      return this.stateProvider
        .getUser(userId, BIOMETRIC_UNLOCK_SESSION_READY)
        .state$.pipe(map(Boolean));
    }
    return this.activeBiometricUnlockSessionReady$;
  }

  async setAllowBiometricUnlockOnRestart(enabled: boolean, userId?: UserId): Promise<void> {
    if (userId != null) {
      await this.stateProvider
        .getUser(userId, REQUIRE_PASSWORD_ON_START)
        .update(() => !enabled);
      return;
    }

    await this.requirePasswordOnStartState.update(() => !enabled);
  }

  async getAllowBiometricUnlockOnRestart(userId?: UserId): Promise<boolean> {
    if (userId != null) {
      return await firstValueFrom(this.allowBiometricUnlockOnRestart$(userId));
    }

    return await firstValueFrom(this.activeAllowBiometricUnlockOnRestart$);
  }

  async setBiometricUnlockSessionReady(ready: boolean, userId?: UserId): Promise<void> {
    if (userId != null) {
      await this.stateProvider
        .getUser(userId, BIOMETRIC_UNLOCK_SESSION_READY)
        .update(() => ready);
      return;
    }

    await this.biometricUnlockSessionReadyState.update(() => ready);
  }

  async getBiometricUnlockSessionReady(userId?: UserId): Promise<boolean> {
    if (userId != null) {
      return await firstValueFrom(this.biometricUnlockSessionReady$(userId));
    }

    return await firstValueFrom(this.activeBiometricUnlockSessionReady$);
  }

  async getBiometricUnlockEnabled(userId: UserId): Promise<boolean> {
    return await firstValueFrom(
      this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_ENABLED).state$.pipe(map(Boolean)),
    );
  }

  async setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId?: UserId): Promise<void> {
    const value = encryptedKeyHalf?.encryptedString ?? null;
    if (userId) {
      await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => value);
    } else {
      await this.encryptedClientKeyHalfState.update(() => value);
    }
  }

  async getEncryptedClientKeyHalf(userId: UserId): Promise<EncString | null> {
    return await firstValueFrom(
      this.stateProvider
        .getUser(userId, ENCRYPTED_CLIENT_KEY_HALF)
        .state$.pipe(map(encryptedClientKeyHalfToEncString)),
    );
  }

  async getBiometricEnrolledKeyId(userId: UserId): Promise<string | null> {
    return await firstValueFrom(
      this.stateProvider
        .getUser(userId, BIOMETRIC_ENROLLED_KEY_ID)
        .state$.pipe(map((value) => value ?? null)),
    );
  }

  async setBiometricEnrolledKeyId(userId: UserId, keyId: string | null): Promise<void> {
    await this.stateProvider.getUser(userId, BIOMETRIC_ENROLLED_KEY_ID).update(() => keyId);
  }

  async logout(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => null);
    await this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_SESSION_READY).update(() => null);
    await this.resetUserPromptCancelled(userId);
    // Persist auto prompt setting through logout
    // Persist dismissed require password on start callout through logout
  }

  async resetUserPromptCancelled(userId: UserId): Promise<void> {
    await this.stateProvider.getGlobal(PROMPT_CANCELLED).update(
      (data, activeUserId) => {
        if (data != null) {
          delete data[userId ?? activeUserId];
        }
        return data;
      },
      {
        combineLatestWith: this.stateProvider.activeUserId$,
        shouldUpdate: (data, activeUserId) => data?.[userId ?? activeUserId] != null,
      },
    );
  }

  async setUserPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(
      (record, userId) => {
        if (userId != null) {
          record ??= {};
          record[userId] = true;
        }
        return record;
      },
      {
        combineLatestWith: this.stateProvider.activeUserId$,
        shouldUpdate: (_, userId) => {
          if (userId == null) {
            throw new Error(
              "Cannot update biometric prompt cancelled state without an active user",
            );
          }
          return true;
        },
      },
    );
  }

  async resetAllPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(() => null);
  }

  async setPromptAutomatically(prompt: boolean): Promise<void> {
    await this.promptAutomaticallyState.update(() => prompt);
  }

  async setFingerprintValidated(validated: boolean): Promise<void> {
    await this.fingerprintValidatedState.update(() => validated);
  }

  async updateLastProcessReload(): Promise<void> {
    await this.lastProcessReloadState.update(() => new Date());
  }

  async getLastProcessReload(): Promise<Date | null> {
    return await firstValueFrom(this.lastProcessReload$);
  }
}

function encryptedClientKeyHalfToEncString(
  encryptedKeyHalf: EncryptedString | null | undefined,
): EncString | null {
  return encryptedKeyHalf == null ? null : new EncString(encryptedKeyHalf);
}
