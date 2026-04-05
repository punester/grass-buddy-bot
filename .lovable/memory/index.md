# Project Memory

## Core
ThirstyGrass lawn watering app. Green #16a34a primary. Mobile-first.
Admin emails: punit@110labs.com, pun279@gmail.com (hardcoded, RLS via is_admin()).
Stripe live mode. Price from app_settings table, not hardcoded.
Never edit client.ts or types.ts. Never edit .env.

## Memories
- [Stripe integration](mem://features/stripe) — Checkout, cancel, webhook edge functions. Price from app_settings.
- [Tier gating](mem://features/tier-gating) — useUserTier hook, LockedFeatureCard, free vs paid features
