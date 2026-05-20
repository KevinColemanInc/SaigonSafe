import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CardComponent, LinkModule, TypographyModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "download-bitwarden.component.html",
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CardComponent,
    TypographyModule,
    LinkModule,
  ],
})
export class DownloadBitwardenComponent implements OnInit {
  readonly repoUrl = "https://github.com/kevincolemaninc/saigonsafe";
  readonly releasesUrl = "https://github.com/kevincolemaninc/saigonsafe/releases";
  readonly mobileDownloads = [
    {
      platform: "iPhone & iPad",
      description: "Track mobile release availability and source updates from the Saigon Safe repository.",
      href: this.releasesUrl,
      cta: "View release feed",
    },
    {
      platform: "Android",
      description: "Use the Saigon Safe release page for Android build availability and project updates.",
      href: this.releasesUrl,
      cta: "Open GitHub releases",
    },
  ];

  constructor(
    private nudgesService: NudgesService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.nudgesService.dismissNudge(NudgeType.DownloadBitwarden, userId);
  }
}
