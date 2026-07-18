import type { HttpMethod, QueryValue } from './api-client';

export type FieldType =
  | 'checkbox'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'lookup'
  | 'lookup-multi'
  | 'number'
  | 'select'
  | 'tel'
  | 'text'
  | 'textarea';

export interface SelectOption {
  label: string;
  value: string;
}

export interface LookupConfig {
  endpoint: string;
  labelKeys: string[];
  query?: Record<string, QueryValue> | undefined;
  valueKey?: string | undefined;
}

export interface FormFieldConfig {
  defaultValue?: boolean | number | string | undefined;
  description?: string | undefined;
  fullWidth?: boolean | undefined;
  key: string;
  label: string;
  lookup?: LookupConfig | undefined;
  max?: number | undefined;
  maxLength?: number | undefined;
  min?: number | undefined;
  options?: SelectOption[] | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  type: FieldType;
}

export type ColumnFormat = 'boolean' | 'currency' | 'date' | 'datetime' | 'status' | 'text';

export interface ColumnConfig {
  format?: ColumnFormat | undefined;
  key: string;
  label: string;
}

export interface CreateConfig {
  description: string;
  endpoint?: string | undefined;
  fields: FormFieldConfig[];
  label: string;
  permission: string;
  successMessage: string;
  title: string;
}

export interface ResourceActionConfig {
  description: string;
  downloadFileName?: string | undefined;
  fields?: FormFieldConfig[] | undefined;
  key: string;
  label: string;
  method?: HttpMethod | undefined;
  permission: string;
  suffix: string;
  successMessage: string;
  tone?: 'default' | 'danger' | undefined;
}

export interface ResourceConfig {
  actions?: ResourceActionConfig[] | undefined;
  baseQuery?: Record<string, QueryValue> | undefined;
  columns: ColumnConfig[];
  create?: CreateConfig | undefined;
  createHref?: string | undefined;
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  endpoint: string;
  eyebrow: string;
  key: string;
  path: string;
  permission: string;
  searchPlaceholder?: string | undefined;
  statusOptions?: SelectOption[] | undefined;
  title: string;
}

const statusOptions = (...values: string[]): SelectOption[] =>
  values.map((value) => ({
    value,
    label: value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase()),
  }));

const lookup = (
  endpoint: string,
  labelKeys: string[],
  query?: Record<string, QueryValue>,
): LookupConfig => ({
  endpoint,
  labelKeys,
  ...(query ? { query } : {}),
});

const nameColumn: ColumnConfig = { key: 'name', label: 'Name' };
const statusColumn: ColumnConfig = { key: 'status', label: 'Status', format: 'status' };
const createdColumn: ColumnConfig = { key: 'createdAt', label: 'Created', format: 'datetime' };
const updatedColumn: ColumnConfig = { key: 'updatedAt', label: 'Updated', format: 'datetime' };
const reasonField: FormFieldConfig = {
  key: 'reason',
  label: 'Reason',
  type: 'textarea',
  required: true,
  fullWidth: true,
  maxLength: 500,
};

const deactivateAction: ResourceActionConfig = {
  key: 'deactivate',
  label: 'Deactivate',
  description: 'Deactivate this record while preserving its history.',
  permission: 'society.manage',
  method: 'POST',
  suffix: '/deactivate',
  fields: [reasonField],
  successMessage: 'The record was deactivated.',
  tone: 'danger',
};

const blocks: ResourceConfig = {
  key: 'blocks',
  path: 'society/blocks',
  eyebrow: 'Society structure',
  title: 'Blocks and towers',
  description: "Manage the society's block directory used by every flat and gate workflow.",
  endpoint: '/society/blocks',
  permission: 'society.read',
  searchPlaceholder: 'Search code or name',
  columns: [{ key: 'code', label: 'Code' }, nameColumn, statusColumn, updatedColumn],
  statusOptions: statusOptions('ACTIVE', 'INACTIVE'),
  emptyTitle: 'No blocks configured',
  emptyDescription: 'Create the first block before adding floors and flats.',
  create: {
    label: 'Add block',
    title: 'Add a block',
    description: 'Block codes must be unique within Manglam Balaji Society.',
    permission: 'society.manage',
    successMessage: 'Block created successfully.',
    fields: [
      { key: 'code', label: 'Block code', type: 'text', required: true, maxLength: 20 },
      { key: 'name', label: 'Display name', type: 'text', required: true, maxLength: 100 },
    ],
  },
  actions: [deactivateAction],
};

const floors: ResourceConfig = {
  key: 'floors',
  path: 'society/floors',
  eyebrow: 'Society structure',
  title: 'Floors',
  description: 'Maintain floor labels and levels under their database-configured blocks.',
  endpoint: '/society/floors',
  permission: 'society.read',
  searchPlaceholder: 'Search floor or block',
  columns: [
    { key: 'block.code', label: 'Block' },
    { key: 'label', label: 'Floor' },
    { key: 'level', label: 'Level' },
    statusColumn,
    updatedColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'INACTIVE'),
  emptyTitle: 'No floors configured',
  emptyDescription: 'Add a floor after at least one block is available.',
  create: {
    label: 'Add floor',
    title: 'Add a floor',
    description: 'Assign the floor to its parent block and provide its physical level.',
    permission: 'society.manage',
    successMessage: 'Floor created successfully.',
    fields: [
      {
        key: 'blockId',
        label: 'Block',
        type: 'lookup',
        required: true,
        lookup: lookup('/society/blocks', ['code', 'name'], { status: 'ACTIVE' }),
      },
      { key: 'label', label: 'Floor label', type: 'text', required: true, maxLength: 40 },
      { key: 'level', label: 'Numeric level', type: 'number', required: true, min: -5, max: 200 },
    ],
  },
  actions: [deactivateAction],
};

