# peri

> `// PERI.SYS v2.0: a pixel pet wired to a terminal. She idles, the log reports what I'm up to.`

A tiny retro Tamagotchi-style desk companion. Peri is drawn pixel-by-pixel on a `<canvas>`; she breathes, blinks, looks around, and reacts when you pet her. Leave her alone and she snubs, then sulks: the five dots on her screen are her mood meter. The power key puts her to sleep.

Her shell has a slide on its top edge that turns it from opaque through milky and frosted to clear. Through a clear shell you see her insides: a board where every button is wired to her brain behind the screen, and each press runs along its line before she reacts.

Peri is short for **periwinkle**, one of my brand colors and the inspiration for her. It's the soft blue-violet of her shell.

**[▶ Live demo](https://gridalchemy.github.io/peri/)**

## What's in here

Peri lives in two forms — this repo has both, and they evolve together.

- **`index.html`** — the standalone toy. One file. No build step, nothing to install, no framework. Vanilla JS + a `<canvas>` sprite grid: `<`, `PET` and `>`, the power key, the shell slide, and a speaker grille you can tap to mute her. Sounds come from [cuelume](https://github.com/danielwh2/cuelume), loaded from a CDN. Open it in a browser and she's there. This is what the live demo above serves.
- **`PixelPet.framer.tsx`** — the fuller "cyberdeck" version, a Framer code component. Peri is wired by a thin teal cable to a small terminal that logs what I'm up to. With **Front door** set to Yes, she becomes my portfolio's entrance instead: alone on the page until you tap her screen, then the camera pushes through her glass onto the site.

Future updates land on both, and they share their code: the shell's CSS and `createInsides()` are identical in the two files. Only the terminal, the cable and the front door are Framer-only.

## Run locally

```bash
git clone https://github.com/gridalchemy/peri.git
cd peri
```

Then either double-click `index.html` or serve the folder:

```bash
python -m http.server 8000
```

…and open <http://localhost:8000>.

The Framer component is used inside Framer — paste `PixelPet.framer.tsx` into a code component there.

## Brand

The `brand/` folder holds Peri's marks — a smooth silhouette, a pixel-true one, outlines, an
app tile and a favicon, all built on the same 32×32 grid mapped 1:1 off her sprite. Open
[`brand/index.html`](brand/index.html) to see the set at every size, and
[`brand/README.md`](brand/README.md) for when to use pixel Peri and when a smooth mark.

She can wear another palette. The duotone marks read two CSS custom properties,
`--peri-body` and `--peri-bulb`, each falling back to her own colours; the one-colour and
outline marks use `currentColor`. Set them on any ancestor of an inlined `<svg>` and she
follows. (An `<img src="…svg">` can't see your page's CSS, so it always shows the fallbacks.)

To use a mark, copy the `.svg` — there is nothing to install and nothing to run. The
scripts in [`tools/`](tools/) only matter if you want to change something all the marks
share, like her silhouette or the artboard: `build-brand.py` writes the seven `.svg` files
from one definition, and `build-sheet.py` writes the contact sheet from those. They need
Python, they are optional, and the toy above still has no build step and no dependencies.

## Credits

- Peri, art & code — [@gridalchemy](https://github.com/gridalchemy)
- Sound: [cuelume](https://github.com/danielwh2/cuelume) by Daniel Belyi ([MIT](https://github.com/danielwh2/cuelume/blob/main/LICENSE))

## License

The code is [MIT](LICENSE). Fork it, run it, change it, build your own thing with it.

**Peri's brand is not.** The marks in [`brand/`](brand/), the Peri name and wordmark, and her
likeness used as a logo are reserved — see [`brand/NOTICE.md`](brand/NOTICE.md). You're welcome
to use them to refer to this project; you may not use them as the branding of your own. If you
fork and ship something, swap in your own mark.
