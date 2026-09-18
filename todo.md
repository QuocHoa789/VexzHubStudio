# Lumen rewards security checklist

- [x] Add Link4Sub level 1 and level 2 URLs with separate rewards.
- [x] Add a tier picker button in the mission card.
- [x] Add server-issued single-use reward attempts.
- [x] Reject completion before the server-side minimum wait time.
- [x] Keep per-tier daily idempotency keys to prevent duplicate credits.
- [x] Restore attempt state after refresh and require tab return before completion.
- [x] Add lightweight rewards API rate limiting and request body limits.
- [x] Add client-side F12/context-menu deterrents.
- [x] Add unit coverage for tier configuration and early-completion timing.
- [x] Run tests, typecheck, production build, and responsive preview.
- [x] Add an optional signed Link4Sub HMAC callback/postback endpoint; enable it only after the provider supplies a secret/signature contract.
