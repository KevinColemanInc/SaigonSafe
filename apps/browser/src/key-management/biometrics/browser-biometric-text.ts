const MAC_OS_USER_AGENT_PATTERN = /(Macintosh|Mac OS X)/i;

export function browserUsesTouchIdLabel(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return MAC_OS_USER_AGENT_PATTERN.test(navigator.userAgent);
}

export function getBrowserBiometricUnlockTextKey(): string {
  return browserUsesTouchIdLabel() ? "unlockWithTouchId" : "unlockWithBiometrics";
}
