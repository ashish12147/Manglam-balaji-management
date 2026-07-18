# Manglam Balaji Society Management System — Implementation Plan

You are the lead architect, product engineer, security engineer, UI/UX designer, QA engineer, and delivery manager for a production-ready society-management application.

Your task is to design and build a fully working MVP for:

# Manglam Balaji Society Management System

This application is exclusively for Manglam Balaji Society. It is not a nationwide platform, SaaS product, multi-society marketplace, or MyGate clone.

Use MyGate only as workflow inspiration. Do not copy its branding, interface, code, copyrighted assets, text, icons, layouts, or visual identity.

The final system must have a genuinely working frontend, backend, database, authentication, real-time updates, notifications, permissions, file uploads, audit logs, offline-tolerant guard workflows, tests, deployment configuration, and documentation.

Do not build a frontend prototype connected to mock data.

Do not mark features as complete unless they work end-to-end.

---

# 1. Operating instructions

Act as the primary manager and technical decision-maker.

Before coding:

1. Inspect the entire existing repository.
2. Read all files, configurations, package manifests, environment templates, documentation, database files, and existing implementations.
3. Identify what already works, what is incomplete, and what should be replaced.
4. Create a concise implementation plan.
5. Break the project into independently verifiable phases.
6. Maintain a task checklist and update it as work progresses.

Use specialised subagents when available.

Delegate independent tasks such as:

- Product and requirements analysis
- Database architecture
- Backend API implementation
- Resident application
- Guard application
- Admin dashboard
- Authentication and permissions
- Real-time visitor approvals
- Offline synchronisation
- Security review
- Automated testing
- UI/UX audit
- Deployment and infrastructure review

The primary agent must remain responsible for:

- Architecture
- Task assignment
- Reviewing subagent work
- Resolving conflicts
- Integrating changes
- Running tests
- Verifying complete workflows
- Making final decisions

Do not allow subagents to independently redesign the product scope.

Do not repeatedly rewrite already working parts of the system.

Do not switch the entire task to another agent or model. Use subagents only as workers for clearly bounded tasks while the primary agent remains the manager.

---

# 2. Core product principle

Build the smallest genuinely useful production system for Manglam Balaji Society.

Prioritise:

- Reliability
- Ease of use
- Security
- Fast gate operations
- Correct permissions
- Real database persistence
- Clear workflows
- Low maintenance
- Mobile usability
- Temporary network-failure handling
- Simple administration

Do not prioritise:

- Feature quantity
- Artificial intelligence features
- Marketplace features
- Advertising
- Social-media-style functionality
- Complex animation
- Decorative 3D effects
- Nationwide scalability
- Multi-society onboarding
- Subscription plans
- Unnecessary microservices

Every included feature must work properly.

---

# 3. Product interfaces

Build three interfaces.

## A. Resident application

A mobile-first application for:

- Owners
- Tenants
- Approved adult family members

The resident interface must support:

- Secure login
- Flat association
- Family-member management
- Daily-help management
- Visitor pre-approval
- Unexpected visitor approval or rejection
- Visitor entry and exit history
- Notices
- Complaints
- Basic maintenance dues
- Payment history
- Emergency alerts
- Notification preferences
- Profile and session management

## B. Guard application

A highly simplified mobile or tablet interface for society security guards.

It must support:

- Guard authentication
- Registered guard-device validation
- Gate selection
- Fast visitor registration
- Flat lookup
- Resident approval requests
- Approval, rejection and timeout status
- Visitor check-in
- Visitor check-out
- Pre-approved visitor code verification
- Daily-help check-in and check-out
- Parcel holding
- Parcel collection verification
- Emergency alerts
- Recent gate activity
- Temporary offline operation
- Synchronisation after reconnection

The guard interface must be:

- Fast
- Minimal
- Large-button based
- Easy to understand
- Suitable for low-end Android devices
- Usable with limited English proficiency
- Resistant to accidental duplicate submissions

## C. Admin dashboard

A responsive web dashboard for authorised society administrators.

It must support:

- Blocks, floors and flat management
- Resident registration and approval
- Owner and tenant assignment
- Family-member management
- Guard-account management
- Gate-device management
- Daily-help management
- Visitor and entry logs
- Notices
- Complaints
- Complaint assignment
- Maintenance dues
- Payment recording
- Receipt generation
- Emergency monitoring
- Reports and CSV exports
- Roles and permissions
- Audit-log review
- Society settings

