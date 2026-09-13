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
const ART = 9
const OX = 48
const OY = 50
const CW = 222
const CH = 180

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
.pd-shell { position: relative; flex: none; }

/* "ON" status badge — pixel-art, matches the left/right/PET button family:
   flat fill + hard offset shadow "profile" underneath. States that Peri is on
   (no off-state); clicking re-runs the log. No glow — the word carries it. */
.pd-power {
    position: absolute; right: 12px; top: 50%; margin-top: -12px;
    padding: 5px 7px; cursor: pointer;
    font-family: ${FONT}; font-size: 8px; letter-spacing: 1px; line-height: 1;
    color: #0b1a1a;
    background: ${C.teal};
    border: 3px solid ${C.tdark};
    border-radius: 3px;
    box-shadow: 0 3px 0 ${C.tdark};
}
.pd-power:active { transform: translateY(3px); box-shadow: 0 0 0 transparent; }

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

.pd-btn:active { transform: translateY(4px); box-shadow: 0 0 0 transparent !important; }

/* Reduced-motion: drop the boot SLIDE (the vestibular-risky part) but keep the
   gentle caret blink + power breath — they're opacity/glow, and they carry the
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
        }
        petRef.current = pet

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
            if (t > pet.nextBlink) {
                pet.blinkUntil = t + 130
                pet.nextBlink = t + 2200 + Math.random() * 2400
            }
            if (
                t > pet.nextMicro &&
                pet.hopStart == null &&
                t > pet.microUntil
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
                    hopPx = -Math.sin(p * Math.PI) * 34
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
                px(46 + i * 30, 12, ART - 3, ART - 3, C.tdark, 0.55)

            px(OX + 2 * ART, OY + 12 * ART + 4, 10 * ART, 5, C.tdark, 0.22)

            const bulb = breath > 0 ? C.peribright : C.peri
            for (let r = 0; r < BODY.length; r++) {
                const row = BODY[r]
                for (let ci = 0; ci < row.length; ci++) {
                    const ch = row[ci]
                    if (ch === " ") continue
                    const col =
                        ch === "A"
                            ? bulb
                            : ch === "H"
                              ? C.tlight
                              : ch === "D"
                                ? C.tdark
                                : C.teal
                    cell(ci, r, oyPx, col)
                }
            }

            const drawEye = (baseCol: number) => {
                if (happy) {
                    cell(baseCol, 6, oyPx, C.bg)
                    cell(baseCol + 1, 5, oyPx, C.bg)
                    cell(baseCol + 2, 6, oyPx, C.bg)
                } else if (blink) {
                    cell(baseCol, 6, oyPx, C.bg)
                    cell(baseCol + 1, 6, oyPx, C.bg)
                } else {
                    cell(baseCol + look, 5, oyPx, C.bg)
                    cell(baseCol + 1 + look, 5, oyPx, C.bg)
                    cell(baseCol + look, 6, oyPx, C.bg)
                    cell(baseCol + 1 + look, 6, oyPx, C.bg)
                }
            }
            drawEye(3)
            drawEye(9)

            cell(6, 8, oyPx, C.bg)
            cell(7, 8, oyPx, C.bg)
            if (mouthOpen) {
                cell(6, 9, oyPx, C.bg)
                cell(7, 9, oyPx, C.bg)
            }

            if (tap) {
                cell(13, 6, oyPx, C.peri)
                cell(14, 6, oyPx, C.peribright)
            }

            pet.hearts = pet.hearts.filter((hh) => t - hh.born < 1250)
            for (const hh of pet.hearts) {
                const p = (t - hh.born) / 1250
                const hy = OY - 6 + hopPx * 0.3 - p * 66
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
        }
    }, [])

    const onPet = () => {
        const pet = petRef.current
        if (!pet) return
        if (soundEnabled) safePlay(petSound, volume)
        const t = performance.now()
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
        pet.micro = "look"
        pet.microDir = dir
        pet.microUntil = performance.now() + 850
    }
    // power light: status + click power-cycles (replays the log boot, with sound)
    const onPower = () => {
        if (soundEnabled) safePlay(powerSound, volume)
        setBoot((b) => b + 1)
    }

    const lookBtn: CSSProperties = {
        width: 52,
        height: 52,
        border: `3px solid ${outlineColor}`,
        borderRadius: "50%",
        cursor: "pointer",
        background: "#5A60C6",
        boxShadow: `0 4px 0 ${outlineColor}`,
        color: "#eef",
        fontFamily: FONT,
        fontSize: 13,
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
                <div
                    className="pd-shell"
                    style={{
                        width: 374,
                        padding: "64px 34px 34px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 20,
                        borderRadius: "50% 50% 47% 47% / 57% 57% 43% 43%",
                        background: shellColor,
                        border: `4px solid ${outlineColor}`,
                    }}
                >
                    {/* keyring nub */}
                    <div
                        style={{
                            position: "absolute",
                            top: 14,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 34,
                            height: 20,
                            border: "4px solid #6B71D6",
                            borderRadius: "12px 12px 4px 4px",
                            background: "transparent",
                        }}
                    />

                    {/* "ON" status badge (click = re-run log, with sound) */}
                    <button
                        type="button"
                        title="Re-run log"
                        className="pd-power"
                        onClick={onPower}
                    >
                        ON
                    </button>

                    <div
                        style={{
                            color: outlineColor,
                            fontSize: 12,
                            letterSpacing: 2,
                            textShadow: "0 1px 0 rgba(255,255,255,0.28)",
                        }}
                    >
                        PERI
                    </div>

                    {/* bezel */}
                    <div
                        style={{
                            position: "relative",
                            padding: 4,
                            borderRadius: 8,
                            background: "#0d0f18",
                            border: `3px solid ${outlineColor}`,
                        }}
                    >
                        <div
                            style={{
                                position: "relative",
                                borderRadius: 5,
                                overflow: "hidden",
                            }}
                        >
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
                                        fontSize: 15,
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
                                        width: 118,
                                        height: 3,
                                        background: C.heart,
                                    }}
                                />
                            </div>
                            {/* scanlines */}
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    pointerEvents: "none",
                                    background:
                                        "repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)",
                                }}
                            />
                            {/* glare */}
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    pointerEvents: "none",
                                    background:
                                        "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%)",
                                }}
                            />
                        </div>
                    </div>

                    <div
                        style={{
                            color: outlineColor,
                            fontSize: 8,
                            letterSpacing: 1,
                            opacity: 0.85,
                            whiteSpace: "nowrap",
                        }}
                    >
                        tap to say hi to Peri
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 26,
                            alignItems: "flex-start",
                        }}
                    >
                        <div style={colStyle}>
                            <button
                                type="button"
                                aria-label="Look left"
                                className="pd-btn"
                                onClick={onLook(-1)}
                                style={lookBtn}
                            >
                                &lt;
                            </button>
                            <span aria-hidden="true" style={labelStyle()}>
                                LOOK
                            </span>
                        </div>

                        <div style={colStyle}>
                            <button
                                type="button"
                                className="pd-btn"
                                onClick={onPet}
                                style={{
                                    width: 56,
                                    height: 56,
                                    border: "3px solid #7C3A5F",
                                    borderRadius: "50%",
                                    cursor: "pointer",
                                    background: "#BF5E95",
                                    boxShadow: "0 4px 0 #7C3A5F",
                                    color: "#fff",
                                    fontFamily: FONT,
                                    fontSize: 9,
                                }}
                            >
                                PET
                            </button>
                            <span aria-hidden="true" style={labelStyle()}>
                                ♥
                            </span>
                        </div>

                        <div style={colStyle}>
                            <button
                                type="button"
                                aria-label="Look right"
                                className="pd-btn"
                                onClick={onLook(1)}
                                style={lookBtn}
                            >
                                &gt;
                            </button>
                            <span aria-hidden="true" style={labelStyle()}>
                                LOOK
                            </span>
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

const colStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
}
// invisible but still in the layout so the shell height stays identical
const labelStyle = (): CSSProperties => ({
    fontSize: 6,
    letterSpacing: 1,
    visibility: "hidden",
})

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
