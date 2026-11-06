import { Overlay } from "@angular/cdk/overlay";
import { TestBed } from "@angular/core/testing";
import { mock, mockDeep } from "jest-mock-extended";
import { firstValueFrom, map, of, takeUntil, throwError } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { anyComplete } from "@bitwarden/common/tools/rx";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import {
  Algorithm,
  AlgorithmMetadata,
  CredentialGeneratorService,
  DefaultCredentialGeneratorService,
  GeneratorMetadata,
  providers,
  GeneratedCredential,
  Profile,
} from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

import { BrowserCipherFormGenerationService } from "./browser-cipher-form-generation.service";

describe("BrowserCipherFormGenerationService", () => {
  const account = { id: "user-1" as UserId } as Account;
  const accountService = mock<AccountService>();
  const generator = mock<CredentialGeneratorService>();
  const history = mock<GeneratorHistoryService>();
  const dialog = mock<DialogService>();
  const log = mock<LogService>();
  let service: BrowserCipherFormGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    accountService.activeAccount$ = of(account);
    history.track.mockResolvedValue(null);
    TestBed.configureTestingModule({
      providers: [
        BrowserCipherFormGenerationService,
        { provide: AccountService, useValue: accountService },
        { provide: CredentialGeneratorService, useValue: generator },
        { provide: GeneratorHistoryService, useValue: history },
        { provide: DialogService, useValue: dialog },
        { provide: Overlay, useValue: mock<Overlay>() },
        { provide: LogService, useValue: log },
      ],
    });
    service = TestBed.inject(BrowserCipherFormGenerationService);
  });

  it.each([Algorithm.password, Algorithm.passphrase])(
    "generates with the saved %s preference and account settings without opening a dialog",
    async (algorithm) => {
      const generated = new GeneratedCredential("generated-secret", "password", new Date());
      generator.preferredAlgorithm$.mockReturnValue(of({ id: algorithm } as AlgorithmMetadata));
      generator.generate$.mockReturnValue(of(generated));
      expect(await service.generatePasswordInPlace()).toBe("generated-secret");
      const dependencies = generator.generate$.mock.calls[0][0];
      expect(await firstValueFrom(dependencies.account$)).toBe(account);
      expect(await firstValueFrom(dependencies.on$)).toEqual({
        source: "cipher form inline",
        algorithm,
        profile: Profile.account,
      });
      expect(history.track).toHaveBeenCalledWith(
        account.id,
        generated.credential,
        generated.category,
        generated.generationDate,
      );
      expect(dialog.open).not.toHaveBeenCalled();
    },
  );

  it("keeps the real generator request alive through asynchronous password generation", async () => {
    const coreProviders = mockDeep<providers.CredentialGeneratorProviders>();
    const system = mock<SystemServiceProvider>();
    system.log.mockReturnValue(mock<SemanticLogger>());
    const core = new DefaultCredentialGeneratorService(coreProviders, system);
    const generated = new GeneratedCredential("async-secret", "password", new Date());
    coreProviders.metadata.metadata.mockReturnValue({
      id: Algorithm.password,
      engine: { create: () => ({ generate: async () => generated }) },
    } as unknown as GeneratorMetadata<object>);
    // Match the lifetime of the state-backed settings provider: closing the account
    // dependency closes settings before an async password can be generated.
    jest.spyOn(core, "settings").mockImplementation(
      (_metadata, dependencies) =>
        dependencies.account$.pipe(
          map(() => ({ length: 24 })),
          takeUntil(anyComplete(dependencies.account$)),
        ) as ReturnType<CredentialGeneratorService["settings"]>,
    );
    generator.preferredAlgorithm$.mockReturnValue(
      of({ id: Algorithm.password } as AlgorithmMetadata),
    );
    generator.generate$.mockImplementation((dependencies) => core.generate$(dependencies));

    expect(await service.generatePasswordInPlace()).toBe("async-secret");
  });

  it("does not generate when no account is active", async () => {
    accountService.activeAccount$ = of(null);
    expect(await service.generatePasswordInPlace()).toBeNull();
    expect(generator.generate$).not.toHaveBeenCalled();
  });

  it("propagates generation errors without recording a password", async () => {
    generator.preferredAlgorithm$.mockReturnValue(
      of({ id: Algorithm.password } as AlgorithmMetadata),
    );
    generator.generate$.mockReturnValue(throwError(() => new Error("generation failed")));
    await expect(service.generatePasswordInPlace()).rejects.toThrow("generation failed");
    expect(history.track).not.toHaveBeenCalled();
  });

  it("still returns the password if recording history fails", async () => {
    generator.preferredAlgorithm$.mockReturnValue(
      of({ id: Algorithm.password } as AlgorithmMetadata),
    );
    generator.generate$.mockReturnValue(
      of(new GeneratedCredential("generated-secret", "password", new Date())),
    );
    history.track.mockRejectedValue(new Error("history unavailable"));
    expect(await service.generatePasswordInPlace()).toBe("generated-secret");
    expect(log.error).toHaveBeenCalled();
  });
});
