import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";

import { VaultActive, VaultInactive } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import BrowserPopupUtils from "../../browser/browser-popup-utils";

import { NavButton, PopupTabNavigationComponent } from "./popup-tab-navigation.component";

@Component({
  template: `
    <popup-tab-navigation [navButtons]="navButtons">
      <div data-testid="content">Content</div>
    </popup-tab-navigation>
  `,
  imports: [PopupTabNavigationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  protected navButtons: NavButton[] = [
    {
      label: "vault",
      page: "/tabs/vault",
      icon: VaultInactive,
      iconActive: VaultActive,
    },
  ];
}

describe("PopupTabNavigationComponent", () => {
  const setup = async (isSidebar: boolean) => {
    jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(isSidebar);

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([]), TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    return fixture;
  };

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("renders the navigation above the content in sidebar view", async () => {
    const fixture = await setup(true);
    const host = fixture.nativeElement.querySelector("popup-tab-navigation") as HTMLElement;
    const footer = host.querySelector("footer") as HTMLElement;

    expect(host.firstElementChild).toBe(footer);
    expect(footer.classList.contains("tw-border-b")).toBe(true);
    expect(footer.classList.contains("tw-border-t")).toBe(false);
  });

  it("renders the navigation below the content outside sidebar view", async () => {
    const fixture = await setup(false);
    const host = fixture.nativeElement.querySelector("popup-tab-navigation") as HTMLElement;
    const footer = host.querySelector("footer") as HTMLElement;

    expect(host.lastElementChild).toBe(footer);
    expect(footer.classList.contains("tw-border-t")).toBe(true);
    expect(footer.classList.contains("tw-border-b")).toBe(false);
  });
});
