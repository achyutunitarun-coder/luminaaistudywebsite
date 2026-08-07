# Lumina — Investor One-Pager

> **Lumina is the adaptive study OS.** It watches where a student stumbles, rebuilds the exact concept they almost understood, and rewires their study plan the moment a test closes. Built for JEE · NEET · SAT · IB · A-Levels · CBSE · GCSE.

---

## The Problem

Students don't lack content — they drown in it. Canvas + Google Calendar + Notion + a paper planner + a group chat for "did we have reading?" The friction isn't finding an explanation; it's that no tool **remembers what they actually know**. Study apps are feature lists. Textbooks can't think back. Motivation evaporates because nothing records consistency in a way a student can see.

## The Product

One surface that unifies timetable, tasks, and motivation:

- **Adaptive intelligence** — per-concept mastery tracking built from test scores, mistake patterns, and time-on-question. Every quiz and explanation is rewired around blind spots, scheduled by spaced-repetition timing.
- **10 brain engines** — flashcards, tests, notes, lecture AI, weakness radar, smart paper generator, predicted-question generator, concept-map mastery, Lumina Computer, and more.
- **Lumina Computer** — a generative agent that produces complete, structured, deployable artifacts (websites, decks, docs, sheets) from a one-line brief. 12 goal-adaptive sections, real code output, design-system-aware.
- **From any source** — PDF, YouTube, voice, scribbled notes. Ingest → notes → flashcards → tests in seconds.

## Business Model (live)

Credits = the pricing unit. A bounded, per-generation cost model; the generative engine never burns unbounded API spend.

| Tier | Price/mo | Credits/mo | Rollover cap |
|------|----------|------------|--------------|
| Basic | ₹0 | 5 | 0 |
| Ultimate | ₹199 | 40 | 80 |
| PRO+ | ₹499 | 150 | 300 |
| MEGA | ₹899 | 300 | 600 |
| POWER+ | ₹1,299 | 500 | 1,000 |

Annual plans at ~33% off (₹133/₹333/₹599/₹866). One-time credit packs: ₹59 → 30cr, ₹149 → 100cr, ₹399 → 300cr, ₹899 → 800cr. Purchased credits never expire.

Cost structure: a Lumina Computer build = 5 credits ≈ 12 model calls (1 plan + 12 sections) routed through OpenRouter free-tier models with `openrouter/free` as the ultimate fallback. Marginal cost per paid user is near-zero at these allowances, so revenue is effectively margin.

Payments via **Dodo Payments** (checkout.dodopayments.com/buy), server-side webhook entitlement sync, return to luminaai.co.in.

## Moat

1. **The loop, not the model.** Any AI company can answer questions. Lumina's defensibility is the *per-concept mastery graph + spaced-repetition scheduling* that compounds with every session. More usage → better model of the student → better output → more usage.
2. **Generative engine with bounded cost** (credits) — a product-level moat over raw API access.
3. **Honest-by-default brand.** Real, verifiable beta voices; "never invented ones." In a market of inflated claims, this is durable trust.

## Traction & Credibility (investor-relevant facts)

- **47 live edge functions** (planning, routing, cooldown-aware streaming, Dodo entitlement sync), **36 DB tables**, all verified active in production.
- Live at **luminaai.co.in** (Vercel) — free signup, 5 free credits, no card required, ~30s to first insight.
- Model reliability engineered as a feature: per-model rate-limit cooldowns, auto-continuation on truncation, multi-key rotation, and `openrouter/free` as an ultimate safety net — generation never hard-fails.

## Roadmap (12 months)

- **Q3** — Cold funnel fix: 60-second product demo video above the fold; initialed & dated testimonials (topic + before/after mastery).
- **Q4** — Monetization validation: conversion analytics on the 5-tier ladder; annual-plan push; measure free→paid.
- **H1 next** — Named institutional pilots (schools/coaching centers), multiplayer/study-squad flywheel, first-party fine-tuned model using opt-in training data (Privacy settings already gate this).
- **Always** — Every feature must feed the one hero moment: *"I almost understood it."*

## Ask

Seed round to (1) ship the demo-video + institutional pilot motion, (2) hire one backend + one growth engineer, (3) run annual-plan acquisition experiments. Pricing and engine are live and measurable today.

---

*Prepared from the live production codebase (Aug 2026). Every price, credit allocation, and capability above is verifiable in the repo and on luminaai.co.in.*
