# LUMINA AI — Full Redesign Handoff for Claude

## What OWL Has Completed

### ✅ AppSidebar (`src/components/AppSidebar.tsx`) — 73 lines
- 7 nav items: Chat, Notes, Tests, Doubts, Performance, Leaderboard, Settings
- Compact XP bar, clean footer

### ✅ AppSidebarContent (`src/components/AppSidebarContent.tsx`) — 137 lines
- Same consolidated nav with collapsible support

### ✅ ChatPage (`src/features/chat/ChatPage.tsx`) — 283 lines
- SVG ambient glow orbs (cross-browser)
- "What do you want to learn?" empty state with 2×2 action cards
- Date-grouped conversation history
- Dense layout, proper contrast

### ✅ index.css — 149 lines
- Complete design system with tokens, utilities, glow effects

### ✅ Landing page (`src/pages/Landing.tsx`) — 750 lines
- Violet-aurora gradient system, product preview, bento features

## What Claude Needs to Do

### 1. Dashboard (`src/pages/Dashboard.tsx`) — 549 lines
**Current problems:**
- Uses old Tailwind classes mixed with inline styles
- `blur-[100px]` classes that don't render properly
- Too many sections (hero, stats, PRO+ upsell, weakness radar, intelligence hub, weekly chart, marketing)
- Low contrast text throughout
- Inconsistent spacing

**What to do:**
- Replace all `blur-[100px]` with SVG radial gradients (see ChatPage for pattern)
- Use inline styles with the design tokens below
- Keep the structure but make it denser and more cohesive
- Improve text contrast: #F0F0F5 primary, #A0A0B0 secondary, #5A5A73 tertiary
- Use the stat-card, surface-glass, btn-primary classes from index.css
- Add SVG ambient glow in the background

### 2. Auth page (`src/pages/Auth.tsx`)
**What to do:**
- Premium glassmorphic login card
- Centered layout with SVG ambient glow
- Google OAuth button with proper styling
- Clean, minimal — just logo + button + footer links

### 3. Remaining pages (Tests, Flashcards, DoubtSolver, Performance, NotesGenerator, Leaderboard, Settings, Upgrade)
**What to do:**
- Apply consistent design system from index.css
- Use inline styles for pixel-perfect control
- SVG ambient glow on each page
- Proper contrast and spacing
- Consistent button styles (btn-primary, btn-secondary, btn-ghost)

## Design Tokens (MUST USE)

```javascript
// Backgrounds
bg: "#09090B"           // Page background
surface: "#1A1A25"      // Cards, panels
sidebar: "#111118"      // Sidebar background

// Borders
border: "rgba(255,255,255,0.06)"     // Default border
borderHi: "rgba(255,255,255,0.1)"    // Hover/focus border

// Text
text: "#F0F0F5"           // Primary text
text2: "#A0A0B0"          // Secondary text  
text3: "#5A5A73"          // Tertiary/disabled

// Accents
violet: "#7C3AED"         // Primary accent
violet2: "#A78BFA"        // Secondary accent
teal: "#14B8A6"           // Success/positive
amber: "#F59E0B"          // Warning/highlight
sky: "#3B82F6"            // Info
rose: "#EF4444"           // Error/danger

// Gradients
gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)"
gradientTeal: "linear-gradient(135deg, #14B8A6, #7C3AED)"
```

## Critical Patterns

### SVG Ambient Glow (USE THIS, NOT CSS filter:blur)
```jsx
<svg style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, width: "100%", height: "100%" }}>
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
}}>
```

### Glow Shadow
```jsx
boxShadow: "0 0 40px rgba(124,58,237,0.25), 0 0 80px rgba(124,58,237,0.1)"
```

## Key Rules
1. NEVER use `blur-[Npx]` Tailwind classes — they don't work on dark backgrounds
2. ALWAYS use SVG radial gradients for glow effects
3. Use inline styles for pixel-perfect control
4. Minimum text contrast: #A0A0B0 for secondary, #F0F0F5 for primary
5. Border radius: 12-16px for cards, 8-10px for buttons, 20-24px for input areas
6. Spacing: 8px grid, 16px padding for cards
7. Button primary: gradient background + glow shadow
8. Button ghost: transparent bg + subtle border

## Build Command
```bash
cd C:\Users\Tarun\luminaaistudywebsite && npx vite build
```
