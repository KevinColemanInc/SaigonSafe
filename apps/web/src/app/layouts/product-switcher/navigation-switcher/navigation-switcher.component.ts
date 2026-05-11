import { Component } from "@angular/core";
import { map, Observable } from "rxjs";

import { ProductSwitcherItem, ProductSwitcherService } from "../shared/product-switcher.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "navigation-product-switcher",
  templateUrl: "./navigation-switcher.component.html",
  standalone: false,
})
export class NavigationProductSwitcherComponent {
  constructor(private productSwitcherService: ProductSwitcherService) {}

  protected readonly accessibleProducts$: Observable<ProductSwitcherItem[]> =
    this.productSwitcherService.products$.pipe(map((products) => products.bento ?? []));
}
