# Data Model Plan

## Conventions

- UUID primary keys; guard-created records accept client UUIDs.
- UTC `timestamptz` storage and `Asia/Kolkata` society timezone.
- `Decimal(12,2)` money with three-character currency.
- E.164 phone normalization and digest-only OTP, token, PIN, visitor, and collection codes.
- `createdAt`, `updatedAt`, and optimistic `version` fields on mutable aggregates.
- Restrictive foreign keys; no cascading deletion of historical or financial records.
- Composite society foreign keys as defense against accidental cross-society joins.

## Entity Groups

| Module        | Entities                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Society       | Society, SocietySettings, Block, Floor, Flat, Gate                                                                                                           |
| Identity      | User, OtpChallenge, UserSession, RefreshToken, Device, PushEndpoint                                                                                          |
| Authorization | Role, Permission, UserRole, RolePermission                                                                                                                   |
| Residents     | FlatMembership, FlatMembershipHistory, FamilyMember                                                                                                          |
| Guards        | GuardProfile, GuardDevice, GuardDeviceGate, GuardGateAssignment                                                                                              |
| Visitors      | Visitor, VisitorPreApproval, PreApprovalUse, Visit, VisitApproval, VisitApprovalDecision, VisitEvent                                                         |
| Daily help    | DailyHelp, DailyHelpFlatAssignment, DailyHelpAccessWindow, DailyHelpAttendance, DailyHelpEvent                                                               |
| Parcels       | Parcel, ParcelEvent                                                                                                                                          |
| Notices       | Notice, NoticeAudience, NoticeRecipient, NoticeAttachment, NoticeRead, NoticeAcknowledgement                                                                 |
| Complaints    | ComplaintCategory, Complaint, ComplaintAttachment, ComplaintComment, ComplaintInternalNote, ComplaintStatusHistory, ComplaintAssignmentHistory               |
| Maintenance   | MaintenanceChargeBatch, MaintenanceCharge, MaintenanceChargeAdjustment, Payment, PaymentAllocation, PaymentReversal, Receipt, ReceiptEvent, DocumentSequence |
| Emergency     | EmergencyAlert, EmergencyEvent                                                                                                                               |
| Delivery      | NotificationPreference, Notification, NotificationDelivery, OutboxEvent, InboxMessage                                                                        |
| Platform      | FileUpload, AuditLog, IdempotencyRecord, OfflineSyncRecord, OfflineSyncAttempt                                                                               |

## Critical Constraints

- A constant singleton key permits exactly one society.
- Block, floor, flat, and gate codes are unique in their proper parent scope.
- Only one active membership exists for a user and flat.
- Only one active approval request exists per visit; only one terminal decision wins.
- Check-in and check-out events are unique and time ordered.
- Overrides require an actor, permission, recent authentication, and a non-empty reason.
- Helper attendance has at most one open shift.
- Notice read/acknowledgement rows are unique per recipient.
- Charge period, payment reference, allocation pair, receipt number, notification dedupe key, client
  mutation, and actor/operation idempotency key are unique.
- Partial indexes, check constraints, immutable triggers, and deferred finance checks live in
  reviewed SQL migrations where Prisma cannot express them.

## Append-Only Records

Visit events and decisions, membership history, complaint histories, helper events, parcel events,
emergency events, adjustments, reversals, receipt events, sync attempts, outbox deliveries, and
audit logs are append-only. Corrections use compensating events. Published notices and issued
receipts cannot be edited in place.

## Transaction Boundaries

OTP verification, refresh rotation, membership transitions, each visit transition, pre-approval
consumption, offline mutation claiming, notice publishing, complaint transitions, payment
allocation/receipt creation, payment reversal, and emergency transitions each commit their
projection, event, audit, and outbox work atomically. Provider calls occur only after commit.
