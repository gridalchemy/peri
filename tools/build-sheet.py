"""Regenerate brand/index.html, the contact sheet. Run after build-brand.py.

    python tools/build-sheet.py
"""

import io
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.join(os.path.dirname(HERE), 'brand')

CAP = [
    ('peri-mark.svg',         'primary &middot; duotone',            False),
    ('peri-mark-mono.svg',    'one colour &middot; currentColor',    True),
    ('peri-mark-line.svg',    'outline &middot; UI chrome',          True),
    ('peri-pixel.svg',        'pixel-true &middot; 1:1 with the sprite', False),
    ('peri-pixel-outline.svg', 'pixel outline &middot; 8-way halo',  False),
    ('peri-badge.svg',        'app tile &middot; her in the shell',  False),
    ('peri-favicon.svg',      'favicon &middot; adapts to light/dark', False),
]

# her own attire first, then four borrowed palettes
PALETTES = [
    ('peri (default)', '#59AFB1', '#8E94F2'),
    ('ember',      '#E0704A', '#F5C563'),
    ('moss',       '#6B9E78', '#D9E8A0'),
    ('slate',      '#2E3350', '#A9AEFB'),
    ('candy',      '#BF5E95', '#7FD0D2'),
]


def read(name):
    src = io.open(os.path.join(BRAND, name), encoding='utf-8').read().strip()
    return (src.replace('width="32"', 'width="100%"').replace('height="32"', 'height="100%"')
               .replace('width="48"', 'width="100%"').replace('height="48"', 'height="100%"'))


def main():
    cards = []
    for name, cap, light in CAP:
        inner = read(name)
        sizes = ''.join('<span style="display:inline-block;width:%dpx;height:%dpx">%s</span>'
                        % (s, s, inner) for s in (72, 32, 24, 16))
        cards.append('<figure class="%s"><div class="sizes">%s</div>'
                     '<figcaption><code>%s</code><span>%s</span></figcaption></figure>'
                     % ('light' if light else '', sizes, name, cap))

    mark = read('peri-mark.svg')
    pixel = read('peri-pixel.svg')
    swatches = []
    for label, body, bulb in PALETTES:
        style = '--peri-body:%s;--peri-bulb:%s' % (body, bulb)
        swatches.append(
            '<figure style="%s"><div class="sizes">'
            '<span style="display:inline-block;width:64px;height:64px">%s</span>'
            '<span style="display:inline-block;width:64px;height:64px">%s</span>'
            '<span style="display:inline-block;width:24px;height:24px">%s</span>'
            '</div><figcaption><code>%s</code><span>%s &nbsp;/&nbsp; %s</span></figcaption></figure>'
            % (style, mark, pixel, mark, label, body, bulb))

    page = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Peri &mdash; brand marks</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root{ --ui: "Outfit", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         --mono: ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, monospace }
  body{margin:0;background:#0B0F1C;color:#e8ebf7;
    font:15px/1.6 var(--ui);padding:40px 24px 90px}
  .wrap{max-width:940px;margin:0 auto}
  h1{font-size:24px;margin:0 0 4px;letter-spacing:-.01em}
  h2{font:600 12px/1 var(--ui);letter-spacing:.14em;text-transform:uppercase;
    color:#8E94F2;margin:44px 0 6px}
  p.lede{color:#8e97bd;font-size:14px;margin:0 0 20px;max-width:64ch}
  p.lede code{font:12px var(--mono);color:#B9BEFF}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:18px}
  figure{margin:0;background:#11162a;border:1px solid #232a47;border-radius:14px;
    padding:20px 16px 16px;text-align:center;color:#B9BEFF}
  figure.light{background:#F4F5FB;border-color:#dcdff0;color:#1a1d2e}
  .sizes{display:flex;align-items:flex-end;justify-content:center;gap:12px;
    min-height:76px;margin-bottom:14px}
  figcaption{display:flex;flex-direction:column;gap:2px}
  figcaption code{font:11px var(--mono);color:#8e97bd}
  figcaption span{font-size:11.5px;color:#5d668c}
  figure.light figcaption code{color:#6b7190}
  figure.light figcaption span{color:#8a90ab}
  pre{background:#070b16;border:1px solid #232a47;border-radius:10px;padding:16px;
    overflow:auto;font:12px/1.65 var(--mono);color:#9fb6d8;margin:0}
  .note{color:#5d668c;font-size:13px;max-width:64ch;margin:14px 0 0}
</style>
</head>
<body>
<div class="wrap">
  <h1>Peri &mdash; brand marks</h1>
  <p class="lede">Every mark is the same silhouette on a 32&times;32 grid, mapped 1:1 off her
  sprite.</p>

  <h2>The set</h2>
  <div class="grid">
''' + '\n'.join('    ' + c for c in cards) + '''
  </div>

  <h2>Borrowing another palette</h2>
  <p class="lede">The duotone marks read two custom properties, <code>--peri-body</code> and
  <code>--peri-bulb</code>, each falling back to her own colours. Set them on any ancestor and
  she wears the palette. The one-colour and outline marks use <code>currentColor</code> instead,
  so they simply take the surrounding text colour.</p>
  <div class="grid">
''' + '\n'.join('    ' + s for s in swatches) + '''
  </div>
  <p class="note">The badge additionally exposes <code>--peri-tile-light</code>,
  <code>--peri-tile</code>, <code>--peri-tile-dark</code> and <code>--peri-screen</code>.</p>

  <h2>How to set them</h2>
  <pre>&lt;!-- inline the svg, then style it from anywhere above it --&gt;
.ember { --peri-body: #E0704A; --peri-bulb: #F5C563 }

&lt;!-- one colour: just set color --&gt;
.footer svg { color: #6B7190 }</pre>
  <p class="note">One real limit: an <code>&lt;img src="peri-mark.svg"&gt;</code> is a separate
  document and cannot see your page's CSS, so it always renders the fallback colours. For a
  palette you need as a file &mdash; a favicon, an app icon, anything handed to someone else
  &mdash; change the two hex fallbacks in the file and save it under its own name.</p>
</div>
</body>
</html>
'''
    io.open(os.path.join(BRAND, 'index.html'), 'w', encoding='utf-8', newline='\n').write(page)
    print('wrote brand/index.html')


if __name__ == '__main__':
    main()