---

# 4. Society scope

The application is for only:

Manglam Balaji Society

Do not build:

- Society discovery
- Multiple society selection
- Society subscription plans
- Multi-tenant billing
- Public society registration
- Nationwide society onboarding

The hierarchy should be:

Manglam Balaji Society  
→ Block or tower  
→ Floor  
→ Flat

Block, floor and flat data must come from the database and admin configuration. Do not hardcode all flats into frontend components.

The application may maintain one internal society record for clean relational design, but it must not expose multi-society functionality.

---

# 5. Required MVP modules

## Module 1: Authentication and account approval

Implement secure authentication for:

- Residents
- Guards
- Administrators
- Approved staff

Preferred resident login:

- Phone number
- OTP verification
- Optional secure app PIN after initial verification

For local development, implement a safe development OTP provider.

For production, use a configurable OTP provider abstraction.

Never hardcode a universal production OTP.

Requirements:

- Phone-number validation
- OTP expiration
- OTP attempt limits
- OTP request rate limits
- Session expiration
- Refresh-token rotation where applicable
- Secure logout
- Account deactivation
- Device/session visibility
- Admin approval for resident-flat association
- Secure guard-device registration
- Role-based access enforcement on the backend

A frontend route guard is not sufficient. Every protected backend action must independently verify permissions.

---

## Module 2: Resident and flat management

Support:

- Owner
- Tenant
- Adult family member
- Child or dependent household member
- Inactive or previous occupant

A user-to-flat association must be represented as a membership record rather than storing only a flat ID directly on the user.

A membership should include:

- User
- Flat
- Relationship
- Occupancy type
- Start date
- End date
- Approval status
- Approved by
- Approved at
- Active status

Required states:

- PENDING
- APPROVED
- REJECTED
- SUSPENDED
- ENDED

Residents must not access unrelated flats.

Previous tenants must lose access when their occupancy ends.

Owners and tenants must have appropriately separated permissions.

---

## Module 3: Visitor management

This is the most important module.

Support visitor categories:

- Guest
- Delivery
- Cab
- Service provider
- Other

### Resident pre-approved visitor flow

1. Resident selects visitor category.
2. Resident enters visitor name.
3. Resident optionally enters phone number and vehicle number.
4. Resident selects expected date and time.
5. Resident selects one-time or recurring access when supported.
6. System generates a secure visitor code.
7. Guard enters or scans the code.
8. Guard sees only the information required for verification.
9. Guard checks the visitor in.
10. Resident receives an entry notification.
11. Guard later checks the visitor out.
12. All events appear in history and audit logs.

### Unexpected visitor flow

1. Guard selects visitor category.
2. Guard captures required visitor details.
3. Guard selects destination block and flat.
4. System creates an approval request.
5. All authorised adult residents of the flat receive a notification.
6. One resident approves or rejects the request.
7. Guard receives the result in real time.
8. Guard completes entry or records denial.
9. Guard checks the visitor out when leaving.

Required visit states:

- DRAFT
- EXPECTED
- ARRIVED_AT_GATE
- AWAITING_APPROVAL
- APPROVED
- REJECTED
- APPROVAL_TIMED_OUT
- CHECKED_IN
- CHECKED_OUT
- CANCELLED
- EXPIRED

Requirements:

- Prevent duplicate check-ins
- Prevent duplicate approval actions
- Use idempotency for critical mutations
- Record timestamps
- Record acting user
- Record gate
- Record guard
- Record approval source
- Record rejection reason when supplied
- Record manual guard override
- Require an override reason
- Never silently overwrite state history
- Support visitor photo when permitted
- Support vehicle number
- Support visitor purpose
- Display approval countdown
- Support configurable approval timeout
- Notify resident after entry
- Notify resident after exit
- Flag unusually long visits
- Preserve an immutable event history

Use WebSockets or another reliable real-time mechanism for approval updates.

Also implement a polling fallback in case the real-time connection fails.

---

## Module 4: Daily help

Support:

- Maid
- Cook
- Driver
- Cleaner
- Nanny
- Delivery staff
- Regular service provider
- Other

Each daily-help profile may include:

- Name
- Phone
- Photo
- Type
- Identification reference
- Active status
- Assigned flats
- Allowed days
- Approximate allowed timings
- Notes
- Emergency contact when applicable

Requirements:

