#!/usr/bin/env python3

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps


DEFAULT_IMAGES_DIR = Path("apps/browser/src/images")
DEFAULT_POPUP_IMAGES_DIR = Path("apps/browser/src/popup/images")
ICON_SOURCE = "icon.png"
LOCKED_SOURCE = "icon_locked.png"
FULL_LOGO_DARK_SOURCE = "fulllogo-dark@2x.png"
FULL_LOGO_DARK_SURFACE_SOURCE = "fulllogo-dark-surface@2x.png"
POPUP_LOGO_TARGET_WIDTH = 568
POPUP_LOGO_TRIM_ALPHA_THRESHOLD = 32
POPUP_DARK_SURFACE_ALPHA_THRESHOLD = 24
POPUP_DARK_SURFACE_TINT = (221, 251, 255)
POPUP_DARK_SURFACE_TINT_OPACITY = 0.68
POPUP_DARK_SURFACE_CONTRAST = 1.1


@dataclass(frozen=True)
class OutputSpec:
    filename: str
    source: str
    size: int | None
    transform: str = "default"
    output_dir: str = "images"
    source_alpha_threshold: int | None = None


OUTPUT_SPECS: tuple[OutputSpec, ...] = (
    OutputSpec("icon16.png", ICON_SOURCE, 16),
    OutputSpec("icon19.png", ICON_SOURCE, 19),
    OutputSpec("icon32.png", ICON_SOURCE, 32),
    OutputSpec("icon38.png", ICON_SOURCE, 38),
    OutputSpec("icon48.png", ICON_SOURCE, 48),
    OutputSpec("icon96.png", ICON_SOURCE, 96),
    OutputSpec("icon128.png", ICON_SOURCE, 128),
    OutputSpec("icon16_gray.png", ICON_SOURCE, 16, "gray"),
    OutputSpec("icon19_gray.png", ICON_SOURCE, 19, "gray"),
    OutputSpec("icon32_gray.png", ICON_SOURCE, 32, "gray"),
    OutputSpec("icon38_gray.png", ICON_SOURCE, 38, "gray"),
    OutputSpec("icon48_gray.png", ICON_SOURCE, 48, "gray"),
    OutputSpec("icon96_gray.png", ICON_SOURCE, 96, "gray"),
    OutputSpec("icon128_gray.png", ICON_SOURCE, 128, "gray"),
    OutputSpec("icon19_locked.png", LOCKED_SOURCE, 19),
    OutputSpec("icon38_locked.png", LOCKED_SOURCE, 38),
    OutputSpec("berry19.png", ICON_SOURCE, 19, "berry"),
    OutputSpec("berry38.png", ICON_SOURCE, 38, "berry"),
    OutputSpec("icon18_safari.png", ICON_SOURCE, 18, "safari"),
    OutputSpec("icon18_safari@2x.png", ICON_SOURCE, 36, "safari"),
    OutputSpec("icon18_safari_locked.png", LOCKED_SOURCE, 18, "safari"),
    OutputSpec("icon18_safari_locked@2x.png", LOCKED_SOURCE, 36, "safari"),
    OutputSpec("logo-dark@2x.png", FULL_LOGO_DARK_SOURCE, None, output_dir="popup"),
    OutputSpec(
        "logo-white@2x.png",
        FULL_LOGO_DARK_SURFACE_SOURCE,
        None,
        transform="popup_dark_surface",
        output_dir="popup",
        source_alpha_threshold=POPUP_DARK_SURFACE_ALPHA_THRESHOLD,
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate tracked browser icon variants from "
            "apps/browser/src/images/icon.png and icon_locked.png."
        ),
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help=f"Directory containing the icon source PNGs. Default: {DEFAULT_IMAGES_DIR}",
    )
    parser.add_argument(
        "--popup-images-dir",
        type=Path,
        default=DEFAULT_POPUP_IMAGES_DIR,
        help=f"Directory containing popup logo output PNGs. Default: {DEFAULT_POPUP_IMAGES_DIR}",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the files that would be written without modifying them.",
    )
    return parser.parse_args()


def load_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def resize_image(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def threshold_alpha(image: Image.Image, threshold_percent: int) -> Image.Image:
    cutoff = round(255 * threshold_percent / 100)
    alpha = image.getchannel("A").point(lambda value: 255 if value >= cutoff else 0)
    result = image.copy()
    result.putalpha(alpha)
    return result


def trim_transparent_bounds(
    image: Image.Image,
    alpha_threshold: int = POPUP_LOGO_TRIM_ALPHA_THRESHOLD,
) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= alpha_threshold else 0)
    bbox = alpha.getbbox()
    return image.crop(bbox) if bbox else image.copy()


