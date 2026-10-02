"""Regenerate everything in brand/.

The marks are small enough to read by hand, but they share one geometry and one
set of colour hooks, so they are generated rather than hand-kept-in-sync.

    python tools/build-brand.py

Colour hooks: every mark reads --peri-body and --peri-bulb (plus --peri-tile-*
and --peri-screen on the badge), each with her own colour as the fallback. Set
them on any ancestor and an INLINED svg follows; an <img src="...svg"> cannot
see page CSS and will always show the fallback.
"""

import io
import os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'brand')

# ---------------------------------------------------------------- her colours
TEAL, PERI = '#59AFB1', '#8E94F2'
BODY_VAR = 'var(--peri-body, %s)' % TEAL
BULB_VAR = 'var(--peri-bulb, %s)' % PERI

# ------------------------------------------------- smooth geometry (32x32)
# mapped 1:1 off the sprite grid: X = 2 + gx*2, Y = 3 + gy*2
BODY = ("M 7.83 10.54 A 4 4 0 0 1 10.63 9.4 L 21.37 9.4 A 4 4 0 0 1 24.17 10.54 "
        "L 26.5 12.83 A 5 5 0 0 1 28 16.4 L 28 19.63 A 5 5 0 0 1 27.48 21.85 "
        "L 24.67 27.56 A 2.6 2.6 0 0 0 24.4 28.71 L 24.4 29.05 A 0.95 0.95 0 0 1 23.45 30 "
        "L 20.5 30 A 1.3 1.3 0 0 1 19.22 28.91 L 19.2 28.8 A 1.44 1.44 0 0 0 17.78 27.6 "
        "L 14.22 27.6 A 1.44 1.44 0 0 0 12.8 28.8 L 12.78 28.91 A 1.3 1.3 0 0 1 11.5 30 "
        "L 8.55 30 A 0.95 0.95 0 0 1 7.6 29.05 L 7.6 28.71 A 2.6 2.6 0 0 0 7.33 27.56 "
        "L 4.52 21.85 A 5 5 0 0 1 4 19.63 L 4 16.4 A 5 5 0 0 1 5.5 12.83 Z")
EYE_L = ("M 8 16.4 A 1.3 1.3 0 0 1 9.3 15.1 L 10.7 15.1 A 1.3 1.3 0 0 1 12 16.4 "
         "L 12 17.7 A 1.3 1.3 0 0 1 10.7 19 L 9.3 19 A 1.3 1.3 0 0 1 8 17.7 Z")
EYE_R = ("M 20 16.4 A 1.3 1.3 0 0 1 21.3 15.1 L 22.7 15.1 A 1.3 1.3 0 0 1 24 16.4 "
         "L 24 17.7 A 1.3 1.3 0 0 1 22.7 19 L 21.3 19 A 1.3 1.3 0 0 1 20 17.7 Z")
STEM = ("M 14.85 5.75 A 1.15 1.15 0 0 1 16 4.6 L 16 4.6 A 1.15 1.15 0 0 1 17.15 5.75 "
        "L 17.15 8.85 A 1.15 1.15 0 0 1 16 10 L 16 10 A 1.15 1.15 0 0 1 14.85 8.85 Z")
MOUTH = ("M 13.7 22.2 A 0.9 0.9 0 0 1 14.6 21.3 L 17.4 21.3 A 0.9 0.9 0 0 1 18.3 22.2 "
         "L 18.3 22.2 A 0.9 0.9 0 0 1 17.4 23.1 L 14.6 23.1 A 0.9 0.9 0 0 1 13.7 22.2 Z")
FACE = ' '.join([BODY, EYE_L, EYE_R, MOUTH])
BULB_C = (16, 4.6, 2.6)

# ---------------------------------------------------------- the sprite grid
GRID = ["      AA      ", "      BB      ", "   BBBBBBBB   ", "  BBBBBBBBBB  ",
        " BBBBBBBBBBBB ", " BBBBBBBBBBBB ", " BBBBBBBBBBBB ", " BBBBBBBBBBBB ",
        " BBBBBBBBBBBB ", " BBBBBBBBBBBB ", "  BBBBBBBBBB  ", "   BBBBBBBB   ",
        "   BB    BB   "]
HOLES = {(3, 5), (4, 5), (3, 6), (4, 6), (9, 5), (10, 5), (9, 6), (10, 6), (6, 8), (7, 8)}
FILLED = {(c, r) for r, row in enumerate(GRID) for c, ch in enumerate(row)
          if ch != ' ' and (c, r) not in HOLES}
on = lambda c, r: (c, r) in FILLED
ch_at = lambda c, r: GRID[r][c] if 0 <= r < len(GRID) and 0 <= c < len(GRID[r]) else ' '
cell = lambda c, r: 'M%d %dh2v2h-2z' % (2 + c * 2, 3 + r * 2)
N8 = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]


def svg(body, vb='0 0 32 32', w=32, h=32, note=''):
    assert '--' not in note, 'XML comments cannot contain a double hyphen: %r' % note
    head = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" width="%d" height="%d" '
            'fill="none" role="img" aria-label="Peri">\n' % (vb, w, h))
    return head + (('  <!-- %s -->\n' % note) if note else '') + body + '\n</svg>\n'


HOOK = 'recolour via the CSS custom properties peri-body and peri-bulb; the hex values below are their fallbacks'
files = {}

