import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DialogRef } from "../dialog.service";
import { DrawerService } from "../drawer.service";

import { DialogComponent } from "./dialog.component";

describe("DialogComponent", () => {
  const createDrawerService = () =>
    ({
      portal: signal(undefined),
      pushWidthPx: signal(0),
      isPushMode: signal(false),
      open: jest.fn(),
      close: jest.fn(),
      declarePushWidth: jest.fn(),
    }) satisfies Partial<DrawerService>;

  it("keeps drawer width constraints in overlay mode", () => {
    TestBed.configureTestingModule({
      imports: [DialogComponent],
      providers: [
        { provide: DrawerService, useValue: createDrawerService() },
        { provide: DialogRef, useValue: { isDrawer: true, disableClose: false } },
      ],
    });

    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentRef.setInput("title", "Drawer");
    fixture.componentRef.setInput("dialogSize", "large");
    fixture.detectChanges();

    expect(fixture.nativeElement.className).toContain("md:tw-max-w-2xl");
  });
});
