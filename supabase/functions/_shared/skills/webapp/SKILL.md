# Lumina Websites Mode — Skill File

## Purpose
Generate complete, runnable frontend code from natural language descriptions. Structure-first approach: plan the site map before writing code, then implement, then self-check by loading the generated site and verifying it against the request.

## General Principles

### Structure-first process (mandatory)
1. **Plan**: For anything beyond a single page, produce a site map first:
   ```
   index.html          — Landing / hero
   pages/about.html    — About / team
   pages/features.html — Feature breakdown
   blog/               — Blog listing
   css/style.css       — Shared styles
   js/app.js           — Shared scripts
   ```
2. **Implement**: Generate each page as a complete, standalone HTML file
3. **Self-check**: Load the generated site in a browser and verify against the request

### Single-page conventions
- One `index.html` with embedded `<style>` and `<script>` blocks
- Keep CSS under 500 lines; if larger, extract to `style.css`
- Keep JS under 300 lines; if larger, extract to `script.js`
- All assets self-contained (no external CDN dependencies unless explicitly requested)

### Multi-page conventions
- Shared `<nav>` and `<footer>` across all pages
- Consistent `<head>` meta tags on every page
- `index.html` is the entry point; all other pages linked from it
- Relative paths: `./pages/about.html`, `../css/style.css`
- Each page is a **complete** HTML document (not a fragment)
- CSS `@import` for shared styles across pages

## HTML Conventions

### Required structure (every HTML file)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meaningful Title</title>
  <meta name="description" content="Concise description under 160 chars">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>...</header>
  <nav>...</nav>
  <main>...</main>
  <footer>...</footer>
  <script src="app.js"></script>
</body>
</html>
```

### Semantic HTML
- `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`
- Heading hierarchy: `h1` (page title, one per page) → `h2` (section) → `h3` (subsection) — never skip levels
- Every `img` has `alt` text
- Every interactive element has focus styles
- Forms have proper `<label>` elements linked by `for` attribute

## CSS Conventions

### Modern CSS required
- CSS custom properties for all colors, spacing, and typography
- `:root { --color-primary: #6366f1; --space-md: 1rem; --font-sans: 'Inter', system-ui, sans-serif; }`
- No raw color values after the `:root` block — use `var(--color-*)` everywhere
- Grid and Flexbox for layout (no floats, no `display: table` for layout)
- Mobile-first responsive: `@media (min-width: 768px) { ... }`
- Fluid typography: `font-size: clamp(1rem, 2.5vw, 2rem)`
- Smooth transitions: `transition: all 0.2s ease`
- Dark mode support via `@media (prefers-color-scheme: dark)` or `[data-theme="dark"]`

### CSS reset
```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
```

### Spacing system
Use a consistent 4px base unit:
- `--space-1: 0.25rem` (4px)
- `--space-2: 0.5rem` (8px)
- `--space-3: 0.75rem` (12px)
- `--space-4: 1rem` (16px)
- `--space-6: 1.5rem` (24px)
- `--space-8: 2rem` (32px)
- `--space-12: 3rem` (48px)
- `--space-16: 4rem` (64px)

## JavaScript Conventions

### ES6+ only
- `const` / `let` — never `var`
- Arrow functions for callbacks
- `async/await` for asynchronous operations
- Proper `try/catch` with user-facing error messages
- `DOMContentLoaded` event listener for DOM manipulation
- Event delegation for dynamic elements
- No inline event handlers (`onclick="..."`) — always `addEventListener`

### State management
- For simple apps: module-scoped variables or a plain object store
- For complex apps: use the provided state management (Zustand store patterns)
- Never pollute `window` with global variables

## Accessibility Checklist
- Every `<img>` has non-empty `alt` text
- Every form input has a `<label>` with `for` attribute
- Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text (18px+ bold or 24px+ regular)
- Keyboard navigable: all interactive elements reachable by Tab, visible focus indicators
- `aria-label` on icon-only buttons
- `lang` attribute on `<html>` tag
- `<nav>` wraps navigation landmarks
- Skip-to-content link for long pages

## Self-Check Validation

Before declaring done, the generated site MUST be loaded in the sandboxed browser and verified:

- [ ] **Page loads without errors**: Open the generated HTML in a browser, check console for JS errors
- [ ] **Responsive at 320px**: Viewport at 320px wide — no horizontal scroll, no overlapping elements, readable text
- [ ] **Responsive at 768px**: Tablet breakpoint works — layout shifts appropriately
- [ ] **Responsive at 1280px**: Desktop layout displays correctly
- [ ] **All links work**: Every `<a>` tag navigates to a valid target (or `#` is handled by JS)
- [ ] **All images load**: No broken image placeholders
- [ ] **Forms submit without error**: Form submission either works or shows a graceful message
- [ ] **Dark mode enabled**: Preferred color scheme toggles correctly if implemented
- [ ] **No placeholder content**: Zero "lorem ipsum", "TODO", "coming soon", "item 1"
- [ ] **Subject matches request**: The site's main heading and content directly reflect the user's request
- [ ] **Content density adequate**: For a visual site request, the page has sufficient content (not just "Welcome to X" with one paragraph)
- [ ] **Screenshot match**: Take a screenshot of the rendered page and compare to any provided mockup/reference; key visual elements are present and positioned correctly

## Region-Editing Support

For follow-up tasks that modify specific sections:

- Use CSS selectors as addressable targets: `#hero`, `#features`, `.pricing-card`
- When editing, output ONLY the modified file(s) — do not regenerate the entire project
- Prefix the file output with the section being changed: `// SECTION: hero`
- Ensure edits don't break the surrounding structure (valid HTML after paste)
