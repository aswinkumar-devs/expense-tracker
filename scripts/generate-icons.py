#!/usr/bin/env python3
"""Generate all PWA icon sizes from a source image."""
import sys
import os
from PIL import Image

SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 512]
ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ICONS_DIR, "app-icon.png")
    if not os.path.exists(src):
        print(f"ERROR: source image not found: {src}", file=sys.stderr)
        sys.exit(1)

    img = Image.open(src).convert("RGBA")
    os.makedirs(ICONS_DIR, exist_ok=True)

    for size in SIZES:
        resized = img.resize((size, size), Image.LANCZOS)
        out = os.path.join(ICONS_DIR, f"icon-{size}.png")
        resized.save(out, "PNG")
        print(f"Generated {out} ({size}x{size})")

    print(f"\nAll {len(SIZES)} icons generated in {ICONS_DIR}")

if __name__ == "__main__":
    main()
