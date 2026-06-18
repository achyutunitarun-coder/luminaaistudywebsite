# LUMINA AI — Design System & Redesign Context

## Project Overview
- **Repo**: `C:\Users\Tarun\luminaaistudywebsite`
- **Live**: `luminaai.co.in`
- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Supabase (Auth, DB, Edge Functions)
- **Branch**: `main` (latest commit: `5f2a6d9`)

## What's Been Done

### 1. Sidebar Navigation (COMPLETE)
**Files**: `src/components/AppSidebar.tsx`, `src/components/AppSidebarContent.tsx`
- Consolidated from 20+ items → 7 items in 3 clear groups
- Groups: Chat, Notes, Tests, Doubts | Performance, Leaderboard | Settings
- Compact stats bar with level + XP gradient bar
- Removed: BETA badge, timer, streak/coins clutter, redundant nav items

### 2. Chat Page (COMPLETE)
**File**: `src/features/chat/ChatPage.tsx`
- Empty state: "What do you want to learn?" headline + 2×2 action cards
- Cards have colored icons, titles, descriptions with hover glow effects
- 4 action cards: Explain, Notes, Tests, Doubts
- Date-grouped conversation history (Today, Yesterday, This Week, Older)
- Improved title generation (extracts verb phrases)
- SVG-based ambient glow orbs (cross-browser radial gradients)
- Compact top bar (52px), refined input area (52px height, 20px border-radius)
- Mode pills with gradient selected state
- Max content width: 760px

### 3. Design System (COMPLETE)
**File**: `src/index.css`
- Color tokens: violet (#7C3AED), teal (#14B8A6), amber (#F59E0B), sky (#3B82F6)
- Utility classes: surface, surface-interactive, surface-glass
- Buttons: btn-primary, btn-secondary, btn-ghost, btn-danger
- Badges: badge-accent, badge-success, badge-warning, badge-neutral
- Glow: shadow-glow, shadow-glow-sm, shadow-glow-teal, shadow-glow-amber
- Sugg-card hover effects
- Custom scrollbar, selection color, focus states
- Fonts: Inter, Instrument Serif, JetBrains Mono (loaded via Google Fonts)

### 4. Landing Page (COMPLETE)
**File**: `src/pages/Landing.tsx`
- Teal-to-violet gradient color system
- Aurora mesh background with SVG radial gradients
- Product preview mockup
- Feature bento grid with colored icons
- Testimonials, pricing, FAQ sections

## Design Tokens

```javascript
// Colors
C.bg = "#0A0A0F"           // Deep background
C.surface = "#1A1A25"      // Cards, panels
C.border = "rgba(255,255,255,0.06)"  // Subtle borders
C.text = "#F0F0F5"          // Primary text
C.text2 = "#A0A0B0"         // Secondary text
C.text3 = "#5A5A73"         // Tertiary/disabled
C.violet = "#7C3AED"        // Primary accent
C.violet2 = "#A78BFA"       // Secondary accent
C.teal = "#14B8A6"          // Success/positive
C.amber = "#F59E0B"         // Warning/highlight
C.sky = "#3B82F6"           // Info
C.rose = "#EF4444"          // Error/danger
C.gradient = "linear-gradient(135deg, #7C3AED, #A78BFA)"
```

## Critical Patterns

### SVG Ambient Glow (works in all browsers)
```jsx
<svg style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
  <defs>
    <radialGradient id="glow-violet" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="rgba(124,58,237,0.15)" />
      <stop offset="70%" stopColor="transparent" />
    </radialGradient>
  </defs>
  <ellipse cx="150" cy="80" rx="350" ry="250" fill="url(#glow-violet)" />
</svg>
```

### Glassmorphic Card
```jsx
<div style={{
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  backdropFilter: "blur(12px)",
}}>
```

### Glow Shadow
```jsx
boxShadow: "0 0 40px rgba(124,58,237,0.25), 0 0 80px rgba(124,58,237,0.1)"
```

## Pages Still Needing Rewrite

Priority order:
1. **Dashboard** (`src/pages/Dashboard.tsx`) — 549 lines, still uses old inline styles
2. **Auth** (`src/pages/Auth.tsx`) — Login page needs premium treatment
3. **Tests** (`src/pages/Tests.tsx`) — Test generator
4. **Flashcards** (`src/pages/Flashcards.tsx`) — Flashcard study
5. **DoubtSolver** (`src/pages/DoubtSolver.tsx`) — Doubt solver
6. **Performance** (`src/pages/Performance.tsx`) — Analytics
7. **NotesGenerator** (`src/pages/NotesGenerator.tsx`) — Notes generator
8. **Leaderboard** (`src/pages/Leaderboard.tsx`) — Leaderboard
9. **Settings** (`src/pages/SettingsPage.tsx`) — Settings
10. **Upgrade** (`src/pages/Upgrade.tsx`) — Pricing page

## Key Principles
1. **Dense layout** — No wasted space, every pixel has purpose
2. **Clear hierarchy** — One primary CTA, secondary actions subdued
3. **Proper contrast** — #F0F0F5 primary, #A0A0B0 secondary, #5A5A73 tertiary
4. **SVG glow effects** — Use radial gradients, NOT CSS filter:blur()
5. **Consistent spacing** — 8px grid, 16px padding, 12-16px border-radius
6. **Glassmorphic surfaces** — rgba(255,255,255,0.04) bg + 0.06-0.08 border
7. **Violet accent** — #7C3AED primary, #A78BFA secondary
8. **Inline styles** — For pixel-perfect control (no Tailwind ambiguity)

## File Structure
```
src/
├── index.css                    # Design system (COMPLETE)
├── main.tsx                     # Entry point
├── App.tsx                      # Routing
├── components/
│   ├── AppSidebar.tsx           # Sidebar (COMPLETE)
│   ├── AppSidebarContent.tsx    # Sidebar content (COMPLETE)
│   ├── AppLayout.tsx            # Main layout wrapper
│   └── ui/                      # shadcn/ui components
├── features/chat/
│   ├── ChatPage.tsx             # Chat page (COMPLETE)
│   ├── components/
│   │   ├── MessageList.tsx      # Message list
│   │   ├── MessageBubble.tsx    # Message bubbles
│   │   ├── InputBar.tsx         # Input area
│   │   └── ModelSelector.tsx    # Model selector
│   └── utils/                   # Chat utilities
└── pages/                       # 38 pages total
    ├── Landing.tsx              # Landing page (COMPLETE)
    ├── Dashboard.tsx            # Dashboard (NEEDS REWRITE)
    ├── Auth.tsx                 # Login (NEEDS REWRITE)
    ├── Tests.tsx                # Tests (NEEDS REWRITE)
    └── ... (34 more pages)
```

## Build & Deploy
```bash
cd C:\Users\Tarun\luminaaistudywebsite
npx vite build    # Build (takes ~30s)
git add -a && git commit -m "..." && git push origin main
# Auto-deploys via Lovable from repo
```

## Known Issues
- `filter: blur()` CSS doesn't work consistently across browsers — use SVG radial gradients instead
- Tailwind blur classes (`blur-[100px]`) produce invisible results on dark backgrounds — use SVG
- Low contrast text (`text-muted-foreground`) is hard to read → use `#A0A0B0` minimum
- Excessive whitespace in empty states → reduce padding, use dense grids
