// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import {
  BehaviorSubject,
  concatMap,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  timer,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { FingerprintDialogComponent } from "@bitwarden/auth/angular";
import { LockService } from "@bitwarden/auth/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  DialogRef,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
  ToastService,
  SwitchComponent,
  CalloutModule,
  SpinnerComponent,
} from "@bitwarden/components";
import {
  KeyService,
  BiometricsService,
  BiometricStateService,
  BiometricsStatus,
} from "@bitwarden/key-management";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

import {
  browserUsesTouchIdLabel,
  getBrowserBiometricUnlockTextKey,
} from "../../../key-management/biometrics/browser-biometric-text";
import { BiometricErrors, BiometricErrorTypes } from "../../../models/biometricErrors";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { SetPinComponent } from "../components/set-pin.component";
import { AuthExtensionRoute } from "../constants/auth-extension-route.constant";

import { AwaitDesktopDialogComponent } from "./await-desktop-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "account-security.component.html",
  imports: [
    CardComponent,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    IconButtonModule,
    IconModule,
    ItemModule,
    JslibModule,
    LinkModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SessionTimeoutSettingsComponent,
    TypographyModule,
    SwitchComponent,
    CalloutModule,
    SpinnerComponent,
  ],
})
export class AccountSecurityComponent implements OnInit, OnDestroy {
  showMasterPasswordOnClientRestartOption = true;
  biometricStatusMessage: string;
  showChangeMasterPass = true;
  pinEnabled$: Observable<boolean> = of(true);
  protected readonly loading = signal(true);

  form = this.formBuilder.group({
    pin: [null as boolean | null],
    pinLockWithMasterPassword: false,
    biometric: false,
    requireMasterPasswordOnRestart: false,
    enableAutoBiometricsPrompt: true,
    enablePhishingDetection: true,
  });