# 1 - primary, duotone
files['peri-mark.svg'] = svg(
    '  <path fill="%s" fill-rule="evenodd" d="%s"/>\n'
    '  <path fill="%s" d="%s"/>\n'
    '  <circle cx="%s" cy="%s" r="%s" fill="%s"/>'
    % (BODY_VAR, FACE, BODY_VAR, STEM, BULB_C[0], BULB_C[1], BULB_C[2], BULB_VAR), note=HOOK)

# 2 - one colour, takes the surrounding text colour
files['peri-mark-mono.svg'] = svg(
    '  <path fill="currentColor" fill-rule="evenodd" d="%s"/>\n'
    '  <path fill="currentColor" d="%s"/>\n'
    '  <circle cx="%s" cy="%s" r="%s" fill="currentColor"/>'
    % (FACE, STEM, BULB_C[0], BULB_C[1], BULB_C[2]),
    note='one colour: inherits currentColor')

# 3 - outline
files['peri-mark-line.svg'] = svg(
    '  <g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">\n'
    '    <path d="%s"/>\n'
    '    <path d="M 16 10.4 L 16 7.4"/>\n'
    '    <path d="M 10.6 17 h 0.01 M 21.4 17 h 0.01" stroke-width="4.3"/>\n'
    '  </g>\n'
    '  <circle cx="16" cy="4.6" r="2.3" fill="%s"/>' % (BODY, BULB_VAR),
    note='body inherits currentColor; the bulb takes the peri-bulb custom property')

# 4 - pixel-true, 1:1 with the sprite
body_cells = [cell(c, r) for r, row in enumerate(GRID) for c, ch in enumerate(row)
              if on(c, r) and ch != 'A']
bulb_cells = [cell(c, r) for r, row in enumerate(GRID) for c, ch in enumerate(row)
              if on(c, r) and ch == 'A']
files['peri-pixel.svg'] = svg(
    '  <g shape-rendering="crispEdges">\n'
    '    <path fill="%s" d="%s"/>\n'
    '    <path fill="%s" d="%s"/>\n'
    '  </g>' % (BODY_VAR, ''.join(body_cells), BULB_VAR, ''.join(bulb_cells)), note=HOOK)

# 5 - pixel outline: the empty cells touching her, 8-way so the corners stay closed
halo_body, halo_bulb = [], []
for r in range(-1, len(GRID) + 1):
    for c in range(-1, 15):
        if on(c, r):
            continue
        touched = [(dc, dr) for dc, dr in N8 if on(c + dc, r + dr)]
        if not touched:
            continue
        tgt = halo_bulb if all(ch_at(c + dc, r + dr) == 'A' for dc, dr in touched) else halo_body
        tgt.append(cell(c, r))
files['peri-pixel-outline.svg'] = svg(
    '  <g shape-rendering="crispEdges">\n'
    '    <path fill="%s" d="%s"/>\n'
    '    <path fill="%s" d="%s"/>\n'
    '  </g>' % (BODY_VAR, ''.join(halo_body), BULB_VAR, ''.join(halo_bulb)), note=HOOK)

# 6 - app tile
files['peri-badge.svg'] = svg(
    '  <defs>\n'
    '    <linearGradient id="peri-shell" x1="0.3" y1="0" x2="0.75" y2="1">\n'
    '      <stop offset="0" stop-color="var(--peri-tile-light, #A9AEFB)"/>\n'
    '      <stop offset="0.5" stop-color="var(--peri-tile, #8E94F2)"/>\n'
    '      <stop offset="1" stop-color="var(--peri-tile-dark, #6A70CE)"/>\n'
    '    </linearGradient>\n'
    '  </defs>\n'
    '  <rect width="48" height="48" rx="12" fill="url(#peri-shell)"/>\n'
    '  <rect x="7" y="8.5" width="34" height="31" rx="5" fill="var(--peri-screen, #050810)"/>\n'
    '  <g transform="translate(8.6 9.8) scale(0.715)">\n'
    '    <path fill="%s" fill-rule="evenodd" d="%s"/>\n'
    '    <path fill="%s" d="%s"/>\n'
    '    <circle cx="%s" cy="%s" r="%s" fill="%s"/>\n'
    '  </g>'
    % (BODY_VAR, FACE, BODY_VAR, STEM, BULB_C[0], BULB_C[1], BULB_C[2], BULB_VAR),
    vb='0 0 48 48', w=48, h=48,
    note='also peri-tile-light, peri-tile, peri-tile-dark and peri-screen')

# 7 - favicon. A browser tab cannot inherit page CSS, so this one carries its own
#     light/dark pair and is the file you edit per-palette rather than theme.
files['peri-favicon.svg'] = svg(
    '  <style>\n'
    '    .body { fill: var(--peri-body, #3E8385) }\n'
    '    @media (prefers-color-scheme: dark) { .body { fill: var(--peri-body-dark, #7FD0D2) } }\n'
    '  </style>\n'
    '  <path class="body" fill-rule="evenodd" d="%s"/>\n'
    '  <path class="body" d="%s"/>\n'
    '  <circle cx="%s" cy="%s" r="%s" fill="%s"/>'
    % (FACE, STEM, BULB_C[0], BULB_C[1], BULB_C[2], BULB_VAR),
    note='tab icons cannot inherit page CSS: edit the fallbacks here for a palette')


def main():
    for name in sorted(os.listdir(OUT)):
        if name.endswith('.svg') and name not in files:
            os.remove(os.path.join(OUT, name))
            print('removed', name)
    for name, content in sorted(files.items()):
        ET.fromstring(content)                       # fail loudly on malformed output
        io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n').write(content)
        print('wrote %-32s %5d bytes' % (name, len(content)))


if __name__ == '__main__':
    main()
