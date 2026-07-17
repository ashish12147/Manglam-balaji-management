# Screen Inventory

## Resident Application

| Area        | Screens                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| Access      | Phone login, OTP, PIN setup/unlock, flat association, pending/rejected/suspended       |
| Home        | Approval request, pre-approve shortcut, emergency, activity, notices, complaints, dues |
| Visitors    | Pre-approval form, invitation/code, live approval, history, visit detail               |
| Household   | Membership, family/dependents, daily help, attendance                                  |
| Parcels     | Held parcels, collection code, history                                                 |
| Notices     | Feed, filters, unread state, detail, attachment, acknowledgement                       |
| Complaints  | List, create, detail/timeline, comments, close/reopen                                  |
| Maintenance | Current dues, charge detail, payment history, receipt                                  |
| Emergency   | Type/confirmation, active status, response timeline                                    |
| Account     | Preferences, profile, sessions/devices, membership switch, logout                      |

## Guard Application

| Area            | Screens                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Access          | Login, device registration/validation, blocked device, gate selection        |
| Home            | Gate actions, pending approvals, emergencies, parcels, activity, sync status |
| Visitors        | Category, details, flat lookup, optional photo, approval countdown/result    |
| Gate operations | Code verification, active visits, check-in, check-out, reasoned override     |
| Daily help      | Search, minimal profile, allowed flats, check-in/out, recent attendance      |
| Parcels         | Hold, optional photo, collection verification, collect/return                |
| Emergency       | Active queue, detail, acknowledge, response update                           |
| Offline         | Connectivity, queue, record detail, conflict, failure, manual retry          |
| Account         | Gate/device context, session, logout                                         |

## Admin Dashboard

| Area           | Screens                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| Dashboard      | Gate activity, resident approvals, emergencies, complaints, dues, audit warnings |
| Society        | Blocks, floors, flats, gates, settings                                           |
| People         | Residents, memberships, family, approvals, occupancy end                         |
| Security       | Guards, supervisors, devices, revocation                                         |
| Access         | Visits, approvals, pre-approvals, overrides, event history                       |
| Operations     | Daily help, assignments, attendance, parcels                                     |
| Communication  | Notice editor, publish/target, acknowledgement report                            |
| Complaints     | Queue, assignment, status, comments, private notes                               |
| Maintenance    | Charge batches, dues, payments, allocations, receipts, reversals, reports        |
| Emergencies    | Active monitor, response timeline, resolution                                    |
| Administration | Users, roles, permissions, audit, exports, provider failures                     |
| Account        | Profile, sessions, logout                                                        |

## Universal State Contract

Every routed screen or actionable panel implements stable loading, contextual empty, plain-language
error with retry, permission denial, form validation, success feedback, and session-expiry behavior.
Offline and conflict states are mandatory wherever guard operations can continue without
connectivity. Mutation controls remain fixed-size and disabled while submitted to prevent duplicate
actions.
