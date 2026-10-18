"""
PROTOTYPE - throwaway. Question: can the 48 bytes after the RGB entries in a
WWCSE palette resource be regenerated from the 16 colours?

Answer: no. They are hand-tuned per image. Run against a copy of the game:

    python3 -I src/wwcse-palette.prototype.py path/to/CITIES.DAT path/to/CARMEN.DAT

Palette resource (99 bytes after the check byte):
    u8 1, u8 0, u8 16           header
    16 x (r, g, b)              6-bit VGA values
    16 bytes                    CGA table: 4 rows x 16 colours x 2 bits, MSB first
    32 bytes                    EGA table: 4 rows x 16 colours x 4 bits, high nibble first
Each colour's 4 rows form a 2x2 dither tile (usually a checkerboard: row 0 == row 3,
row 1 == row 2) of CGA palette 1 or EGA colours.
"""

import collections
import struct
import sys


def load(path):
    d = open(path, "rb").read()
    off, _ = struct.unpack_from("<IH", d, 0)
    (n,) = struct.unpack_from("<H", d, off)
    out = {}
    for i in range(n):
        rid, o, s = struct.unpack_from("<HIH", d, off + 2 + 8 * i)
        out[rid] = d[o + 1 : o + 1 + s]  # skip check byte
    return out


samples = []
for path in sys.argv[1:]:
    for rid, b in sorted(load(path).items()):
        if len(b) != 99 or b[:3] != bytes([1, 0, 16]):
            continue
        rgb = [tuple(b[3 + 3 * i : 6 + 3 * i]) for i in range(16)]
        cga_t, ega_t = b[51:67], b[67:99]
        for i in range(16):
            cga = tuple((cga_t[4 * row + i // 4] >> (6 - 2 * (i % 4))) & 3 for row in range(4))
            ega = tuple((ega_t[8 * row + i // 2] >> (4 - 4 * (i % 2))) & 15 for row in range(4))
            samples.append((path, rid, i, rgb[i], cga, ega))

by_rgb = collections.defaultdict(lambda: (collections.Counter(), collections.Counter()))
for _, _, _, rgb, cga, ega in samples:
    by_rgb[rgb][0][cga] += 1
    by_rgb[rgb][1][ega] += 1
repeated = {rgb: v for rgb, v in by_rgb.items() if sum(v[0].values()) > 1}
conflicting = {rgb: v for rgb, v in repeated.items() if len(v[0]) > 1 or len(v[1]) > 1}

print(f"{len(samples) // 16} palettes, {len(samples)} colours, {len(by_rgb)} distinct RGB")
print(f"{len(repeated)} RGB values appear more than once; {len(conflicting)} of those map differently somewhere")
for rgb, (cga, ega) in sorted(conflicting.items(), key=lambda kv: -sum(kv[1][0].values()))[:6]:
    print(f"  {rgb}: CGA {dict(cga)}  EGA {dict(ega)}")
