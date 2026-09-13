# peri

> `// PERI.SYS v2.0: a pixel pet wired to a terminal. She idles, the log reports what I'm up to.`

A tiny retro Tamagotchi-style desk companion. Peri is drawn pixel-by-pixel on a `<canvas>`; she breathes, blinks, looks around, and reacts when you pet her.

**[▶ Live demo](https://gridalchemy.github.io/peri/)**

![peri](docs/peri.png)

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

## Credits

- Peri, art & code — [@gridalchemy](https://github.com/gridalchemy)
- Sound in the Framer variant: [cuelume](https://github.com/Danilaa1/cuelume) by Daniel Belyi ([MIT](https://github.com/Danilaa1/cuelume/blob/main/LICENSE))

## License

[MIT](LICENSE)
