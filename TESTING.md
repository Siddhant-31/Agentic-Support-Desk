Support Desk App — Auth E2E Test PRD (MVP)
Purpose

Demonstrate end-to-end authentication testing using TestSprite:

API health check

Auth gating via httpOnly cookie

Dev-only E2E login

Authenticated user session validation

App URLs (Local)

Backend: http://localhost:5000

Auth Setup (Dev-only)

POST /auth/e2e/login

{
"id": "e2e_user_1",
"email": "e2e@test.local",
"name": "E2E User"
}

Expected:

200 { "ok": true }

httpOnly session cookie set

Test Scope

In scope

Backend auth APIs

Cookie-based sessions

Protected route enforcement

Out of scope

Frontend UI

Agent logic

LLM calls

Target Test Flows
Flow 1 — Public API

GET /status → 200 { ok: true }

Flow 2 — Auth gate (unauthenticated)

GET /auth/me → 401

POST /api/support/run → 401

Flow 3 — Login + session

POST /auth/e2e/login → 200, cookie set

GET /auth/me → 200

{
"user": {
"id": "e2e_user_1",
"email": "e2e@test.local",
"name": "E2E User"
}
}
