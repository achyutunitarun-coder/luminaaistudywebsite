/**
 * Aesthetic Style Rotation for artifacts.
 * Picks 1 of N distinctive visual directions so artifacts never feel "samey".
 * Honours the Frontend Design & Aesthetics skill — bold anchor, characterful
 * typography, no Inter/Roboto/Space Grotesk as primary identity, no
 * purple-on-black clichés.
 */

export interface AestheticStyle {
  id: string;
  name: string;
  anchor: string;
  palette: string;
  fonts: string;
  fontImport: string;
  motif: string;
  motion: string;
}

export const AESTHETIC_STYLES: AestheticStyle[] = [
  {
    id: "editorial-broadsheet",
    name: "Editorial Broadsheet",
    anchor: "Old-world print magazine — generous margins, oversized italic serif, hairline rules, drop caps",
    palette: "--bg:#f4ecd8; --ink:#1a1208; --rule:#1a120822; --accent:#a8341d; --highlight:#c48a2e; --quote:#5b3b1f;",
    fonts: "Display: 'Fraunces' italic 800. Body: 'Newsreader' 400/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Newsreader:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Hairline column rules, oversized drop cap, pull-quote with vertical rule, kicker/tracked uppercase eyebrow.",
    motion: "Single staggered fade-up on load, ink-bleed underline on hover. No bouncing.",
  },
  {
    id: "neo-brutal",
    name: "Neo-Brutalist Workshop",
    anchor: "Raw blocks, thick 2px black borders, hard offset shadows, single saturated accent",
    palette: "--bg:#f2efe6; --ink:#0a0a0a; --paper:#ffffff; --accent:#ff5722; --pop:#fbbf24; --shadow:#0a0a0a;",
    fonts: "Display: 'Archivo Black' 900. Body: 'Space Grotesk' is FORBIDDEN — use 'IBM Plex Sans' 400/600. Mono: 'IBM Plex Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap",
    motif: "Hard 6px solid borders, 8px offset block shadows, no rounded corners over 4px, sticker labels.",
    motion: "Click press = shadow collapses to 0; hover = shadow grows. Snappy 120ms.",
  },
  {
    id: "swiss-grid",
    name: "Swiss Grid Precision",
    anchor: "International Typographic Style — extreme geometric precision, baseline grid, mathematical spacing",
    palette: "--bg:#fafafa; --ink:#111111; --rule:#11111122; --accent:#d22b2b; --muted:#666; --paper:#ffffff;",
    fonts: "Display: 'Bricolage Grotesque' 700/800. Body: 'Inter Tight' 400/500 (this ONE case is allowed when paired with Bricolage). Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Inter+Tight:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap",
    motif: "12-column visible grid, large numerals as section markers, diagonal accent rule, tabular figures everywhere.",
    motion: "No decorative motion. Only state changes (200ms ease).",
  },
  {
    id: "luxury-noir",
    name: "Luxury Noir",
    anchor: "Black tie editorial — deep charcoal, brushed gold accents, restrained serifs, museum-grade whitespace",
    palette: "--bg:#0d0d0f; --surface:#16161a; --ink:#f4ead5; --gold:#c9a44c; --bronze:#8a6a2b; --rule:#f4ead51a;",
    fonts: "Display: 'Cormorant Garamond' 300/600 italic. Body: 'Manrope' 300/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,500;1,300;1,500&family=Manrope:wght@300;500&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Thin gold rules, monogrammed seal in corner, italic display headlines, low-contrast bronze body.",
    motion: "Slow 800ms fades, gentle parallax on hero, gold shimmer sweep on primary button hover.",
  },
  {
    id: "organic-botanica",
    name: "Organic Botanica",
    anchor: "Hand-drawn natural science journal — warm paper, soft greens, ink illustrations, deckle edges",
    palette: "--bg:#f6f1e6; --paper:#fdf9ef; --ink:#1f2b1c; --moss:#506d47; --rust:#a44a2a; --sky:#7aa9b8;",
    fonts: "Display: 'Caslon' (use 'DM Serif Display'). Body: 'Lora' 400/500. Script accent: 'Caveat'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lora:ital,wght@0,400;0,600;1,400&family=Caveat:wght@500;700&display=swap",
    motif: "Deckle-edge cards, hand-drawn underlines (SVG squiggle), botanical SVG flourishes, handwritten margin notes.",
    motion: "Pages turn with subtle paper rustle (CSS only), wax-seal stamp drop on load.",
  },
  {
    id: "retro-terminal",
    name: "Retro Terminal",
    anchor: "CRT / vintage computing — phosphor glow, scanlines, monospace everywhere, ASCII art",
    palette: "--bg:#0b1109; --grid:#0e1a0c; --green:#9cffa3; --amber:#ffb454; --dim:#3a6b3e; --warn:#ff6363;",
    fonts: "Display: 'VT323' or 'Major Mono Display'. Body: 'JetBrains Mono' 400/600. Accent: 'Press Start 2P' for headings only.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=VT323&family=Major+Mono+Display&family=JetBrains+Mono:wght@400;500;700&family=Press+Start+2P&display=swap",
    motif: "CRT scanline overlay, phosphor text-shadow, blinking caret, ASCII box-drawing rules, boot-sequence loader.",
    motion: "Typewriter reveal on headings, scanline drift, cursor blink, glitch flash on hover.",
  },
  {
    id: "japandi-minimal",
    name: "Japandi Minimal",
    anchor: "Japanese-Scandinavian fusion — vast negative space, single ink line, sumi-e restraint",
    palette: "--bg:#f5f2ec; --paper:#ffffff; --ink:#1d1d1b; --vermilion:#c8442a; --moss:#5b6b50; --rule:#1d1d1b22;",
    fonts: "Display: 'Shippori Mincho' 600. Body: 'Noto Sans JP' or 'Manrope' 300/500.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Manrope:wght@300;400;600&display=swap",
    motif: "Single red enso brushstroke as section divider, vertical kicker (writing-mode), tatami baseline grid.",
    motion: "Slow ink-bleed reveal (1.2s), no bounce, no scale, only opacity + 8px translateY.",
  },
  {
    id: "cyber-aurora",
    name: "Cyber Aurora",
    anchor: "Holographic glass, aurora gradients, iridescent borders — NOT purple-on-black cliché",
    palette: "--bg:#06121a; --surface:#0c1c28; --aurora1:#5eead4; --aurora2:#a78bfa; --aurora3:#f0abfc; --ice:#e0fbfc;",
    fonts: "Display: 'Syne' 700/800. Body: 'Sora' 300/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Sora:wght@300;400;600&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Conic-gradient borders, holographic chrome text, aurora-orb backgrounds, 1px iridescent rule.",
    motion: "Aurora drift, conic-gradient rotation on hover, soft chromatic aberration on focus.",
  },
  {
    id: "warm-library",
    name: "Warm Library",
    anchor: "Vintage study — worn leather, amber lamps, wooden shelves, warm paper, classic scholarship",
    palette: "--bg:#e8ddd0; --paper:#f5efe6; --ink:#2c1810; --leather:#8b4513; --amber:#d4a043; --wine:#722f37;",
    fonts: "Display: 'Playfair Display' 700 italic. Body: 'EB Garamond' 400/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Warm vignette border, ornamental drop caps, decorative section dividers, simulated book-page curve at spine.",
    motion: "Page curl on section transitions, candlelight flicker on hover, slow amber glow pulse on hero.",
  },
  {
    id: "minimal-slate",
    name: "Minimal Slate",
    anchor: "Contemporary clean — cool gray scale, single accent for emphasis, maximum whitespace, editorial photography feel",
    palette: "--bg:#f8f9fa; --card:#ffffff; --ink:#1e293b; --accent:#3b82f6; --muted:#64748b; --border:#e2e8f0;",
    fonts: "Display: 'Plus Jakarta Sans' 700. Body: 'Plus Jakarta Sans' 400/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Hairline borders everywhere, large hero numeral/counter, monochrome with single blue accent, clean data tables.",
    motion: "Only opacity + translateY entrances, subtle shadow on hover, no decorative motion.",
  },
  {
    id: "neon-midnight",
    name: "Neon Midnight",
    anchor: "Cyberpunk study — dark indigo base, electric cyan + magenta highlights, scanner/glitch aesthetic",
    palette: "--bg:#0a0a1a; --surface:#12122a; --ink:#e0e0ff; --cyan:#22d3ee; --magenta:#e879f9; --amber:#fbbf24;",
    fonts: "Display: 'Orbitron' 700. Body: 'DM Sans' 400/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Scanline overlay (CSS only), neon glow text-shadow, grid background pattern, corner brackets on cards.",
    motion: "Glow pulse on accent elements (3s), scanning line sweep, glitch transition on section change.",
  },
  {
    id: "studio-notebook",
    name: "Studio Notebook",
    anchor: "Sketchbook aesthetic — cream pages, margin notes, hand-drawn underlines, polaroid-style media blocks",
    palette: "--bg:#f8f5f0; --paper:#fffbeb; --ink:#292524; --red:#dc2626; --blue:#2563eb; --tape:#e5e7eb;",
    fonts: "Display: 'Nanum Pen Script' or 'Patrick Hand'. Body: 'Source Serif 4' 400/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Nanum+Pen+Script&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Margin-lined paper background, taped-down media blocks, handwritten-style annotations, red ink corrections.",
    motion: "Sketch appear (draw-on effect), sticky-note drop in, pencil underline draw from left.",
  },
  {
    id: "glass-morphism",
    name: "Glass Morphism",
    anchor: "Frosted glass futuristic — deep blur backdrops, translucent cards, light borders, floating depth layers",
    palette: "--bg:#0c0e1a; --glass:rgba(255,255,255,0.05); --border:rgba(255,255,255,0.1); --ink:#f0f0f5; --accent:#60a5fa; --accent2:#a78bfa;",
    fonts: "Display: 'Clash Display' 600. Body: 'Satoshi' 400/500. Mono: 'JetBrains Mono'.",
    fontImport:
      "https://fonts.googleapis.com/css2?family=Clash+Display:wght@500;600;700&family=Satoshi:wght@300;400;500;700&family=JetBrains+Mono:wght@500&display=swap",
    motif: "Backdrop blur glass cards, floating layer positioning with z-index, subtle gradient orb accents, frosted button styles.",
    motion: "Depth shift on hover (z-translate), shimmer sweep across glass surfaces, gentle float animation on hero.",
  },
];

/** Deterministic-ish hash so same topic gets the same style. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function pickStyle(seed: string): AestheticStyle {
  if (!seed) return AESTHETIC_STYLES[0];
  return AESTHETIC_STYLES[hash(seed) % AESTHETIC_STYLES.length];
}

export function styleDirectiveBlock(seed: string): string {
  const s = pickStyle(seed);
  return `
═══════════════════════════════════════
ASSIGNED AESTHETIC FOR THIS ARTIFACT — ${s.name.toUpperCase()}
═══════════════════════════════════════
Visual anchor: ${s.anchor}
Palette (use these as your :root tokens, override any default tokens above):
  ${s.palette}
Typography: ${s.fonts}
Required Google Fonts import:
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${s.fontImport}" rel="stylesheet">
Signature motif (MUST appear): ${s.motif}
Motion language: ${s.motion}

Commit fully to this aesthetic. Do NOT mix it with other style languages. Do NOT
default back to teal-on-near-black glassmorphism unless this style is "Cyber Aurora"
or "Glass Morphism". Background must NOT be generic flat white or pitch black unless
the assigned palette specifies it.
`.trim();
}
