---
name: Onboarding puzzle sequence vision
description: Long-term design for onboarding puzzles as numbered archive entries with a skill ladder
type: project
---

Give onboarding puzzles real numbers (1–10), so they slot into the archive before daily puzzles (currently in the 90s). No special-casing needed — streak, optimal, total solves all just work.

The 10 puzzles should be small variations on the same wall layout, gradually increasing in difficulty, with the later ones reaching expert-level optimal move counts. Same board "family" = player builds spatial intuition incrementally without needing a tutorial screen.

**Why:** Clean data model (no `onboardingLevel` special-casing for stats), natural skill ladder built into the archive, rewards going back to fill gaps.

**How to apply:** This is a future refactor. Current blocker: existing users would get silent streak gaps at #1–#2. Ship as a deliberate migration moment, not a silent change. For now, `onboardingLevel` filter stays and a TODO comment lives in `game/streak.ts`.
