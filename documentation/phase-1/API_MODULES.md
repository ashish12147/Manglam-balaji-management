# API Module Plan

## Contract

All public REST routes use `/api/v1`. Requests are validated with Zod-compatible DTOs,
protected by authentication plus action and resource scope, and return typed envelopes.
List endpoints use cursor pagination, filtering, sorting, and bounded search. Critical
mutations require `Idempotency-Key`. Every response carries a correlation ID.

```json
{
  "error": {
    "code": "VISIT_ALREADY_CHECKED_IN",
    "message": "This visitor has already been checked in.",
    "details": {},
    "correlationId": "019f..."
  }
}
```

## Modules

| Module | Principal routes and channels |
| --- | --- |
| Auth | OTP request/verify, PIN/password login, refresh rotation, logout, sessions, MFA |
| Users | Self profile, notification settings, admin user activation/suspension |
| Society | Settings, blocks, floors, flats, gates, scoped directory lookup |
| Memberships | Request, approve/reject/suspend/end, family/dependent management |
| Guards | Guard accounts, assignments, device enrollment/revoke, gate selection |
| Visitors | Pre-approvals, walk-in request, approve/reject/timeout/override, check-in/out, history |
| Realtime | Authenticated flat, gate, user, and emergency rooms; approval/status events |
| Offline sync | Directory snapshot, mutation batch, conflict list, retry status |
| Daily help | Profiles, flat assignments, access windows, attendance, history |
| Parcels | Arrival, decision, hold, code verification, collect, return |
| Notices | Draft, publish, target, list, read, acknowledge, attachment access |
| Complaints | Create, assign, transition, comments, private notes, attachments, history |
| Maintenance | Charge batches, charges, payments, allocations, receipts, reversals, CSV reports |
| Emergencies | Create, list active, acknowledge, respond, resolve, event history |
| Notifications | Inbox, read/unread, preferences, push endpoints, delivery diagnostics |
| Files | Upload intent, completion, scan status, authorized short-lived download |
| Roles | Roles, action permissions, assignments, effective-permission inspection |
| Audit | Authorized filtered review and export; no update or delete routes |
| Reports | Permission-scoped CSV exports with formula neutralization and audit events |
| Health | Live, ready, and authenticated dependency diagnostics |

## Authorization Rules

The server derives society scope from configuration, never from a trusted client field.
Resident queries require an approved, date-effective membership. Guard mutations require
an active guard profile, session, registered device, and gate assignment. File access
inherits its parent entity policy. The same policies apply to REST, WebSocket rooms,
workers, search, signed URLs, and exports.
