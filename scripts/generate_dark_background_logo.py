#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter


DEFAULT_INPUT = Path("apps/browser/src/images/fulllogo-white@2x.png")
DEFAULT_OUTPUT = Path("apps/browser/src/images/fulllogo-dark-surface@2x.png")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert a transparent logo into a version with brighter fills and a "
            "subtle cyan edge/glow so it reads better on dark backgrounds."
        ),
    )
    parser.add_argument("input", nargs="?", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("output", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def load_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def blend_toward(base: Image.Image, target: tuple[int, int, int], amount: float) -> Image.Image:
    overlay = Image.new("RGB", base.size, target)
    return Image.blend(base, overlay, amount)


def brighten_for_dark_background(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")

    contrast = ImageEnhance.Contrast(rgb).enhance(1.06)
    lifted = blend_toward(contrast, (220, 246, 255), 0.18)
    brightened = ImageEnhance.Brightness(lifted).enhance(1.1)
    saturated = ImageEnhance.Color(brightened).enhance(1.08)

    highlight = blend_toward(saturated, (170, 255, 245), 0.11)
    result = Image.merge("RGBA", (*highlight.split(), alpha))
    return result


def build_edge_mask(alpha: Image.Image, width: int) -> Image.Image:
    kernel = max(3, width | 1)
    outer = alpha.filter(ImageFilter.MaxFilter(kernel))
    return ImageChops.subtract(outer, alpha)


def add_glow(base: Image.Image, alpha: Image.Image, width: int) -> Image.Image:
    glow_radius = max(12, round(base.width * 0.018))
    glow_mask = alpha.filter(ImageFilter.GaussianBlur(glow_radius))
    edge_mask = build_edge_mask(alpha, width)

    glow = Image.new("RGBA", base.size, (64, 226, 255, 0))
    glow.putalpha(glow_mask.point(lambda value: min(88, round(value * 0.3))))

    edge = Image.new("RGBA", base.size, (182, 250, 255, 0))
    edge.putalpha(edge_mask.point(lambda value: min(62, round(value * 0.5))))

    composed = Image.alpha_composite(glow, base)
    return Image.alpha_composite(composed, edge)


def convert_logo(input_path: Path, output_path: Path) -> Path:
    source = load_image(input_path)
    alpha = source.getchannel("A")
    brightened = brighten_for_dark_background(source)
    result = add_glow(brightened, alpha, width=max(3, round(source.width * 0.004)))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path)
    return output_path


def main() -> int:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    written = convert_logo(input_path, output_path)
    print(written.relative_to(Path.cwd()) if written.is_relative_to(Path.cwd()) else written)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
