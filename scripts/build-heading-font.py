#!/usr/bin/env python3
"""Build a local LXGW WenKai WOFF2 subset for the site's section headings."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "fonts" / "lxgw-wenkai-headings.woff2"
LABELS = "文章技术生活作品留言关于联系记录写一句话公开示例我的演示"


class H2TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_h2 = False
        self.current: list[str] = []
        self.headings: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "h2":
            self.in_h2 = True
            self.current = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "h2" and self.in_h2:
            self.headings.append("".join(self.current))
            self.current = []
            self.in_h2 = False

    def handle_data(self, data: str) -> None:
        if self.in_h2:
            self.current.append(data)


def compress_unicode_range(codepoints: list[int]) -> str:
    ranges: list[tuple[int, int]] = []
    for codepoint in codepoints:
        if ranges and codepoint == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], codepoint)
        else:
            ranges.append((codepoint, codepoint))
    return ", ".join(
        f"U+{start:04X}" if start == end else f"U+{start:04X}-{end:04X}"
        for start, end in ranges
    )


def load_fonttools():
    try:
        import brotli  # noqa: F401
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError as error:
        raise SystemExit(
            "Font building requires the optional development packages fonttools and brotli. "
            "Install them in a temporary virtual environment; see assets/fonts/README.md."
        ) from error
    return subset, TTFont


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", required=True, type=Path,
        help="path to the official LXGW WenKai Regular TTF (not included in this project)",
    )
    args = parser.parse_args(argv)
    source = args.source.expanduser()
    if not source.is_file():
        parser.error("--source must name an existing Regular TTF file")

    subset, TTFont = load_fonttools()
    source_font = TTFont(source)
    source_weight = source_font["OS/2"].usWeightClass
    if source_weight != 400:
        parser.error(f"expected Regular weight 400, got {source_weight}")

    html_files = sorted(ROOT.glob("*.html"))
    heading_text: list[str] = []
    for html_file in html_files:
        html = H2TextParser()
        html.feed(html_file.read_text(encoding="utf-8"))
        heading_text.extend(html.headings)

    requested = set("".join(heading_text) + LABELS)
    requested.discard("\ufeff")
    codepoints = sorted(ord(char) for char in requested)
    source_cmap = set().union(
        *(table.cmap.keys() for table in source_font["cmap"].tables if table.isUnicode())
    )
    missing = sorted(set(codepoints) - source_cmap)
    if missing:
        missing_list = ", ".join(f"U+{codepoint:04X}" for codepoint in missing)
        parser.error(f"source font lacks required heading characters: {missing_list}")

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.glyph_names = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(source_font)
    source_font.flavor = "woff2"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    source_font.save(OUTPUT)

    built_font = TTFont(OUTPUT)
    output_cmap = set().union(
        *(table.cmap.keys() for table in built_font["cmap"].tables if table.isUnicode())
    )
    if set(codepoints) - output_cmap:
        raise SystemExit("Generated WOFF2 is missing one or more requested codepoints")
    data = OUTPUT.read_bytes()
    if data[:4] != b"wOF2":
        raise SystemExit("Generated font does not have a valid WOFF2 signature")

    print(f"Output: {OUTPUT.relative_to(ROOT)}")
    print(f"Bytes: {len(data):,}")
    print(f"Static weight: {built_font['OS/2'].usWeightClass}")
    print(f"Coverage: {len(codepoints)} codepoints; missing: 0")
    print(f"Copy this unicode-range into site.css:\nunicode-range: {compress_unicode_range(codepoints)};")
    return 0


if __name__ == "__main__":
    sys.exit(main())
