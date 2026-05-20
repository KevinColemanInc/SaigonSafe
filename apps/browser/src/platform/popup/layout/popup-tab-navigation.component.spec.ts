import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";

import { VaultActive, VaultInactive } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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
  const setup = async () => {
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
    TestBed.resetTestingModule();
  });

  it("renders the navigation above the content", async () => {
    const fixture = await setup();
    const host = fixture.nativeElement.querySelector("popup-tab-navigation") as HTMLElement;
    const nav = host.querySelector("nav") as HTMLElement;

    expect(host.firstElementChild).toBe(nav);
    expect(nav.classList.contains("tw-border-b")).toBe(true);
  });

  it("renders the content below the navigation", async () => {
    const fixture = await setup();
    const host = fixture.nativeElement.querySelector("popup-tab-navigation") as HTMLElement;
    const content = host.querySelector('[data-testid="content"]') as HTMLElement;

    expect(host.lastElementChild?.contains(content)).toBe(true);
  });
});
