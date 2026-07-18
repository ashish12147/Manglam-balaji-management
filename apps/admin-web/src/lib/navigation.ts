import {
  Activity,
  BellRing,
  Building2,
  ClipboardList,
  ContactRound,
  CreditCard,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  PackageCheck,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  Siren,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavigationItem {
  href: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; size?: number }>;
  label: string;
  permission?: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const NAVIGATION: NavigationGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        href: '/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
        permission: 'dashboard.read',
      },
    ],
  },
  {
    label: 'Society',
    items: [
      { href: '/society/blocks', icon: Building2, label: 'Blocks', permission: 'society.read' },
      { href: '/society/floors', icon: Building2, label: 'Floors', permission: 'society.read' },
      { href: '/society/flats', icon: Building2, label: 'Flats', permission: 'society.read' },
      { href: '/society/gates', icon: ShieldCheck, label: 'Gates', permission: 'society.read' },
      {
        href: '/society/settings',
        icon: Settings,
        label: 'Society settings',
        permission: 'society.settings.read',
      },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/people/residents', icon: UsersRound, label: 'Residents', permission: 'user.read' },
      {
        href: '/people/memberships',
        icon: ContactRound,
        label: 'Memberships',
        permission: 'membership.read',
      },
      {
        href: '/people/family',
        icon: UsersRound,
        label: 'Family members',
        permission: 'family.read',
      },
      {
        href: '/people/approvals',
        icon: FileCheck2,
        label: 'Pending approvals',
        permission: 'membership.approve',
      },
      {
        href: '/people/occupancy-end',
        icon: ContactRound,
        label: 'Occupancy end',
        permission: 'membership.end',
      },
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/security/guards', icon: ShieldCheck, label: 'Guards', permission: 'guard.read' },
      {
        href: '/security/supervisors',
        icon: UserRoundCog,
        label: 'Supervisors',
        permission: 'guard.read',
      },
      {
        href: '/security/devices',
        icon: KeyRound,
        label: 'Gate devices',
        permission: 'device.read',
      },
    ],
  },
  {
    label: 'Access',
    items: [
      {
        href: '/access/visits',
        icon: Activity,
        label: 'Visit log',
        permission: 'visitor.read_all',
      },
      {
        href: '/access/approvals',
        icon: FileCheck2,
        label: 'Approvals',
        permission: 'visitor.read_all',
      },
      {
        href: '/access/pre-approvals',
        icon: ClipboardList,
        label: 'Pre-approvals',
        permission: 'visitor.read_all',
      },
      {
        href: '/access/overrides',
        icon: ShieldCheck,
        label: 'Overrides',
        permission: 'visitor.override.read',
      },
      {
        href: '/access/events',
        icon: Activity,
        label: 'Event history',
        permission: 'visitor.read_all',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        href: '/operations/daily-help',
        icon: ContactRound,
        label: 'Daily help',
        permission: 'daily_help.read',
      },
      {
        href: '/operations/assignments',
        icon: ClipboardList,
        label: 'Assignments',
        permission: 'daily_help.read',
      },
      {
        href: '/operations/attendance',
        icon: Activity,
        label: 'Attendance',
        permission: 'daily_help.read',
      },
      {
        href: '/operations/parcels',
        icon: PackageCheck,
        label: 'Parcels',
        permission: 'parcel.read_all',
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        href: '/communication/notices',
        icon: Megaphone,
        label: 'Notices',
        permission: 'notice.read',
      },
      {
        href: '/communication/acknowledgements',
        icon: FileCheck2,
        label: 'Acknowledgements',
        permission: 'notice.report',
      },
      {
        href: '/complaints',
        icon: ClipboardList,
        label: 'Complaints',
        permission: 'complaint.read_all',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        href: '/maintenance/batches',
        icon: ReceiptIndianRupee,
        label: 'Charge batches',
        permission: 'maintenance.read',
      },
      {
        href: '/maintenance/dues',
        icon: ReceiptIndianRupee,
        label: 'Dues',
        permission: 'maintenance.read',
      },
      {
        href: '/maintenance/payments',
        icon: CreditCard,
        label: 'Payments',
        permission: 'payment.read',
      },
      {
        href: '/maintenance/allocations',
        icon: Activity,
        label: 'Allocations',
        permission: 'payment.read',
      },
      {
        href: '/maintenance/receipts',
        icon: FileCheck2,
        label: 'Receipts',
        permission: 'payment.read',
      },
      {
        href: '/maintenance/reversals',
        icon: Activity,
        label: 'Reversals',
        permission: 'payment.reverse',
      },
      {
        href: '/maintenance/reports',
        icon: ClipboardList,
        label: 'Reports',
        permission: 'report.finance',
      },
    ],
  },
  {
    label: 'Safety',
    items: [
      {
        href: '/emergencies',
        icon: Siren,
        label: 'Emergencies',
        permission: 'emergency.read_all',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/administration/users', icon: UsersRound, label: 'Users', permission: 'user.read' },
      { href: '/administration/roles', icon: KeyRound, label: 'Roles', permission: 'role.read' },
      {
        href: '/administration/permissions',
        icon: ShieldCheck,
        label: 'Permissions',
        permission: 'role.read',
      },
      {
        href: '/administration/audit',
        icon: Activity,
        label: 'Audit log',
        permission: 'audit.read',
      },
      {
        href: '/administration/exports',
        icon: ClipboardList,
        label: 'Exports',
        permission: 'report.export',
      },
      {
        href: '/administration/provider-failures',
        icon: BellRing,
        label: 'Delivery failures',
        permission: 'notification.diagnostics',
      },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/account/profile', icon: ContactRound, label: 'Profile' },
      { href: '/account/sessions', icon: KeyRound, label: 'Sessions' },
    ],
  },
];

export const ALL_NAVIGATION_ITEMS = NAVIGATION.flatMap((group) => group.items);

export function navigationLabel(pathname: string) {
  return ALL_NAVIGATION_ITEMS.find((item) => item.href === pathname)?.label ?? 'Administration';
}
