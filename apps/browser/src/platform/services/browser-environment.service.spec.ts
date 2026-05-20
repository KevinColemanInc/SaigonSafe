import { firstValueFrom } from "rxjs";
import { mock } from "jest-mock-extended";

import {
  EnvironmentUrls,
  GLOBAL_ENVIRONMENT_KEY,
} from "@bitwarden/common/platform/services/default-environment.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserEnvironmentService } from "./browser-environment.service";

describe("BrowserEnvironmentService", () => {
  const userId = "00000000-0000-1000-a000-000000000001" as UserId;

  it("resets the legacy localhost managed environment back to Bitwarden cloud when no managed environment exists", async () => {
    const accountService = mockAccountServiceWith(userId);
    const stateProvider = new FakeStateProvider(accountService);
    const sut = new BrowserEnvironmentService(mock<LogService>(), stateProvider, accountService);
    const urls = new EnvironmentUrls();
    urls.base = "https://localhost:8080";

    stateProvider.global.getFake(GLOBAL_ENVIRONMENT_KEY).stateSubject.next({
      region: Region.SelfHosted,
      urls,
    });

    jest.spyOn(sut, "getManagedEnvironment").mockResolvedValue(null);

    await sut.syncManagedEnvironment();

    const environment = await firstValueFrom(sut.globalEnvironment$);

    expect(environment.getRegion()).toBe(Region.US);
    expect(environment.getApiUrl()).toBe("https://api.bitwarden.com");
    expect(environment.getIdentityUrl()).toBe("https://identity.bitwarden.com");
    expect(environment.getWebVaultUrl()).toBe("https://vault.bitwarden.com");
  });

  it("does not reset a real self-hosted environment when no managed environment exists", async () => {
    const accountService = mockAccountServiceWith(userId);
    const stateProvider = new FakeStateProvider(accountService);
    const sut = new BrowserEnvironmentService(mock<LogService>(), stateProvider, accountService);
    const urls = new EnvironmentUrls();
    urls.base = "https://vault.example.com";

    stateProvider.global.getFake(GLOBAL_ENVIRONMENT_KEY).stateSubject.next({
      region: Region.SelfHosted,
      urls,
    });

    jest.spyOn(sut, "getManagedEnvironment").mockResolvedValue(null);

    await sut.syncManagedEnvironment();

    const environment = await firstValueFrom(sut.globalEnvironment$);

    expect(environment.getRegion()).toBe(Region.SelfHosted);
    expect(environment.getWebVaultUrl()).toBe("https://vault.example.com");
    expect(environment.getApiUrl()).toBe("https://vault.example.com/api");
  });

  it("applies the managed environment when one is configured", async () => {
    const accountService = mockAccountServiceWith(userId);
    const stateProvider = new FakeStateProvider(accountService);
    const sut = new BrowserEnvironmentService(mock<LogService>(), stateProvider, accountService);

    jest.spyOn(sut, "getManagedEnvironment").mockResolvedValue({
      base: "https://managed.example.com",
    });

    await sut.syncManagedEnvironment();

    const environment = await firstValueFrom(sut.globalEnvironment$);

    expect(environment.getRegion()).toBe(Region.SelfHosted);
    expect(environment.getWebVaultUrl()).toBe("https://managed.example.com");
    expect(environment.getApiUrl()).toBe("https://managed.example.com/api");
    expect(environment.getIdentityUrl()).toBe("https://managed.example.com/identity");
  });
});
