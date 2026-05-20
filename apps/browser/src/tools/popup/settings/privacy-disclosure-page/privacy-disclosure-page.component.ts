import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { CardComponent, LinkModule, TypographyModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "privacy-disclosure-page.component.html",
  imports: [
    CommonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CardComponent,
    TypographyModule,
    LinkModule,
  ],
})
export class PrivacyDisclosurePageComponent {}
