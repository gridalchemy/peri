// Peri — Framer code component (Tamagotchi + terminal "cyberdeck").
// Paste this whole file into a Code Component in Framer (Assets > Code > +).
// Self-contained: the pet is drawn procedurally on a <canvas>, no image assets.
//
// Sound: uses `cuelume` (MIT) — synthesized Web Audio UI sounds, no files.
// Loaded from the esm.sh CDN because Framer's package manager can't resolve a
// bare "cuelume" specifier. Version is pinned; bump @0.2.2 to update.

import {
    useEffect,
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
    { k: "reading", v: "The Path to Senior Product Designer" },
    { k: "playing", v: "Tiny Glade" },
    { k: "learning", v: "Frontend Engineering" },
    { k: "working", v: "Reckon: Phase C (Capture flow)" },
]

// One-line "what is this" caption under the deck. Comment style, techy/minimal.
// Edit freely (or set to "" to hide it).
const BIO = "// peri — a tamagotchi desk companion. the buttons are hers; the log is mine."

// ---- palette ----
const C = {
    bg: "#050810",
    teal: "#59AFB1",
    tlight: "#7FD0D2",
    tdark: "#3E8385",
    peri: "#8E94F2",
    peribright: "#B9BEFF",
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
const TEAR = "#C9F4F4"
const BULB_DIM = ["#5A60C6", "#6B71D6"]
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
// Power glow breathes on a 3.45s half-cycle = Peri's ~6.9s breath rhythm.
const CSS = `
.pd-deck { display: flex; align-items: center; justify-content: center; gap: 0; }

/* wrapper: holds the keyring behind the shell and the floor shadow */
.pd-device { position: relative; isolation: isolate; flex: none; width: 374px; }
/* sizes below assume border-box; don't rely on the host page's reset */
.pd-device, .pd-device *, .pd-device *::before, .pd-device *::after { box-sizing: border-box; }
.pd-device::after {
    content: ''; position: absolute; z-index: -1;
    left: 10%; right: 10%; bottom: -30px; height: 30px;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.75), rgba(0,0,0,0) 70%);
    filter: blur(2px);
}
/* molded loop — sits behind the shell, only its top arc shows */
.pd-keyring {
    position: absolute; top: -24px; left: 50%; transform: translateX(-50%);
    width: 52px; height: 56px;
    border: 8px solid #A8538A; border-radius: 50% 50% 40% 40%;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,0.22), inset -2px -1px 0 rgba(0,0,0,0.25), 0 2px 0 #6E3354;
}

/* molded shell. --pd-shell / --pd-outline come from the property controls;
   the plain background is the fallback where color-mix() isn't supported */
.pd-shell {
    position: relative; width: 374px; height: 470px;
    padding: 46px 34px 30px;
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
        inset -6px -10px 20px rgba(59,63,140,0.38),
        0 26px 40px rgba(0,0,0,0.55);
}
.pd-wordmark {
    color: var(--pd-outline); font-size: 13px; letter-spacing: 4px; margin-right: -4px;
    text-shadow: 0 1px 0 rgba(255,255,255,0.4), 0 -1px 0 rgba(40,43,110,0.35);
}

/* screen surround: recessed dark panel with grip ridges */
.pd-bezel {
    position: relative; padding: 10px 16px 14px;
    border-radius: 12px 12px 20px 20px;
    background: linear-gradient(180deg, #2C2F58 0%, #1F2245 55%, #1A1C3A 100%);
    box-shadow:
        0 -1px 0 rgba(40,43,110,0.55),
        0 2px 0 rgba(255,255,255,0.38),
        inset 0 3px 5px rgba(0,0,0,0.5),
        inset 0 -1px 0 rgba(255,255,255,0.07);
}
.pd-bezel::before, .pd-bezel::after {
    content: ''; position: absolute; top: 50%; transform: translateY(-50%);
    width: 7px; height: 24px;
    background: repeating-linear-gradient(180deg,
        rgba(255,255,255,0.10) 0 1px, rgba(0,0,0,0.45) 1px 3px, rgba(0,0,0,0) 3px 7px);
}
.pd-bezel::before { left: 5px; }
.pd-bezel::after { right: 5px; }
.pd-lcd {
    position: relative; border-radius: 4px; overflow: hidden;
    box-shadow: 0 0 0 2px #0A0C18, 0 1px 0 2px rgba(255,255,255,0.08);
}
.pd-overlay { position: absolute; inset: 0; pointer-events: none; }
.pd-scanlines { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px); }
/* screen sits below the glass: dark falloff at the edges */
.pd-shade { box-shadow: inset 0 0 16px rgba(0,0,0,0.85), inset 0 4px 6px rgba(0,0,0,0.55); }
.pd-glare { background: linear-gradient(118deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 34%, rgba(255,255,255,0) 34.5%); }

.pd-hint {
    color: var(--pd-outline); opacity: 0.9;
    font-size: 8px; letter-spacing: 1px; white-space: nowrap;
    text-shadow: 0 1px 0 rgba(255,255,255,0.35);
}

/* buttons: matte caps sitting in recessed wells */
.pd-controls { display: flex; gap: 26px; align-items: flex-start; }
.pd-control { position: relative; display: flex; flex-direction: column; align-items: center; gap: 7px; }
/* labels invisible but kept in the layout so the shell height stays identical */
.pd-control > span { font-size: 6px; letter-spacing: 1px; visibility: hidden; }
.pd-control::before {
    content: ''; position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
    width: 64px; height: 66px; border-radius: 50%;
    background: linear-gradient(180deg, #6A70D2, #9298F3);
    box-shadow: inset 0 3px 4px rgba(40,43,110,0.55), 0 1px 0 rgba(255,255,255,0.45);
}
.pd-control.pd-pet::before { width: 68px; height: 70px; }
.pd-btn {
    position: relative; z-index: 1; border: none; border-radius: 50%; cursor: pointer;
    font-family: ${FONT};
    transition: transform 0.06s ease, box-shadow 0.06s ease;
}
.pd-btn-look {
    width: 52px; height: 52px; color: #E4E6FF; font-size: 13px;
    background: linear-gradient(180deg, #6167CD 0%, #5A60C6 55%, #555BBF 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 3px rgba(0,0,0,0.12),
        0 4px 0 #34387E, 0 6px 6px rgba(20,22,60,0.45);
    text-shadow: 0 -1px 0 rgba(40,43,110,0.8);
}
.pd-btn-look:active {
    transform: translateY(3px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 2px 3px rgba(0,0,0,0.15),
        0 1px 0 #34387E, 0 2px 3px rgba(20,22,60,0.4);
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

/* "ON" status key — same family as the buttons: a matte teal cap in a
   recessed well. States that Peri is on (no off-state); clicking re-runs the log. */
.pd-power-well {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    padding: 4px 4px 6px; border-radius: 7px;
    background: linear-gradient(180deg, #6A70D2, #9298F3);
    box-shadow: inset 0 2px 3px rgba(40,43,110,0.55), 0 1px 0 rgba(255,255,255,0.45);
}
.pd-power {
    display: block; padding: 6px 7px 5px; cursor: pointer; border: none; border-radius: 4px;
    font-family: ${FONT}; font-size: 8px; letter-spacing: 1px; line-height: 1;
    color: #0B1A1A;
    background: linear-gradient(180deg, #60B7B9 0%, ${C.teal} 55%, #54A8AA 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 3px rgba(0,0,0,0.12),
        0 3px 0 #2F6A6C, 0 4px 4px rgba(20,22,60,0.4);
    text-shadow: 0 1px 0 rgba(255,255,255,0.25);
    transition: transform 0.06s ease, box-shadow 0.06s ease;
}
.pd-power:active {
    transform: translateY(2px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 2px 3px rgba(0,0,0,0.15),
        0 1px 0 #2F6A6C, 0 2px 3px rgba(20,22,60,0.35);
}

/* bottom row: speaker slots + version plate */
.pd-base { display: flex; align-items: center; gap: 26px; margin-top: 12px; }
.pd-grille { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.pd-grille > i {
    display: block; height: 4px; border-radius: 2px; background: #3A3E86;
    box-shadow: inset 0 1px 1px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.38);
}
/* slots shorten toward the bottom, following the curve of the shell */
.pd-grille > i:nth-child(1) { width: 82px; }
.pd-grille > i:nth-child(2) { width: 78px; }
.pd-grille > i:nth-child(3) { width: 72px; }
.pd-grille > i:nth-child(4) { width: 64px; }
.pd-plate {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 8px 4px; border-radius: 3px;
    color: #3A3E6E; font-size: 8px; letter-spacing: 1px;
    background: linear-gradient(180deg, #B7BAD6 0%, #9A9EC2 50%, #8B8FB6 100%);
    border: 1px solid #4A4E90;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.12),
        0 1px 0 rgba(255,255,255,0.35), 0 -1px 1px rgba(40,43,110,0.3);
    text-shadow: 0 1px 0 rgba(255,255,255,0.4);
}
.pd-tri {
    width: 0; height: 0; margin-top: -1px;
    border-top: 3px solid transparent; border-bottom: 3px solid transparent;
    border-left: 4px solid #3A3E6E;
}

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
    background: #0a0d18; color: #D1CEDF;
    border-bottom: 1px solid rgba(89,175,177,0.1);
}
.pd-body { padding: 20px 20px 24px; background: #12162a; min-height: 240px; font-size: 14px; line-height: 1.7; }
.pd-prompt { display: flex; gap: 8px; margin-bottom: 12px; }
.pd-prompt.pd-trail { margin-top: 14px; margin-bottom: 0; }
.pd-path { color: ${C.teal}; }
.pd-cmd { color: #FAFAFC; }
.pd-row { display: grid; grid-template-columns: 100px 1fr; gap: 8px; padding: 2px 0; }
.pd-k { color: #8b88a0; }
.pd-v { color: #FAFAFC; }
.pd-caret {
    display: inline-block; width: 8px; height: 16px; background: ${C.teal};
    vertical-align: middle; margin-left: 4px; animation: pdBlink 1s infinite; animation-delay: 0.62s;
}
@keyframes pdBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }

.pd-body > * { animation: pdBootIn 0.32s ease both; }
@keyframes pdBootIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes pdFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Reduced-motion: drop the boot SLIDE (the vestibular-risky part) but keep the
   gentle caret blink — it's opacity only, and it carries the
   "she's alive" signal that's the whole point of the piece. */
@media (prefers-reduced-motion: reduce) {
    .pd-body > * { animation-name: pdFadeIn; }
}

/* Stacking is driven by the component's own measured width (ResizeObserver),
   not a viewport query — so it adapts to whatever width Framer gives it. */
.pd-deck.pd-stacked { flex-direction: column; }
.pd-deck.pd-stacked .pd-cable-h { display: none; }
.pd-deck.pd-stacked .pd-cable-v { display: block; }
.pd-deck.pd-stacked .pd-terminal { width: 320px; }

.pd-bio {
    margin-top: 18px; text-align: center;
    font-family: ${MONO}; font-size: 11px; letter-spacing: 0.3px;
    color: #8b88a0;
}
`

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 812
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
    const [stacked, setStacked] = useState(false)

    // Responsive by the component's OWN width (works with Framer's sizing /
    // breakpoints), stacking Peri above the terminal when it gets narrow.
    useEffect(() => {
        const el = wrapRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) => {
            setStacked(entries[0].contentRect.width < 800)
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
            if (pet.onScreen && !document.hidden && pet.hopStart == null)
                pet.lonely += dt
            const mood =
                pet.lonely >= SULK_AFTER
                    ? "sulk"
                    : pet.lonely >= SNUB_AFTER
                      ? "snub"
                      : null

            if (t > pet.nextBlink) {
                pet.blinkUntil = t + 130
                pet.nextBlink = t + 2200 + Math.random() * 2400
            }
            // no fidgeting while she's in a mood
            if (
                t > pet.nextMicro &&
                pet.hopStart == null &&
                t > pet.microUntil &&
                !mood
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

            const breath = Math.sin(t / 1100)
            const oyPx = OY + Math.round(breath * 2) + hopPx

            const active = t < pet.microUntil ? pet.micro : null
            const blink = t < pet.blinkUntil
            const look = active === "look" ? pet.microDir : 0
            const tap = active === "tap"

            ctx.clearRect(0, 0, CW, CH)
            px(0, 0, CW, CH, C.bg)

            for (let i = 0; i < 5; i++)
                px(44 + i * 26, 11, ART - 3, ART - 3, C.tdark, 0.55)

            px(OX + 2 * ART, OY + 12 * ART + 4, 10 * ART, 5, C.tdark, 0.22)

            // the bulb dims (but keeps breathing) while she's in a mood
            const bulb = mood
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
                if (happy) {
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

            pet.raf = requestAnimationFrame(loop)
        }

        pet.raf = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(pet.raf)
            clearTimeout(msgTimer.current)
            io?.disconnect()
        }
    }, [])

    const onPet = () => {
        const pet = petRef.current
        if (!pet) return
        if (soundEnabled) safePlay(petSound, volume)
        const t = performance.now()
        pet.lonely = 0
        if (pet.hopStart == null) {
            pet.hopStart = t
            pet.hearts.push({ born: t, x: OX + 3.5 * ART })
        }
        setMsg(true)
        clearTimeout(msgTimer.current)
        msgTimer.current = setTimeout(() => setMsg(false), 2600)
    }
    const onLook = (dir: number) => () => {
        const pet = petRef.current
        if (!pet) return
        if (soundEnabled) safePlay(lookSound, volume)
        pet.snubSide = dir // while snubbing, LOOK changes which way she turns away
        pet.micro = "look"
        pet.microDir = dir
        pet.microUntil = performance.now() + 850
    }
    // power light: status + click power-cycles (replays the log boot, with sound)
    const onPower = () => {
        if (soundEnabled) safePlay(powerSound, volume)
        setBoot((b) => b + 1)
    }

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

            <div className={stacked ? "pd-deck pd-stacked" : "pd-deck"}>
                {/* ─── Peri ─── */}
                <div className="pd-device">
                    <div className="pd-keyring" />
                    <div
                        className="pd-shell"
                        style={
                            {
                                "--pd-shell": shellColor,
                                "--pd-outline": outlineColor,
                            } as CSSProperties
                        }
                    >
                        {/* "ON" status key (click = re-run log, with sound) */}
                        <div className="pd-power-well">
                            <button
                                type="button"
                                title="Re-run log"
                                className="pd-power"
                                onClick={onPower}
                            >
                                ON
                            </button>
                        </div>

                        <div className="pd-wordmark">PERI</div>

                        <div className="pd-bezel">
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
                                <div className="pd-overlay pd-scanlines" />
                                <div className="pd-overlay pd-shade" />
                                <div className="pd-overlay pd-glare" />
                            </div>
                        </div>

                        <div className="pd-hint">tap to say hi to Peri</div>

                        <div className="pd-controls">
                            <div className="pd-control">
                                <button
                                    type="button"
                                    aria-label="Look left"
                                    className="pd-btn pd-btn-look"
                                    onClick={onLook(-1)}
                                >
                                    &lt;
                                </button>
                                <span aria-hidden="true">LOOK</span>
                            </div>

                            <div className="pd-control pd-pet">
                                <button
                                    type="button"
                                    className="pd-btn pd-btn-pet"
                                    onClick={onPet}
                                >
                                    PET
                                </button>
                                <span aria-hidden="true">♥</span>
                            </div>

                            <div className="pd-control">
                                <button
                                    type="button"
                                    aria-label="Look right"
                                    className="pd-btn pd-btn-look"
                                    onClick={onLook(1)}
                                >
                                    &gt;
                                </button>
                                <span aria-hidden="true">LOOK</span>
                            </div>
                        </div>

                        {/* speaker slots + version plate */}
                        <div className="pd-base" aria-hidden="true">
                            <div className="pd-grille">
                                <i />
                                <i />
                                <i />
                                <i />
                            </div>
                            <div className="pd-plate">
                                v2.0
                                <i className="pd-tri" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── cable: horizontal (desktop), gentle catenary sag ─── */}
                <svg
                    className="pd-cable-h"
                    width="76"
                    height="60"
                    viewBox="0 0 76 60"
                    fill="none"
                    aria-hidden="true"
                >
                    <rect x="0" y="24" width="9" height="12" fill={C.teal} />
                    <rect x="9" y="28" width="4" height="4" fill={C.teal} />
                    <path
                        d="M13 30 Q38 52 63 30"
                        stroke={C.teal}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <rect x="63" y="28" width="4" height="4" fill={C.teal} />
                    <rect x="67" y="24" width="9" height="12" fill={C.teal} />
                </svg>

                {/* ─── cable: vertical (mobile only) ─── */}
                <svg
                    className="pd-cable-v"
                    width="60"
                    height="40"
                    viewBox="0 0 60 40"
                    fill="none"
                    aria-hidden="true"
                >
                    <rect x="24" y="0" width="12" height="9" fill={C.teal} />
                    <rect x="28" y="9" width="4" height="4" fill={C.teal} />
                    <path
                        d="M30 13 L30 27"
                        stroke={C.teal}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <rect x="28" y="27" width="4" height="4" fill={C.teal} />
                    <rect x="24" y="31" width="12" height="9" fill={C.teal} />
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
                        {bodyRows}
                    </div>
                </div>
            </div>

            {BIO ? <div className="pd-bio">{BIO}</div> : null}
        </div>
    )
}

PixelPet.defaultProps = {
    message: "THX FOR\nVISITING!",
    shellColor: "#8E94F2",
    outlineColor: "#3B3F8C",
    arrowColor: "#59AFB1",
    soundEnabled: true,
    petSound: "sparkle",
    lookSound: "tick",
    powerSound: "ready",
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
        defaultValue: "#8E94F2",
    },
    outlineColor: {
        type: ControlType.Color,
        title: "Outline",
        defaultValue: "#3B3F8C",
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
        defaultValue: "sparkle",
        options: SOUND_NAMES,
        optionTitles: SOUND_NAMES.map((n) => n[0].toUpperCase() + n.slice(1)),
        hidden: (p) => !p.soundEnabled,
    },
    lookSound: {
        type: ControlType.Enum,
        title: "LOOK sound",
        defaultValue: "tick",
        options: SOUND_NAMES,
        optionTitles: SOUND_NAMES.map((n) => n[0].toUpperCase() + n.slice(1)),
        hidden: (p) => !p.soundEnabled,
    },
    powerSound: {
        type: ControlType.Enum,
        title: "POWER sound",
        defaultValue: "ready",
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
