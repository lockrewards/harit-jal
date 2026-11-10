import type { StaffRole } from '../types';

export type CanonicalStaffRole =
  | 'admin'
  | 'sales_manager'
  | 'operations_lead'
  | 'label_designer'
  | 'staff';

const ROLE_ALIASES: Record<string, CanonicalStaffRole> = {
  super_admin: 'admin',
  'super admin': 'admin',
  'super-admin': 'admin',
  superadmin: 'admin',
  admin: 'admin',
  staff: 'staff',
  sales_manager: 'sales_manager',
  'sales manager': 'sales_manager',
  'sales-manager': 'sales_manager',
  operations_lead: 'operations_lead',
  'operations lead': 'operations_lead',
  'operations-lead': 'operations_lead',
  label_designer: 'label_designer',
  'label designer': 'label_designer',
  'label-designer': 'label_designer',
};

const DISPLAY_LABELS: Record<CanonicalStaffRole, string> = {
  admin: 'Department Admin',
  sales_manager: 'Sales Manager',
  operations_lead: 'Operations Lead',
  label_designer: 'Label Designer',
  staff: 'Staff',
};

export const ASSIGNABLE_STAFF_ROLES: ReadonlyArray<{ value: CanonicalStaffRole; label: string }> = [
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Department Admin' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'operations_lead', label: 'Operations Lead' },
  { value: 'label_designer', label: 'Label Designer' },
];

export const ROOT_SUPER_ADMIN_IDENTITY = {
  email: 'admin@haritjal.in',
  name: 'Atal Pandey',
  phone: '+916299293497',
  designation: 'Founder & Root Admin',
  role: 'admin' as CanonicalStaffRole,
  isRootSuperAdmin: true,
} as const;

export function normalizeStaffRole(role?: string | null): CanonicalStaffRole | null {
  if (!role || typeof role !== 'string') return null;
  const cleaned = role.trim().toLowerCase().replace(/\s+/g, ' ');
  return ROLE_ALIASES[cleaned] ?? null;
}

/**
 * @deprecated Under Harit Jal 3-role architecture, 'super_admin' is not a business role.
 * Root protection is managed exclusively via the `is_root_super_admin` account flag.
 * Always returns false to eliminate role-based privilege escalation.
 */
export function isSuperAdminRole(_role?: string | null): boolean {
  return false;
}

export function isAdminRole(role?: string | null): boolean {
  return normalizeStaffRole(role) === 'admin';
}

export function isStaffRole(role?: string | null): boolean {
  return normalizeStaffRole(role) !== null;
}

export function isStaffMemberRole(role?: string | null): boolean {
  const normalized = normalizeStaffRole(role);
  return normalized !== null && normalized !== 'admin';
}

export type HaritJalAccountType = 'admin' | 'staff' | 'partner';

export function isPartnerRole(role?: string | null): boolean {
  if (!role || typeof role !== 'string') return false;
  const cleaned = role.trim().toLowerCase();
  return cleaned === 'customer' || cleaned === 'partner';
}

export function isAssignableStaffRole(role?: string | null): boolean {
  return normalizeStaffRole(role) !== null;
}

export function formatRoleDisplay(role?: string | null): string {
  const normalized = normalizeStaffRole(role);
  if (normalized) return DISPLAY_LABELS[normalized];
  if (role && role.trim()) return role.trim();
  return 'Staff';
}

export function toCanonicalStaffRole(role?: StaffRole | string | null): CanonicalStaffRole {
  return normalizeStaffRole(role) ?? 'staff';
}

