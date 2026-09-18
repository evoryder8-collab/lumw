"""Retain the site's Latin characters and standard typography features.

Requires FontTools with WOFF2 support. Source files and the OFL license live
beside the derivatives. All display italics on this site use weight 300.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1] / "public/fonts"
characters = list(range(0x100)) + [0x131, 0x152, 0x153, 0x2BB, 0x2BC, 0x2C6, 0x2DA, 0x2DC]
characters += list(range(0x2000, 0x2070)) + [0x20AC, 0x2122, 0x2212, 0xFEFF, 0xFFFD]
for source, destination, italic in [
    ("cormorant-garamond-latin-var.woff2", "cormorant-garamond-display-var.woff2", False),
    ("cormorant-garamond-italic-latin-var.woff2", "cormorant-garamond-display-italic.woff2", True),
]:
    font = TTFont(root / source)
    options = subset.Options()
    options.layout_features = ["kern", "liga", "clig", "calt", "tnum", "lnum", "pnum", "onum", "locl", "mark", "mkmk"]
    reducer = subset.Subsetter(options=options)
    reducer.populate(unicodes=characters)
    reducer.subset(font)
    if italic:
        font = instantiateVariableFont(font, {"wght": 300}, inplace=True)
    font.save(root / destination)
    print(destination, (root / destination).stat().st_size, "bytes")