- One helper may serve multiple flats.
- Residents may only view helpers connected to their own flat.
- Guards may check helpers in and out.
- Residents may view recent attendance.
- Admin may activate, suspend or deactivate a helper.
- All status changes must be audited.

Do not build payroll or salary management in the MVP.

---

## Module 5: Parcels

Support a basic Leave at Gate workflow.

Required flow:

1. Delivery person arrives.
2. Guard selects destination flat.
3. Resident may allow delivery, reject it, or request Leave at Gate.
4. Guard records the parcel.
5. Guard may upload a parcel photograph.
6. System generates a collection code.
7. Resident receives notification.
8. Resident provides the collection code.
9. Guard marks the parcel collected.
10. Collection time and guard identity are recorded.

Required parcel states:

- EXPECTED
- ARRIVED
- HELD_AT_GATE
- COLLECTED
- RETURNED
- CANCELLED

---

## Module 6: Notices

Admins can create:

- General notices
- Urgent notices
- Maintenance notices
- Water notices
- Electricity notices
- Meeting announcements
- Other notices

Notice fields:

- Title
- Body
- Category
- Priority
- Publish time
- Expiry time
- Attachment
- Target audience
- Created by
- Published status

Residents can:

- View notices
- Filter notices
- See unread counts
- Open attachments
- Acknowledge important notices

Requirements:

- Draft and published states
- Push notification for published notices
- Special treatment for urgent notices
- Read tracking
- Acknowledgement tracking
- Attachment validation
- Admin visibility into acknowledgement status

---

## Module 7: Complaints

Residents can create complaints with:

- Category
- Subject
- Description
- Priority
- Photograph or attachment
- Flat information

Complaint categories should be configurable by the admin.

Example categories:

- Water
- Electricity
- Lift
- Cleaning
- Security
- Parking
- Plumbing
- Common area
- Other

Required states:

- OPEN
- ASSIGNED
- IN_PROGRESS
- RESOLVED
- CLOSED
- REOPENED
- CANCELLED

Requirements:

- Resident can submit complaint
- Admin can assign staff
- Assigned staff or admin can update status
- Resident receives status notifications
- Resident can comment
- Admin can add internal notes
- Internal notes must never be visible to residents
- Resident can reopen a recently resolved complaint
- Every status transition must be stored
- Attachments must use private storage
- The system must record resolution notes and timestamps

---

## Module 8: Maintenance dues

Build only basic maintenance tracking.

Support:

- Monthly charge creation
- Flat-wise due amount
- Due date
- Previous balance
- Late charge when manually configured
- Payment status
- Offline payment recording
- Online payment placeholder only if no real payment gateway is configured
- Receipt generation
- Payment history
- Pending-dues report
- Paid-dues report
- CSV export

Required payment states:

- UNPAID
- PARTIALLY_PAID
- PAID
- WAIVED
- CANCELLED

Payment methods:

- Cash
- UPI
- Bank transfer
- Cheque
- Other

Requirements:

- Never mark an online payment successful without verified gateway confirmation.
- Store payment references.
- Prevent duplicate payment recording.
- Generate unique receipt numbers.
- Allow authorised admin correction through reversal records rather than destructive deletion.
- Audit every dues and payment modification.

Do not build:

- Full accounting ERP
- General ledger
- GST filing
- TDS filing
- Balance sheet
- Vendor accounting
- Automated reconciliation
- Complex interest formulas

---

## Module 9: Emergency alerts

Residents can create alerts for:

- Medical emergency
- Fire
- Security threat
- Lift emergency
- Other emergency

The alert must contain:

- Flat
- Resident
- Alert category
- Timestamp
- Status
- Acknowledging guard
- Acknowledging admin
- Resolution information

Required states:

- ACTIVE
- ACKNOWLEDGED
- RESPONDING
- RESOLVED
- FALSE_ALARM

Requirements:

- Active alerts appear prominently in the guard app.
- Active alerts appear prominently in the admin dashboard.
- Guards can acknowledge alerts.
- Admins can monitor the response.
- Residents receive acknowledgement confirmation.
- Every action must be timestamped.
- Emergency alerts must not be mixed with optional notifications.

---

## Module 10: Notifications

Implement:

- Push notifications
- In-app notifications
- Real-time updates
- Notification history
- Read and unread states

Notification categories:

