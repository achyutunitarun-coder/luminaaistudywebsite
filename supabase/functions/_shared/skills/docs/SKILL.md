# Lumina Docs Mode — Skill File

## Purpose
Generate structured documents (markdown → DOCX/PDF/LaTeX) with cross-format consistency. This file defines format compatibility rules, styling conventions, structural patterns, and the mandatory validation checklist.

## Format Targets

### Markdown (primary authoring format)
- Always start with a level-1 heading (`# Title`).
- Use ATX headings (`##`, `###`, not underlined).
- One blank line before and after every heading.
- Tables: use GFM pipe syntax with alignment dashes.
- Lists: `-` for unordered, `1.` for ordered. Nested lists indent 2 spaces.
- Code blocks: fence with triple backticks and language tag.
- Math: use `$inline$` and `$$block$$` (LaTeX notation).
- Images: `![alt](path)` with descriptive alt text always.
- Links: `[text](url)` — prefer descriptive link text, never "click here".

### DOCX (export target)
- Heading 1 = document title (page-break before if section start)
- Heading 2+ = section hierarchy
- Lists auto-convert to Word numbered/bulleted lists
- Tables preserve column widths (set explicit widths: 25/50/25 for 3-col)
- Images embedded at 100% of text width, max 6in
- Footnotes become Word footnotes
- Code blocks → shaded `Code` style (light grey background, monospace)
- Page size: Letter (8.5×11in), 1in margins all sides
- Font: body 11pt Calibri, heading 14pt Calibri Bold, code 9.5pt Consolas
- Line spacing: 1.15 body, 1.0 code
- Paragraph spacing: 6pt after, 0 before

### PDF (via LaTeX when requested, or direct HTML→PDF)
- If LaTeX is requested: produce valid `.tex` with `\documentclass[11pt]{article}`
- Use `\usepackage{amsmath, amssymb, graphicx, hyperref, geometry}`
- Geometry: `margin=1in`
- `\title{}`, `\author{}`, `\date{}`, `\maketitle`
- Sections: `\section{}`, `\subsection{}`
- Code: `\begin{verbatim}` or `\usepackage{listings}` with `\lstset{basicstyle=\ttfamily}`
- Images: `\includegraphics[width=\textwidth]{path}`
- If NOT LaTeX: request is for HTML→PDF via browser print, produce clean HTML with `@media print` styles

### Cross-Format Rules
| Feature | Markdown | DOCX | LaTeX PDF |
|---------|----------|------|-----------|
| Bold | `**text**` | Bold style | `\textbf{}` |
| Italic | `*text*` | Italic style | `\textit{}` |
| Inline code | `` `code` `` | Consolas font | `\texttt{}` |
| Math inline | `$x^2$` | Equation object (fallback: italic) | `$x^2$` |
| Math block | `$$...$$` | Equation object (fallback: center) | `\[...\]` |
| Image | `![alt](p)` | Embedded at width | `\includegraphics` |
| Footnote | `[^1]` | Word footnote | `\footnote{}` |

## Structural Conventions

### General document structure
1. **Title page** (single # heading, optional subtitle, author, date)
2. **Abstract or Executive Summary** (if document > 2 pages)
3. **Table of Contents** (if document > 5 sections, mark with `<!-- TOC -->`)
4. **Body sections** in logical narrative flow
5. **References / Bibliography** (APA 7th edition format preferred)
6. **Appendices** (if applicable)

### Tone and voice
- Professional, direct, and concise
- Use active voice: "The system processes data" not "Data is processed by the system"
- Define acronyms on first use: "Artificial Intelligence (AI)"
- Numbered steps for procedures, bullet lists for items
- Every claim that is not common knowledge needs a citation `[1]`

## Validation Checklist (execute before declaring done)

Run through each check. Fix any failures.

- [ ] **Structural completeness**: Title, body sections, and references present
- [ ] **Heading hierarchy**: No skipped levels (h1 → h2 → h3, never h1 → h3)
- [ ] **Heading continuity**: No orphan headings with zero body content
- [ ] **Cross-format tags**: All markdown-only syntax (tables, footnotes, math) has a fallback for non-MD output
- [ ] **No placeholder content**: Zero instances of "lorem ipsum", "TODO", "FIXME", "[placeholder]", "coming soon", etc.
- [ ] **Citation integrity**: Every `[N]` reference has a matching entry in the References section
- [ ] **Image alt text**: Every `![](...)` has non-empty alt text
- [ ] **Link health**: All URLs start with `https://` (no broken or example.com links)
- [ ] **Math validity**: All `$...$` and `$$...$$` blocks are syntactically valid LaTeX (balanced braces, no stray characters)
- [ ] **Min content threshold**: Document body (excluding code fences) > 300 characters for anything labeled as a deliverable
- [ ] **Consistent formatting**: Same style for all list items, consistent heading capitalization (title case or sentence case, not mixed)
- [ ] **No raw HTML in markdown**: The markdown body should not contain raw `<div>`, `<span>`, `<style>` tags (use pure markdown)
- [ ] **File naming**: Document files use `.md` extension, export artifacts use `.docx` or `.pdf` as appropriate