const flats: ResourceConfig = {
  key: 'flats',
  path: 'society/flats',
  eyebrow: 'Society structure',
  title: 'Flats',
  description: 'Manage occupancy-ready flat records and their block and floor relationships.',
  endpoint: '/society/flats',
  permission: 'society.read',
  searchPlaceholder: 'Search flat number or block',
  columns: [
    { key: 'block.code', label: 'Block' },
    { key: 'number', label: 'Flat' },
    { key: 'floor.label', label: 'Floor' },
    { key: 'occupancyType', label: 'Occupancy', format: 'status' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'INACTIVE'),
  emptyTitle: 'No flats configured',
  emptyDescription: 'Add flats after their blocks and floors have been created.',
  create: {
    label: 'Add flat',
    title: 'Add a flat',
    description: 'The API validates that the selected block and floor belong together.',
    permission: 'society.manage',
    successMessage: 'Flat created successfully.',
    fields: [
      {
        key: 'blockId',
        label: 'Block',
        type: 'lookup',
        required: true,
        lookup: lookup('/society/blocks', ['code', 'name'], { status: 'ACTIVE' }),
      },
      {
        key: 'floorId',
        label: 'Floor',
        type: 'lookup',
        required: true,
        lookup: lookup('/society/floors', ['label', 'block.code'], { status: 'ACTIVE' }),
      },
      { key: 'number', label: 'Flat number', type: 'text', required: true, maxLength: 30 },
      {
        key: 'occupancyType',
        label: 'Occupancy type',
        type: 'select',
        required: true,
        options: statusOptions('OWNER_OCCUPIED', 'RENTED', 'FAMILY_OCCUPIED', 'OTHER'),
      },
    ],
  },
  actions: [deactivateAction],
};

const gates: ResourceConfig = {
  key: 'gates',
  path: 'society/gates',
  eyebrow: 'Society structure',
  title: 'Gates',
  description: 'Configure staffed entry points used for guard assignments and access records.',
  endpoint: '/society/gates',
  permission: 'society.read',
  columns: [
    { key: 'code', label: 'Code' },
    nameColumn,
    { key: 'location', label: 'Location' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'INACTIVE'),
  emptyTitle: 'No gates configured',
  emptyDescription: 'Add the first gate before registering guard devices.',
  create: {
    label: 'Add gate',
    title: 'Add a gate',
    description: 'Use a short unique code that guards can recognise quickly.',
    permission: 'society.manage',
    successMessage: 'Gate created successfully.',
    fields: [
      { key: 'code', label: 'Gate code', type: 'text', required: true, maxLength: 20 },
      { key: 'name', label: 'Gate name', type: 'text', required: true, maxLength: 100 },
      {
        key: 'location',
        label: 'Location',
        type: 'text',
        required: true,
        maxLength: 160,
        fullWidth: true,
      },
    ],
  },
  actions: [deactivateAction],
};

const residents: ResourceConfig = {
  key: 'residents',
  path: 'people/residents',
  eyebrow: 'People',
  title: 'Residents',
  description:
    'Review resident identities and account standing without exposing unrelated flat data.',
  endpoint: '/users',
  baseQuery: { type: 'RESIDENT' },
  permission: 'user.read',
  searchPlaceholder: 'Search name, phone, or email',
  columns: [
    nameColumn,
    { key: 'phoneMasked', label: 'Phone' },
    { key: 'email', label: 'Email' },
    statusColumn,
    createdColumn,
  ],
  statusOptions: statusOptions('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'),
  emptyTitle: 'No resident accounts',
  emptyDescription:
    'Resident accounts appear after registration or an authorised admin creates one.',
  create: {
    label: 'Add resident',
    title: 'Create resident account',
    description: 'Flat access is granted separately through an approved membership.',
    permission: 'user.create',
    successMessage: 'Resident account created successfully.',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
      { key: 'phone', label: 'Phone number', type: 'tel', required: true, placeholder: '+91...' },
      { key: 'email', label: 'Email address', type: 'email' },
    ],
  },
  actions: [
    {
      key: 'suspend',
      label: 'Suspend',
      description: 'Suspend this account and invalidate applicable sessions.',
      permission: 'user.suspend',
      method: 'POST',
      suffix: '/suspend',
      fields: [reasonField],
      successMessage: 'Resident account suspended.',
      tone: 'danger',
    },
    {
      key: 'activate',
      label: 'Activate',
      description: 'Restore this account when its identity has been verified.',
      permission: 'user.activate',
      method: 'POST',
      suffix: '/activate',
      successMessage: 'Resident account activated.',
    },
  ],
};

const membershipFields: FormFieldConfig[] = [
  {
    key: 'userId',
    label: 'Resident',
    type: 'lookup',
    required: true,
    lookup: lookup('/users', ['name', 'phoneMasked'], { type: 'RESIDENT' }),
  },
  {
    key: 'flatId',
    label: 'Flat',
    type: 'lookup',
    required: true,
    lookup: lookup('/society/flats', ['block.code', 'number'], { status: 'ACTIVE' }),
  },
  {
    key: 'relationship',
    label: 'Relationship',
    type: 'select',
    required: true,
    options: statusOptions('OWNER', 'TENANT', 'ADULT_FAMILY'),
  },
  {
    key: 'occupancyType',
    label: 'Occupancy type',
    type: 'select',
    required: true,
    options: statusOptions('OWNER_OCCUPIED', 'RENTED', 'FAMILY_OCCUPIED', 'OTHER'),
  },
  { key: 'startAt', label: 'Start date', type: 'date', required: true },
  { key: 'endAt', label: 'End date', type: 'date' },
];

const membershipColumns: ColumnConfig[] = [
  { key: 'user.name', label: 'Resident' },
  { key: 'flat.displayName', label: 'Flat' },
  { key: 'relationship', label: 'Relationship', format: 'status' },
  { key: 'startAt', label: 'Starts', format: 'date' },
  { key: 'endAt', label: 'Ends', format: 'date' },
  statusColumn,
];

const memberships: ResourceConfig = {
  key: 'memberships',
  path: 'people/memberships',
  eyebrow: 'People',
  title: 'Flat memberships',
  description: 'Manage the approved, date-effective relationship between residents and flats.',
  endpoint: '/memberships',
  permission: 'membership.read',
  searchPlaceholder: 'Search resident or flat',
  columns: membershipColumns,
  statusOptions: statusOptions('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ENDED'),
  emptyTitle: 'No memberships',
  emptyDescription: 'Create a membership to associate a resident with a flat.',
  create: {
    label: 'Add membership',
    title: 'Create flat membership',
    description: 'New memberships remain pending until an authorised administrator approves them.',
    permission: 'membership.create',
    successMessage: 'Membership request created.',
    fields: membershipFields,
  },
  actions: [
    {
      key: 'approve',
      label: 'Approve',
      description: 'Approve this membership after verifying occupancy evidence.',
      permission: 'membership.approve',
      method: 'POST',
      suffix: '/approve',
      successMessage: 'Membership approved.',
    },
    {
      key: 'reject',
      label: 'Reject',
      description: 'Reject this membership request with a reason.',
      permission: 'membership.approve',
      method: 'POST',
      suffix: '/reject',
      fields: [reasonField],
      successMessage: 'Membership rejected.',
      tone: 'danger',
    },
    {
      key: 'suspend',
      label: 'Suspend',
      description: 'Suspend flat access and invalidate scoped sessions.',
      permission: 'membership.suspend',
      method: 'POST',
      suffix: '/suspend',
      fields: [reasonField],
      successMessage: 'Membership suspended.',
      tone: 'danger',
    },
    {
      key: 'end',
      label: 'End occupancy',
      description: 'End this occupancy. The resident loses access at the specified time.',
      permission: 'membership.end',
      method: 'POST',
      suffix: '/end',
      fields: [
        { key: 'endAt', label: 'End date and time', type: 'datetime-local', required: true },
        reasonField,
      ],
      successMessage: 'Occupancy ended.',
      tone: 'danger',
    },
  ],
};

const family: ResourceConfig = {
  key: 'family',
  path: 'people/family',
  eyebrow: 'People',
  title: 'Family and dependents',
  description: 'Review non-login children and dependents attached to active flat memberships.',
  endpoint: '/family-members',
  permission: 'family.read',
  searchPlaceholder: 'Search family member or flat',
  columns: [
    nameColumn,
    { key: 'relationship', label: 'Relationship', format: 'status' },
    { key: 'membership.flat.displayName', label: 'Flat' },
    { key: 'birthDate', label: 'Birth date', format: 'date' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'INACTIVE'),
  emptyTitle: 'No family members recorded',
  emptyDescription: 'Dependents added by authorised residents or admins appear here.',
  create: {
    label: 'Add family member',
    title: 'Add family member',
    description:
      'Adult account holders should use a flat membership instead of a dependent record.',
    permission: 'family.manage',
    successMessage: 'Family member added.',
    fields: [
      {
        key: 'membershipId',
        label: 'Flat membership',
        type: 'lookup',
        required: true,
        lookup: lookup('/memberships', ['user.name', 'flat.displayName'], { status: 'APPROVED' }),
      },
      { key: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
      { key: 'relationship', label: 'Relationship', type: 'text', required: true, maxLength: 60 },
      { key: 'birthDate', label: 'Birth date', type: 'date' },
    ],
  },
  actions: [
    {
      key: 'deactivate',
      label: 'Deactivate',
      description: 'Deactivate this dependent record while preserving history.',
      permission: 'family.manage',
      method: 'POST',
      suffix: '/deactivate',
      fields: [reasonField],
      successMessage: 'Family member deactivated.',
      tone: 'danger',
    },
  ],
};

const approvals: ResourceConfig = {
  ...memberships,
  key: 'membership-approvals',
  path: 'people/approvals',
  title: 'Pending resident approvals',
  description: 'Review flat-association requests awaiting identity and occupancy verification.',
  baseQuery: { status: 'PENDING' },
  permission: 'membership.approve',
  statusOptions: undefined,
  create: undefined,
  emptyTitle: 'No approvals waiting',
  emptyDescription: 'All resident membership requests have been reviewed.',
  actions: memberships.actions?.filter(
    (action) => action.key === 'approve' || action.key === 'reject',
  ),
};

const occupancyEnd: ResourceConfig = {
  ...memberships,
  key: 'occupancy-end',
  path: 'people/occupancy-end',
  title: 'Occupancy end',
  description: 'End approved occupancies and remove flat access at an auditable effective time.',
  baseQuery: { status: 'APPROVED' },
  permission: 'membership.end',
  statusOptions: undefined,
  create: undefined,
  emptyTitle: 'No active occupancies',
  emptyDescription: 'There are no approved memberships available to end.',
  actions: memberships.actions?.filter((action) => action.key === 'end'),
};

const guards: ResourceConfig = {
  key: 'guards',
  path: 'security/guards',
  eyebrow: 'Security',
  title: 'Guard accounts',
  description: 'Manage guard identities, shifts, and gate access separately from device trust.',
  endpoint: '/guards',
  permission: 'guard.read',
  searchPlaceholder: 'Search guard name or phone',
  columns: [
    nameColumn,
    { key: 'phoneMasked', label: 'Phone' },
    { key: 'employeeCode', label: 'Employee code' },
    { key: 'assignedGates', label: 'Gates' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'SUSPENDED', 'INACTIVE'),
  emptyTitle: 'No guard accounts',
  emptyDescription: 'Create a guard account before registering a gate device.',
  create: {
    label: 'Add guard',
    title: 'Create guard account',
    description: 'The initial PIN must be changed according to the backend credential policy.',
    permission: 'guard.manage',
    successMessage: 'Guard account created.',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
      { key: 'phone', label: 'Phone number', type: 'tel', required: true, placeholder: '+91...' },
      { key: 'employeeCode', label: 'Employee code', type: 'text', required: true, maxLength: 40 },
      {
        key: 'initialPin',
        label: 'Initial 6-digit PIN',
        type: 'text',
        required: true,
        min: 6,
        maxLength: 12,
      },
      {
        key: 'gateIds',
        label: 'Assigned gates',
        type: 'lookup-multi',
        required: true,
        fullWidth: true,
        lookup: lookup('/society/gates', ['code', 'name'], { status: 'ACTIVE' }),
      },
    ],
  },
  actions: [
    {
      key: 'suspend',
      label: 'Suspend',
      description: 'Suspend the guard and invalidate active guard sessions.',
      permission: 'guard.manage',
      method: 'POST',
      suffix: '/suspend',
      fields: [reasonField],
      successMessage: 'Guard suspended.',
      tone: 'danger',
    },
    {
      key: 'activate',
      label: 'Activate',
      description: 'Restore this verified guard account.',
      permission: 'guard.manage',
      method: 'POST',
      suffix: '/activate',
      successMessage: 'Guard activated.',
    },
  ],
};

const supervisors: ResourceConfig = {
  ...guards,
  key: 'supervisors',
  path: 'security/supervisors',
  title: 'Security supervisors',
  description: 'Review guards with supervisor authority and their gate scope.',
  baseQuery: { role: 'SECURITY_SUPERVISOR' },
  create: undefined,
  emptyTitle: 'No supervisors assigned',
  emptyDescription: 'Assign the security supervisor role from role administration.',
};

const devices: ResourceConfig = {
  key: 'devices',
  path: 'security/devices',
  eyebrow: 'Security',
  title: 'Gate devices',
  description: 'Register, scope, and revoke trusted devices used by guards at society gates.',
  endpoint: '/guards/devices',
  permission: 'device.read',
  searchPlaceholder: 'Search device, guard, or gate',
  columns: [
    { key: 'deviceName', label: 'Device' },
    { key: 'guard.name', label: 'Guard' },
    { key: 'gates', label: 'Gates' },
    { key: 'lastSeenAt', label: 'Last seen', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('PENDING', 'ACTIVE', 'REVOKED', 'LOST'),
  emptyTitle: 'No guard devices',
  emptyDescription: 'Create a short-lived enrollment for a verified guard device.',
  create: {
    label: 'Create enrollment',
    title: 'Create device enrollment',
    description: 'Enrollment tokens are single-use and expire after ten minutes.',
    endpoint: '/guards/device-enrollments',
    permission: 'device.enroll',
    successMessage: 'Device enrollment created.',
    fields: [
      {
        key: 'guardId',
        label: 'Guard',
        type: 'lookup',
        required: true,
        lookup: lookup('/guards', ['name', 'employeeCode'], { status: 'ACTIVE' }),
      },
      {
        key: 'gateIds',
        label: 'Permitted gates',
        type: 'lookup-multi',
        required: true,
        fullWidth: true,
        lookup: lookup('/society/gates', ['code', 'name'], { status: 'ACTIVE' }),
      },
    ],
  },
  actions: [
    {
      key: 'revoke',
      label: 'Revoke',
      description:
        'Immediately revoke trust and block refresh or synchronization from this device.',
      permission: 'device.revoke',
      method: 'POST',
      suffix: '/revoke',
      fields: [reasonField],
      successMessage: 'Device revoked.',
      tone: 'danger',
    },
  ],
};

const visits: ResourceConfig = {
  key: 'visits',
  path: 'access/visits',
  eyebrow: 'Access control',
  title: 'Visitor and entry log',
  description: 'Review current visit projections with their flat, gate, guard, and state history.',
  endpoint: '/visitors/visits',
  permission: 'visitor.read_all',
  searchPlaceholder: 'Search visitor, flat, code, or vehicle',
  columns: [
    { key: 'visitor.name', label: 'Visitor' },
    { key: 'category', label: 'Category', format: 'status' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'gate.name', label: 'Gate' },
    statusColumn,
    { key: 'arrivedAt', label: 'Arrived', format: 'datetime' },
    { key: 'checkedOutAt', label: 'Exited', format: 'datetime' },
  ],
  statusOptions: statusOptions(
    'EXPECTED',
    'ARRIVED_AT_GATE',
    'AWAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'APPROVAL_TIMED_OUT',
    'CHECKED_IN',
    'CHECKED_OUT',
    'CANCELLED',
    'EXPIRED',
  ),
  emptyTitle: 'No visitor records',
  emptyDescription: 'Visitor activity appears here when residents or guards create a visit.',
};

const visitorApprovals: ResourceConfig = {
  key: 'visitor-approvals',
  path: 'access/approvals',
  eyebrow: 'Access control',
  title: 'Visitor approvals',
  description: 'Inspect approval requests, first-valid decisions, timeouts, and decision sources.',
  endpoint: '/visitors/approvals',
  permission: 'visitor.read_all',
  searchPlaceholder: 'Search visitor or flat',
  columns: [
    { key: 'visit.visitor.name', label: 'Visitor' },
    { key: 'visit.flat.displayName', label: 'Flat' },
    { key: 'requestedAt', label: 'Requested', format: 'datetime' },
    { key: 'decidedBy.name', label: 'Decision by' },
    { key: 'source', label: 'Source', format: 'status' },
    statusColumn,
  ],
  statusOptions: statusOptions(
    'PENDING',
    'APPROVED',
    'REJECTED',
    'TIMED_OUT',
    'CANCELLED',
    'OVERRIDDEN',
  ),
  emptyTitle: 'No visitor approvals',
  emptyDescription: 'Approval requests created at the gate will appear here.',
};

const preApprovals: ResourceConfig = {
  key: 'pre-approvals',
  path: 'access/pre-approvals',
  eyebrow: 'Access control',
  title: 'Visitor pre-approvals',
  description: 'Review resident-created invitations and their validity and consumption state.',
  endpoint: '/visitors/pre-approvals',
  permission: 'visitor.read_all',
  searchPlaceholder: 'Search visitor or flat',
  columns: [
    { key: 'visitor.name', label: 'Visitor' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'accessType', label: 'Access', format: 'status' },
    { key: 'validFrom', label: 'Valid from', format: 'datetime' },
    { key: 'validUntil', label: 'Valid until', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'CONSUMED', 'CANCELLED', 'EXPIRED', 'SUSPENDED'),
  emptyTitle: 'No pre-approvals',
  emptyDescription: 'Resident-created visitor invitations will appear here.',
  actions: [
    {
      key: 'cancel',
      label: 'Cancel',
      description: 'Cancel this pre-approval and preserve its prior use history.',
      permission: 'visitor.preapproval.cancel_all',
      method: 'POST',
      suffix: '/cancel',
      fields: [reasonField],
      successMessage: 'Pre-approval cancelled.',
      tone: 'danger',
    },
  ],
};

const overrides: ResourceConfig = {
  key: 'overrides',
  path: 'access/overrides',
  eyebrow: 'Access control',
  title: 'Manual overrides',
  description: 'Audit supervisor-authorised visitor overrides and their mandatory reasons.',
  endpoint: '/visitors/overrides',
  permission: 'visitor.override.read',
  searchPlaceholder: 'Search visitor, guard, or reason',
  columns: [
    { key: 'visit.visitor.name', label: 'Visitor' },
    { key: 'visit.flat.displayName', label: 'Flat' },
    { key: 'actor.name', label: 'Authorised by' },
    { key: 'gate.name', label: 'Gate' },
    { key: 'reason', label: 'Reason' },
    { key: 'createdAt', label: 'Occurred', format: 'datetime' },
  ],
  emptyTitle: 'No overrides recorded',
  emptyDescription: 'Reasoned visitor overrides will appear here when used.',
};

const visitorEvents: ResourceConfig = {
  key: 'visitor-events',
  path: 'access/events',
  eyebrow: 'Access control',
  title: 'Visitor event history',
  description: 'Read the immutable sequence of visitor state transitions and acting identities.',
  endpoint: '/visitors/events',
  permission: 'visitor.read_all',
  searchPlaceholder: 'Search visit, actor, or event',
  columns: [
    { key: 'visit.visitor.name', label: 'Visitor' },
    { key: 'sequence', label: 'Sequence' },
    { key: 'type', label: 'Event', format: 'status' },
    { key: 'actor.name', label: 'Actor' },
    { key: 'gate.name', label: 'Gate' },
    { key: 'serverOccurredAt', label: 'Occurred', format: 'datetime' },
  ],
  emptyTitle: 'No visitor events',
  emptyDescription: 'Immutable visitor transition events will appear here.',
};

const dailyHelp: ResourceConfig = {
  key: 'daily-help',
  path: 'operations/daily-help',
  eyebrow: 'Operations',
  title: 'Daily help directory',
  description: 'Manage verified helpers, service types, status, and flat-scoped access.',
  endpoint: '/daily-help',
  permission: 'daily_help.read',
  searchPlaceholder: 'Search helper name or phone',
  columns: [
    nameColumn,
    { key: 'type', label: 'Type', format: 'status' },
    { key: 'phoneMasked', label: 'Phone' },
    { key: 'assignedFlatCount', label: 'Flats' },
    { key: 'lastAttendanceAt', label: 'Last attendance', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'SUSPENDED', 'INACTIVE'),
  emptyTitle: 'No daily-help profiles',
  emptyDescription: 'Create a verified helper profile before assigning flats.',
  create: {
    label: 'Add daily help',
    title: 'Create daily-help profile',
    description: 'Do not collect Aadhaar or PAN documents in this system.',
    permission: 'daily_help.manage',
    successMessage: 'Daily-help profile created.',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
      { key: 'phone', label: 'Phone number', type: 'tel' },
      {
        key: 'type',
        label: 'Service type',
        type: 'select',
        required: true,
        options: statusOptions(
          'MAID',
          'COOK',
          'DRIVER',
          'CLEANER',
          'NANNY',
          'DELIVERY_STAFF',
          'REGULAR_SERVICE_PROVIDER',
          'OTHER',
        ),
      },
      {
        key: 'identificationReference',
        label: 'Non-sensitive identification reference',
        type: 'text',
        maxLength: 120,
      },
      {
        key: 'notes',
        label: 'Operational notes',
        type: 'textarea',
        maxLength: 500,
        fullWidth: true,
      },
    ],
  },
  actions: [
    {
      key: 'suspend',
      label: 'Suspend',
      description: 'Suspend access while preserving assignments and attendance history.',
      permission: 'daily_help.manage',
      method: 'POST',
      suffix: '/suspend',
      fields: [reasonField],
      successMessage: 'Daily-help profile suspended.',
      tone: 'danger',
    },
    {
      key: 'activate',
      label: 'Activate',
      description: 'Activate this verified daily-help profile.',
      permission: 'daily_help.manage',
      method: 'POST',
      suffix: '/activate',
      successMessage: 'Daily-help profile activated.',
    },
  ],
};

const assignments: ResourceConfig = {
  key: 'daily-help-assignments',
  path: 'operations/assignments',
  eyebrow: 'Operations',
  title: 'Daily-help assignments',
  description: 'Assign helpers to flats with explicit effective dates and access windows.',
  endpoint: '/daily-help/assignments',
  permission: 'daily_help.read',
  searchPlaceholder: 'Search helper or flat',
  columns: [
    { key: 'dailyHelp.name', label: 'Daily help' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'validFrom', label: 'Valid from', format: 'date' },
    { key: 'validUntil', label: 'Valid until', format: 'date' },
    { key: 'allowedDays', label: 'Allowed days' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'ENDED', 'SUSPENDED'),
  emptyTitle: 'No flat assignments',
  emptyDescription: 'Assign an active helper to a flat to permit attendance operations.',
  create: {
    label: 'Add assignment',
    title: 'Assign daily help',
    description: 'The backend enforces same-society and date-effective access.',
    permission: 'daily_help.assign',
    successMessage: 'Daily-help assignment created.',
    fields: [
      {
        key: 'dailyHelpId',
        label: 'Daily help',
        type: 'lookup',
        required: true,
        lookup: lookup('/daily-help', ['name', 'type'], { status: 'ACTIVE' }),
      },
      {
        key: 'flatId',
        label: 'Flat',
        type: 'lookup',
        required: true,
        lookup: lookup('/society/flats', ['block.code', 'number'], { status: 'ACTIVE' }),
      },
      { key: 'validFrom', label: 'Valid from', type: 'date', required: true },
      { key: 'validUntil', label: 'Valid until', type: 'date' },
      {
        key: 'allowedDays',
        label: 'Allowed days',
        type: 'text',
        placeholder: 'MON,TUE,WED',
        description: 'Comma-separated weekday codes',
        fullWidth: true,
      },
      { key: 'startTime', label: 'Earliest entry time', type: 'text', placeholder: '07:00' },
      { key: 'endTime', label: 'Latest exit time', type: 'text', placeholder: '19:00' },
    ],
  },
  actions: [
    {
      key: 'end',
      label: 'End assignment',
      description: 'End this flat assignment at an auditable effective time.',
      permission: 'daily_help.assign',
      method: 'POST',
      suffix: '/end',
      fields: [
        { key: 'endAt', label: 'End date and time', type: 'datetime-local', required: true },
        reasonField,
      ],
      successMessage: 'Assignment ended.',
      tone: 'danger',
    },
  ],
};

const attendance: ResourceConfig = {
  key: 'daily-help-attendance',
  path: 'operations/attendance',
  eyebrow: 'Operations',
  title: 'Daily-help attendance',
  description: 'Review check-in and check-out activity recorded at assigned gates.',
  endpoint: '/daily-help/attendance',
  permission: 'daily_help.read',
  searchPlaceholder: 'Search helper, flat, or guard',
  columns: [
    { key: 'dailyHelp.name', label: 'Daily help' },
    { key: 'gate.name', label: 'Gate' },
    { key: 'checkedInAt', label: 'Checked in', format: 'datetime' },
    { key: 'checkedOutAt', label: 'Checked out', format: 'datetime' },
    { key: 'guard.name', label: 'Guard' },
    statusColumn,
  ],
  statusOptions: statusOptions('CHECKED_IN', 'CHECKED_OUT', 'VOIDED'),
  emptyTitle: 'No attendance records',
  emptyDescription: 'Guard-recorded daily-help attendance will appear here.',
};

const parcels: ResourceConfig = {
  key: 'parcels',
  path: 'operations/parcels',
  eyebrow: 'Operations',
  title: 'Parcels',
  description: 'Monitor held parcels, resident decisions, collection verification, and returns.',
  endpoint: '/parcels',
  permission: 'parcel.read_all',
  searchPlaceholder: 'Search flat, courier, or parcel reference',
  columns: [
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'courierName', label: 'Courier' },
    { key: 'reference', label: 'Reference' },
    { key: 'gate.name', label: 'Gate' },
    statusColumn,
    { key: 'arrivedAt', label: 'Arrived', format: 'datetime' },
    { key: 'collectedAt', label: 'Collected', format: 'datetime' },
  ],
  statusOptions: statusOptions(
    'EXPECTED',
    'ARRIVED',
    'HELD_AT_GATE',
    'COLLECTED',
    'RETURNED',
    'CANCELLED',
  ),
  emptyTitle: 'No parcel records',
  emptyDescription: 'Gate-recorded parcel activity will appear here.',
  actions: [
    {
      key: 'return',
      label: 'Return',
      description: 'Record a held parcel as returned with a reason.',
      permission: 'parcel.manage',
      method: 'POST',
      suffix: '/return',
      fields: [reasonField],
      successMessage: 'Parcel marked as returned.',
      tone: 'danger',
    },
    {
      key: 'cancel',
      label: 'Cancel',
      description: 'Cancel this parcel record without deleting its event history.',
      permission: 'parcel.manage',
      method: 'POST',
      suffix: '/cancel',
      fields: [reasonField],
      successMessage: 'Parcel cancelled.',
      tone: 'danger',
    },
  ],
};

const notices: ResourceConfig = {
  key: 'notices',
  path: 'communication/notices',
  eyebrow: 'Communication',
  title: 'Notices',
  description: 'Draft, publish, target, and track society notices and acknowledgements.',
  endpoint: '/notices',
  permission: 'notice.read',
  createHref: '/communication/notices/new',
  searchPlaceholder: 'Search title or category',
  columns: [
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category', format: 'status' },
    { key: 'priority', label: 'Priority', format: 'status' },
    { key: 'publishAt', label: 'Publish time', format: 'datetime' },
    { key: 'acknowledgementCount', label: 'Acknowledged' },
    statusColumn,
  ],
  statusOptions: statusOptions('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'),
  emptyTitle: 'No notices',
  emptyDescription: 'Create a draft notice to begin communicating with residents.',
  actions: [
    {
      key: 'publish',
      label: 'Publish',
      description: 'Freeze the content and audience, then notify the materialized recipients.',
      permission: 'notice.publish',
      method: 'POST',
      suffix: '/publish',
      successMessage: 'Notice published.',
    },
    {
      key: 'archive',
      label: 'Archive',
      description: 'Archive this notice while preserving reads and acknowledgements.',
      permission: 'notice.manage',
      method: 'POST',
      suffix: '/archive',
      fields: [reasonField],
      successMessage: 'Notice archived.',
      tone: 'danger',
    },
  ],
};

const acknowledgements: ResourceConfig = {
  key: 'notice-acknowledgements',
  path: 'communication/acknowledgements',
  eyebrow: 'Communication',
  title: 'Notice acknowledgements',
  description: 'Review recipient, read, and acknowledgement status for published notices.',
  endpoint: '/notices/acknowledgements',
  permission: 'notice.report',
  searchPlaceholder: 'Search notice, resident, or flat',
  columns: [
    { key: 'notice.title', label: 'Notice' },
    { key: 'user.name', label: 'Resident' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'readAt', label: 'Read', format: 'datetime' },
    { key: 'acknowledgedAt', label: 'Acknowledged', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('UNREAD', 'READ', 'ACKNOWLEDGED'),
  emptyTitle: 'No acknowledgement records',
  emptyDescription: 'Recipient tracking appears after a notice is published.',
};

const complaints: ResourceConfig = {
  key: 'complaints',
  path: 'complaints',
  eyebrow: 'Resident service',
  title: 'Complaint queue',
  description:
    'Assign, investigate, update, and resolve complaints while protecting internal notes.',
  endpoint: '/complaints',
  permission: 'complaint.read_all',
  searchPlaceholder: 'Search subject, flat, or reference',
  columns: [
    { key: 'reference', label: 'Reference' },
    { key: 'subject', label: 'Subject' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'category.name', label: 'Category' },
    { key: 'priority', label: 'Priority', format: 'status' },
    { key: 'assignedTo.name', label: 'Assigned to' },
    statusColumn,
    createdColumn,
  ],
  statusOptions: statusOptions(
    'OPEN',
    'ACKNOWLEDGED',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
  ),
  emptyTitle: 'No complaints',
  emptyDescription: 'Resident complaints will appear here when submitted.',
  actions: [
    {
      key: 'assign',
      label: 'Assign',
      description: 'Assign this complaint to an authorised staff member.',
      permission: 'complaint.assign',
      method: 'POST',
      suffix: '/assign',
      fields: [
        {
          key: 'assignedToUserId',
          label: 'Assignee',
          type: 'lookup',
          required: true,
          lookup: lookup('/users', ['name', 'email'], { permission: 'complaint.update' }),
        },
        {
          key: 'note',
          label: 'Assignment note',
          type: 'textarea',
          fullWidth: true,
          maxLength: 500,
        },
      ],
      successMessage: 'Complaint assigned.',
    },
    {
      key: 'status',
      label: 'Update status',
      description: 'Apply a valid complaint state transition.',
      permission: 'complaint.update',
      method: 'POST',
      suffix: '/transition',
      fields: [
        {
          key: 'status',
          label: 'New status',
          type: 'select',
          required: true,
          options: statusOptions('ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'),
        },
        {
          key: 'comment',
          label: 'Resident-visible update',
          type: 'textarea',
          fullWidth: true,
          maxLength: 1000,
        },
      ],
      successMessage: 'Complaint status updated.',
    },
    {
      key: 'internal-note',
      label: 'Internal note',
      description: 'Add a private staff note that is never returned to residents.',
      permission: 'complaint.internal_note',
      method: 'POST',
      suffix: '/internal-notes',
      fields: [
        {
          key: 'body',
          label: 'Private note',
          type: 'textarea',
          required: true,
          fullWidth: true,
          maxLength: 2000,
        },
      ],
      successMessage: 'Internal note added.',
    },
  ],
};

const batches: ResourceConfig = {
  key: 'charge-batches',
  path: 'maintenance/batches',
  eyebrow: 'Maintenance',
  title: 'Charge batches',
  description: 'Create auditable maintenance charge runs for a defined billing period.',
  endpoint: '/maintenance/charge-batches',
  permission: 'maintenance.read',
  columns: [
    { key: 'reference', label: 'Batch' },
    { key: 'periodStart', label: 'Period', format: 'date' },
    { key: 'dueDate', label: 'Due date', format: 'date' },
    { key: 'chargeCount', label: 'Charges' },
    { key: 'totalAmount', label: 'Total', format: 'currency' },
    statusColumn,
    createdColumn,
  ],
  statusOptions: statusOptions('DRAFT', 'POSTED', 'CANCELLED'),
  emptyTitle: 'No charge batches',
  emptyDescription: 'Create a draft charge batch for the next maintenance period.',
  create: {
    label: 'Create batch',
    title: 'Create charge batch',
    description: 'Amounts are validated and applied by the backend when the batch is posted.',
    permission: 'maintenance.charge.create',
    successMessage: 'Draft charge batch created.',
    fields: [
      { key: 'periodStart', label: 'Period start', type: 'date', required: true },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true },
      { key: 'amount', label: 'Charge per flat', type: 'number', required: true, min: 0 },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        required: true,
        maxLength: 500,
        fullWidth: true,
      },
    ],
  },
  actions: [
    {
      key: 'post',
      label: 'Post charges',
      description:
        'Create flat dues from this batch. Posted charges cannot be destructively edited.',
      permission: 'maintenance.charge.create',
      method: 'POST',
      suffix: '/post',
      successMessage: 'Charge batch posted.',
    },
    {
      key: 'cancel',
      label: 'Cancel batch',
      description: 'Cancel this draft batch with an auditable reason.',
      permission: 'maintenance.charge.cancel',
      method: 'POST',
      suffix: '/cancel',
      fields: [reasonField],
      successMessage: 'Charge batch cancelled.',
      tone: 'danger',
    },
  ],
};

const dues: ResourceConfig = {
  key: 'dues',
  path: 'maintenance/dues',
  eyebrow: 'Maintenance',
  title: 'Flat dues',
  description: 'Review charge, allocation, balance, due date, and payment standing by flat.',
  endpoint: '/maintenance/charges',
  permission: 'maintenance.read',
  searchPlaceholder: 'Search flat or charge reference',
  columns: [
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'description', label: 'Charge' },
    { key: 'periodStart', label: 'Period', format: 'date' },
    { key: 'amount', label: 'Charged', format: 'currency' },
    { key: 'allocatedAmount', label: 'Paid', format: 'currency' },
    { key: 'balanceAmount', label: 'Balance', format: 'currency' },
    { key: 'dueDate', label: 'Due date', format: 'date' },
    statusColumn,
  ],
  statusOptions: statusOptions(
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'WAIVED',
    'CANCELLED',
  ),
  emptyTitle: 'No maintenance dues',
  emptyDescription: 'Posted maintenance charges will appear here.',
  actions: [
    {
      key: 'adjust',
      label: 'Adjust',
      description: 'Create a compensating adjustment. The original charge remains immutable.',
      permission: 'maintenance.charge.adjust',
      method: 'POST',
      suffix: '/adjustments',
      fields: [
        { key: 'amount', label: 'Adjustment amount', type: 'number', required: true },
        reasonField,
      ],
      successMessage: 'Charge adjustment recorded.',
    },
  ],
};

const payments: ResourceConfig = {
  key: 'payments',
  path: 'maintenance/payments',
  eyebrow: 'Maintenance',
  title: 'Payments',
  description:
    'Record verified offline payments and review immutable references and receipt status.',
  endpoint: '/maintenance/payments',
  permission: 'payment.read',
  searchPlaceholder: 'Search flat, payment reference, or receipt',
  columns: [
    { key: 'reference', label: 'Reference' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'method', label: 'Method', format: 'status' },
    { key: 'receivedAt', label: 'Received', format: 'datetime' },
    { key: 'receipt.number', label: 'Receipt' },
    statusColumn,
  ],
  statusOptions: statusOptions('PENDING_VERIFICATION', 'CONFIRMED', 'REVERSED', 'FAILED'),
  emptyTitle: 'No payments recorded',
  emptyDescription: 'Record a verified offline payment when funds have actually been received.',
  create: {
    label: 'Record payment',
    title: 'Record verified payment',
    description:
      'This does not simulate online payment. Record only funds already received and verified.',
    permission: 'payment.record',
    successMessage: 'Payment recorded and receipt processing started.',
    fields: [
      {
        key: 'flatId',
        label: 'Flat',
        type: 'lookup',
        required: true,
        lookup: lookup('/society/flats', ['block.code', 'number'], { status: 'ACTIVE' }),
      },
      { key: 'amount', label: 'Amount received', type: 'number', required: true, min: 0 },
      {
        key: 'method',
        label: 'Payment method',
        type: 'select',
        required: true,
        options: statusOptions('CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI_EXTERNAL', 'OTHER'),
      },
      {
        key: 'reference',
        label: 'Unique payment reference',
        type: 'text',
        required: true,
        maxLength: 120,
      },
      { key: 'receivedAt', label: 'Received at', type: 'datetime-local', required: true },
      {
        key: 'notes',
        label: 'Verification notes',
        type: 'textarea',
        fullWidth: true,
        maxLength: 500,
      },
    ],
  },
  actions: [
    {
      key: 'reverse',
      label: 'Reverse',
      description:
        'Create a compensating reversal. The original payment and receipt remain in history.',
      permission: 'payment.reverse',
      method: 'POST',
      suffix: '/reverse',
      fields: [reasonField],
      successMessage: 'Payment reversal recorded.',
      tone: 'danger',
    },
  ],
};

const allocations: ResourceConfig = {
  key: 'allocations',
  path: 'maintenance/allocations',
  eyebrow: 'Maintenance',
  title: 'Payment allocations',
  description: 'Review how confirmed payments are allocated to charges for the same flat.',
  endpoint: '/maintenance/allocations',
  permission: 'payment.read',
  searchPlaceholder: 'Search payment, charge, or flat',
  columns: [
    { key: 'payment.reference', label: 'Payment' },
    { key: 'charge.reference', label: 'Charge' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'amount', label: 'Allocated', format: 'currency' },
    createdColumn,
  ],
  emptyTitle: 'No payment allocations',
  emptyDescription: 'Payment-to-charge allocations will appear here after confirmation.',
  create: {
    label: 'Allocate payment',
    title: 'Allocate payment',
    description: 'The backend rejects cross-flat or over-balance allocations transactionally.',
    permission: 'payment.allocate',
    successMessage: 'Payment allocation recorded.',
    fields: [
      {
        key: 'paymentId',
        label: 'Confirmed payment',
        type: 'lookup',
        required: true,
        lookup: lookup('/maintenance/payments', ['reference', 'flat.displayName'], {
          status: 'CONFIRMED',
        }),
      },
      {
        key: 'chargeId',
        label: 'Open charge',
        type: 'lookup',
        required: true,
        lookup: lookup('/maintenance/charges', ['reference', 'flat.displayName'], {
          status: 'UNPAID',
        }),
      },
      { key: 'amount', label: 'Allocation amount', type: 'number', required: true, min: 0 },
    ],
  },
};

const receipts: ResourceConfig = {
  key: 'receipts',
  path: 'maintenance/receipts',
  eyebrow: 'Maintenance',
  title: 'Receipts',
  description: 'Review immutable issued receipts and download authorised receipt documents.',
  endpoint: '/maintenance/receipts',
  permission: 'payment.read',
  searchPlaceholder: 'Search receipt, payment, or flat',
  columns: [
    { key: 'number', label: 'Receipt' },
    { key: 'payment.reference', label: 'Payment' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'issuedAt', label: 'Issued', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('ISSUED', 'VOIDED'),
  emptyTitle: 'No receipts issued',
  emptyDescription: 'Receipts appear after a payment is confirmed and allocated.',
  actions: [
    {
      key: 'download',
      label: 'Download PDF',
      description: 'Download the authorised receipt document.',
      permission: 'payment.read',
      suffix: '/download',
      downloadFileName: 'receipt.pdf',
      successMessage: 'Receipt downloaded.',
    },
  ],
};

const reversals: ResourceConfig = {
  key: 'reversals',
  path: 'maintenance/reversals',
  eyebrow: 'Maintenance',
  title: 'Payment reversals',
  description: 'Audit compensating payment reversals, authority, reasons, and impacted receipts.',
  endpoint: '/maintenance/reversals',
  permission: 'payment.reverse',
  searchPlaceholder: 'Search payment, receipt, or actor',
  columns: [
    { key: 'payment.reference', label: 'Payment' },
    { key: 'payment.flat.displayName', label: 'Flat' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'reason', label: 'Reason' },
    { key: 'actor.name', label: 'Reversed by' },
    createdColumn,
  ],
  emptyTitle: 'No payment reversals',
  emptyDescription: 'Compensating reversal records will appear here.',
};

const reports: ResourceConfig = {
  key: 'maintenance-reports',
  path: 'maintenance/reports',
  eyebrow: 'Maintenance',
  title: 'Maintenance reports',
  description:
    'Generate permission-scoped CSV reports without exposing formulas or private fields.',
  endpoint: '/reports/exports',
  baseQuery: { module: 'MAINTENANCE' },
  permission: 'report.finance',
  columns: [
    { key: 'type', label: 'Report', format: 'status' },
    { key: 'requestedBy.name', label: 'Requested by' },
    createdColumn,
    { key: 'completedAt', label: 'Completed', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'),
  emptyTitle: 'No maintenance reports',
  emptyDescription: 'Generate a report for charges, payments, or outstanding dues.',
  create: {
    label: 'Generate report',
    title: 'Generate maintenance report',
    description: 'The export is generated asynchronously and every download is audited.',
    endpoint: '/reports/exports',
    permission: 'report.finance',
    successMessage: 'Maintenance report queued.',
    fields: [
      {
        key: 'type',
        label: 'Report type',
        type: 'select',
        required: true,
        options: statusOptions('MAINTENANCE_DUES', 'PAYMENTS', 'FLAT_LEDGER'),
      },
      { key: 'fromDate', label: 'From date', type: 'date', required: true },
      { key: 'toDate', label: 'To date', type: 'date', required: true },
      {
        key: 'status',
        label: 'Due status',
        type: 'select',
        options: statusOptions('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'),
      },
    ],
  },
  actions: [
    {
      key: 'download',
      label: 'Download CSV',
      description: 'Download this completed, permission-scoped export.',
      permission: 'report.finance',
      suffix: '/download',
      downloadFileName: 'maintenance-report.csv',
      successMessage: 'Report downloaded.',
    },
  ],
};

const emergencies: ResourceConfig = {
  key: 'emergencies',
  path: 'emergencies',
  eyebrow: 'Safety',
  title: 'Emergency monitor',
  description:
    'Monitor active resident alerts and their ordered acknowledgement and response timeline.',
  endpoint: '/emergencies',
  permission: 'emergency.read_all',
  searchPlaceholder: 'Search flat, resident, or alert reference',
  columns: [
    { key: 'reference', label: 'Alert' },
    { key: 'type', label: 'Type', format: 'status' },
    { key: 'flat.displayName', label: 'Flat' },
    { key: 'resident.name', label: 'Raised by' },
    { key: 'createdAt', label: 'Raised', format: 'datetime' },
    { key: 'acknowledgedBy.name', label: 'Acknowledged by' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'FALSE_ALARM'),
  emptyTitle: 'No emergency alerts',
  emptyDescription: 'There are no emergency records matching the current filters.',
  actions: [
    {
      key: 'acknowledge',
      label: 'Acknowledge',
      description: 'Acknowledge receipt and add the event to the alert timeline.',
      permission: 'emergency.acknowledge',
      method: 'POST',
      suffix: '/acknowledge',
      successMessage: 'Emergency acknowledged.',
    },
    {
      key: 'respond',
      label: 'Update response',
      description: 'Record an operational response update visible in the alert timeline.',
      permission: 'emergency.respond',
      method: 'POST',
      suffix: '/respond',
      fields: [
        {
          key: 'status',
          label: 'Response status',
          type: 'select',
          required: true,
          options: statusOptions(
            'RESPONDING',
            'SECURITY_DISPATCHED',
            'MEDICAL_ASSISTANCE_REQUESTED',
            'POLICE_CONTACTED',
          ),
        },
        {
          key: 'note',
          label: 'Response note',
          type: 'textarea',
          required: true,
          fullWidth: true,
          maxLength: 1000,
        },
      ],
      successMessage: 'Emergency response updated.',
    },
    {
      key: 'resolve',
      label: 'Resolve',
      description: 'Resolve the emergency or mark a verified false alarm with a reason.',
      permission: 'emergency.resolve',
      method: 'POST',
      suffix: '/resolve',
      fields: [
        {
          key: 'resolution',
          label: 'Resolution',
          type: 'select',
          required: true,
          options: statusOptions('RESOLVED', 'FALSE_ALARM'),
        },
        reasonField,
      ],
      successMessage: 'Emergency resolved.',
      tone: 'danger',
    },
  ],
};

const users: ResourceConfig = {
  ...residents,
  key: 'users',
  path: 'administration/users',
  eyebrow: 'Administration',
  title: 'User administration',
  description: 'Review account standing, roles, and activation state across authorised user types.',
  baseQuery: undefined,
  columns: [
    nameColumn,
    { key: 'phoneMasked', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'roles', label: 'Roles' },
    statusColumn,
    { key: 'lastSeenAt', label: 'Last seen', format: 'datetime' },
  ],
  create: undefined,
  emptyTitle: 'No user accounts',
  emptyDescription: 'No user accounts match the current filters.',
};

const roles: ResourceConfig = {
  key: 'roles',
  path: 'administration/roles',
  eyebrow: 'Administration',
  title: 'Roles',
  description:
    'Manage explicit action permissions without client-trusted or wildcard admin bypasses.',
  endpoint: '/roles',
  permission: 'role.read',
  searchPlaceholder: 'Search role name or code',
  columns: [
    { key: 'name', label: 'Role' },
    { key: 'code', label: 'Code' },
    { key: 'permissionCount', label: 'Permissions' },
    { key: 'userCount', label: 'Assigned users' },
    statusColumn,
  ],
  statusOptions: statusOptions('ACTIVE', 'INACTIVE'),
  emptyTitle: 'No roles available',
  emptyDescription:
    'System roles are created during secure bootstrap or by an authorised super admin.',
  create: {
    label: 'Create role',
    title: 'Create custom role',
    description:
      'Custom roles should contain only the actions required for their operational duty.',
    permission: 'role.manage',
    successMessage: 'Role created.',
    fields: [
      { key: 'name', label: 'Role name', type: 'text', required: true, maxLength: 100 },
      { key: 'code', label: 'Role code', type: 'text', required: true, maxLength: 60 },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        required: true,
        fullWidth: true,
        maxLength: 500,
      },
      {
        key: 'permissionIds',
        label: 'Action permissions',
        type: 'lookup-multi',
        required: true,
        fullWidth: true,
        lookup: lookup('/roles/permissions', ['code', 'description']),
      },
    ],
  },
  actions: [
    {
      key: 'deactivate',
      label: 'Deactivate',
      description: 'Deactivate this role and invalidate affected permission caches and sessions.',
      permission: 'role.manage',
      method: 'POST',
      suffix: '/deactivate',
      fields: [reasonField],
      successMessage: 'Role deactivated.',
      tone: 'danger',
    },
  ],
};

const permissions: ResourceConfig = {
  key: 'permissions',
  path: 'administration/permissions',
  eyebrow: 'Administration',
  title: 'Permission catalogue',
  description: 'Inspect the backend-enforced action permissions available for role composition.',
  endpoint: '/roles/permissions',
  permission: 'role.read',
  searchPlaceholder: 'Search permission code or module',
  columns: [
    { key: 'code', label: 'Permission' },
    { key: 'module', label: 'Module' },
    { key: 'description', label: 'Description' },
    { key: 'roleCount', label: 'Roles' },
  ],
  emptyTitle: 'No permissions available',
  emptyDescription: 'The backend permission catalogue has not been initialized.',
};

const audit: ResourceConfig = {
  key: 'audit',
  path: 'administration/audit',
  eyebrow: 'Administration',
  title: 'Audit log',
  description:
    'Review append-only security and operational activity with actors and correlation IDs.',
  endpoint: '/audit',
  permission: 'audit.read',
  searchPlaceholder: 'Search actor, entity, action, or correlation ID',
  columns: [
    { key: 'occurredAt', label: 'Occurred', format: 'datetime' },
    { key: 'actor.name', label: 'Actor' },
    { key: 'action', label: 'Action', format: 'status' },
    { key: 'entityType', label: 'Entity' },
    { key: 'entityId', label: 'Entity ID' },
    { key: 'result', label: 'Result', format: 'status' },
    { key: 'correlationId', label: 'Correlation ID' },
  ],
  statusOptions: statusOptions('SUCCESS', 'DENIED', 'FAILED'),
  emptyTitle: 'No audit records',
  emptyDescription: 'No audit events match the current permission scope and filters.',
};

const exportsResource: ResourceConfig = {
  key: 'exports',
  path: 'administration/exports',
  eyebrow: 'Administration',
  title: 'Data exports',
  description:
    'Review and download permission-scoped exports; every request and download is audited.',
  endpoint: '/reports/exports',
  permission: 'report.export',
  columns: [
    { key: 'type', label: 'Export', format: 'status' },
    { key: 'requestedBy.name', label: 'Requested by' },
    createdColumn,
    { key: 'completedAt', label: 'Completed', format: 'datetime' },
    { key: 'expiresAt', label: 'Expires', format: 'datetime' },
    statusColumn,
  ],
  statusOptions: statusOptions('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'),
  emptyTitle: 'No exports requested',
  emptyDescription: 'Permission-scoped export jobs will appear here when requested.',
  create: {
    label: 'Request export',
    title: 'Request data export',
    description: 'Only fields allowed by your effective permissions are included.',
    permission: 'report.export',
    successMessage: 'Export request queued.',
    fields: [
      {
        key: 'type',
        label: 'Export type',
        type: 'select',
        required: true,
        options: statusOptions(
          'VISITS',
          'RESIDENTS',
          'DAILY_HELP_ATTENDANCE',
          'PARCELS',
          'COMPLAINTS',
          'AUDIT_LOG',
        ),
      },
      { key: 'fromDate', label: 'From date', type: 'date', required: true },
      { key: 'toDate', label: 'To date', type: 'date', required: true },
    ],
  },
  actions: [
    {
      key: 'download',
      label: 'Download CSV',
      description: 'Download this completed export. The action is recorded in the audit log.',
      permission: 'report.export',
      suffix: '/download',
      downloadFileName: 'manglam-balaji-export.csv',
      successMessage: 'Export downloaded.',
    },
  ],
};

const providerFailures: ResourceConfig = {
  key: 'provider-failures',
  path: 'administration/provider-failures',
  eyebrow: 'Administration',
  title: 'Notification delivery failures',
  description:
    'Diagnose failed OTP, push, and in-app delivery attempts without exposing message secrets.',
  endpoint: '/notifications/deliveries',
  baseQuery: { status: 'FAILED' },
  permission: 'notification.diagnostics',
  searchPlaceholder: 'Search provider, recipient, or correlation ID',
  columns: [
    { key: 'channel', label: 'Channel', format: 'status' },
    { key: 'provider', label: 'Provider' },
    { key: 'recipientMasked', label: 'Recipient' },
    { key: 'errorCode', label: 'Error code' },
    { key: 'attemptCount', label: 'Attempts' },
    { key: 'lastAttemptAt', label: 'Last attempt', format: 'datetime' },
    statusColumn,
  ],
  emptyTitle: 'No delivery failures',
  emptyDescription: 'Notification providers have no failed deliveries in the current result set.',
  actions: [
    {
      key: 'retry',
      label: 'Retry delivery',
      description: 'Queue a bounded retry using the original deduplication key.',
      permission: 'notification.retry',
      method: 'POST',
      suffix: '/retry',
      successMessage: 'Notification retry queued.',
    },
  ],
};

export const RESOURCE_CONFIGS: ResourceConfig[] = [
  blocks,
  floors,
  flats,
  gates,
  residents,
  memberships,
  family,
  approvals,
  occupancyEnd,
  guards,
  supervisors,
  devices,
  visits,
  visitorApprovals,
  preApprovals,
  overrides,
  visitorEvents,
  dailyHelp,
  assignments,
  attendance,
  parcels,
  notices,
  acknowledgements,
  complaints,
  batches,
  dues,
  payments,
  allocations,
  receipts,
  reversals,
  reports,
  emergencies,
  users,
  roles,
  permissions,
  audit,
  exportsResource,
  providerFailures,
];

export const RESOURCE_BY_PATH = new Map(RESOURCE_CONFIGS.map((config) => [config.path, config]));
export const RESOURCE_BY_KEY = new Map(RESOURCE_CONFIGS.map((config) => [config.key, config]));

export const CUSTOM_PATHS = new Set([
  'dashboard',
  'society/settings',
  'communication/notices/new',
  'account/profile',
  'account/sessions',
]);

export const ADMIN_PATHS = new Set([
  ...RESOURCE_CONFIGS.map((config) => config.path),
  ...CUSTOM_PATHS,
]);