- SECURITY_CRITICAL
- VISITOR_APPROVAL
- VISITOR_ACTIVITY
- EMERGENCY
- NOTICE
- COMPLAINT
- PAYMENT
- GENERAL

Users may configure non-critical notification preferences.

Critical security and emergency notifications must remain enabled where legally and technically appropriate.

Use a provider abstraction so notification services can be changed later.

Handle:

- Expired device tokens
- Failed delivery
- Retry rules
- Duplicate notification prevention
- Notification deep links
- Notification permission denial
- In-app fallback

---

## Module 11: Roles and permissions

Do not use only an `isAdmin` flag.

Implement role-based access control with action-level permissions.

Suggested roles:

- RESIDENT_OWNER
- RESIDENT_TENANT
- RESIDENT_FAMILY
- GUARD
- SECURITY_SUPERVISOR
- COMPLAINT_STAFF
- ACCOUNTANT
- SOCIETY_ADMIN
- SUPER_ADMIN

Suggested permission patterns:

- resident.read_self
- resident.manage_family
- resident.approve_visitor
- visitor.create
- visitor.read_flat
- visitor.read_all
- visitor.check_in
- visitor.check_out
- visitor.override
- notice.create
- notice.publish
- complaint.create
- complaint.assign
- complaint.resolve
- dues.read_self
- dues.manage
- payment.record
- receipt.generate
- emergency.acknowledge
- guard.manage
- role.manage
- audit.read
- report.export

Enforce permissions on every protected backend endpoint and real-time channel.

---

## Module 12: Audit logs

Create immutable audit logs for security-sensitive actions.

Audit:

- Login attempts
- OTP requests
- Resident approvals
- Role changes
- Guard-device registration
- Visitor approval
- Visitor rejection
- Manual overrides
- Check-in
- Check-out
- Daily-help status changes
- Notice publishing
- Complaint status changes
- Dues modifications
- Payment recording
- Receipt reversal
- Emergency acknowledgement
- Data exports
- Account suspension

An audit record should contain:

- Actor
- Action
- Entity type
- Entity ID
- Previous values where appropriate
- New values where appropriate
- Timestamp
- Device or session information
- IP address where available
- Reason
- Correlation ID

Normal users must not edit or delete audit records.

---

# 6. Offline guard workflow

The guard application must remain partially usable during temporary internet loss.

Use local persistent storage such as SQLite or an equivalent reliable local database.

Support offline:

- Preparing visitor records
- Recording manual entries under an explicit offline state
- Recording check-outs
- Viewing recently synchronised flat directory data
- Viewing pre-downloaded daily-help profiles
- Recording emergency acknowledgement locally

Do not claim resident approval occurred while offline unless it was previously synchronised.

Offline-created records must clearly show:

- Offline status
- Local creation time
- Device ID
- Sync status
- Conflict status

Required sync states:

- LOCAL_PENDING
- SYNCING
- SYNCED
- CONFLICT
- FAILED

Requirements:

- Use client-generated UUIDs.
- Use idempotent server mutations.
- Retry safely.
- Do not create duplicate visit records.
- Resolve conflicts explicitly.
- Preserve both local and server event timestamps.
- Show guards when data has not synchronised.
- Provide a manual retry button.
- Automatically retry when connectivity returns.

Do not attempt a complex fully offline resident-approval system.

---

# 7. Recommended architecture

Use a monorepo.

Suggested structure:

```text
manglam-balaji/
├── apps/
│   ├── resident-app/
│   ├── guard-app/
│   ├── admin-web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── ui/
│   ├── types/
│   ├── validation/
│   ├── api-client/
│   ├── permissions/
│   ├── config/
│   └── testing/
├── database/
├── infrastructure/
├── documentation/
└── scripts/
```

Preferred stack unless the existing repository already has a strong alternative:

## Resident and guard applications

- React Native
- Expo
- TypeScript
- Expo Router
- TanStack Query
- Zustand only for necessary client state
- React Hook Form
- Zod
- SecureStore
- SQLite for guard offline data
- Firebase Cloud Messaging or compatible push provider

## Admin dashboard

- Next.js
- TypeScript
- App Router
- TanStack Query
- React Hook Form
- Zod
- Accessible reusable components
- Responsive design

## Backend

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- Background job queue
- WebSockets
- REST API
- OpenAPI documentation
- Private object storage

Use a modular monolith rather than unnecessary microservices.

Suggested backend modules:

