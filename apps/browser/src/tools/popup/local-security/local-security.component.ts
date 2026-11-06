import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BadgeModule, LinkModule, TypographyModule } from "@bitwarden/components";

import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { LocalSecurityReportService } from "./local-security-report.service";

@Component({
  templateUrl: "local-security.component.html",
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    TypographyModule,
    LinkModule,
    BadgeModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalSecurityComponent {
  protected readonly report$ = inject(LocalSecurityReportService).report$;
}
