import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { GlobalStateProvider, KeyDefinition, THEMING_DISK } from "@bitwarden/common/platform/state";

export const PopupColorPalettes = {
  KitschMaster: "kitsch-master",
  ContemporaryRealism: "contemporary-realism",
  ClassicismMaster: "classicism-master",
  Spectralism: "spectralism",
  Verism: "verism",
} as const;

export type PopupColorPalette = (typeof PopupColorPalettes)[keyof typeof PopupColorPalettes];

export const DEFAULT_POPUP_COLOR_PALETTE = PopupColorPalettes.ContemporaryRealism;

export const POPUP_COLOR_PALETTE = new KeyDefinition<PopupColorPalette>(
  THEMING_DISK,
  "popupColorPalette",
  {
    deserializer: (value) => value,
  },
);

export type PopupColorPaletteOption = {
  description: string;
  label: string;
  preview: {
    dark: PopupColorPalettePreview;
    light: PopupColorPalettePreview;
  };
  value: PopupColorPalette;
};

export type PopupColorPalettePreview = {
  accent: string;
  surface: string;
  surfaceAlt: string;
  swatches: string[];
  text: string;
};

export const POPUP_COLOR_PALETTE_OPTIONS: PopupColorPaletteOption[] = [
  {
    value: PopupColorPalettes.ContemporaryRealism,
    label: "Saigon Safe",
    description: "Clean white surfaces with navy structure and a security teal accent.",
    preview: {
      light: {
        accent: "#082C5F",
        surface: "#FFFFFF",
        surfaceAlt: "#EDF4FB",
        swatches: ["#082C5F", "#0BA69C", "#D8E6F5", "#FFFFFF"],
        text: "#082C5F",
      },
      dark: {
        accent: "#0BA69C",
        surface: "#082C5F",
        surfaceAlt: "#06234C",
        swatches: ["#082C5F", "#0BA69C", "#5F86BF", "#FFFFFF"],
        text: "#FFFFFF",
      },
    },
  },
  {
    value: PopupColorPalettes.ClassicismMaster,
    label: "Classicism Master",
    description: "Warm stone neutrals with an archival brown accent.",
    preview: {
      light: {
        accent: "#6B5538",
        surface: "#FAF8F5",
        surfaceAlt: "#F1ECE4",
        swatches: ["#231C1A", "#6B5538", "#B09165", "#FAF8F5"],
        text: "#312A25",
      },
      dark: {
        accent: "#D8C1A5",
        surface: "#312A25",
        surfaceAlt: "#211B18",
        swatches: ["#312A25", "#4C3326", "#D8C1A5", "#FAF8F5"],
        text: "#FAF8F5",
      },
    },
  },
  {
    value: PopupColorPalettes.Verism,
    label: "Verism",
    description: "Soft parchment surfaces with a restrained walnut accent.",
    preview: {
      light: {
        accent: "#9D7557",
        surface: "#FCFBF6",
        surfaceAlt: "#F1EFD2",
        swatches: ["#352A2E", "#9D7557", "#C1AC84", "#FCFBF6"],
        text: "#352A2E",
      },
      dark: {
        accent: "#D4C08C",
        surface: "#352A2E",
        surfaceAlt: "#251D21",
        swatches: ["#352A2E", "#764035", "#D4C08C", "#FCFBF6"],
        text: "#FCFBF6",
      },
    },
  },
  {
    value: PopupColorPalettes.KitschMaster,
    label: "Kitsch Master",
    description: "Creamy neutrals with a cognac accent.",
    preview: {
      light: {
        accent: "#945537",
        surface: "#FBFAF8",
        surfaceAlt: "#F2EDE6",
        swatches: ["#29201D", "#945537", "#B69B7C", "#FBFAF8"],
        text: "#29201D",
      },
      dark: {
        accent: "#C9A17A",
        surface: "#2E2522",
        surfaceAlt: "#211917",
        swatches: ["#2E2522", "#594032", "#C9A17A", "#FBFAF8"],
        text: "#FBFAF8",
      },
    },
  },
  {
    value: PopupColorPalettes.Spectralism,
    label: "Spectralism",
    description: "Cool slate structure with a quiet amber lift.",
    preview: {
      light: {
        accent: "#4C536A",
        surface: "#F7F7F9",
        surfaceAlt: "#ECECF0",
        swatches: ["#4C536A", "#7E7456", "#C3C3CA", "#F7F7F9"],
        text: "#2D323D",
      },
      dark: {
        accent: "#C3CBD8",
        surface: "#2D323D",
        surfaceAlt: "#20242D",
        swatches: ["#2D323D", "#40475D", "#C3CBD8", "#F7F7F9"],
        text: "#F7F7F9",
      },
    },
  },
];

@Injectable({ providedIn: "root" })
export class PopupColorPaletteService {
  private readonly state = inject(GlobalStateProvider).get(POPUP_COLOR_PALETTE);

  readonly selectedPalette$: Observable<PopupColorPalette> = this.state.state$.pipe(
    map((palette) =>
      Object.values(PopupColorPalettes).includes(palette as PopupColorPalette)
        ? (palette as PopupColorPalette)
        : DEFAULT_POPUP_COLOR_PALETTE,
    ),
  );

  init(document: Document = globalThis.document) {
    this.selectedPalette$.subscribe((palette) => {
      document.documentElement.classList.remove(
        ...Object.values(PopupColorPalettes).map((value) => this.getPaletteClassName(value)),
      );
      document.documentElement.classList.add(this.getPaletteClassName(palette));
    });
  }

  async setSelectedPalette(palette: PopupColorPalette) {
    await this.state.update(() => palette, {
      shouldUpdate: (currentPalette) => currentPalette !== palette,
    });
  }

  private getPaletteClassName(palette: PopupColorPalette) {
    return `color-palette-${palette}`;
  }
}
