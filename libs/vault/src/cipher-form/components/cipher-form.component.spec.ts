import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { ToastService } from "@bitwarden/components";

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";
import { CipherFormService } from "../abstractions/cipher-form.service";
import { CipherFormCacheService } from "../services/default-cipher-form-cache.service";

import { CipherFormComponent } from "./cipher-form.component";

describe("CipherFormComponent", () => {
  let component: CipherFormComponent;
  let fixture: ComponentFixture<CipherFormComponent>;

  const decryptCipher = jest.fn().mockResolvedValue(new CipherView());

  const mockAccountService = mock<AccountService>();
  const mockCipherArchiveService = mock<CipherArchiveService>();
  const mockAddEditFormService = { saveCipher: jest.fn(), decryptCipher };

  beforeEach(async () => {
    decryptCipher.mockClear();

    await TestBed.configureTestingModule({
      imports: [CipherFormComponent, ReactiveFormsModule],
      providers: [
        { provide: ChangeDetectorRef, useValue: {} },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: CipherFormService, useValue: mockAddEditFormService },
        {
          provide: CipherFormCacheService,
          useValue: { init: jest.fn(), getCachedCipherView: jest.fn(), clearCache: jest.fn() },
        },
        {
          provide: ViewCacheService,
          useValue: {
            signal: jest.fn(() => {
              const signalFn = (): any => null;
              signalFn.set = jest.fn();
              return signalFn;
            }),
          },
        },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: AccountService, useValue: mockAccountService },
        { provide: CipherArchiveService, useValue: mockCipherArchiveService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CipherFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create the component", () => {
    expect(component).toBeTruthy();
  });

  describe("submit", () => {
    beforeEach(() => {
      component.config = { mode: "edit" } as CipherFormConfig;

      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].archivedDate = new Date();
    });

    it("should remove archivedDate when user cannot archive and cipher is archived", async () => {
      mockAccountService.activeAccount$ = of({ id: "user-id" }) as Observable<Account | null>;
      mockCipherArchiveService.userCanArchive$.mockReturnValue(of(false));
      mockAddEditFormService.saveCipher = jest.fn().mockResolvedValue(new CipherView());

      const originalArchivedDate = component["updatedCipherView"]?.archivedDate;
      expect(originalArchivedDate).not.toBeNull();

      await component.submit();

      expect(mockAddEditFormService.saveCipher.mock.calls[0][0].archivedDate).toBeNull();
      expect(mockCipherArchiveService.userCanArchive$).toHaveBeenCalledWith("user-id");
    });
  });

  describe("auto-save", () => {
    let notes: FormControl<string>;

    beforeEach(async () => {
      mockAddEditFormService.saveCipher = jest.fn().mockImplementation(async (cipher) => cipher);
      decryptCipher.mockImplementation(async () => new CipherView());
      mockAccountService.activeAccount$ = of({ id: "user-id" }) as Observable<Account | null>;
      mockCipherArchiveService.userCanArchive$.mockReturnValue(of(true));
      component.config = { mode: "edit", originalCipher: new Cipher() } as CipherFormConfig;
      component.autoSaveEnabled = true;
      await component.init();
      notes = new FormControl("", { nonNullable: true });
      notes.valueChanges.subscribe((value) => {
        component.patchCipher((cipher) => {
          cipher.notes = value;
          return cipher;
        });
      });
      component.registerChildForm(
        "additionalOptions",
        new FormGroup({ notes, reprompt: new FormControl(false) }),
      );
      component.ngAfterViewChecked();
    });

    function edit(value: string) {
      notes.markAsDirty();
      notes.setValue(value);
    }

    it("waits three seconds after the last edit and stays on the edit screen", fakeAsync(() => {
      const saved = jest.spyOn(component.cipherSaved, "emit");
      edit("first edit");
      tick(2000);
      edit("latest edit");
      tick(2999);
      expect(mockAddEditFormService.saveCipher).not.toHaveBeenCalled();
      expect(component.autoSaveStatus).toBe("autoSavePending");
      tick(1);
      flushMicrotasks();
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
      expect(mockAddEditFormService.saveCipher.mock.calls[0][0].notes).toBe("latest edit");
      expect(component.autoSaveStatus).toBe("autoSaveSaved");
      expect(saved).not.toHaveBeenCalled();
    }));

    it("saves changes made through generators or dialogs without a dirty flag", fakeAsync(() => {
      notes.setValue("generated value");
      tick(3000);
      flushMicrotasks();
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
    }));

    it("does not save initialization or read-only sessions", fakeAsync(() => {
      component["readyForAutoSave"] = false;
      notes.setValue("initial notes");
      component.ngAfterViewChecked();
      tick(3000);
      expect(mockAddEditFormService.saveCipher).not.toHaveBeenCalled();
      component.autoSaveEnabled = false;
      edit("manual-only edit");
      tick(3000);
      expect(mockAddEditFormService.saveCipher).not.toHaveBeenCalled();
    }));

    it("keeps invalid edits unsaved and prevents closing", fakeAsync(() => {
      notes.setErrors({ invalid: true });
      component["editRevision"] = 1;
      let flushed: boolean | undefined;
      void component.flushAutoSave().then((result) => (flushed = result));
      flushMicrotasks();
      expect(flushed).toBe(false);
      expect(mockAddEditFormService.saveCipher).not.toHaveBeenCalled();
    }));

    it("keeps failed edits and permits a manual retry", fakeAsync(() => {
      const cache = component["cipherFormCacheService"];
      const clear = jest.spyOn(cache, "clearCache");
      mockAddEditFormService.saveCipher.mockRejectedValueOnce(new Error("offline"));
      edit("keep these notes");
      tick(3000);
      flushMicrotasks();
      expect(component.autoSaveStatus).toBe("autoSaveFailed");
      expect(clear).not.toHaveBeenCalled();
      expect(notes.value).toBe("keep these notes");
      void component.submit();
      flushMicrotasks();
      expect(component.autoSaveStatus).toBe("autoSaveSaved");
      expect(clear).toHaveBeenCalledTimes(1);
    }));

    it("preserves the edit if a failed endpoint mutates its input", fakeAsync(() => {
      mockAddEditFormService.saveCipher.mockImplementationOnce(async (cipher) => {
        cipher.notes = "mutated by endpoint";
        cipher.organizationId = null;
        throw new Error("offline");
      });
      component["updatedCipherView"]!.organizationId = "organization-1";
      edit("original edit");
      tick(3000);
      flushMicrotasks();
      expect(component["updatedCipherView"]!.notes).toBe("original edit");
      expect(component["updatedCipherView"]!.organizationId).toBe("organization-1");
      expect(component.autoSaveStatus).toBe("autoSaveFailed");
    }));

    it("flushes pending edits before closing", fakeAsync(() => {
      edit("close immediately");
      let flushed: boolean | undefined;
      void component.flushAutoSave().then((result) => (flushed = result));
      flushMicrotasks();
      expect(flushed).toBe(true);
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
      tick(3000);
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
    }));

    it("serializes manual and automatic saves and preserves disabled controls", fakeAsync(() => {
      let finishSave: (value: CipherView) => void;
      mockAddEditFormService.saveCipher.mockImplementationOnce(
        () => new Promise((resolve) => (finishSave = resolve)),
      );
      component["cipherForm"].controls.additionalOptions!.controls.reprompt.disable({
        emitEvent: false,
      });
      edit("in flight");
      tick(3000);
      flushMicrotasks();
      expect(component.autoSaveStatus).toBe("autoSaveSaving");
      void component.submit();
      flushMicrotasks();
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
      finishSave!(component["updatedCipherView"]!);
      flushMicrotasks();
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(2);
      expect(notes.enabled).toBe(true);
      expect(component["cipherForm"].controls.additionalOptions!.controls.reprompt.disabled).toBe(
        true,
      );
    }));

    it("waits for an active auto-save before closing without writing twice", fakeAsync(() => {
      let finishSave: (value: CipherView) => void;
      mockAddEditFormService.saveCipher.mockImplementationOnce(
        () => new Promise((resolve) => (finishSave = resolve)),
      );
      edit("pending close");
      tick(3000);
      flushMicrotasks();
      let flushed: boolean | undefined;
      void component.flushAutoSave().then((result) => (flushed = result));
      flushMicrotasks();
      expect(flushed).toBeUndefined();
      finishSave!(component["updatedCipherView"]!);
      flushMicrotasks();
      expect(flushed).toBe(true);
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
    }));

    it("preserves typing during a save and debounces the newer edit", fakeAsync(() => {
      let finishSave: (value: CipherView) => void;
      mockAddEditFormService.saveCipher.mockImplementationOnce(
        () => new Promise((resolve) => (finishSave = resolve)),
      );
      edit("first");
      tick(3000);
      flushMicrotasks();
      expect(notes.enabled).toBe(true);
      edit("newer edit");
      tick(3000);
      edit("latest edit");
      finishSave!(mockAddEditFormService.saveCipher.mock.calls[0][0]);
      flushMicrotasks();
      expect(component["updatedCipherView"]!.notes).toBe("latest edit");
      expect(component.autoSaveStatus).toBe("autoSavePending");
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
      tick(2999);
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(1);
      tick(1);
      flushMicrotasks();
      expect(mockAddEditFormService.saveCipher).toHaveBeenCalledTimes(2);
      expect(mockAddEditFormService.saveCipher.mock.calls[1][0].notes).toBe("latest edit");
      expect(component.autoSaveStatus).toBe("autoSaveSaved");
    }));

    it("cancels the debounce when the edit view is destroyed", fakeAsync(() => {
      edit("pending");
      fixture.destroy();
      tick(3000);
      expect(mockAddEditFormService.saveCipher).not.toHaveBeenCalled();
    }));
  });

  describe("website", () => {
    it("should return null if updatedCipherView is null", () => {
      component["updatedCipherView"] = null as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login is undefined", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = undefined as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login is null", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = null as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is undefined", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: undefined } as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is null", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: null } as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is an empty array", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: [] } as any;
      expect(component.website).toBeNull();
    });

    it("should return updatedCipherView if login.uris contains at least one URI", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: [{ uri: "https://example.com" }] } as any;
      expect(component.website).toEqual("https://example.com");
    });
  });

  describe("clone", () => {
    const cipherView = new CipherView();
    cipherView.id = "test-id";
    cipherView.key = "existingCipherKey" as any;
    cipherView.login.fido2Credentials = [new Fido2CredentialView()];
    cipherView.attachments = [new AttachmentView()];

    beforeEach(() => {
      component.config = {
        mode: "clone",
        originalCipher: new Cipher(),
      } as CipherFormConfig;

      decryptCipher.mockResolvedValue(cipherView);
    });

    it("clears id on updatedCipherView", async () => {
      await component.ngOnInit();

      expect(component["updatedCipherView"]?.id).toBeNull();
    });

    it("clears key on updatedCipherView so a new cipher key is generated", async () => {
      await component.ngOnInit();

      expect(component["updatedCipherView"]?.key).toBeUndefined();
    });

    it("clears fido2Credentials on updatedCipherView", async () => {
      await component.ngOnInit();

      expect(component["updatedCipherView"]?.login.fido2Credentials).toBeNull();
    });

    it("clears attachments on updatedCipherView", async () => {
      await component.ngOnInit();

      expect(component["updatedCipherView"]?.attachments).toEqual([]);
    });

    it("does not clear archiveDate on updatedCipherView", async () => {
      cipherView.archivedDate = new Date();
      decryptCipher.mockResolvedValue(cipherView);

      await component.ngOnInit();

      expect(component["updatedCipherView"]?.archivedDate).toBe(cipherView.archivedDate);
    });
  });

  describe("enableFormFields", () => {
    beforeEach(() => {
      // disable the form so enabling occurs
      component.disableFormFields();
    });

    it("only enables the form when it is disabled", () => {
      jest.spyOn(component["cipherForm"], "enable");
      component.enableFormFields();

      expect(component["cipherForm"].enable).toHaveBeenCalled();

      component.enableFormFields();
      component.enableFormFields();

      // enable is only called once
      expect(component["cipherForm"].enable).toHaveBeenCalledTimes(1);
    });

    it("emits formStatusChange$", (done) => {
      component.formStatusChange$.subscribe((status) => {
        expect(status).toBe("enabled");
        done();
      });

      component.enableFormFields();
    });
  });
});