- Auth
- Users
- Residents
- Flats
- Guards
- Devices
- Visitors
- DailyHelp
- Parcels
- Notices
- Complaints
- Maintenance
- Payments
- Emergencies
- Notifications
- Files
- Audit
- Reports

If the repository already uses another mature stack, evaluate whether migration is justified before replacing it.

---

# 8. Database requirements

Design a clean relational schema.

At minimum include:

- Society
- Block
- Floor
- Flat
- User
- UserSession
- Device
- Role
- Permission
- UserRole
- RolePermission
- FlatMembership
- FamilyMember
- GuardProfile
- Gate
- GuardDevice
- Visitor
- Visit
- VisitApproval
- VisitEvent
- VisitorPreApproval
- DailyHelp
- DailyHelpFlatAssignment
- DailyHelpAttendance
- Parcel
- Notice
- NoticeRead
- NoticeAcknowledgement
- Complaint
- ComplaintComment
- ComplaintInternalNote
- ComplaintStatusHistory
- MaintenanceCharge
- Payment
- PaymentAllocation
- Receipt
- EmergencyAlert
- EmergencyEvent
- Notification
- FileUpload
- AuditLog
- OfflineSyncRecord

Use:

- UUID primary keys
- Foreign keys
- Unique constraints
- Database indexes
- Transactions
- Soft deletion only where required
- Immutable event records for critical workflows
- Created and updated timestamps
- Optimistic concurrency or version fields where useful

Add indexes for:

- Phone number
- Flat lookup
- Visitor code
- Visit status
- Visit date
- Gate
- Complaint status
- Maintenance due date
- Payment reference
- Notification recipient
- Audit timestamp

Create migrations and seed scripts.

Seed only useful development data.

Do not rely on seeded accounts in production.

---

# 9. API requirements

Create properly versioned APIs.

Suggested prefix:

`/api/v1`

Requirements:

- Input validation
- Typed response models
- Consistent errors
- Pagination
- Filtering
- Sorting
- Search
- Permission enforcement
- Idempotency support
- Rate limiting
- Correlation IDs
- Transaction safety
- OpenAPI documentation

Use a consistent error structure:

```json
{
  "error": {
    "code": "VISIT_ALREADY_CHECKED_IN",
    "message": "This visitor has already been checked in.",
    "details": {},
    "correlationId": "..."
  }
}
```

Never expose stack traces, database internals, secret values, or private object-storage URLs.

---

# 10. UI and design requirements

Create an original identity for Manglam Balaji Society.

The visual style should be:

- Clean
- Trustworthy
- Calm
- Modern
- Practical
- Mobile-first
- Accessible
- Fast-loading

Avoid:

- MyGate visual copying
- Neon colours
- Cyberpunk styling
- Excessive gradients
- Decorative 3D scenes
- Over-animation
- Glassmorphism everywhere
- Tiny text
- Low contrast
- Crowded dashboards
- Generic AI-generated visual clutter

Resident home screen should prioritise:

1. Visitor approval
2. Pre-approve visitor
3. Recent activity
4. Notices
5. Complaints
6. Maintenance dues
7. Emergency action

Guard home screen should prioritise:

1. Register visitor
2. Verify visitor code
3. Pending approvals
4. Check-out visitor
5. Daily-help attendance
6. Held parcels
7. Emergency alerts
8. Sync status

Admin dashboard should prioritise:

1. Active gate activity
2. Pending resident approvals
3. Active emergencies
4. Open complaints
5. Recent visitor activity
6. Unpaid maintenance dues
7. Notice publishing
8. Audit alerts

Every screen must implement:

- Loading state
- Empty state
- Error state
- Permission-denied state
- Offline state when relevant
- Retry action
- Form validation
- Success feedback
- Accessible labels
- Keyboard handling
- Responsive layout

Do not leave lorem ipsum, placeholder buttons, fake charts, dead navigation, or non-functional cards.

---

# 11. Security requirements

Perform a serious security implementation.

Required controls:

- Secure password or PIN hashing
- OTP rate limiting
- Session invalidation
- Refresh-token rotation
- Device registration
- Backend RBAC
- Input validation
- Output encoding
- SQL injection prevention
- Secure file validation
- File size limits
- File type allowlists
- Private storage
- Signed temporary file URLs
- CSRF protection where applicable
- CORS configuration
- Security headers
- Brute-force protection
- Audit logging
- Secret management
- Environment separation
- Database backup plan
- Sensitive-field masking
- Resident phone-number masking for guards
- No cross-flat data access
- No insecure direct object references
- No client-trusted roles
- No hardcoded production credentials
- No secrets committed to Git

