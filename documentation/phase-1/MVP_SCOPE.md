# MVP Scope

## Product Boundary

The product serves Manglam Balaji Society only. It may retain one internal `Society`
record for relational integrity, but it exposes no society discovery, registration,
subscription, billing, or multi-society switching.

## Included Modules

1. Authentication, sessions, account approval, and device trust.
2. Blocks, floors, flats, memberships, residents, guards, and role assignments.
3. Visitor pre-approval, unexpected approval, real-time status, entry, exit, overrides,
   notifications, and immutable history.
4. Guard offline directory, mutation queue, retry, conflict, and synchronization.
5. Daily-help profiles, assignments, access windows, and attendance.
6. Leave-at-gate parcels and one-time collection verification.
7. Notices, targeting, reads, acknowledgements, and private attachments.
8. Complaints, assignment, comments, private notes, history, and attachments.
9. Basic maintenance charges, offline payment records, allocations, receipts, reversals,
   and CSV reports.
10. Emergency creation, acknowledgement, response, resolution, and event history.
11. In-app and provider-based notifications, preferences, retries, and deep links.
12. Action-level RBAC, immutable audit logs, health checks, observability, CI, and
    deployment documentation.

## Explicit Non-Goals

Multi-society SaaS, marketplace, advertising, social feed, chat, polls, amenities,
property listings, full accounting ERP, payroll, inventory, facial recognition, number
plate recognition, RFID, barrier hardware, smart locks, subscription plans, AI features,
and fake online payment success are excluded.

## Product Defaults

- The first valid adult resident decision wins an approval race.
- Visitor recurrence is excluded from the first release; the schema can add it later.
- Manual visitor override belongs to a security supervisor or an explicitly permitted
  guard and always requires a reason.
- Online payment controls remain disabled until a verified gateway is configured.
- Guard labels use short English and Hindi where it improves comprehension.
- Resident and guard push delivery always has an in-app and polling fallback.
- Guard offline snapshots show their last synchronization time and expire after 24 hours.
- Aadhaar and PAN documents are not collected in the MVP.

## Retention Defaults Requiring Society Approval

| Data | Proposed default |
| --- | --- |
| Guard offline cache | 24 hours |
| Visitor and parcel photos | 30 days |
| Notification history | 90 days |
| Visit records | 180 days |
| Security and audit records | 1 year |
| Finance records | Society-approved statutory policy |
