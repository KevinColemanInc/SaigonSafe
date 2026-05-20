import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService, BiometricStateService, BiometricsStatus } from "@bitwarden/key-management";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

import { BackgroundBrowserBiometricsService } from "./background-browser-biometrics.service";

describe("background browser biometrics service tests", function () {
  let service: BackgroundBrowserBiometricsService;

  const nativeMessagingBackground = mock<NativeMessagingBackground>();
  const logService = mock<LogService>();
  const keyService = mock<KeyService>();
  const biometricStateService = mock<BiometricStateService>();
  const messagingService = mock<MessagingService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const pinService = mock<PinServiceAbstraction>();

  beforeEach(() => {
    jest.resetAllMocks();
    biometricStateService.biometricUnlockEnabled$.mockReturnValue(of(false));
    biometricStateService.getAllowBiometricUnlockOnRestart.mockResolvedValue(true);
    service = new BackgroundBrowserBiometricsService(
      () => nativeMessagingBackground,
      logService,
      keyService,
      biometricStateService,
      messagingService,
      vaultTimeoutSettingsService,
      pinService,
    );
  });

  describe("canEnableBiometricUnlock", () => {
    const table: [BiometricsStatus, boolean, boolean][] = [
      // status, already enabled, expected

      // if the setting is not already on, it should only be possible to enable it if biometrics are available
      [BiometricsStatus.Available, false, true],
      [BiometricsStatus.HardwareUnavailable, false, false],
      [BiometricsStatus.NotEnabledInConnectedDesktopApp, false, false],
      [BiometricsStatus.DesktopDisconnected, false, false],

      // if the setting is already on, it should always be possible to disable it
      [BiometricsStatus.Available, true, true],
      [BiometricsStatus.HardwareUnavailable, true, true],
      [BiometricsStatus.NotEnabledInConnectedDesktopApp, true, true],
      [BiometricsStatus.DesktopDisconnected, true, true],
    ];
    test.each(table)(
      "status: %s, already enabled: %s, expected: %s",
      async (status, alreadyEnabled, expected) => {
        service.getBiometricsStatus = jest.fn().mockResolvedValue(status);
        vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(alreadyEnabled);
        const result = await service.canEnableBiometricUnlock();

        expect(result).toBe(expected);
      },
    );
  });

  describe("setBiometricProtectedUnlockKeyForUser", () => {
    const userId = "user-1" as UserId;
    const userKey = new SymmetricCryptoKey(new Uint8Array(64));

    it("stores a session key and persists it when restart unlock is allowed", async () => {
      nativeMessagingBackground.callCommand.mockResolvedValue({ response: true });
      nativeMessagingBackground.connected = true;

      await service.setBiometricProtectedUnlockKeyForUser(userId, userKey);

      expect(nativeMessagingBackground.callCommand).toHaveBeenNthCalledWith(1, {
        command: "setBiometricUnlockKeyForUser",
        userId,
        keyB64: userKey.keyB64,
      });
      expect(nativeMessagingBackground.callCommand).toHaveBeenNthCalledWith(2, {
        command: "persistBiometricUnlockKeyForUser",
        userId,
        keyB64: userKey.keyB64,
      });
      expect(biometricStateService.setBiometricUnlockSessionReady).toHaveBeenCalledWith(
        true,
        userId,
      );
    });

    it("skips persistence when restart unlock is not allowed", async () => {
      nativeMessagingBackground.callCommand.mockResolvedValue({ response: true });
      nativeMessagingBackground.connected = true;
      biometricStateService.getAllowBiometricUnlockOnRestart.mockResolvedValue(false);

      await service.setBiometricProtectedUnlockKeyForUser(userId, userKey);

      expect(nativeMessagingBackground.callCommand).toHaveBeenCalledTimes(1);
      expect(nativeMessagingBackground.callCommand).toHaveBeenCalledWith({
        command: "setBiometricUnlockKeyForUser",
        userId,
        keyB64: userKey.keyB64,
      });
    });
  });
});