Guard devices must receive only the minimum resident information necessary for gate operations.

Photographs and identity-related documents must not be publicly accessible.

Create a threat model covering:

- Account takeover
- OTP abuse
- Resident impersonation
- Guard-device theft
- Cross-flat data leakage
- Visitor-code guessing
- Duplicate approval requests
- Malicious file uploads
- Payment-record manipulation
- Privilege escalation
- Audit-log tampering
- Offline-sync conflicts
- Notification spoofing

---

# 12. Testing requirements

Testing is mandatory.

Implement:

## Unit tests

Cover:

- Permission checks
- Visitor state transitions
- OTP rules
- Visitor-code generation
- Payment calculations
- Receipt numbering
- Complaint state transitions
- Notification preference rules
- Offline-sync conflict logic

## Integration tests

Cover:

- Authentication
- Resident approval
- Visitor creation
- Visitor approval
- Check-in
- Check-out
- Complaint creation
- Complaint assignment
- Notice publishing
- Maintenance charge creation
- Payment recording
- Emergency acknowledgement
- Role restrictions

## End-to-end tests

Cover complete workflows:

### Workflow 1: Resident onboarding

Admin creates or approves resident  
→ Resident logs in  
→ Resident receives flat access  
→ Unrelated flats remain inaccessible

### Workflow 2: Pre-approved visitor

Resident creates invitation  
→ Guard verifies code  
→ Guard checks visitor in  
→ Resident receives notification  
→ Guard checks visitor out  
→ History appears correctly

### Workflow 3: Unexpected visitor

Guard creates visit request  
→ Resident receives request  
→ Resident approves  
→ Guard receives live status  
→ Guard checks visitor in  
→ Audit history is correct

### Workflow 4: Visitor rejection

Guard requests approval  
→ Resident rejects  
→ Entry is denied  
→ Rejection is recorded  
→ Guard cannot check in without an authorised override

### Workflow 5: Offline guard entry

Guard loses internet  
→ Guard records permitted offline action  
→ Local record persists after app restart  
→ Internet returns  
→ Record synchronises once  
→ No duplicate record is created

### Workflow 6: Complaint

Resident raises complaint with image  
→ Admin assigns complaint  
→ Status changes  
→ Resident receives updates  
→ Resident closes or reopens complaint

### Workflow 7: Notice

Admin publishes urgent notice  
→ Residents receive notification  
→ Resident reads and acknowledges  
→ Admin sees acknowledgement

### Workflow 8: Maintenance payment

Admin creates charge  
→ Resident sees due  
→ Admin records payment  
→ Receipt is generated  
→ Resident sees paid status  
→ Duplicate payment is prevented

### Workflow 9: Emergency

Resident raises emergency  
→ Guard receives prominent alert  
→ Guard acknowledges  
→ Admin monitors  
→ Resident receives acknowledgement  
→ Event history remains available

Also test:

- Expired OTP
- Incorrect OTP
- Rate limiting
- Missing permissions
- Invalid state transitions
- Duplicate API calls
- File upload rejection
- Network timeout
- WebSocket failure
- Push-notification failure
- Database transaction rollback

Do not reduce test coverage merely to make the test suite pass.

Fix the implementation.

---

# 13. Observability and reliability

Implement:

- Structured logs
- Correlation IDs
- Request logging without sensitive data
- Error tracking integration point
- Health endpoints
- Readiness endpoint
- Database health check
- Redis health check
- Queue health check
- Notification failure logging
- Offline-sync diagnostics
- Background-job retries
- Dead-letter handling where applicable

Create:

- Backup procedure
- Restore procedure
- Deployment checklist
- Rollback procedure
- Incident-response notes

---

# 14. Deployment

Provide production-ready configuration.

Include:

- Development environment
- Staging environment
- Production environment
- `.env.example`
- Docker configuration where useful
- Database migrations
- Seed scripts
- Build scripts
- CI workflow
- Linting
- Type checking
- Automated tests
- Deployment documentation
- Health checks
- Secure secret handling

Do not commit production secrets.

Do not use development OTP bypasses in production.

Do not deploy fake payment success endpoints.

