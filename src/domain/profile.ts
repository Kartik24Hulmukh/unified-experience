/**
 * BErozgar — Unified Profile Domain Model
 *
 * Pure TypeScript. No React, no UI, no styling.
 * Defines role-based profile data with safe defaults.
 */

import type { UserRole, AdminPrivilegeLevel } from '@/contexts/AuthContext';
import type { TrustResult } from '@/domain/trustEngine';

/* ═══════════════════════════════════════════════════
   Shared Identity
   ═══════════════════════════════════════════════════ */

export interface ProfileIdentity {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  verified: boolean;
  joinedAt: string;          // ISO date
  avatarUrl: string | null;
}

/* ═══════════════════════════════════════════════════
   Role-Specific Data
   ═══════════════════════════════════════════════════ */

/** Student participation metrics */
export interface StudentProfileData {
  listingsCount: number;
  requestsCount: number;
  exchangesCompleted: number;
  valueCirculated: number;   // ₹ amount
  activeListings: number;
  reputation: number;        // 0–100
  /** Raw metrics for trust computation */
  cancelledRequests: number;
  disputesCount: number;
  adminFlags: number;
}

/**
 * Admin authority metrics (summary-level only).
 * Includes observatory fields (formerly faculty-only) since
 * admin + faculty are now unified under a single role with
 * privilege tiers.
 */
export interface AdminProfileData {
  totalListings: number;
  activeUsers: number;
  openDisputes: number;
  avgApprovalTimeHours: number;
  recentActions: number;        // actions in last 24h
  systemHealthScore: number;    // 0–100
  /* Observatory fields (visible to all admin tiers) */
  totalStudents: number;
  activeExchanges: number;
  academicListings: number;
  systemUptimePercent: number;
}

/* ═══════════════════════════════════════════════════
   Unified Profile (discriminated union)
   ═══════════════════════════════════════════════════ */

export interface StudentProfile {
  identity: ProfileIdentity;
  role: 'student';
  data: StudentProfileData;
  /** Computed trust level — derived dynamically, never persisted */
  trust: TrustResult | null;
}

export interface AdminProfile {
  identity: ProfileIdentity;
  role: 'admin';
  data: AdminProfileData;
  /** Internal privilege tier — determines capability, not identity */
  privilegeLevel: AdminPrivilegeLevel;
}

export type Profile = StudentProfile | AdminProfile;

/* ═══════════════════════════════════════════════════
   Safe Defaults
   ═══════════════════════════════════════════════════ */

export const DEFAULT_STUDENT_DATA: StudentProfileData = {
  listingsCount: 0,
  requestsCount: 0,
  exchangesCompleted: 0,
  valueCirculated: 0,
  activeListings: 0,
  reputation: 0,
  cancelledRequests: 0,
  disputesCount: 0,
  adminFlags: 0,
};

export const DEFAULT_ADMIN_DATA: AdminProfileData = {
  totalListings: 0,
  activeUsers: 0,
  openDisputes: 0,
  avgApprovalTimeHours: 0,
  recentActions: 0,
  systemHealthScore: 0,
  totalStudents: 0,
  activeExchanges: 0,
  academicListings: 0,
  systemUptimePercent: 0,
};

/* ═══════════════════════════════════════════════════
   Role → Config Registry (extensible)
   ═══════════════════════════════════════════════════ */

export interface RoleConfig<D = unknown> {
  label: string;
  defaultData: D;
  /** Sections visible for this role on the profile page */
  visibleSections: readonly string[];
  /** Whether the role can perform actions (mutations) */
  canAct: boolean;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  student: {
    label: 'Student',
    defaultData: DEFAULT_STUDENT_DATA,
    visibleSections: ['activity', 'listings', 'requests', 'contributions'] as const,
    canAct: true,
  },
  admin: {
    label: 'Administrator',
    defaultData: DEFAULT_ADMIN_DATA,
    visibleSections: ['metrics', 'recentActions', 'systemHealth', 'systemOverview', 'academicRegistry'] as const,
    canAct: true,
  },
};

/* ═══════════════════════════════════════════════════
   Privilege-Based Capability Checks
   ═══════════════════════════════════════════════════ */

/** Whether this admin tier can perform mutations (approvals, flags, etc.) */
export function canAdminAct(level: AdminPrivilegeLevel): boolean {
  return level === 'SUPER' || level === 'REVIEWER';
}

/** Whether this admin tier can view governance metrics */
export function canViewGovernance(level: AdminPrivilegeLevel): boolean {
  return level === 'SUPER' || level === 'REVIEWER';
}

/** Whether this admin tier is limited to observatory (read-only) view */
export function isObserverOnly(level: AdminPrivilegeLevel): boolean {
  return level === 'OBSERVER';
}

/* ═══════════════════════════════════════════════════
   Type Guards
   ═══════════════════════════════════════════════════ */

export function isStudentProfile(p: Profile): p is StudentProfile {
  return p.role === 'student';
}

export function isAdminProfile(p: Profile): p is AdminProfile {
  return p.role === 'admin';
}

/* ═══════════════════════════════════════════════════
   Validation (safety net)
   ═══════════════════════════════════════════════════ */

export function validateProfileRoleIntegrity(profile: Profile): boolean {
  if (profile.identity.role !== profile.role) {
    // Logged via caller context — pure domain should not import logger
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════
   Admin Drilldown View (sanitised student profile)
   ═══════════════════════════════════════════════════ */

/** What an admin sees when drilling into a student's profile. */
export interface AdminStudentView {
  identity: Pick<ProfileIdentity, 'id' | 'fullName' | 'email' | 'role' | 'verified' | 'joinedAt'>;
  data: StudentProfileData;
  trust: { status: string; reasons: string[] };
  /** Fraud heuristic summary — null if user has never been flagged */
  fraud: {
    totalFlags: number;
    unreviewedCount: number;
    latestRiskLevel: 'MEDIUM' | 'HIGH' | null;
    hasPendingReview: boolean;
  } | null;
}
