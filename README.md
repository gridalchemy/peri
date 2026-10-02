# peri

> `// PERI.SYS v2.0: a pixel pet wired to a terminal. She idles, the log reports what I'm up to.`

A tiny retro Tamagotchi-style desk companion. Peri is drawn pixel-by-pixel on a `<canvas>`; she breathes, blinks, looks around, and reacts when you pet her.

Peri is short for **periwinkle**, one of my brand colors and the inspiration for her. It's the soft blue-violet of her shell.

**[▶ Live demo](https://gridalchemy.github.io/peri/)**

## What's in here

Peri lives in two forms — this repo has both, and they evolve together.

- **`index.html`** — the standalone toy. One file. No build step, no dependencies, no framework. Vanilla JS + a `<canvas>` sprite grid, three buttons (`<`, `PET`, `>`), and that's the whole surface. Open it in a browser and she's there. This is what the live demo above serves.
- **`PixelPet.framer.tsx`** — the fuller "cyberdeck" version, a Framer code component. Peri is wired by a thin teal cable to a small terminal that logs what I'm up to; `PET` and `LOOK` play sounds via [cuelume](https://github.com/Danilaa1/cuelume).

Future updates land on both.

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
[`brand/index.html`](brand/index.html) to see the set at every size.

She can wear another palette. The duotone marks read two CSS custom properties,
`--peri-body` and `--peri-bulb`, each falling back to her own colours; the one-colour and
outline marks use `currentColor`. Set them on any ancestor of an inlined `<svg>` and she
follows. (An `<img src="…svg">` can't see your page's CSS, so it always shows the fallbacks.)

## Credits

- Peri, art & code — [@gridalchemy](https://github.com/gridalchemy)
- Sound in the Framer variant: [cuelume](https://github.com/Danilaa1/cuelume) by Daniel Belyi ([MIT](https://github.com/Danilaa1/cuelume/blob/main/LICENSE))

## License

The code is [MIT](LICENSE). Fork it, run it, change it, build your own thing with it.

**Peri's brand is not.** The marks in [`brand/`](brand/), the Peri name and wordmark, and her
likeness used as a logo are reserved — see [`brand/NOTICE.md`](brand/NOTICE.md). You're welcome
to use them to refer to this project; you may not use them as the branding of your own. If you
fork and ship something, swap in your own mark.