  protected showAccountSecurityNudge$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.vaultNudgesService.showNudgeSpotlight$(NudgeType.AccountSecurity, userId),
      ),
    );

  protected readonly phishingDetectionAvailable$: Observable<boolean>;
  protected readonly multiClientPasswordManagement$: Observable<boolean>;

  protected refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();
  private readonly BIOMETRICS_POLLING_INTERVAL = 2000;

  constructor(
    private accountService: AccountService,
    private pinService: PinServiceAbstraction,
    private configService: ConfigService,
    private router: Router,
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private lockService: LockService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    public messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private keyService: KeyService,
    private userVerificationService: UserVerificationService,
    private dialogService: DialogService,
    private biometricStateService: BiometricStateService,
    private toastService: ToastService,
    private biometricsService: BiometricsService,
    private vaultNudgesService: NudgesService,
    private validationService: ValidationService,
    private logService: LogService,
    private phishingDetectionSettingsService: PhishingDetectionSettingsServiceAbstraction,
  ) {
    this.multiClientPasswordManagement$ = this.configService.getFeatureFlag$(
      FeatureFlag.PM32413_MultiClientPasswordManagement,
    );

    // Check if user phishing detection available
    this.phishingDetectionAvailable$ = this.phishingDetectionSettingsService.available$;
  }

  async ngOnInit() {
    const hasMasterPassword = await this.userVerificationService.hasMasterPassword();
    this.showMasterPasswordOnClientRestartOption = hasMasterPassword;

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    this.pinEnabled$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.RemoveUnlockWithPin, userId),
      ),
      getFirstPolicy,
      map((policy) => {
        return policy == null || !policy.enabled;
      }),
    );

    const initialValues = {
      pin: await this.pinService.isPinSet(activeAccount.id),
      pinLockWithMasterPassword:
        (await this.pinService.getPinLockType(activeAccount.id)) == "EPHEMERAL",
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(activeAccount.id),
      requireMasterPasswordOnRestart: this.showMasterPasswordOnClientRestartOption
        ? !(await this.biometricStateService.getAllowBiometricUnlockOnRestart(activeAccount.id))
        : false,
      enableAutoBiometricsPrompt: await firstValueFrom(
        this.biometricStateService.promptAutomatically$,
      ),
      enablePhishingDetection: await firstValueFrom(this.phishingDetectionSettingsService.enabled$),
    };
    this.form.patchValue(initialValues, { emitEvent: false });

    if (initialValues.biometric && this.showMasterPasswordOnClientRestartOption) {
      this.form.controls.requireMasterPasswordOnRestart.enable({ emitEvent: false });
    } else {
      this.form.controls.requireMasterPasswordOnRestart.disable({ emitEvent: false });
    }

    this.loading.set(false);

    timer(0, this.BIOMETRICS_POLLING_INTERVAL)
      .pipe(
        switchMap(async () => {
          const biometricSettingAvailable = await this.biometricsService.canEnableBiometricUnlock();
          if (!biometricSettingAvailable) {
            this.form.controls.biometric.disable({ emitEvent: false });
          } else {
            this.form.controls.biometric.enable({ emitEvent: false });
          }

          // Biometrics status shouldn't be checked if permissions are needed.
          const needsPermissionPrompt =
            !(await BrowserApi.permissionsGranted(["nativeMessaging"])) &&
            !this.platformUtilsService.isSafari();
          if (needsPermissionPrompt) {
            this.biometricStatusMessage = "";
            return;
          }

          const status = await this.biometricsService.getBiometricsStatusForUser(activeAccount.id);
          if (
            status === BiometricsStatus.Available &&
            biometricSettingAvailable &&
            this.usesTouchId()
          ) {
            this.biometricStatusMessage = this.i18nService.t("touchIdAvailableOnThisMac");
          } else if (status === BiometricsStatus.DesktopDisconnected && !biometricSettingAvailable) {
            this.biometricStatusMessage = this.i18nService.t(
              "biometricsStatusHelptextDesktopDisconnected",
            );
          } else if (
            status === BiometricsStatus.NotEnabledInConnectedDesktopApp &&
            !biometricSettingAvailable
          ) {
            this.biometricStatusMessage = this.i18nService.t(
              "biometricsStatusHelptextNotEnabledInDesktop",
              activeAccount.email,
            );
          } else if (
            status === BiometricsStatus.HardwareUnavailable &&
            !biometricSettingAvailable
          ) {
            this.biometricStatusMessage = this.i18nService.t(
              "biometricsStatusHelptextHardwareUnavailable",
            );
          } else {
            this.biometricStatusMessage = "";
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.showChangeMasterPass = await this.userVerificationService.hasMasterPassword();

    this.form.controls.pin.valueChanges
      .pipe(
        concatMap(async (value) => {
          await this.updatePin(value);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.pinLockWithMasterPassword.valueChanges
      .pipe(
        concatMap(async (value) => {
          const userId = (await firstValueFrom(this.accountService.activeAccount$)).id;
          const pin = await this.pinService.getPin(userId);
          await this.pinService.setPin(pin, value ? "EPHEMERAL" : "PERSISTENT", userId);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.biometric.valueChanges
      .pipe(
        distinctUntilChanged(),
        concatMap(async (enabled) => {
          await this.updateBiometric(enabled);
          const biometricsEnabled = this.form.controls.biometric.value === true;
          if (biometricsEnabled) {
            this.form.controls.enableAutoBiometricsPrompt.enable();
            if (this.showMasterPasswordOnClientRestartOption) {
              this.form.controls.requireMasterPasswordOnRestart.enable({ emitEvent: false });
            }
          } else {
            this.form.controls.enableAutoBiometricsPrompt.disable();
            this.form.controls.requireMasterPasswordOnRestart.disable({ emitEvent: false });
          }
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.requireMasterPasswordOnRestart.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.updateRequireMasterPasswordOnRestart(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.enableAutoBiometricsPrompt.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.biometricStateService.setPromptAutomatically(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.enablePhishingDetection.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
          await this.phishingDetectionSettingsService.setEnabled(userId, enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  protected async dismissAccountSecurityNudge() {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      return;
    }
    await this.vaultNudgesService.dismissNudge(NudgeType.AccountSecurity, activeAccount.id);
  }

  async updatePin(value: boolean) {
    if (value) {
      const dialogRef = SetPinComponent.open(this.dialogService);

      if (dialogRef == null) {
        this.form.controls.pin.setValue(false, { emitEvent: false });
        return;
      }

      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((account) => account.id)),
      );
      const userHasPinSet = await firstValueFrom(dialogRef.closed);
      this.form.controls.pin.setValue(userHasPinSet, { emitEvent: false });
      const requireReprompt = (await this.pinService.getPinLockType(userId)) == "EPHEMERAL";
      this.form.controls.pinLockWithMasterPassword.setValue(requireReprompt, { emitEvent: false });
      if (userHasPinSet) {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("unlockPinSet"),
        });
        await this.vaultNudgesService.dismissNudge(NudgeType.AccountSecurity, userId);
      }
    } else {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.pinService.unsetPin(userId);
    }
  }

  async updateBiometric(enabled: boolean) {
    if (enabled) {
      let granted;
      try {
        granted = await BrowserApi.requestPermission({ permissions: ["nativeMessaging"] });
      } catch (e) {
        // eslint-disable-next-line
        console.error(e);

        if (this.platformUtilsService.isFirefox() && BrowserPopupUtils.inSidebar(window)) {
          await this.dialogService.openSimpleDialog({
            title: { key: "nativeMessaginPermissionSidebarTitle" },
            content: { key: "nativeMessaginPermissionSidebarDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "info",
          });

          this.form.controls.biometric.setValue(false);
          return;
        }
      }

      if (!granted) {
        await this.dialogService.openSimpleDialog({
          title: { key: "nativeMessaginPermissionErrorTitle" },
          content: { key: "nativeMessaginPermissionErrorDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });

        this.form.controls.biometric.setValue(false);
        return;
      }

      try {
        const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
        if (!this.showMasterPasswordOnClientRestartOption) {
          await this.biometricStateService.setAllowBiometricUnlockOnRestart(true, userId);
          this.form.controls.requireMasterPasswordOnRestart.setValue(false, { emitEvent: false });
        }
        await this.keyService.refreshAdditionalKeys(userId);

        const successful = await this.trySetupBiometrics();
        this.form.controls.biometric.setValue(successful, { emitEvent: false });
        await this.biometricStateService.setBiometricUnlockEnabled(successful);
        if (!successful) {
          await this.biometricStateService.setFingerprintValidated(false);
          await this.biometricStateService.setBiometricUnlockSessionReady(false, userId);
          return;
        }
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("unlockWithBiometricSet"),
        });
      } catch (error) {
        this.form.controls.biometric.setValue(false);
        this.validationService.showError(error);
      }
    } else {
      await this.biometricStateService.setBiometricUnlockEnabled(false);
      await this.biometricStateService.setFingerprintValidated(false);
      await this.biometricStateService.setBiometricUnlockSessionReady(false);
    }
  }

  async trySetupBiometrics(): Promise<boolean> {
    let awaitDesktopDialogRef: DialogRef<boolean, unknown> | undefined;
    let biometricsResponseReceived = false;
    let setupResult = false;

    const waitForUserDialogPromise = async () => {
      // only show waiting dialog if we have waited for 500 msec to prevent double dialog
      // the os will respond instantly if the dialog shows successfully, and the desktop app will respond instantly if something is wrong
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (biometricsResponseReceived) {
        return;
      }

      awaitDesktopDialogRef = AwaitDesktopDialogComponent.open(this.dialogService);
      await firstValueFrom(awaitDesktopDialogRef.closed);
      if (!biometricsResponseReceived) {
        setupResult = false;
      }
      return;
    };

    const biometricsPromise = async () => {
      try {
        const userId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a.id)),
        );
        const userKey = await this.keyService.getUserKey(userId);
        if (userKey == null) {
          throw new Error("User key unavailable");
        }

        let result = false;
        try {
          result = await this.biometricsService.authenticateWithBiometrics();
          if (result) {
            await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
            result = await this.biometricStateService.getBiometricUnlockSessionReady(userId);
          }
          // FIXME: Remove when updating file. Eslint update
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          result = false;
        }

        // prevent duplicate dialog
        biometricsResponseReceived = true;
        if (awaitDesktopDialogRef) {
          await awaitDesktopDialogRef.close(result);
        }

        if (!result) {
          this.platformUtilsService.showToast(
            "error",
            this.i18nService.t("errorEnableBiometricTitle"),
            this.i18nService.t("errorEnableBiometricDesc"),
          );
          setupResult = false;
          return;
        }
        setupResult = true;
      } catch (e) {
        // prevent duplicate dialog
        biometricsResponseReceived = true;
        if (awaitDesktopDialogRef) {
          await awaitDesktopDialogRef.close(true);
        }

        if (e instanceof Error && e.message == "canceled") {
          setupResult = false;
          return;
        }

        const error = BiometricErrors[(e as Error)?.message as BiometricErrorTypes];
        if (error == null) {
          this.validationService.showError(e);
          setupResult = false;
          return;
        }
        const shouldRetry = await this.dialogService.openSimpleDialog({
          title: { key: error.title },
          content: { key: error.description },
          acceptButtonText: { key: "retry" },
          cancelButtonText: null,
          type: "danger",
        });
        if (shouldRetry) {
          setupResult = await this.trySetupBiometrics();
        } else {
          setupResult = false;
          return;
        }
      } finally {
        if (awaitDesktopDialogRef) {
          await awaitDesktopDialogRef.close(true);
        }
      }
    };

    await Promise.all([waitForUserDialogPromise(), biometricsPromise()]);
    return setupResult;
  }

  async updateRequireMasterPasswordOnRestart(enabled: boolean) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.biometricStateService.setAllowBiometricUnlockOnRestart(!enabled, userId);

    if (!this.form.controls.biometric.value) {
      return;
    }

    const userKey = await this.keyService.getUserKey(userId);
    if (userKey == null) {
      return;
    }

    await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
  }

  async updateAutoBiometricsPrompt() {
    await this.biometricStateService.setPromptAutomatically(
      this.form.value.enableAutoBiometricsPrompt,
    );
  }

  async changePassword() {
    const multiClientPasswordManagementFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM32413_MultiClientPasswordManagement,
    );

    if (multiClientPasswordManagementFlagEnabled) {
      await this.router.navigate(["/" + AuthExtensionRoute.SettingsPassword]);
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "changeMasterPasswordOnWebConfirmation" },
      type: "info",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });
    if (confirmed) {
      const env = await firstValueFrom(this.environmentService.environment$);
      await BrowserApi.createNewTab(env.getWebVaultUrl());
    }
  }

  async twoStep() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "twoStepLoginConfirmationTitle" },
      content: { key: "twoStepLoginConfirmationContent" },
      type: "info",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });
    if (confirmed) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("https://github.com/kevincolemaninc/saigonsafe");
    }
  }

  async openAcctFingerprintDialog() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const publicKey = await firstValueFrom(this.keyService.userPublicKey$(activeUserId));
    if (publicKey == null) {
      this.logService.error(
        "[AccountSecurityComponent] No public key available for the user: " +
          activeUserId +
          " fingerprint can't be displayed.",
      );
      return;
    }
    const fingerprint = await this.keyService.getFingerprint(activeUserId, publicKey);

    const dialogRef = FingerprintDialogComponent.open(this.dialogService, {
      fingerprint,
    });

    return firstValueFrom(dialogRef.closed);
  }

  async lock() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    await this.lockService.lock(activeUserId);
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      type: "info",
    });

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (confirmed) {
      this.messagingService.send("logout", { userId: userId });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get biometricText(): string {
    return getBrowserBiometricUnlockTextKey();
  }

  private usesTouchId(): boolean {
    return browserUsesTouchIdLabel();
  }
}
