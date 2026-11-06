import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { AdditionalOptionsComponent } from "./additional-options.component";

describe("AdditionalOptionsComponent", () => {
  let fixture: ComponentFixture<AdditionalOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdditionalOptionsComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdditionalOptionsComponent);
  });

  it("shows notes loaded after the view opens and updates on subsequent loads", () => {
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector("textarea");
    expect(textarea.value).toBe("");
    fixture.componentRef.setInput("notes", "First line\nSecond line <literal text>");
    fixture.detectChanges();
    expect(textarea.value).toBe("First line\nSecond line <literal text>");
    fixture.componentRef.setInput("notes", "Updated notes");
    fixture.detectChanges();
    expect(textarea.value).toBe("Updated notes");
    expect(textarea.readOnly).toBe(true);
  });

  it("updates the displayed notes after the browser restores the textarea value", () => {
    fixture.componentRef.setInput("notes", "Original notes");
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector("textarea");

    // A restored form value can differ from the textarea's default text content.
    // Updating child text alone no longer updates the displayed value in that state.
    textarea.value = "";
    fixture.componentRef.setInput("notes", "New notes\nWith another line");
    fixture.detectChanges();

    expect(textarea.value).toBe("New notes\nWith another line");
  });
});