If external credentials are unavailable, create a proper provider interface and development implementation, clearly documenting the exact production configuration required.

---

# 15. Explicitly excluded features

Do not build these in the MVP:

- Multi-society support
- Nationwide onboarding
- Society marketplace
- Advertisements
- Property listings
- Home-service marketplace
- Social feed
- Resident-to-resident chat
- Polls and elections
- Amenity booking
- Full accounting ERP
- GST and TDS filing
- Vendor procurement
- Inventory management
- Payroll
- Facial recognition
- Number-plate recognition
- RFID
- Boom-barrier integration
- Smart locks
- Subscription billing
- Premium plans
- AI chatbot
- Recommendation engine
- Complex analytics
- Decorative 3D interfaces

Do not add excluded features simply because they are present in MyGate.

---

# 16. Required implementation phases

Follow these phases.

## Phase 1: Repository and requirements audit

Deliver:

- Existing-state assessment
- Architecture decision
- MVP scope confirmation
- Risk list
- Implementation plan
- Screen inventory
- Data-model plan

Do not begin broad implementation until this is complete.

## Phase 2: Foundation

Implement:

- Monorepo structure
- Shared configuration
- Database
- Migrations
- Authentication
- Roles and permissions
- Audit logging
- File storage abstraction
- Notification abstraction
- API error conventions
- CI checks

## Phase 3: Society, flats and users

Implement:

- Block management
- Floor management
- Flat management
- Resident onboarding
- Flat membership
- Guard accounts
- Device registration
- Admin user management

## Phase 4: Visitor system

Implement:

- Pre-approvals
- Unexpected visitors
- Real-time approvals
- Check-in
- Check-out
- Visit history
- Guard overrides
- Visitor events
- Notifications

Complete and test this phase before adding secondary modules.

## Phase 5: Offline guard support

Implement:

- Local database
- Offline queue
- Sync service
- Idempotency
- Conflict handling
- Connectivity indicators
- Retry system

## Phase 6: Daily help and parcels

Implement and test both modules end-to-end.

## Phase 7: Notices and complaints

Implement and test both modules end-to-end.

## Phase 8: Maintenance dues

Implement basic charges, payment recording, receipts and reports.

## Phase 9: Emergencies

Implement alerting, acknowledgement, response status and event history.

## Phase 10: Security and quality hardening

Perform:

- Permission audit
- Data-isolation audit
- Threat-model review
- File-upload review
- Session review
- Rate-limit review
- Offline-sync review
- Accessibility review
- Performance review
- Full test run

## Phase 11: Deployment readiness

Complete:

- Staging build
- Production build
- Migration test
- Backup test
- Restore test
- Deployment documentation
- Admin guide
- Guard guide
- Resident guide
- Known limitations

---

# 17. Definition of done

A feature is complete only when:

- Frontend interface works
- Backend API works
- Database persistence works
- Validation works
- Permissions work
- Loading state exists
- Empty state exists
- Error state exists
- Audit logs exist where required
- Notifications work where required
- Tests exist
- Tests pass
- No mock data is required
- No placeholder remains
- No button is dead
- The workflow survives refresh or app restart
- Relevant mobile layouts work
- Documentation is updated

The full MVP is complete only after all critical workflows pass end-to-end.

---

# 18. Final verification checklist

Before claiming completion, run and report:

- Installation
- Development startup
- Production build
- Database migration
- Database seed
- Lint
- Type checking
- Unit tests
- Integration tests
- End-to-end tests
- Security review
- Permission review
- Mobile build validation
- Admin-web build validation
- API build validation
- Offline-sync validation

Provide a final report containing:

1. What was implemented
2. What was tested
3. Exact commands executed
4. Test results
5. Architecture summary
6. Database summary
7. API summary
8. Security controls
9. Deployment instructions
10. Environment variables
11. Remaining limitations
12. Recommended post-MVP improvements

Never claim a command succeeded unless you actually ran it.

Never claim a feature works unless you verified it.

---

# 19. Start now

Begin by inspecting the repository.

Then produce:

1. Repository audit
2. Proposed architecture
3. Final MVP module list
4. Screen inventory
5. Database entity plan
6. API module plan
7. Security risks
8. Phased task checklist

After the plan, begin implementation without repeatedly asking for confirmation.

Make reasonable technical decisions independently.

Ask a question only when missing information makes safe implementation impossible. Otherwise, proceed with the most practical production-quality choice.
