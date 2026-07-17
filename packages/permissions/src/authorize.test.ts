import { describe, expect, it } from 'vitest';

import {
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  ROLE_POLICIES,
  authorize,
  canAssignRole,
  effectiveActions,
  type AuthorizationActor,
} from './index.js';

const societyId = 'society-a';
const otherSocietyId = 'society-b';
const flatA = 'flat-a';
const flatB = 'flat-b';
const gateA = 'gate-a';
const gateB = 'gate-b';
const complaintA = 'complaint-a';
const complaintB = 'complaint-b';

const actor = (overrides: Partial<AuthorizationActor> = {}): AuthorizationActor => ({
  userId: 'user-a',
  societyId,
  active: true,
  roles: ['RESIDENT_OWNER'],
  activeFlatIds: [flatA],
  assignedGateIds: [],
  assignedComplaintIds: [],
  ...overrides,
});

describe('permission catalog', () => {
  it('contains no wildcard and no duplicate action', () => {
    expect(PERMISSION_ACTIONS.some((action) => action.includes('*'))).toBe(false);
    expect(new Set(PERMISSION_ACTIONS).size).toBe(PERMISSION_ACTIONS.length);
    expect(PERMISSION_CATALOG.length).toBeGreaterThan(70);
  });

  it('references only catalogued actions and allowed scopes in every role default', () => {
    const knownActions = new Set(PERMISSION_ACTIONS);
    const definitions = new Map(PERMISSION_CATALOG.map((entry) => [entry.action, entry.scopes]));

    for (const policy of Object.values(ROLE_POLICIES)) {
      for (const [action, scopes] of Object.entries(policy)) {
        expect(knownActions.has(action as (typeof PERMISSION_ACTIONS)[number]), action).toBe(true);
        for (const scope of scopes ?? []) {
          expect(definitions.get(action as (typeof PERMISSION_ACTIONS)[number])).toContain(scope);
        }
      }
    }
  });
});

describe('scoped authorization', () => {
  it('allows a resident only for an active flat', () => {
    const resident = actor();
    expect(
      authorize({
        actor: resident,
        action: 'visitor.read_flat',
        resource: { societyId, flatId: flatA },
      }).allowed,
    ).toBe(true);
    expect(
      authorize({
        actor: resident,
        action: 'visitor.read_flat',
        resource: { societyId, flatId: flatB },
      }),
    ).toMatchObject({ allowed: false, reason: 'SCOPE_MISMATCH' });
  });

  it('denies every role across society boundaries', () => {
    const admin = actor({ roles: ['SUPER_ADMIN'] });
    expect(
      authorize({
        actor: admin,
        action: 'resident.read_all',
        resource: { societyId: otherSocietyId },
      }),
    ).toMatchObject({ allowed: false, reason: 'SOCIETY_MISMATCH' });
  });

  it('limits guards to assigned gates and never grants resident approval', () => {
    const guard = actor({ roles: ['GUARD'], activeFlatIds: [], assignedGateIds: [gateA] });
    expect(
      authorize({
        actor: guard,
        action: 'visitor.check_in',
        resource: { societyId, gateId: gateA },
      }).allowed,
    ).toBe(true);
    expect(
      authorize({
        actor: guard,
        action: 'visitor.check_in',
        resource: { societyId, gateId: gateB },
      }),
    ).toMatchObject({ allowed: false, reason: 'SCOPE_MISMATCH' });
    expect(
      authorize({
        actor: guard,
        action: 'visitor.approve',
        resource: { societyId, flatId: flatA },
      }),
    ).toMatchObject({ allowed: false, reason: 'ACTION_NOT_GRANTED' });
  });

  it('limits complaint staff to assignments', () => {
    const staff = actor({
      roles: ['COMPLAINT_STAFF'],
      activeFlatIds: [],
      assignedComplaintIds: [complaintA],
    });
    expect(
      authorize({
        actor: staff,
        action: 'complaint.internal_note',
        resource: { societyId, complaintId: complaintA },
      }).allowed,
    ).toBe(true);
    expect(
      authorize({
        actor: staff,
        action: 'complaint.internal_note',
        resource: { societyId, complaintId: complaintB },
      }),
    ).toMatchObject({ allowed: false, reason: 'SCOPE_MISMATCH' });
  });

  it('requires explicit targeting for resident notice access', () => {
    const resident = actor();
    expect(
      authorize({
        actor: resident,
        action: 'notice.read',
        resource: { societyId, targetFlatIds: [flatA] },
      }).allowed,
    ).toBe(true);
    expect(
      authorize({
        actor: resident,
        action: 'notice.read',
        resource: { societyId, targetFlatIds: [flatB] },
      }).allowed,
    ).toBe(false);
  });

  it('requires reason and recent authentication for a supervisor override', () => {
    const supervisor = actor({
      roles: ['SECURITY_SUPERVISOR'],
      activeFlatIds: [],
      assignedGateIds: [gateA],
    });
    const base = {
      actor: supervisor,
      action: 'visitor.override' as const,
      resource: { societyId, gateId: gateA },
    };

    expect(authorize(base)).toMatchObject({
      allowed: false,
      reason: 'RECENT_AUTHENTICATION_REQUIRED',
    });
    expect(authorize({ ...base, recentlyAuthenticated: true })).toMatchObject({
      allowed: false,
      reason: 'REASON_REQUIRED',
    });
    expect(
      authorize({ ...base, recentlyAuthenticated: true, reason: 'Resident is unreachable' })
        .allowed,
    ).toBe(true);
  });

  it('lets explicit denies override all role and direct grants', () => {
    const admin = actor({ roles: ['SUPER_ADMIN'], deniedActions: ['report.export'] });
    expect(
      authorize({ actor: admin, action: 'report.export', resource: { societyId } }),
    ).toMatchObject({ allowed: false, reason: 'ACTION_NOT_GRANTED' });
    expect(effectiveActions(admin)).not.toContain('report.export');
  });

  it('rejects inactive identities before evaluating permissions', () => {
    expect(
      authorize({
        actor: actor({ active: false }),
        action: 'account.read_self',
        resource: { societyId, ownerUserId: 'user-a' },
      }),
    ).toMatchObject({ allowed: false, reason: 'ACTOR_INACTIVE' });
  });

  it('allows custom direct grants only within the catalogued scope', () => {
    const custom = actor({
      roles: [],
      directGrants: [{ action: 'visitor.read_gate', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }],
      assignedGateIds: [gateA],
    });

    expect(
      authorize({
        actor: custom,
        action: 'visitor.read_gate',
        resource: { societyId, gateId: gateA },
      }).allowed,
    ).toBe(true);
    expect(
      authorize({ actor: custom, action: 'visitor.read_gate', resource: { societyId } }).allowed,
    ).toBe(false);
  });
});

describe('role assignment boundaries', () => {
  it('prevents society admins from assigning privileged admin roles', () => {
    const admin = actor({ roles: ['SOCIETY_ADMIN'] });
    expect(canAssignRole(admin, 'GUARD', 'New gate officer', true).allowed).toBe(true);
    expect(canAssignRole(admin, 'SOCIETY_ADMIN', 'Peer administrator', true).allowed).toBe(false);
    expect(canAssignRole(admin, 'SUPER_ADMIN', 'Escalate privileges', true).allowed).toBe(false);
  });

  it('allows a recently authenticated super admin to control privileged roles', () => {
    const superAdmin = actor({ roles: ['SUPER_ADMIN'] });
    expect(
      canAssignRole(superAdmin, 'SUPER_ADMIN', 'Approved privileged operator', true).allowed,
    ).toBe(true);
  });
});
