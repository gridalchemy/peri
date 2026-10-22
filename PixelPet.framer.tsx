// Peri — Framer code component (Tamagotchi + terminal "cyberdeck").
// Paste this whole file into a Code Component in Framer (Assets > Code > +).
// Self-contained: the pet is drawn procedurally on a <canvas>, no image assets.
//
// The shell, its clear versions and the insides are shared with index.html: the CSS block marked
// "Shared with index.html" and createInsides() below are identical in both, keep them that way.
// Only the terminal and the cable are Framer-only.
//
// Sound: uses `cuelume` (MIT) — synthesized Web Audio UI sounds, no files.
// Loaded from the esm.sh CDN because Framer's package manager can't resolve a
// bare "cuelume" specifier. Version is pinned; bump @0.2.2 to update.

import {
    useEffect,
    useId,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react"
import { addPropertyControls, ControlType } from "framer"
import { play } from "https://esm.sh/cuelume@0.2.2"

// ─────────────────────────────────────────────────────────────────────────
//  ⤵  EDIT PERI'S LOG HERE  — one line to change, ~10 seconds. Present tense.
//     Keep entries slow-turning so an occasional update is enough to stay fresh.
// ─────────────────────────────────────────────────────────────────────────
const LOG: { k: string; v: string }[] = [
    { k: "reading", v: "The Path to Senior PD" },
    { k: "playing", v: "Nivalis Nights" },
    { k: "learning", v: "Frontend Development" },
    { k: "working", v: "Reckon: Phase C (Capture flow)" },
]

// One-line "what is this" caption under the deck. Comment style, techy/minimal.
// Edit freely (or set to "" to hide it).
const BIO = "// PERI.SYS v2.0: a pixel pet wired to a terminal. She idles, the log reports what I'm up to."

// ---- palette ----
const C = {
    bg: "#050810",
    teal: "#59AFB1",
    tlight: "#7FD0D2",
    tdark: "#3E8385",
    peri: "#8497F3",
    peribright: "#B2C0FF",
    heart: "#BF5E95",
}

// ---- sprite geometry ----
const ART = 8
const OX = 43
const OY = 44
const CW = 198
const CH = 160

const BODY = [
    "      AA      ",
    "      BB      ",
    "   HHHHHHHH   ",
    "  HHHHHHHHHH  ",
    " BBBBBBBBBBBB ",
    " BBBBBBBBBBBB ",
    " BBBBBBBBBBBB ",
    " BBBBBBBBBBBB ",
    " BBBBBBBBBBBB ",
    " DDDDDDDDDDDD ",
    "  DDDDDDDDDD  ",
    "   DDDDDDDD   ",
    "   DD    DD   ",
]

const HEART = [" ## ## ", "#######", "#######", " ##### ", "  ###  ", "   #   "]

// ---- shading: lit from the top-left, like the shell ----
// three tones per band: lit edge / base / edge turned away from the light
const TONES: Record<string, { lit: string; base: string; away: string }> = {
    H: { lit: "#A3E6E6", base: C.tlight, away: "#66B6B8" },
    B: { lit: "#71C6C8", base: C.teal, away: "#448E90" },
    D: { lit: "#4B9294", base: C.tdark, away: "#2B6163" },
}
const SPECULAR = "#B4ECEC"
const LID = TONES.B.away
// asleep: the lid's lower row one tone darker, where it meets the cheek
const CREASE = TONES.D.away
const TEAR = "#C9F4F4"
// a pixel z for sleep, drawn in finer cells than the body so it stays small
const Z = ["####", "  # ", " #  ", "####"]
const BULB_DIM = ["#4E63C7", "#6074D7"]
const filled = (r: number, c: number) =>
    r >= 0 && r < BODY.length && c >= 0 && c < BODY[r].length && BODY[r][c] !== " "
// computed once; "bulb" is resolved per frame because it breathes
const SHADED: (string | null)[][] = BODY.map((row, r) =>
    [...row].map((ch, c) => {
        if (ch === " ") return null
        if (ch === "A") return "bulb"
        if (ch === "B" && r < 2) return C.tdark // antenna stem
        if (r === 2 && (c === 4 || c === 5)) return SPECULAR
        const t = TONES[ch]
        if (!filled(r, c + 1) || (ch === "D" && !filled(r + 1, c))) return t.away
        if (!filled(r, c - 1) || !filled(r - 1, c)) return t.lit
        return t.base
    })
)

// ---- moods: left without pets she snubs, then sulks; a pet brings her back.
// The clock only runs while she's on screen, so time spent reading the rest
// of the page doesn't count.
const SNUB_AFTER = 40000
const SULK_AFTER = 60000

const FONT = "'Press Start 2P', monospace"
const MONO = "'DM Mono', monospace"
const FONT_HREFS = [
    "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap",
    "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap",
]

// every cuelume sound, for the dropdowns. `as const` so the type below is the
// exact 17-name union — no dependency on cuelume's own exported type.
const SOUND_NAMES = [
    "chime",
    "sparkle",
    "droplet",
    "bloom",
    "whisper",
    "tick",
    "press",
    "release",
    "toggle",
    "success",
    "error",
    "page",
    "loading",
    "ready",
    "pulse",
    "scan",
    "arrival",
] as const
type SoundName = (typeof SOUND_NAMES)[number]

// never let an audio hiccup break the interaction
function safePlay(name: SoundName, volume: number) {
    try {
        play(name, { volume })
    } catch {
        /* no-op: sound is a nicety, not a requirement */
    }
}

// ===== Peri's insides. Shared with index.html: keep the two copies identical. =====
// What you see through a translucent shell, drawn into SVG layers measured off the real layout: the board,
// every part's line to her brain behind the screen, the screws, the speaker, the coin cell and the LED,
// plus the slide that changes the shell. In the opaque shell all of it is hidden and nothing here runs.
const SH_W = 358
const SH_H = 452
const SVG_NS = "http://www.w3.org/2000/svg"
const MATS = ["opaque", "milky", "frosted", "clear"]
const MAT_NAMES = ["Opaque", "Milky", "Frosted", "Clear"]
// slide stops, in degrees round the top arc: Opaque nearest the keyring, Clear lowest; every stop clears
// the screen surround's corner
const SLIDE_STOPS = [67, 58, 49, 40]

// the shell outline as a path: border-radius 50% 50% 47% 47% / 57% 57% 43% 43% on 358 x 452, inset by d
function shellPath(d: number): string {
    const tx = 179 - d, ty = 258 - d, bx = 168.26 - d, by = 194.36 - d
    return `M ${d} 258 A ${tx} ${ty} 0 0 1 ${SH_W - d} 258 L ${SH_W - d} 257.64 A ${bx} ${by} 0 0 1 189.74 ${SH_H - d} L 168.26 ${SH_H - d} A ${bx} ${by} 0 0 1 ${d} 257.64 Z`
}
const topPt = (deg: number, d: number): number[] => [179 + (179 - d) * Math.cos((deg * Math.PI) / 180), 258 - (258 - d) * Math.sin((deg * Math.PI) / 180)]
const botPt = (deg: number, d: number, side: number): number[] => {
    const x = (168.26 - d) * Math.cos((deg * Math.PI) / 180)
    return [side > 0 ? 189.74 + x : 168.26 - x, 257.64 + (194.36 - d) * Math.sin((deg * Math.PI) / 180)]
}
const tangentDeg = (a: number): number => (Math.atan2(-258 * Math.cos((a * Math.PI) / 180), -179 * Math.sin((a * Math.PI) / 180)) * 180) / Math.PI

// o: { uid, shell, guts, surface, front, slide, slideKey, bezel, powerWell, port (optional), grille, left, pet, right,
//      isClear(), matIndex(), onPick(index), led: { on, bright, dim, off } }
function createInsides(o: any): any {
    const id = (n: string): string => `${o.uid}-${n}`
    const el = (tag: string, attrs: any, parent?: any): any => {
        const e = document.createElementNS(SVG_NS, tag)
        for (const k in attrs) e.setAttribute(k, String(attrs[k]))
        if (parent) parent.appendChild(e)
        return e
    }
    // positions in the shell's own 358 x 452 units, whatever scale the page (or Framer's canvas) shows it at
    const box = (node: any): any => {
        const s = o.shell.getBoundingClientRect(), k = s.width / SH_W || 1, r = node.getBoundingClientRect()
        const x = (r.left - s.left) / k, y = (r.top - s.top) / k, w = r.width / k, h = r.height / k
        return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h }
    }
    const pulses: any = {}
    let led: any = null, ledGlow: any = null, speaker: any = null, knob: any = null

    function build(): void {
        const guts = o.guts, surf = o.surface
        guts.innerHTML = ""
        surf.innerHTML = ""
        const bz = box(o.bezel), pw = box(o.powerWell), gr = box(o.grille)
        // the cable's side port exists only where there is a cable (and is hidden when Framer stacks the deck)
        const port = o.port && o.port.getBoundingClientRect().width ? box(o.port) : null
        // well centres: the well is 64x66 (PET 68x70) starting 6px above the button
        const btn = (node: any): any => {
            const b = box(node), big = b.w > 53
            return { cx: b.cx, cy: b.y - 6 + (big ? 35 : 33), rx: big ? 34 : 32, ry: big ? 35 : 33 }
        }
        const L = btn(o.left), P = btn(o.pet), R = btn(o.right)

        const defs = el("defs", {}, guts)
        // the glow's region is the whole shell: sized to each pulse's own box, a perfectly straight line
        // (PET's, the speaker's) has zero width and the filter would draw nothing at all
        const glow = el("filter", { id: id("glow"), filterUnits: "userSpaceOnUse", x: 0, y: 0, width: SH_W, height: SH_H }, defs)
        el("feGaussianBlur", { stdDeviation: 1.6, result: "b" }, glow)
        const merge = el("feMerge", {}, glow)
        el("feMergeNode", { in: "b" }, merge)
        el("feMergeNode", { in: "SourceGraphic" }, merge)
        el("path", { d: shellPath(1) }, el("clipPath", { id: id("inside") }, defs))
        // the board is its own shape, a rounded card that follows the shell with a gap
        const card = { x: 18, y: bz.y + bz.h * 0.42, width: SH_W - 36, height: SH_H, rx: 16 }
        el("path", { d: shellPath(13) }, el("clipPath", { id: id("boardclip") }, defs))
        el("rect", card, el("clipPath", { id: id("cardclip") }, defs))
        const root = el("g", { "clip-path": `url(#${id("inside")})` }, guts)

        // ---- board ----
        const bg = el("g", {}, root)
        const bshape = el("g", { "clip-path": `url(#${id("boardclip")})` }, bg)
        el("rect", { ...card, class: "pd-g-board" }, bshape)
        el("rect", { ...card, x: card.x + 0.5, y: card.y + 0.5, width: card.width - 1, class: "pd-g-board-edge" }, bshape)
        el("path", { d: shellPath(13.5), class: "pd-g-board-edge", "clip-path": `url(#${id("cardclip")})` }, bg)

        // lines: every part is wired to her brain behind the screen. Each is drawn from the part toward the
        // screen, so a press travels that way; the speaker pair is the one that carries her sound back down
        const under = bz.b - 14 // safely hidden under the screen surround
        const sx = (L.cx + L.rx + P.cx - P.rx) / 2 // the speaker pair runs up the gap between LOOK and PET
        const traces: any = {
            left: `M ${L.cx} ${L.cy - L.ry + 2} V ${bz.b + 12} L ${L.cx + 12} ${bz.b} V ${under}`,
            pet: `M ${P.cx} ${P.cy - P.ry + 2} V ${under}`,
            right: `M ${R.cx} ${R.cy - R.ry + 2} V ${bz.b + 12} L ${R.cx - 12} ${bz.b} V ${under}`,
            spkA: `M ${sx - 2.5} ${gr.y + 4} V ${under}`,
            spkB: `M ${sx + 2.5} ${gr.y + 4} V ${under}`,
            power: `M ${pw.x + 2} ${pw.cy} H ${bz.r - 20}`,
            led: `M ${pw.cx} ${pw.y - 16} H ${bz.r + 6} L ${bz.r - 4} ${pw.y - 6} H ${bz.r - 20}`,
            cell: `M ${SH_W - pw.cx + 17} ${pw.cy} H ${bz.x + 20}`,
        }
        if (port) traces.port = `M ${port.x - 4} ${port.cy + 7} H ${pw.r - 5}` // tucks under the power key
        for (const k in traces) el("path", { d: traces[k], class: "pd-g-trace" }, bg)
        traces.spkOut = `M ${sx - 2.5} ${under} V ${gr.y + 4}` // her sound, from the brain down to the speaker

        // vias: where a line drops to the back of the board, by the battery and the power key
        for (const [x, y] of [[SH_W - pw.cx - 8, pw.cy + 30], [SH_W - pw.cx + 5, pw.cy + 36], [pw.cx - 8, pw.b + 18], [pw.cx + 4, pw.b + 26]])
            el("circle", { cx: x, cy: y, r: 1.8, fill: "var(--pcb)", stroke: "var(--pad)", "stroke-width": 1 }, bg)

        // button contacts: a tinned ring with the comb pattern a rubber dome closes
        for (const b of [L, P, R]) {
            el("ellipse", { cx: b.cx, cy: b.cy, rx: b.rx - 3, ry: b.ry - 3, class: "pd-g-pad" }, bg)
            for (const k of [6, 11, 16]) el("ellipse", { cx: b.cx, cy: b.cy, rx: b.rx - 3 - k, ry: b.ry - 3 - k, class: "pd-g-ring" }, bg)
        }
        // power key contact, and the port's housing if there is one
        el("rect", { x: pw.x + 1, y: pw.y + 1, width: pw.w - 2, height: pw.h - 2, rx: 6, class: "pd-g-pad" }, bg)
        el("rect", { x: pw.x + 5, y: pw.y + 5, width: pw.w - 10, height: pw.h - 10, rx: 3, class: "pd-g-ring" }, bg)
        if (port) el("rect", { x: port.x - 5, y: port.y - 3, width: port.w + 6, height: port.h + 6, rx: 2, fill: "#090C18" }, bg)

        // coin cell, mirrored across from the power key: a CR2032 like a Tamagotchi's, with its holder clip
        const cc = { x: SH_W - pw.cx, y: pw.cy }
        el("rect", { x: cc.x - 4, y: cc.y - 21, width: 8, height: 42, rx: 2, fill: "#8790B7" }, bg)
        const cg = el("linearGradient", { id: id("coin"), x1: 0, y1: 0, x2: 1, y2: 1 }, defs)
        el("stop", { offset: 0, "stop-color": "#C7CCE0" }, cg)
        el("stop", { offset: 1, "stop-color": "#6A739A" }, cg)
        el("circle", { cx: cc.x, cy: cc.y, r: 17, fill: `url(#${id("coin")})` }, bg)
        el("circle", { cx: cc.x, cy: cc.y, r: 14.5, fill: "none", stroke: "rgba(53,64,111,0.35)", "stroke-width": 1 }, bg)
        el("path", { d: `M ${cc.x - 4} ${cc.y} h 8 M ${cc.x} ${cc.y - 4} v 8`, stroke: "rgba(53,64,111,0.6)", "stroke-width": 1.6 }, bg)
        el("rect", { x: cc.x - 4, y: cc.y - 21, width: 8, height: 6, rx: 1.5, fill: "#969FC3" }, bg)

        // the speaker behind the grille
        const sp = { x: gr.x + gr.w - 38, y: gr.cy, r: 21 }
        speaker = el("g", { style: `transform-origin:${sp.x}px ${sp.y}px` }, bg)
        el("circle", { cx: sp.x, cy: sp.y, r: sp.r, fill: "#090C18" }, speaker)
        el("circle", { cx: sp.x, cy: sp.y, r: sp.r - 3, fill: "#13192E" }, speaker)
        for (const k of [7, 12]) el("circle", { cx: sp.x, cy: sp.y, r: sp.r - k, fill: "none", stroke: "#20294C", "stroke-width": 1 }, speaker)
        el("circle", { cx: sp.x, cy: sp.y, r: 7, fill: "#283059" }, speaker)
        el("circle", { cx: sp.x - 2, cy: sp.y - 2, r: 2.5, fill: "rgba(255,255,255,0.12)" }, speaker)

        // the LED by the power key is her bulb: it breathes with her antenna and goes out when she sleeps
        const ly = pw.y - 16
        el("rect", { x: pw.cx - 6, y: ly - 3, width: 4, height: 6, rx: 0.5, fill: "#B4BBD6" }, bg)
        el("rect", { x: pw.cx + 2, y: ly - 3, width: 4, height: 6, rx: 0.5, fill: "#B4BBD6" }, bg)
        led = el("rect", { x: pw.cx - 3, y: ly - 3.5, width: 6, height: 7, rx: 1, fill: o.led.on }, bg)

        // pulses ride on copies of the lines; a press first lights the contact's ring
        for (const k of ["left", "pet", "right", "power", "spkOut"]) {
            const p = el("path", { d: traces[k], class: "pd-g-pulse", filter: `url(#${id("glow")})` }, bg)
            pulses[k] = { el: p, len: p.getTotalLength() }
        }
        for (const [b, k] of [[L, "left"], [P, "pet"], [R, "right"]])
            pulses[k].flash = el("ellipse", { cx: b.cx, cy: b.cy, rx: b.rx - 4, ry: b.ry - 4, class: "pd-g-pulse", filter: `url(#${id("glow")})` }, bg)
        pulses.power.flash = el("rect", { x: pw.x + 2, y: pw.y + 2, width: pw.w - 4, height: pw.h - 4, rx: 5, class: "pd-g-pulse", filter: `url(#${id("glow")})` }, bg)

        // ---- screw bosses, molded into the shell ----
        for (const [x, y] of [topPt(150, 24), topPt(30, 24), botPt(36, 22, -1), botPt(36, 22, 1), [179, SH_H - 18]]) {
            el("circle", { cx: x, cy: y, r: 9, fill: "rgba(50,66,141,0.42)" }, root)
            el("circle", { cx: x, cy: y, r: 9, fill: "none", stroke: "rgba(255,255,255,0.18)", "stroke-width": 1 }, root)
            el("circle", { cx: x, cy: y, r: 4.6, fill: "#A6ADCC" }, root)
            el("path", { d: `M ${x - 2.6} ${y} h 5.2 M ${x} ${y - 2.6} v 5.2`, stroke: "#435091", "stroke-width": 1.2 }, root)
        }

        // ---- the front wall's mask: white is plastic, black is a hole ----
        const holes =
            [L, P, R].map((b: any) => `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx - 0.5}" ry="${b.ry - 0.5}" fill="black"/>`).join("") +
            `<rect x="${pw.x}" y="${pw.y}" width="${pw.w}" height="${pw.h}" rx="7" fill="black"/>` +
            Array.from(o.grille.children).map((i: any) => { const r = box(i); return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2" fill="black"/>` }).join("")
        const mask = `<svg xmlns="${SVG_NS}" viewBox="0 0 ${SH_W} ${SH_H}" width="${SH_W}" height="${SH_H}"><rect width="${SH_W}" height="${SH_H}" fill="white"/>${holes}</svg>`
        o.front.style.setProperty("--cl-mask", `url("data:image/svg+xml;utf8,${encodeURIComponent(mask)}")`)

        // ---- surface: the inner wall seen through the front, and a glint where the curve catches the light ----
        el("path", { d: shellPath(6), fill: "none", stroke: "rgba(255,255,255,0.16)", "stroke-width": 1 }, surf)
        el("path", { d: shellPath(7), fill: "none", stroke: "rgba(50,66,141,0.28)", "stroke-width": 1 }, surf)
        const [ax, ay] = topPt(166, 5), [bx, by] = topPt(112, 5), [cx2, cy2] = topPt(104, 5), [dx2, dy2] = topPt(98, 5)
        el("path", { d: `M ${ax} ${ay} A 174 253 0 0 1 ${bx} ${by}`, fill: "none", stroke: "rgba(255,255,255,0.62)", "stroke-width": 2.2, "stroke-linecap": "round" }, surf)
        el("path", { d: `M ${cx2} ${cy2} A 174 253 0 0 1 ${dx2} ${dy2}`, fill: "none", stroke: "rgba(255,255,255,0.5)", "stroke-width": 2.2, "stroke-linecap": "round" }, surf)
        // light from the LED spreads through frosted plastic as a soft halo
        const lg = el("radialGradient", { id: id("ledglow") }, el("defs", {}, surf))
        el("stop", { offset: 0, "stop-color": o.led.bright, "stop-opacity": 0.75 }, lg)
        el("stop", { offset: 1, "stop-color": o.led.on, "stop-opacity": 0 }, lg)
        ledGlow = el("circle", { cx: pw.cx, cy: ly, r: 22, fill: `url(#${id("ledglow")})` }, surf)

        drawSlide()
    }

    // ---- the slide: a groove along the top-right shoulder, four printed stops and a ridged knob ----
    function drawSlide(): void {
        const svg = o.slide
        svg.innerHTML = ""
        const groove: number[][] = []
        for (let a = SLIDE_STOPS[0] + 4; a >= SLIDE_STOPS[3] - 4; a -= 1) groove.push(topPt(a, 5))
        const d = "M " + groove.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")
        el("path", { d, fill: "none", stroke: "rgba(255,255,255,0.4)", "stroke-width": 7, "stroke-linecap": "round", transform: "translate(0 1)" }, svg)
        el("path", { d, fill: "none", stroke: "#171D3A", "stroke-width": 7, "stroke-linecap": "round" }, svg)
        for (const a of SLIDE_STOPS) {
            const [x, y] = topPt(a, 14)
            el("circle", { cx: x, cy: y, r: 1.4, fill: "rgba(50,66,141,0.75)" }, svg)
        }
        knob = el("g", { class: "pd-knob" }, svg)
        el("rect", { x: -9, y: -6.5, width: 18, height: 13, rx: 3.5, fill: "#4E63C7", stroke: "#2C3A7F", "stroke-width": 1 }, knob)
        el("rect", { x: -8, y: -5.5, width: 16, height: 4, rx: 2, fill: "rgba(255,255,255,0.22)" }, knob)
        for (const x of [-3.5, 0, 3.5]) el("line", { x1: x, y1: -3.5, x2: x, y2: 3.5, stroke: "#2C3A7F", "stroke-width": 1 }, knob)
        // press or drag anywhere along the groove: the nearest stop wins
        const hit = el("path", { d, fill: "none", stroke: "transparent", "stroke-width": 24, class: "pd-hit" }, svg)
        const pick = (e: any): void => {
            const s = o.shell.getBoundingClientRect(), k = s.width / SH_W || 1
            const x = (e.clientX - s.left) / k, y = (e.clientY - s.top) / k
            const a = (Math.atan2((258 - y) / 258, (x - 179) / 179) * 180) / Math.PI
            let best = 0
            SLIDE_STOPS.forEach((st: number, i: number) => { if (Math.abs(st - a) < Math.abs(SLIDE_STOPS[best] - a)) best = i })
            o.onPick(best)
        }
        let dragging = false
        hit.addEventListener("pointerdown", (e: any) => { dragging = true; hit.setPointerCapture(e.pointerId); pick(e) })
        hit.addEventListener("pointermove", (e: any) => { if (dragging) pick(e) })
        hit.addEventListener("pointerup", () => { dragging = false })
        // the keyboard target sits over the groove
        const xs = groove.map((p) => p[0]), ys = groove.map((p) => p[1])
        Object.assign(o.slideKey.style, {
            left: `${Math.min(...xs) - 10}px`, top: `${Math.min(...ys) - 10}px`,
            width: `${Math.max(...xs) - Math.min(...xs) + 20}px`, height: `${Math.max(...ys) - Math.min(...ys) + 20}px`,
        })
        setKnob(o.matIndex(), true)
    }
    function setKnob(i: number, instant?: boolean): void {
        if (!knob) return
        const [x, y] = topPt(SLIDE_STOPS[i], 1)
        if (instant) knob.style.transition = "none" // a fresh knob appears in place instead of sliding in
        knob.style.transform = `translate(${x}px, ${y}px) rotate(${tangentDeg(SLIDE_STOPS[i])}deg)`
        if (instant) { knob.getBoundingClientRect(); knob.style.transition = "" }
    }

    // ---- a press: the contact lights, a pulse runs along the line, and `then` runs as it lands ----
    // one steady speed for every line, with a floor so a short run (PET's) is still seen
    function pulse(k: string, then?: any): void {
        const p = pulses[k]
        if (!p || !o.isClear()) { if (then) then(); return }
        const dash = 14, travel = Math.max(240, p.len / 0.32), delay = p.flash ? 90 : 0
        if (p.flash) p.flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 360 })
        p.el.style.strokeDasharray = `${dash} ${p.len + dash}`
        p.el.animate(
            [{ strokeDashoffset: dash, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.08 }, { strokeDashoffset: -p.len + dash, opacity: 1, offset: 0.92 }, { strokeDashoffset: -p.len, opacity: 0 }],
            { duration: travel, delay, easing: "linear" }
        )
        setTimeout(() => { if (then) then() }, delay + travel * 0.92)
    }
    function thump(): void {
        if (!o.isClear() || !speaker) return
        speaker.animate([{ transform: "scale(1)" }, { transform: "scale(0.93)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 260 })
    }
    function updateLed(asleep: boolean, mood: any, breath: number): void {
        if (!led || !o.isClear()) return
        if (asleep) { led.setAttribute("fill", o.led.off); ledGlow.setAttribute("opacity", 0); return }
        if (mood) { led.setAttribute("fill", o.led.dim); ledGlow.setAttribute("opacity", 0.25); return } // dims with her bulb
        led.setAttribute("fill", breath > 0 ? o.led.bright : o.led.on)
        ledGlow.setAttribute("opacity", 0.55 + 0.45 * (breath * 0.5 + 0.5))
    }

    // keyboard on the slide: arrows move it a stop (attached once, even if the insides are created again)
    if (!o.slideKey.dataset.pdKeys) {
        o.slideKey.dataset.pdKeys = "1"
        o.slideKey.addEventListener("keydown", (e: any) => {
            const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as any)[e.key]
            if (!step) return
            e.preventDefault()
            o.onPick(Math.max(0, Math.min(MATS.length - 1, o.matIndex() + step)))
        })
    }
    return { build, setKnob, pulse, thump, updateLed }
}

interface Heart {
    born: number
    x: number
}

interface PetState {
    raf: number
    blinkUntil: number
    nextBlink: number
    micro: "look" | "tap" | null
    microUntil: number
    microDir: number
    nextMicro: number
    hopStart: number | null
    hearts: Heart[]
    lonely: number // ms on screen since the last pet
    lastT: number
    onScreen: boolean
    snubSide: number // which way she turns away while snubbing
    asleep: boolean
    sleptAt: number
    wokeAt: number
    peekUntil: number // a pet while she sleeps opens one eye for a moment
    refillAt: number // the mood meter refills from where it was, left to right, after a pet
    levelAtPet: number
}

interface Props {
    style?: CSSProperties
    message: string
    shellColor: string
    outlineColor: string
    arrowColor: string
    soundEnabled: boolean
    petSound: SoundName
    lookSound: SoundName
    powerSound: SoundName
    volume: number
}

// scoped CSS. All classes prefixed `pd-` so nothing leaks into the host page.
const CSS = `
.pd-deck { display: flex; align-items: center; justify-content: center; gap: 0; }

/* ===== Peri. Shared with index.html: keep the two copies identical. =====
   All classes are prefixed pd- so nothing leaks into a host page. */

/* wrapper: holds the keyring, the shell switch and the floor shadow. --pd-shell / --pd-outline are her
   periwinkle and its outline; the clear shells mix their tint from --pd-shell, so they follow it too */
.pd-device {
    --pd-shell: #8497F3; --pd-outline: #32428D;
    --pcb: #1F4A4C; --pcb-edge: #4B9294; --trace: #3E8385; --pad: #A3E6E6;
    position: relative; isolation: isolate; flex: none; width: 358px;
    transition: --cl-back .45s ease, --cl-front .45s ease, --cl-rim .45s ease, --cl-pipe .45s ease, --cl-edge .45s ease, --cl-frost .45s ease;
}
.pd-device, .pd-device *, .pd-device *::before, .pd-device *::after { box-sizing: border-box; }
.pd-device::after {
    content: ''; position: absolute; z-index: -1;
    left: 10%; right: 10%; bottom: -30px; height: 30px;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.75), rgba(0,0,0,0) 70%);
    filter: blur(2px);
}
/* molded loop — sits behind the shell, only its top arc shows (through a clear shell, all of it) */
.pd-keyring {
    position: absolute; top: -24px; left: 50%; transform: translateX(-50%);
    width: 52px; height: 56px;
    border: 8px solid #AB5284; border-radius: 50% 50% 40% 40%;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,0.22), inset -2px -1px 0 rgba(0,0,0,0.25), 0 2px 0 #6E3354;
}

/* molded shell; the plain background is the fallback where color-mix() isn't supported */
.pd-shell {
    position: relative; width: 358px; height: 452px;
    padding: 50px 34px 30px;
    display: flex; flex-direction: column; align-items: center; gap: 18px;
    border-radius: 50% 50% 47% 47% / 57% 57% 43% 43%;
    border: 1px solid var(--pd-outline);
    background: var(--pd-shell);
    background:
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.23  0 0 0 0 0.25  0 0 0 0 0.55  0 0 0 0.16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"),
        radial-gradient(120% 85% at 30% 16%,
            color-mix(in srgb, var(--pd-shell) 72%, white) 0%,
            var(--pd-shell) 46%,
            color-mix(in srgb, var(--pd-shell) 88%, black) 100%);
    box-shadow:
        inset 0 2px 1px rgba(255,255,255,0.5),
        inset 5px 6px 14px rgba(255,255,255,0.16),
        inset -6px -10px 20px rgba(50,66,141,0.38),
        0 26px 40px rgba(0,0,0,0.55);
}
.pd-wordmark {
    color: var(--pd-outline); font-size: 13px; letter-spacing: 4px; margin: 0 -4px 4px 0;
    text-shadow: 0 1px 0 rgba(255,255,255,0.4), 0 -1px 0 rgba(32,45,111,0.35);
}

/* screen surround: recessed dark panel, four moulded grooves on each side */
.pd-bezel {
    position: relative; padding: 10px 16px 14px;
    border-radius: 12px 12px 20px 20px;
    background: linear-gradient(180deg, #283059 0%, #1B2345 55%, #171D3A 100%);
    box-shadow:
        0 -1px 0 rgba(32,45,111,0.55),
        0 2px 0 rgba(255,255,255,0.38),
        inset 0 3px 5px rgba(0,0,0,0.5),
        inset 0 -1px 0 rgba(255,255,255,0.07);
}
/* each groove is a dark slot with a lit lower lip, the speaker grille's language */
.pd-bezel::before, .pd-bezel::after {
    content: ''; position: absolute; top: calc(50% - 11px);
    width: 10px; height: 2px; border-radius: 1px; background: #0C1126;
    box-shadow: 0 1px 0 rgba(255,255,255,0.13),
        0 7px 0 #0C1126, 0 8px 0 rgba(255,255,255,0.13),
        0 14px 0 #0C1126, 0 15px 0 rgba(255,255,255,0.13),
        0 21px 0 #0C1126, 0 22px 0 rgba(255,255,255,0.13);
}
.pd-bezel::before { left: 3px; }
.pd-bezel::after { right: 3px; }
.pd-lcd {
    position: relative; border-radius: 4px; overflow: hidden;
    box-shadow: 0 0 0 2px #090C18, 0 1px 0 2px rgba(255,255,255,0.08);
}
.pd-overlay { position: absolute; inset: 0; pointer-events: none; }
.pd-scanlines { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px); }
/* screen sits below the glass: dark falloff at the edges */
.pd-shade { box-shadow: inset 0 0 16px rgba(0,0,0,0.85), inset 0 4px 6px rgba(0,0,0,0.55); }
.pd-glare { background: linear-gradient(118deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 34%, rgba(255,255,255,0) 34.5%); }
/* asleep: the backlight dims */
.pd-dim { background: #050810; opacity: 0; transition: opacity 1.2s ease; }
.pd-asleep .pd-dim { opacity: 0.35; }

/* the caption is printed in the screen surround's navy, so it reads across the whole gradient */
.pd-hint {
    color: #1B2345;
    font-size: 8px; letter-spacing: 1px; white-space: nowrap;
    text-shadow: 0 1px 0 rgba(255,255,255,0.3);
}

/* buttons: matte caps sitting in recessed wells */
.pd-controls { display: flex; gap: 26px; align-items: flex-start; }
.pd-control { position: relative; display: flex; flex-direction: column; align-items: center; }
.pd-control::before {
    content: ''; position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
    width: 64px; height: 66px; border-radius: 50%;
    background: linear-gradient(180deg, #5F73D3, #889BF4);
    box-shadow: inset 0 3px 4px rgba(32,45,111,0.55), 0 1px 0 rgba(255,255,255,0.45);
}
.pd-control.pd-pet::before { width: 68px; height: 70px; }
.pd-btn {
    position: relative; z-index: 1; border: none; border-radius: 50%; cursor: pointer;
    font-family: 'Press Start 2P', monospace;
    transition: transform 0.06s ease, box-shadow 0.06s ease;
}
.pd-btn-look {
    width: 52px; height: 52px; color: #E2E7FF; font-size: 13px;
    background: linear-gradient(180deg, #556ACE 0%, #4E63C7 55%, #495EC0 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 3px rgba(0,0,0,0.12),
        0 4px 0 #2C3A7F, 0 6px 6px rgba(16,23,60,0.45);
    text-shadow: 0 -1px 0 rgba(32,45,111,0.8);
}
.pd-btn-look:active {
    transform: translateY(3px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 2px 3px rgba(0,0,0,0.15),
        0 1px 0 #2C3A7F, 0 2px 3px rgba(16,23,60,0.4);
}
.pd-btn-pet {
    width: 56px; height: 56px; color: #FFF3F9; font-size: 9px;
    background: linear-gradient(180deg, #C6649C 0%, #BF5E95 55%, #B8598F 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 3px rgba(0,0,0,0.12),
        0 4px 0 #6E3354, 0 6px 6px rgba(40,10,30,0.45);
    text-shadow: 0 -1px 0 rgba(110,51,84,0.8);
}
.pd-btn-pet:active {
    transform: translateY(3px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 2px 3px rgba(0,0,0,0.15),
        0 1px 0 #6E3354, 0 2px 3px rgba(40,10,30,0.4);
}

/* power key — same family as the buttons: a matte cap in a recessed well. Its label says what a press
   does: a vermilion OFF while she's awake, a teal ON while she sleeps. Centred in the gap between the
   screen surround (115px from the middle) and the shell's edge (179px), so the sides can stay slim. */
.pd-power-well {
    position: absolute; left: calc(50% + 147px); top: 50%; transform: translate(-50%, -50%);
    padding: 4px 4px 6px; border-radius: 7px;
    background: linear-gradient(180deg, #5F73D3, #889BF4);
    box-shadow: inset 0 2px 3px rgba(32,45,111,0.55), 0 1px 0 rgba(255,255,255,0.45);
}
/* one fixed width for ON and OFF so the key doesn't jump; letter-spacing 0 like PET, and 1px of left
   padding to balance the glyphs' own right bearing */
.pd-power {
    display: block; width: 36px; padding: 6px 0 5px 1px; text-align: center;
    cursor: pointer; border: none; border-radius: 4px;
    font-family: 'Press Start 2P', monospace; font-size: 8px; letter-spacing: 0; line-height: 1;
    color: #0B1A1A;
    background: linear-gradient(180deg, #60B7B9 0%, #59AFB1 55%, #54A8AA 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 3px rgba(0,0,0,0.12),
        0 3px 0 #2F6A6C, 0 4px 4px rgba(16,23,60,0.4);
    text-shadow: 0 1px 0 rgba(255,255,255,0.25);
    transition: transform 0.06s ease, box-shadow 0.06s ease;
}
.pd-power:active {
    transform: translateY(2px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 2px 3px rgba(0,0,0,0.15),
        0 1px 0 #2F6A6C, 0 2px 3px rgba(16,23,60,0.35);
}
/* OFF: vermilion, the shipped red turned 10 degrees toward orange (OKLCH hue 37) to stand apart from
   PET's magenta; same lightness and chroma, so the label keeps its contrast */
.pd-deck:not(.pd-asleep) .pd-power {
    color: #FFF1EF; text-shadow: 0 -1px 0 rgba(123,41,14,0.8);
    background: linear-gradient(180deg, #E25E37 0%, #D85025 55%, #CE491E 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 3px rgba(0,0,0,0.12),
        0 3px 0 #7B290E, 0 4px 4px rgba(40,14,4,0.4);
}
.pd-deck:not(.pd-asleep) .pd-power:active {
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 2px 3px rgba(0,0,0,0.15),
        0 1px 0 #7B290E, 0 2px 3px rgba(40,14,4,0.35);
}

/* side port: where the link cable meets the shell */
.pd-port {
    position: absolute; right: -1px; top: 50%; transform: translateY(-50%);
    width: 7px; height: 20px; border-radius: 3px 0 0 3px;
    background: linear-gradient(180deg, #171D3A, #283059);
    box-shadow: inset 1px 1px 2px rgba(0,0,0,0.6), -1px 0 0 rgba(255,255,255,0.35);
}

/* bottom row: speaker slots + version plate; the plate's top edge sits flush with the first slot */
.pd-base { display: flex; align-items: flex-start; gap: 26px; margin-top: 5px; }
/* the speaker grille is also her mute: tap it and the four slots close over, top to bottom */
.pd-grille {
    display: flex; flex-direction: column; align-items: flex-end; gap: 5px;
    border: 0; padding: 0; margin: 0; background: none; cursor: pointer; border-radius: 3px;
}
.pd-grille:focus-visible { outline: 2px solid #7FD0D2; outline-offset: 3px; }
.pd-grille > i {
    display: block; height: 4px; border-radius: 2px; background: #324087;
    box-shadow: inset 0 1px 1px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.38);
    transition: opacity .3s ease;
}
/* slots shorten toward the bottom, following the curve of the shell */
.pd-grille > i:nth-child(1) { width: 82px; }
.pd-grille > i:nth-child(2) { width: 78px; transition-delay: .05s; }
.pd-grille > i:nth-child(3) { width: 72px; transition-delay: .1s; }
.pd-grille > i:nth-child(4) { width: 64px; transition-delay: .15s; }
.pd-muted .pd-grille > i { opacity: 0.22; }
/* brushed steel: a soft diagonal sheen and fine horizontal brushing over the steel-lavender */
.pd-plate {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 9px 5px; border-radius: 3px;
    color: #35406F; font-size: 8px; letter-spacing: 1px;
    background:
        linear-gradient(115deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.42) 40%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0) 60%),
        repeating-linear-gradient(180deg, rgba(255,255,255,0.13) 0 1px, rgba(53,64,111,0.07) 1px 2px, rgba(255,255,255,0) 2px 3px),
        linear-gradient(180deg, #B4BBD6 0%, #969FC3 50%, #8790B7 100%);
    border: 1px solid #435091;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.12),
        0 1px 0 rgba(255,255,255,0.35), 0 -1px 1px rgba(32,45,111,0.3);
    text-shadow: 0 1px 0 rgba(255,255,255,0.4);
}
.pd-tri {
    width: 0; height: 0; margin-top: -1px;
    border-top: 3px solid transparent; border-bottom: 3px solid transparent;
    border-left: 4px solid #35406F;
}

/* ---- shell switch: a slide in a groove on the top-right shoulder, four stops (Opaque, Milky, Frosted,
   Clear); its knob stands proud of the outline. The groove is the pointer target, the key over it the
   keyboard one ---- */
.pd-slide { position: absolute; z-index: 5; left: 0; top: 0; width: 358px; height: 452px; overflow: visible; pointer-events: none; }
.pd-slide .pd-hit { pointer-events: stroke; cursor: pointer; }
.pd-slide .pd-knob { transition: transform .28s cubic-bezier(.3,1.3,.5,1); }
.pd-slide-key { position: absolute; z-index: 6; border: 0; padding: 0; background: none; pointer-events: none; border-radius: 8px; }
.pd-slide-key:focus-visible { outline: 2px solid #7FD0D2; outline-offset: 2px; }

/* ---- clear shells: back wall, the insides, the front wall (frosted), its surface ---- */
@property --cl-back  { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --cl-front { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --cl-rim   { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --cl-pipe  { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --cl-edge  { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --cl-frost { syntax: '<length>'; inherits: true; initial-value: 0px; }
/* opaque has values too, so leaving it starts from solid plastic instead of from nothing */
.pd-mat-opaque  { --cl-back: var(--pd-shell); --cl-front: color-mix(in srgb, var(--pd-shell) 94%, white); --cl-frost: 4px;
    --cl-rim: rgba(77,101,215,0.50); --cl-pipe: rgba(222,228,255,0.35); --cl-edge: rgba(50,66,141,0.70); }
.pd-mat-milky   { --cl-back: color-mix(in srgb, var(--pd-shell) 86%, transparent); --cl-front: color-mix(in srgb, color-mix(in srgb, var(--pd-shell) 72%, white) 50%, transparent); --cl-frost: 2.4px;
    --cl-rim: rgba(77,101,215,0.50); --cl-pipe: rgba(222,228,255,0.35); --cl-edge: rgba(50,66,141,0.70); }
.pd-mat-frosted { --cl-back: color-mix(in srgb, var(--pd-shell) 62%, transparent); --cl-front: color-mix(in srgb, color-mix(in srgb, var(--pd-shell) 80%, white) 34%, transparent); --cl-frost: 1.3px;
    --cl-rim: rgba(77,101,215,0.55); --cl-pipe: rgba(195,206,255,0.35); --cl-edge: rgba(50,66,141,0.70); }
.pd-mat-clear   { --cl-back: color-mix(in srgb, var(--pd-shell) 34%, transparent); --cl-front: color-mix(in srgb, var(--pd-shell) 14%, transparent); --cl-frost: 0px;
    --cl-rim: rgba(77,101,215,0.60); --cl-pipe: rgba(178,192,255,0.40); --cl-edge: rgba(50,66,141,0.80); }

.pd-cl { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; display: none; }
.pd-clear .pd-cl { display: block; }
.pd-shell > :not(.pd-cl):not(.pd-power-well):not(.pd-port) { position: relative; z-index: 3; }
.pd-power-well, .pd-port { z-index: 4; }
.pd-cl-back { z-index: 0; background: var(--cl-back); }
.pd-cl-guts { z-index: 1; width: 358px; height: 452px; overflow: visible; }
/* the front wall frosts whatever is behind it; the button holes, speaker slots and power key are cut out
   of it with a mask, so the parts there are seen without plastic in the way */
.pd-cl-front {
    z-index: 2; background: var(--cl-front);
    -webkit-backdrop-filter: blur(var(--cl-frost)) saturate(1.15); backdrop-filter: blur(var(--cl-frost)) saturate(1.15);
    -webkit-mask: var(--cl-mask) center / 100% 100% no-repeat; mask: var(--cl-mask) center / 100% 100% no-repeat;
    box-shadow: inset 0 2px 1px rgba(255,255,255,0.55), inset 0 0 0 1.5px var(--cl-rim),
        inset 0 0 22px 2px var(--cl-rim), inset -3px -5px 10px var(--cl-pipe);
}
.pd-cl-surface { z-index: 3; width: 358px; height: 452px; overflow: visible; }
/* plastic seen edge-on is thicker, so the silhouette is the most saturated part of a clear shell */
.pd-clear .pd-shell { background: none; border-color: var(--cl-edge); box-shadow: 0 26px 40px rgba(0,0,0,0.55); }
/* holes: the wells are openings in the plastic now, so they only keep their recess shading */
.pd-clear .pd-control::before, .pd-clear .pd-power-well {
    background: rgba(23,29,58,0.10);
    box-shadow: inset 0 3px 4px rgba(32,45,111,0.55), inset 0 0 0 1px rgba(50,66,141,0.35), 0 1px 0 rgba(255,255,255,0.45);
}
.pd-clear .pd-grille > i { background: rgba(9,12,24,0.35); }
.pd-clear .pd-keyring {
    border-color: rgba(191,94,149,0.62);
    box-shadow: inset 2px 2px 0 rgba(255,255,255,0.35), inset -2px -1px 0 rgba(110,51,84,0.45), 0 2px 0 rgba(110,51,84,0.45), 0 0 0 1px rgba(110,51,84,0.45);
}
/* water-clear plastic takes on whatever is behind it, and the component can't know the page, so the
   wordmark is printed: light ink with the 8-way pixel halo from brand/peri-pixel-outline.svg */
.pd-mat-clear .pd-wordmark {
    color: #E2E7FF; text-shadow:
        1px 0 0 #32428D, -1px 0 0 #32428D, 0 1px 0 #32428D, 0 -1px 0 #32428D,
        1px 1px 0 #32428D, -1px 1px 0 #32428D, 1px -1px 0 #32428D, -1px -1px 0 #32428D;
}
/* the caption is printed over the board, so on a clear shell it needs light ink */
.pd-clear .pd-hint { color: #E2E7FF; opacity: .85; text-shadow: 0 1px 0 rgba(9,12,24,0.6); }

/* the insides */
.pd-g-board { fill: var(--pcb); }
.pd-g-board-edge { fill: none; stroke: var(--pcb-edge); stroke-width: 1; }
.pd-g-trace { fill: none; stroke: var(--trace); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pd-g-pad { fill: var(--pad); }
.pd-g-ring { fill: none; stroke: var(--pcb); stroke-width: 1.4; }
.pd-g-pulse { fill: none; stroke: #C9F4F4; stroke-width: 2.6; stroke-linecap: round; opacity: 0; }

/* asleep: the terminal goes dark */
.pd-terminal, .pd-body { transition: background 1.2s ease, border-color 1.2s ease; }
.pd-asleep .pd-body { background: #070912; }
.pd-asleep .pd-terminal { border-color: rgba(89,175,177,0.07); }

.pd-cable-h { flex: none; display: block; }
.pd-cable-v { display: none; }

.pd-terminal {
    flex: none; width: 360px; overflow: hidden;
    background: #0a0d18; border-radius: 8px;
    border: 1px solid rgba(89,175,177,0.15);
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    font-family: ${MONO};
}
.pd-toolbar {
    display: flex; align-items: center; padding: 12px 16px;
    background: #0a0d18; color: #D8DBE8;
    border-bottom: 1px solid rgba(89,175,177,0.1);
}
.pd-body { padding: 20px 20px 24px; background: #12162a; min-height: 240px; font-size: 14px; line-height: 1.7; }
.pd-prompt { display: flex; gap: 8px; margin-bottom: 12px; }
.pd-prompt.pd-trail { margin-top: 14px; margin-bottom: 0; }
.pd-path { color: ${C.teal}; }
.pd-cmd { color: #FAFAFC; }
.pd-row { display: grid; grid-template-columns: 100px 1fr; gap: 8px; padding: 2px 0; }
.pd-k { color: #8B90A0; }
.pd-v { color: #FAFAFC; }
.pd-caret {
    display: inline-block; width: 8px; height: 16px; background: ${C.teal};
    vertical-align: middle; margin-left: 4px; animation: pdBlink 1s infinite; animation-delay: 0.62s;
}
@keyframes pdBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }

.pd-body > * { animation: pdBootIn 0.32s ease both; }
@keyframes pdBootIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* Stacking is driven by the component's own measured width (ResizeObserver),
   not a viewport query — so it adapts to whatever width Framer gives it. */
.pd-deck.pd-stacked { flex-direction: column; }
.pd-deck.pd-stacked .pd-cable-h { display: none; }
.pd-deck.pd-stacked .pd-cable-v { display: block; }
.pd-deck.pd-stacked .pd-port { display: none; }
.pd-deck.pd-stacked .pd-terminal { width: 320px; }

.pd-bio {
    margin-top: 44px; text-align: center; /* clear of the deck's floor shadow */
    font-family: ${MONO}; font-size: 12px; letter-spacing: 0.3px;
    color: #8B90A0;
}
`

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 796
 * @framerIntrinsicHeight 620
 */
export default function PixelPet(props: Props) {
    const {
        message,
        shellColor,
        outlineColor,
        arrowColor,
        soundEnabled,
        petSound,
        lookSound,
        powerSound,
        volume,
    } = props
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const petRef = useRef<PetState | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const msgTimer = useRef<ReturnType<typeof setTimeout>>()
    const [msg, setMsg] = useState(false)
    const [boot, setBoot] = useState(0) // bump to replay the log boot stagger
    const [asleep, setAsleep] = useState(false)
    const [stacked, setStacked] = useState(false)
    // shell: Opaque first; the slide on the top-right shoulder turns it Milky, Frosted, Clear
    const [mat, setMat] = useState(0)
    const matRef = useRef(0)
    // the speaker grille is her mute, remembered per visitor
    const [muted, setMuted] = useState(false)
    const mutedRef = useRef(false)
    const insidesRef = useRef<any>(null)
    const r = {
        device: useRef<HTMLDivElement>(null), shell: useRef<HTMLDivElement>(null),
        guts: useRef<SVGSVGElement>(null), surface: useRef<SVGSVGElement>(null), front: useRef<HTMLDivElement>(null),
        slide: useRef<SVGSVGElement>(null), slideKey: useRef<HTMLButtonElement>(null),
        bezel: useRef<HTMLDivElement>(null), powerWell: useRef<HTMLDivElement>(null), port: useRef<HTMLDivElement>(null),
        grille: useRef<HTMLButtonElement>(null), left: useRef<HTMLButtonElement>(null),
        pet: useRef<HTMLButtonElement>(null), right: useRef<HTMLButtonElement>(null),
    }
    // per-instance prefix for the cable's SVG ids, so two Peris on one page don't share them
    const uid = "pd" + useId().replace(/:/g, "")

    // Responsive by the component's OWN width (works with Framer's sizing /
    // breakpoints), stacking Peri above the terminal when it gets narrow.
    useEffect(() => {
        const el = wrapRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) => {
            setStacked(entries[0].contentRect.width < 784)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // load Press Start 2P + DM Mono once
    useEffect(() => {
        for (const href of FONT_HREFS) {
            if (document.querySelector(`link[href="${href}"]`)) continue
            const link = document.createElement("link")
            link.rel = "stylesheet"
            link.href = href
            document.head.appendChild(link)
        }
    }, [])

    useEffect(() => {
        try {
            const m = localStorage.getItem("peri-muted") === "1"
            mutedRef.current = m
            setMuted(m)
        } catch {
            /* storage can be blocked; she just starts unmuted */
        }
        const insides = createInsides({
            uid,
            shell: r.shell.current, guts: r.guts.current, surface: r.surface.current, front: r.front.current,
            slide: r.slide.current, slideKey: r.slideKey.current, bezel: r.bezel.current,
            powerWell: r.powerWell.current, port: r.port.current, grille: r.grille.current,
            left: r.left.current, pet: r.pet.current, right: r.right.current,
            isClear: () => matRef.current > 0,
            matIndex: () => matRef.current,
            onPick: (i: number) => {
                if (i === matRef.current) return
                matRef.current = i
                setMat(i)
            },
            led: { on: C.peri, bright: C.peribright, dim: BULB_DIM[0], off: "#32428D" },
        })
        insidesRef.current = insides
        // the insides are measured off the real layout, so they wait for her font (and redo it if it lands late)
        const rebuild = () => insides.build()
        rebuild()
        document.fonts?.load("8px 'Press Start 2P'").then(rebuild).catch(() => {})
        document.fonts?.addEventListener?.("loadingdone", rebuild)
        return () => document.fonts?.removeEventListener?.("loadingdone", rebuild)
    }, [])
    useEffect(() => {
        insidesRef.current?.setKnob(mat)
    }, [mat])
    // stacking moves the cable's port out of sight: measure the insides again
    useEffect(() => {
        insidesRef.current?.build()
    }, [stacked])

    useEffect(() => {
        const cv = canvasRef.current
        if (!cv) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        cv.width = CW * dpr
        cv.height = CH * dpr
        const ctx = cv.getContext("2d")
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.imageSmoothingEnabled = false

        const now = performance.now()
        const pet: PetState = {
            raf: 0,
            blinkUntil: 0,
            nextBlink: now + 1400,
            micro: null,
            microUntil: 0,
            microDir: 1,
            nextMicro: now + 3800,
            hopStart: null,
            hearts: [],
            lonely: 0,
            lastT: now,
            onScreen: true,
            snubSide: 1,
            asleep: false,
            sleptAt: 0,
            wokeAt: -1e9,
            peekUntil: 0,
            refillAt: -1e9,
            levelAtPet: 5,
        }
        petRef.current = pet

        // mood clock only runs while at least half of the screen is visible
        const io =
            typeof IntersectionObserver === "undefined"
                ? null
                : new IntersectionObserver(
                      ([e]) => {
                          pet.onScreen = e.isIntersecting
                      },
                      { threshold: 0.5 }
                  )
        io?.observe(cv)

        const px = (
            x: number,
            y: number,
            w: number,
            h: number,
            color: string,
            a?: number
        ) => {
            ctx.globalAlpha = a == null ? 1 : a
            ctx.fillStyle = color
            ctx.fillRect(x, y, w, h)
            ctx.globalAlpha = 1
        }
        const cell = (gx: number, gy: number, oyPx: number, color: string) => {
            px(OX + gx * ART, oyPx + gy * ART, ART, ART, color)
        }

        const loop = (t: number) => {
            const dt = Math.min(t - pet.lastT, 100)
            pet.lastT = t
            // the mood clock stops while she sleeps; waking resets it
            if (
                pet.onScreen &&
                !document.hidden &&
                pet.hopStart == null &&
                !pet.asleep
            )
                pet.lonely += dt
            const mood = pet.asleep
                ? null
                : pet.lonely >= SULK_AFTER
                    ? "sulk"
                    : pet.lonely >= SNUB_AFTER
                      ? "snub"
                      : null

            if (t > pet.nextBlink) {
                pet.blinkUntil = t + 130
                pet.nextBlink = t + 2200 + Math.random() * 2400
            }
            // no fidgeting while she's in a mood or asleep
            if (
                t > pet.nextMicro &&
                pet.hopStart == null &&
                t > pet.microUntil &&
                !mood &&
                !pet.asleep
            ) {
                if (Math.random() < 0.35) {
                    pet.micro = "tap"
                    pet.microUntil = t + 780
                } else {
                    pet.micro = "look"
                    pet.microDir = Math.random() < 0.5 ? -1 : 1
                    pet.microUntil = t + 950
                }
                pet.nextMicro = t + 4600 + Math.random() * 4200
            }

            let hopPx = 0
            let happy = false
            let mouthOpen = false
            if (pet.hopStart != null) {
                const p = (t - pet.hopStart) / 560
                if (p >= 1) {
                    pet.hopStart = null
                } else {
                    hopPx = -Math.sin(p * Math.PI) * 30
                    happy = true
                    mouthOpen = true
                }
            }

            // asleep, she breathes slower and deeper: the ~6.9s cycle
            const breath = pet.asleep
                ? Math.sin(((t - pet.sleptAt) / 1100) * 0.32)
                : Math.sin(t / 1100)
            const oyPx =
                OY + Math.round(breath * (pet.asleep ? 3 : 2)) + hopPx

            const active = t < pet.microUntil ? pet.micro : null
            // waking: two quick blinks before her eyes open
            const sinceWake = t - pet.wokeAt
            const wakeBlink =
                (sinceWake > 0 && sinceWake < 180) ||
                (sinceWake > 420 && sinceWake < 560)
            const blink = t < pet.blinkUntil || wakeBlink
            const look = active === "look" ? pet.microDir : 0
            const tap = active === "tap"

            ctx.clearRect(0, 0, CW, CH)
            px(0, 0, CW, CH, C.bg)

            // MOOD METER: the five status dots are how loved she feels. Full after a pet, they drain right
            // to left over the minute before she sulks: two are left when she snubs (40s), none when she
            // sulks (60s). A pet refills them, left to right. They go dark while she sleeps.
            if (!pet.asleep) {
                const level = Math.max(0, 1 - pet.lonely / SULK_AFTER) * 5
                for (let i = 0; i < 5; i++) {
                    px(44 + i * 26, 11, ART - 3, ART - 3, C.tdark, 0.22)
                    let a = Math.min(1, Math.max(0, level - i))
                    const since = t - pet.refillAt - i * 70
                    if (since < 140)
                        a = Math.max(Math.min(1, Math.max(0, pet.levelAtPet - i)), Math.min(1, Math.max(0, since / 140)))
                    if (a > 0) px(44 + i * 26, 11, ART - 3, ART - 3, C.teal, a)
                }
            }

            px(OX + 2 * ART, OY + 12 * ART + 4, 10 * ART, 5, C.tdark, 0.22)

            // the bulb dims (but keeps breathing) while she's in a mood or asleep
            const bulb = mood || pet.asleep
                ? BULB_DIM[breath > 0 ? 1 : 0]
                : breath > 0
                  ? C.peribright
                  : C.peri
            for (let r = 0; r < SHADED.length; r++) {
                for (let ci = 0; ci < SHADED[r].length; ci++) {
                    const col = SHADED[r][ci]
                    if (!col) continue
                    cell(ci, r, oyPx, col === "bulb" ? bulb : col)
                }
            }

            const drawEye = (baseCol: number, side: number) => {
                if (pet.asleep) {
                    // closed lids; on a pet the left one lifts to a slit
                    const peek = side < 0 && t < pet.peekUntil
                    cell(baseCol, 5, oyPx, LID)
                    cell(baseCol + 1, 5, oyPx, LID)
                    cell(baseCol, 6, oyPx, peek ? C.bg : CREASE)
                    cell(baseCol + 1, 6, oyPx, peek ? C.bg : CREASE)
                } else if (happy) {
                    cell(baseCol, 6, oyPx, C.bg)
                    cell(baseCol + 1, 5, oyPx, C.bg)
                    cell(baseCol + 2, 6, oyPx, C.bg)
                } else if (mood === "snub") {
                    // half-lidded, both eyes pushed to one side
                    const c = baseCol + pet.snubSide
                    cell(c, 5, oyPx, LID)
                    cell(c + 1, 5, oyPx, LID)
                    const e = blink ? LID : C.bg
                    cell(c, 6, oyPx, e)
                    cell(c + 1, 6, oyPx, e)
                } else if (blink) {
                    cell(baseCol, 6, oyPx, C.bg)
                    cell(baseCol + 1, 6, oyPx, C.bg)
                } else if (mood === "sulk") {
                    // only the inner top corner stays open: worried brows
                    const inner = side < 0 ? baseCol + 1 : baseCol
                    cell(inner + look, 5, oyPx, C.bg)
                    cell(baseCol + look, 6, oyPx, C.bg)
                    cell(baseCol + 1 + look, 6, oyPx, C.bg)
                } else {
                    cell(baseCol + look, 5, oyPx, C.bg)
                    cell(baseCol + 1 + look, 5, oyPx, C.bg)
                    cell(baseCol + look, 6, oyPx, C.bg)
                    cell(baseCol + 1 + look, 6, oyPx, C.bg)
                }
            }
            drawEye(3, -1)
            drawEye(9, 1)

            if (mood === "snub") {
                cell(pet.snubSide > 0 ? 8 : 5, 8, oyPx, C.bg) // "hmph", off to the side
            } else if (mood === "sulk") {
                cell(6, 8, oyPx, C.bg)
                cell(7, 8, oyPx, C.bg)
                cell(5, 9, oyPx, C.bg)
                cell(8, 9, oyPx, C.bg)
                cell(3, 7, oyPx, TEAR)
            } else {
                cell(6, 8, oyPx, C.bg)
                cell(7, 8, oyPx, C.bg)
                if (mouthOpen) {
                    cell(6, 9, oyPx, C.bg)
                    cell(7, 9, oyPx, C.bg)
                }
            }

            if (tap) {
                cell(13, 6, oyPx, C.peri)
                cell(14, 6, oyPx, C.peribright)
            }

            // z's drift up and to the right, one every 3.4s, fading out
            if (pet.asleep) {
                const since = t - pet.sleptAt - 900
                for (let k = 0; k < 3; k++) {
                    const p = (since / 3400 - k / 3) % 1
                    if (since < 0 || p < 0) continue
                    const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85
                    const zc = p > 0.45 ? 5 : 4
                    const zx = OX + 12 * ART + Math.round(p * 14)
                    const zy = oyPx + 16 - Math.round(p * 52)
                    for (let r = 0; r < Z.length; r++)
                        for (let ci = 0; ci < Z[r].length; ci++)
                            if (Z[r][ci] === "#")
                                px(zx + ci * zc, zy + r * zc, zc, zc, C.tlight, a * 0.9)
                }
            }

            pet.hearts = pet.hearts.filter((hh) => t - hh.born < 1250)
            for (const hh of pet.hearts) {
                const p = (t - hh.born) / 1250
                const hy = OY - 6 + hopPx * 0.3 - p * 58
                const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85
                for (let r = 0; r < HEART.length; r++) {
                    const row = HEART[r]
                    for (let ci = 0; ci < row.length; ci++) {
                        if (row[ci] === " ") continue
                        px(
                            hh.x + ci * ART,
                            hy + r * ART,
                            ART,
                            ART,
                            C.heart,
                            Math.max(0, a)
                        )
                    }
                }
            }

            // the LED inside breathes with her bulb
            insidesRef.current?.updateLed(pet.asleep, mood, breath)

            pet.raf = requestAnimationFrame(loop)
        }

        pet.raf = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(pet.raf)
            clearTimeout(msgTimer.current)
            io?.disconnect()
        }
    }, [])

    // sound plays when she reacts. Muted (tap the speaker grille), a press that would have made a sound
    // makes the closed slots glint once, so the silence has a reason
    const sound = (name: SoundName) => {
        if (!soundEnabled) return
        if (mutedRef.current) {
            Array.from(r.grille.current?.children || []).forEach((i: any, k: number) =>
                i.animate([{ opacity: 0.22 }, { opacity: 0.6 }, { opacity: 0.22 }], { duration: 420, delay: k * 40 })
            )
            return
        }
        safePlay(name, volume)
    }
    const toggleMute = () => {
        const m = !mutedRef.current
        mutedRef.current = m
        setMuted(m)
        try {
            localStorage.setItem("peri-muted", m ? "1" : "0")
        } catch {
            /* fine: it just won't be remembered */
        }
    }
    const insides = () => insidesRef.current
    const onPet = () =>
        insides()?.pulse("pet", () => {
            const pet = petRef.current
            if (!pet) return
            const t = performance.now()
            if (pet.asleep) {
                pet.peekUntil = t + 900 // one sleepy eye, then back to sleep
                return
            }
            pet.levelAtPet = Math.max(0, 1 - pet.lonely / SULK_AFTER) * 5
            pet.refillAt = t
            pet.lonely = 0
            sound(petSound)
            if (soundEnabled && !mutedRef.current) insides()?.pulse("spkOut", insides()?.thump) // her sound runs back down to the speaker
            if (pet.hopStart == null) {
                pet.hopStart = t
                pet.hearts.push({ born: t, x: OX + 3.5 * ART })
            }
            setMsg(true)
            clearTimeout(msgTimer.current)
            msgTimer.current = setTimeout(() => setMsg(false), 2600)
        })
    const onLook = (dir: number) => () =>
        insides()?.pulse(dir < 0 ? "left" : "right", () => {
            const pet = petRef.current
            if (!pet || pet.asleep) return
            sound(lookSound)
            pet.snubSide = dir // while snubbing, LOOK changes which way she turns away
            pet.micro = "look"
            pet.microDir = dir
            pet.microUntil = performance.now() + 850
        })
    // power key: OFF puts her to sleep and the terminal goes dark; ON wakes
    // her, replays the log boot and starts her mood clock fresh
    const onPower = () =>
        insides()?.pulse("power", () => {
            const pet = petRef.current
            if (!pet) return
            sound(powerSound)
            if (soundEnabled && !mutedRef.current) insides()?.thump()
            const t = performance.now()
            if (!pet.asleep) {
                pet.asleep = true
                pet.sleptAt = t
                pet.hopStart = null
                pet.hearts = []
                pet.micro = null
                setMsg(false)
                clearTimeout(msgTimer.current)
            } else {
                pet.asleep = false
                pet.wokeAt = t
                pet.lonely = 0
                pet.nextMicro = t + 3800
                setBoot((b) => b + 1)
            }
            setAsleep(pet.asleep)
        })

    // term-body children, in order, each with a staggered boot-in delay
    const step = 55
    const bodyRows: ReactNode[] = [
        <div className="pd-prompt" style={{ animationDelay: "0ms" }} key="cmd">
            <span className="pd-path">~/about</span>
            <span style={{ color: arrowColor }}>&gt;</span>
            <span className="pd-cmd">log</span>
        </div>,
        ...LOG.map((row, idx) => (
            <div
                className="pd-row"
                style={{ animationDelay: `${(idx + 1) * step}ms` }}
                key={row.k}
            >
                <span className="pd-k">{row.k}</span>
                <span className="pd-v">{row.v}</span>
            </div>
        )),
        <div
            className="pd-prompt pd-trail"
            style={{ animationDelay: `${(LOG.length + 1) * step}ms` }}
            key="trail"
        >
            <span className="pd-path">~/about</span>
            <span style={{ color: arrowColor }}>&gt;</span>
            <span className="pd-caret" />
        </div>,
    ]

    return (
        <div ref={wrapRef} style={{ ...props.style, fontFamily: FONT }}>
            <style>{CSS}</style>

            <div
                className={
                    "pd-deck" +
                    (stacked ? " pd-stacked" : "") +
                    (asleep ? " pd-asleep" : "")
                }
            >
                {/* ─── Peri ─── */}
                <div
                    ref={r.device}
                    className={
                        `pd-device pd-mat-${MATS[mat]}` +
                        (mat > 0 ? " pd-clear" : "") +
                        (muted ? " pd-muted" : "")
                    }
                    style={
                        {
                            "--pd-shell": shellColor,
                            "--pd-outline": outlineColor,
                        } as CSSProperties
                    }
                >
                    <div className="pd-keyring" />
                    {/* shell switch: a slide on the top-right shoulder (Opaque, Milky, Frosted, Clear) */}
                    <svg ref={r.slide} className="pd-slide" viewBox="0 0 358 452" aria-hidden="true" />
                    <button
                        ref={r.slideKey}
                        type="button"
                        className="pd-slide-key"
                        role="slider"
                        aria-label="Shell"
                        aria-valuemin={0}
                        aria-valuemax={3}
                        aria-valuenow={mat}
                        aria-valuetext={MAT_NAMES[mat]}
                        title="Slide to change her shell"
                    />
                    <div ref={r.shell} className="pd-shell">
                        {/* what a translucent shell shows: back wall, insides, frosted front wall, its surface */}
                        <div className="pd-cl pd-cl-back" />
                        <svg ref={r.guts} className="pd-cl pd-cl-guts" viewBox="0 0 358 452" aria-hidden="true" />
                        <div ref={r.front} className="pd-cl pd-cl-front" />
                        <svg ref={r.surface} className="pd-cl pd-cl-surface" viewBox="0 0 358 452" aria-hidden="true" />

                        {/* power key: says what a press does (OFF while she's awake, ON while she sleeps) */}
                        <div ref={r.powerWell} className="pd-power-well">
                            <button
                                type="button"
                                title={asleep ? "Wake Peri" : "Put Peri to sleep"}
                                className="pd-power"
                                onClick={onPower}
                            >
                                {asleep ? "ON" : "OFF"}
                            </button>
                        </div>

                        <div ref={r.port} className="pd-port" aria-hidden="true" />

                        <div className="pd-wordmark">PERI</div>

                        <div ref={r.bezel} className="pd-bezel">
                            <div className="pd-lcd">
                                <canvas
                                    ref={canvasRef}
                                    width={CW}
                                    height={CH}
                                    style={{
                                        display: "block",
                                        width: CW,
                                        height: CH,
                                        imageRendering: "pixelated",
                                        background: C.bg,
                                    }}
                                />
                                {/* message overlay */}
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 12,
                                        pointerEvents: "none",
                                        background: "rgba(5,8,16,0.74)",
                                        opacity: msg ? 1 : 0,
                                        transition: "opacity 0.4s ease",
                                    }}
                                >
                                    <div
                                        style={{
                                            color: C.teal,
                                            fontFamily: FONT,
                                            fontSize: 13,
                                            lineHeight: 1.9,
                                            letterSpacing: 2,
                                            textAlign: "center",
                                            textShadow:
                                                "0 0 8px rgba(89,175,177,0.4)",
                                            whiteSpace: "pre-line",
                                        }}
                                    >
                                        {message}
                                    </div>
                                    <div
                                        style={{
                                            width: 104,
                                            height: 3,
                                            background: C.heart,
                                        }}
                                    />
                                </div>
                                <div className="pd-overlay pd-dim" />
                                <div className="pd-overlay pd-scanlines" />
                                <div className="pd-overlay pd-shade" />
                                <div className="pd-overlay pd-glare" />
                            </div>
                        </div>

                        <div className="pd-hint">
                            {asleep
                                ? "shh… tap ON to wake her"
                                : "tap to say hi to Peri"}
                        </div>

                        <div className="pd-controls">
                            <div className="pd-control">
                                <button
                                    ref={r.left}
                                    type="button"
                                    aria-label="Look left"
                                    className="pd-btn pd-btn-look"
                                    onClick={onLook(-1)}
                                >
                                    &lt;
                                </button>
                            </div>

                            <div className="pd-control pd-pet">
                                <button
                                    ref={r.pet}
                                    type="button"
                                    className="pd-btn pd-btn-pet"
                                    onClick={onPet}
                                >
                                    PET
                                </button>
                            </div>

                            <div className="pd-control">
                                <button
                                    ref={r.right}
                                    type="button"
                                    aria-label="Look right"
                                    className="pd-btn pd-btn-look"
                                    onClick={onLook(1)}
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>

                        {/* speaker slots (tap to mute her) + version plate */}
                        <div className="pd-base">
                            <button
                                ref={r.grille}
                                type="button"
                                className="pd-grille"
                                aria-pressed={muted}
                                aria-label={muted ? "Unmute Peri" : "Mute Peri"}
                                title={muted ? "Tap the speaker to unmute her" : "Tap the speaker to mute her"}
                                onClick={toggleMute}
                            >
                                <i />
                                <i />
                                <i />
                                <i />
                            </button>
                            <div className="pd-plate" aria-hidden="true">
                                v2.0
                                <i className="pd-tri" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* plug parts shared by both cables. Its own zero-size svg, never
                    display:none, because gradients inside a hidden svg don't render
                    and the horizontal cable is hidden when stacked. */}
                <svg
                    width="0"
                    height="0"
                    style={{ position: "absolute" }}
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id={`${uid}-plug`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#71C6C8" />
                            <stop offset="0.5" stopColor={C.teal} />
                            <stop offset="1" stopColor="#448E90" />
                        </linearGradient>
                        <filter id={`${uid}-soft`} x="-20%" y="-50%" width="140%" height="200%">
                            <feGaussianBlur stdDeviation="1.6" />
                        </filter>
                        <g id={`${uid}-end`}>
                            <rect x="9" y="27" width="5" height="6" rx="1" fill={`url(#${uid}-plug)`} />
                            <rect x="0" y="23" width="10" height="15" rx="2.5" fill="#2F6A6C" />
                            <rect x="0" y="22" width="10" height="14" rx="2.5" fill={`url(#${uid}-plug)`} />
                            <rect x="1" y="22.6" width="8" height="1" rx="0.5" fill="#B4ECEC" fillOpacity="0.6" />
                            <rect x="3" y="26" width="1" height="7" fill="#2F6A6C" fillOpacity="0.5" />
                            <rect x="6" y="26" width="1" height="7" fill="#2F6A6C" fillOpacity="0.5" />
                        </g>
                    </defs>
                </svg>

                {/* ─── cable: horizontal (desktop), gentle catenary sag ───
                    Molded like the ON key: lit top, base teal, dark underside,
                    and a round cable with a highlight along its top. */}
                <svg
                    className="pd-cable-h"
                    width="76"
                    height="60"
                    viewBox="0 0 76 60"
                    fill="none"
                    aria-hidden="true"
                >
                    <path d="M13 36 Q38 58 63 36" stroke="rgba(0,0,0,0.55)" strokeWidth="4" strokeLinecap="round" filter={`url(#${uid}-soft)`} />
                    <path d="M12 30 Q38 52 64 30" stroke="#2F6A6C" strokeWidth="5" strokeLinecap="round" />
                    <path d="M12 30 Q38 52 64 30" stroke={C.teal} strokeWidth="3" strokeLinecap="round" />
                    <path d="M14 29.2 Q38 50.2 62 29.2" stroke="#A3E6E6" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
                    <use href={`#${uid}-end`} />
                    <use href={`#${uid}-end`} transform="translate(76 0) scale(-1 1)" />
                </svg>

                {/* ─── cable: vertical (mobile only), the same plug turned on its side ─── */}
                <svg
                    className="pd-cable-v"
                    width="60"
                    height="40"
                    viewBox="0 0 60 40"
                    fill="none"
                    aria-hidden="true"
                >
                    <path d="M30 12 L30 28" stroke="#2F6A6C" strokeWidth="5" strokeLinecap="round" />
                    <path d="M30 12 L30 28" stroke={C.teal} strokeWidth="3" strokeLinecap="round" />
                    <path d="M29.2 13 L29.2 27" stroke="#A3E6E6" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
                    {/* the horizontal plug end turned upright; both keep their lit edge on the left */}
                    <use href={`#${uid}-end`} transform="matrix(0 1 1 0 0 0)" />
                    <use href={`#${uid}-end`} transform="matrix(0 -1 1 0 0 40)" />
                </svg>

                {/* ─── terminal ─── */}
                <div className="pd-terminal">
                    <div className="pd-toolbar">
                        {/* Lucide `terminal`, inlined — decorative identity */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" x2="20" y1="19" y2="19" />
                        </svg>
                    </div>
                    <div className="pd-body" key={boot}>
                        {asleep ? null : bodyRows}
                    </div>
                </div>
            </div>

            {BIO ? <div className="pd-bio">{BIO}</div> : null}
        </div>
    )
}

PixelPet.defaultProps = {
    message: "THX FOR\nVISITING!",
    shellColor: "#8497F3",
    outlineColor: "#32428D",
    arrowColor: "#59AFB1",
    soundEnabled: true,
    petSound: "success",
    lookSound: "press",
    powerSound: "toggle",
    volume: 0.6,
}

addPropertyControls(PixelPet, {
    message: {
        type: ControlType.String,
        title: "Message",
        defaultValue: "THX FOR\nVISITING!",
        displayTextArea: true,
    },
    shellColor: {
        type: ControlType.Color,
        title: "Shell",
        defaultValue: "#8497F3",
    },
    outlineColor: {
        type: ControlType.Color,
        title: "Outline",
        defaultValue: "#32428D",
    },
    arrowColor: {
        type: ControlType.Color,
        title: "Prompt arrow",
        defaultValue: "#59AFB1",
    },
    soundEnabled: {
        type: ControlType.Boolean,
        title: "Sound",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    petSound: {
        type: ControlType.Enum,
        title: "PET sound",
        defaultValue: "success",
        options: SOUND_NAMES,
        optionTitles: SOUND_NAMES.map((n) => n[0].toUpperCase() + n.slice(1)),
        hidden: (p) => !p.soundEnabled,
    },
    lookSound: {
        type: ControlType.Enum,
        title: "LOOK sound",
        defaultValue: "press",
        options: SOUND_NAMES,
        optionTitles: SOUND_NAMES.map((n) => n[0].toUpperCase() + n.slice(1)),
        hidden: (p) => !p.soundEnabled,
    },
    powerSound: {
        type: ControlType.Enum,
        title: "POWER sound",
        defaultValue: "toggle",
        options: SOUND_NAMES,
        optionTitles: SOUND_NAMES.map((n) => n[0].toUpperCase() + n.slice(1)),
        hidden: (p) => !p.soundEnabled,
    },
    volume: {
        type: ControlType.Number,
        title: "Volume",
        defaultValue: 0.6,
        min: 0,
        max: 1,
        step: 0.05,
        displayStepper: true,
        hidden: (p) => !p.soundEnabled,
    },
})
