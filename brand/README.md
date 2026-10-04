# Which Peri where

Peri comes in two forms, and they do different jobs.

**Pixel Peri** is the character. She lives on a screen: the Tamagotchi, an avatar, a
banner, a favicon, a 404 page. She is always on a dark surface, wears her own colours —
three bands of teal and a periwinkle bulb, shaded like the sprite in the shell — and she
has moods, so she can blink, hop or sulk. Her frames are in
[`peri-frames.png`](peri-frames.png).

**The smooth marks** in this folder are the signature. They mark something as made by
Peri's author: a README header, a footer, a credit line, the corner of a slide, print.
They sit on any surface, take any palette through `--peri-body` and `--peri-bulb` (or
`currentColor`), and always wear the same neutral face.

| | Pixel Peri | Smooth marks |
|---|---|---|
| Role | the character | the signature |
| Surface | a dark screen | anything |
| Colour | her own, fixed | recolourable, or one colour |
| Face | any mood | neutral |

If Peri is the thing being looked at, use pixel Peri. If she is marking something else as
yours, use a smooth mark. `peri-pixel.svg` sits between the two: her pixel form as a
vector, for the rare time she needs to appear outside a screen.

Both forms are covered by the [brand notice](NOTICE.md).