def prepare_popup_logo(image: Image.Image) -> Image.Image:
    trimmed = trim_transparent_bounds(image)
    if trimmed.width <= POPUP_LOGO_TARGET_WIDTH:
        return trimmed

    target_height = max(1, round(trimmed.height * POPUP_LOGO_TARGET_WIDTH / trimmed.width))
    return trimmed.resize((POPUP_LOGO_TARGET_WIDTH, target_height), Image.Resampling.LANCZOS)


def make_grayscale(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    grayscale = ImageOps.grayscale(image)
    result = Image.merge("RGBA", (grayscale, grayscale, grayscale, alpha))
    return result


def make_safari_template(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.paste((0, 0, 0, 255), mask=alpha)
    return result


def make_berry(image: Image.Image) -> Image.Image:
    result = image.copy()
    draw = ImageDraw.Draw(result)
    size = result.width
    badge_diameter = max(6, round(size * 0.42))
    inset = max(1, round(size * 0.06))
    stroke = max(1, round(size * 0.08))

    left = size - badge_diameter - inset
    top = inset
    right = left + badge_diameter
    bottom = top + badge_diameter

    draw.ellipse(
        (left, top, right, bottom),
        fill=(217, 45, 32, 255),
        outline=(255, 255, 255, 255),
        width=stroke,
    )
    return result


def make_popup_dark_surface_logo(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")

    base = image.copy()
    base.putalpha(255)

    overlay = Image.new("RGBA", image.size, (*POPUP_DARK_SURFACE_TINT, 255))
    blended = Image.blend(base, overlay, POPUP_DARK_SURFACE_TINT_OPACITY)

    contrasted_rgb = ImageEnhance.Contrast(blended.convert("RGB")).enhance(
        POPUP_DARK_SURFACE_CONTRAST,
    )
    result = contrasted_rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def apply_transform(image: Image.Image, transform: str) -> Image.Image:
    if transform == "default":
        return image
    if transform == "gray":
        return make_grayscale(image)
    if transform == "safari":
        return make_safari_template(image)
    if transform == "berry":
        return make_berry(image)
    if transform == "popup_dark_surface":
        return make_popup_dark_surface_logo(image)
    raise ValueError(f"Unsupported transform: {transform}")


def resolve_output_path(images_dir: Path, popup_images_dir: Path, spec: OutputSpec) -> Path:
    if spec.output_dir == "images":
        return images_dir / spec.filename
    if spec.output_dir == "popup":
        return popup_images_dir / spec.filename
    raise ValueError(f"Unsupported output directory: {spec.output_dir}")


def generate_images(images_dir: Path, popup_images_dir: Path, dry_run: bool) -> list[Path]:
    icon_source = load_image(images_dir / ICON_SOURCE)
    locked_source = load_image(images_dir / LOCKED_SOURCE)
    full_logo_dark_source = load_image(images_dir / FULL_LOGO_DARK_SOURCE)
    full_logo_dark_surface_source = load_image(images_dir / FULL_LOGO_DARK_SURFACE_SOURCE)
    source_map = {
        ICON_SOURCE: icon_source,
        LOCKED_SOURCE: locked_source,
        FULL_LOGO_DARK_SOURCE: full_logo_dark_source,
        FULL_LOGO_DARK_SURFACE_SOURCE: full_logo_dark_surface_source,
    }

    written: list[Path] = []
    for spec in OUTPUT_SPECS:
        output_path = resolve_output_path(images_dir, popup_images_dir, spec)
        base_image = source_map[spec.source]
        if spec.source_alpha_threshold is not None:
            base_image = threshold_alpha(base_image, spec.source_alpha_threshold)
        if spec.output_dir == "popup":
            resized = prepare_popup_logo(base_image)
        else:
            resized = base_image.copy() if spec.size is None else resize_image(base_image, spec.size)
        transformed = apply_transform(resized, spec.transform)
        if not dry_run:
            transformed.save(output_path)
        written.append(output_path)
    return written


def main() -> int:
    args = parse_args()
    images_dir = args.images_dir.resolve()
    popup_images_dir = args.popup_images_dir.resolve()
    written = generate_images(images_dir, popup_images_dir, args.dry_run)
    for path in written:
        print(path.relative_to(Path.cwd()) if path.is_relative_to(Path.cwd()) else path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
