/**
 * BErozgar — Profile Page
 *
 * Role-based conditional rendering using ONLY existing components.
 * No new UI elements. No new CSS. No layout changes.
 *
 * - Students: activity summary, listings, requests, contributions
 * - Admins (SUPER/REVIEWER): governance metrics, system health
 * - Admins (OBSERVER): observatory read-only view
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import gsap from 'gsap';
import logger from '@/lib/logger';
import {
  User,
  Shield,
  BookOpen,
  Package,
  ArrowLeftRight,
  TrendingUp,
  CheckCircle,
  Eye,
} from 'lucide-react';

import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api-client';
import {
  isStudentProfile,
  isAdminProfile,
  validateProfileRoleIntegrity,
  ROLE_CONFIGS,
  canViewGovernance,
  isObserverOnly,
} from '@/domain/profile';
import type { Profile, AdminStudentView } from '@/domain/profile';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import SplitText from '@/components/SplitText';
import { logAdminAction } from '@/services/auditService';

/* ═══════════════════════════════════════════════════
   Minimal Safe View (fallback)
   ═══════════════════════════════════════════════════ */

function SafeFallbackView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-portal flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <Shield className="w-12 h-12 text-white/20 mx-auto" />
        <p className="text-white/40 text-sm font-body">{message}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Student Profile Sections
   ═══════════════════════════════════════════════════ */

function StudentSections({ profile }: { profile: Profile }) {
  if (!isStudentProfile(profile)) return null;

  const { data } = profile;
  const stats = [
    { label: 'Listings', value: data.listingsCount.toString(), icon: Package },
    { label: 'Requests', value: data.requestsCount.toString(), icon: BookOpen },
    { label: 'Exchanges', value: data.exchangesCompleted.toString(), icon: ArrowLeftRight },
    { label: 'Value Circulated', value: `₹${data.valueCirculated.toLocaleString()}`, icon: TrendingUp },
  ];

  return (
    <>
      {/* Activity Summary */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Activity Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="p-6 border border-white/10 bg-black/20 space-y-2 group hover:border-primary/30 transition-all duration-500">
              <div className="flex items-center space-x-2">
                <stat.icon className="w-4 h-4 text-white/30" />
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">{stat.label}</p>
              </div>
              <span className="text-3xl font-display font-bold">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reputation & Active Listings */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Contributions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Reputation Score</p>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-display font-bold">{data.reputation}</span>
                <span className="text-[10px] font-bold text-primary">/100</span>
              </div>
              <Progress value={data.reputation} className="h-1 bg-white/5" />
            </div>
          </div>
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Active Listings</p>
            <div className="flex justify-between items-end">
              <span className="text-3xl font-display font-bold">{data.activeListings}</span>
              <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                LIVE
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Admin Profile Sections
   Privilege-aware: SUPER/REVIEWER see governance metrics.
   OBSERVER sees read-only observatory view.
   ═══════════════════════════════════════════════════ */

function AdminSections({ profile }: { profile: Profile }) {
  if (!isAdminProfile(profile)) return null;

  const { data, privilegeLevel } = profile;

  // ── OBSERVER tier: read-only observatory view ────────
  if (isObserverOnly(privilegeLevel)) {
    return (
      <>
        {/* Observatory Banner */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
              System Overview
            </h3>
            <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
              <Eye className="w-3 h-3 mr-1 text-white/40" />
              READ-ONLY
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Students', value: data.totalStudents.toLocaleString() },
              { label: 'Active Exchanges', value: data.activeExchanges.toString() },
              { label: 'Academic Listings', value: data.academicListings.toString() },
              { label: 'System Uptime', value: `${data.systemUptimePercent}%` },
            ].map((stat, i) => (
              <div key={i} className="p-6 border border-white/10 bg-black/20 space-y-2">
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">{stat.label}</p>
                <span className="text-3xl font-display font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Academic Registry Summary */}
        <div className="space-y-6">
          <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
            Academic Registry Summary
          </h3>
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-white/40 text-sm font-body leading-relaxed">
              High-level view of academic resource circulation within the MCTRGIT campus ecosystem.
              Detailed records are maintained by the administrative governance layer.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
              <div>
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-1">Textbooks Listed</p>
                <p className="text-xl font-display font-bold">{data.academicListings}</p>
              </div>
              <div>
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-1">Active Student Exchanges</p>
                <p className="text-xl font-display font-bold">{data.activeExchanges}</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── SUPER / REVIEWER tier: full governance metrics ──
  const stats = [
    { label: 'Total Listings', value: data.totalListings.toString(), delta: 'System-wide' },
    { label: 'Active Users', value: data.activeUsers.toLocaleString(), delta: 'Verified' },
    { label: 'Open Disputes', value: data.openDisputes.toString(), delta: data.openDisputes > 5 ? 'Attention Required' : 'Under Control', danger: data.openDisputes > 5 },
    { label: 'Avg Approval', value: `${data.avgApprovalTimeHours}hr`, delta: 'Optimized' },
  ];

  return (
    <>
      {/* Admin Metrics */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Governance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="p-6 border border-white/10 bg-black/20 space-y-2 group hover:border-primary/30 transition-all duration-500">
              <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">{stat.label}</p>
              <div className="flex justify-between items-end">
                <span className="text-3xl font-display font-bold">{stat.value}</span>
                <span className={`text-[10px] font-bold ${stat.danger ? 'text-red-400' : 'text-primary'}`}>{stat.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Health */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          System Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Health Score</p>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-display font-bold">{data.systemHealthScore}</span>
                <span className="text-[10px] font-bold text-primary">/100</span>
              </div>
              <Progress value={data.systemHealthScore} className="h-1 bg-white/5" />
            </div>
          </div>
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Recent Actions (24h)</p>
            <div className="flex justify-between items-end">
              <span className="text-3xl font-display font-bold">{data.recentActions}</span>
              <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                <CheckCircle className="w-3 h-3 mr-1 text-emerald-400" />
                ACTIVE
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Admin Drilldown — Read-Only Student View
   Shows student data to admin. No edit capability.
   ═══════════════════════════════════════════════════ */

function AdminDrilldownView({ view }: { view: AdminStudentView }) {
  const stats = [
    { label: 'Listings', value: view.data.listingsCount.toString(), icon: Package },
    { label: 'Requests', value: view.data.requestsCount.toString(), icon: BookOpen },
    { label: 'Exchanges', value: view.data.exchangesCompleted.toString(), icon: ArrowLeftRight },
    { label: 'Value Circulated', value: `₹${view.data.valueCirculated.toLocaleString()}`, icon: TrendingUp },
  ];

  const trustBadgeClass =
    view.trust.status === 'RESTRICTED'
      ? 'border-red-400/40 text-red-400'
      : view.trust.status === 'REVIEW_REQUIRED'
        ? 'border-yellow-400/40 text-yellow-400'
        : 'border-emerald-400/40 text-emerald-400';

  return (
    <>
      {/* Read-Only Banner */}
      <div className="flex items-center space-x-2 text-white/30">
        <Eye className="w-4 h-4" />
        <p className="text-[10px] uppercase font-bold tracking-[0.3em]">
          Admin Observation Mode — Read Only
        </p>
      </div>

      {/* Identity Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 border border-white/10 bg-black/40 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase italic leading-none">
              {view.identity.fullName.toUpperCase()}
            </h1>
            <div className="flex items-center space-x-3 mt-2">
              <Badge variant="outline" className="border-primary/30 text-primary text-[9px] font-bold tracking-widest px-3 py-1">
                STUDENT
              </Badge>
              <span className="text-white/20 text-[10px] font-bold tracking-widest uppercase">
                {view.identity.email}
              </span>
            </div>
          </div>
        </div>
        <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.4em]">
          BErozgar Campus Identity — {view.identity.verified ? 'Verified' : 'Unverified'}
        </p>
      </div>

      <div className="border-t border-white/5" />

      {/* Trust Status */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Trust Status
        </h3>
        <div className="p-6 border border-white/10 bg-black/20 space-y-3">
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className={`text-[9px] font-bold tracking-widest px-3 py-1 ${trustBadgeClass}`}>
              {view.trust.status.replace(/_/g, ' ')}
            </Badge>
            {view.fraud?.hasPendingReview && (
              <Badge variant="outline" className="border-yellow-400/40 text-yellow-400 text-[9px] font-bold tracking-widest px-3 py-1">
                FRAUD REVIEW REQUIRED
              </Badge>
            )}
          </div>
          {view.trust.reasons.length > 0 && (
            <ul className="space-y-1">
              {view.trust.reasons.map((reason, i) => (
                <li key={i} className="text-white/30 text-[10px] font-body">— {reason}</li>
              ))}
            </ul>
          )}
          {view.fraud && view.fraud.totalFlags > 0 && (
            <div className="pt-3 border-t border-white/5 space-y-2">
              <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">
                Fraud Heuristic Flags: {view.fraud.totalFlags} total, {view.fraud.unreviewedCount} unreviewed
              </p>
              {view.fraud.latestRiskLevel && (
                <p className="text-white/30 text-[10px] font-body">
                  — Latest risk level: {view.fraud.latestRiskLevel}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Activity Summary */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Activity Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="p-6 border border-white/10 bg-black/20 space-y-2">
              <div className="flex items-center space-x-2">
                <stat.icon className="w-4 h-4 text-white/30" />
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">{stat.label}</p>
              </div>
              <span className="text-3xl font-display font-bold">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reputation */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Contributions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Reputation Score</p>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-display font-bold">{view.data.reputation}</span>
                <span className="text-[10px] font-bold text-primary">/100</span>
              </div>
              <Progress value={view.data.reputation} className="h-1 bg-white/5" />
            </div>
          </div>
          <div className="p-6 border border-white/10 bg-black/20 space-y-4">
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Active Listings</p>
            <div className="flex justify-between items-end">
              <span className="text-3xl font-display font-bold">{view.data.activeListings}</span>
              <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                LIVE
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Profile Page (main export)
   Supports two modes:
     1) Self profile — authenticated user views their own profile
     2) Admin drilldown — admin views student profile (read-only)
   ═══════════════════════════════════════════════════ */

const ProfilePage = () => {
  const { user } = useAuth();
  const { profile, isLoading, error } = useProfile();
  const { userId: targetUserId } = useParams<{ userId: string }>();
  const containerRef = useRef<HTMLDivElement>(null);

  const [drilldownView, setDrilldownView] = useState<AdminStudentView | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);

  const isAdminDrilldown = !!targetUserId && user?.role === 'admin';

  useEffect(() => {
    if (!isAdminDrilldown || !user) return;

    let cancelled = false;
    setDrilldownLoading(true);
    setDrilldownError(null);

    const load = async () => {
      try {
        const response = await api.get<{ data: AdminStudentView }>(`/admin/users/${targetUserId}`);
        const view = response.data;
        if (cancelled) return;
        logAdminAction(user.id, targetUserId, 'VIEW_PROFILE');
        setDrilldownView(view);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load student profile';
        logger.error('ProfilePage:Drilldown', message);
        setDrilldownError(message);
      } finally {
        if (!cancelled) setDrilldownLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isAdminDrilldown, targetUserId, user]);

  // Animate child elements, not the container, to prevent FOUC on Strict Mode double-invoke (ISSUE-08)
  useLayoutEffect(() => {
    const loading = isAdminDrilldown ? drilldownLoading : isLoading;
    if (!containerRef.current || loading) return;

    const ctx = gsap.context(() => {
      gsap.set('.profile-content', { y: 20, opacity: 0 });
      gsap.to('.profile-content', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
    }, containerRef);

    return () => ctx.revert();
  }, [isLoading, drilldownLoading, isAdminDrilldown]);

  // ── Admin Drilldown Mode ──────────────────────────
  if (isAdminDrilldown) {
    if (drilldownLoading) {
      return (
        <div className="min-h-screen bg-portal flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      );
    }

    if (drilldownError) {
      return <SafeFallbackView message={drilldownError} />;
    }

    if (!drilldownView) {
      return <SafeFallbackView message="Student profile data unavailable." />;
    }

    return (
      <div className="min-h-screen bg-portal text-white">
        <div ref={containerRef} className="max-w-6xl mx-auto px-6 md:px-12 py-24">
          <div className="profile-content space-y-12">
            <AdminDrilldownView view={drilldownView} />
          </div>
        </div>
        {/* Scanlines — z below cursor: --z-scanline: 80, --z-cursor: 90 (ISSUE-12) */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[var(--z-scanline)] bg-[length:100%_2px,3px_100%]" />
      </div>
    );
  }

  // ── Non-admin tried to access /profile/:userId → redirect away
  if (targetUserId && user?.role !== 'admin') {
    return <SafeFallbackView message="Insufficient permissions. Admin access required." />;
  }

  // ── Self Profile Mode ─────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-portal flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <SafeFallbackView message={error} />;
  }

  if (!profile || !user) {
    return <SafeFallbackView message="Profile data unavailable." />;
  }

  if (!validateProfileRoleIntegrity(profile)) {
    return <SafeFallbackView message="Security check failed. Profile data withheld." />;
  }

  if (user.role !== profile.role) {
    logger.error('ProfilePage',
      `User role "${user.role}" does not match profile role "${profile.role}". ` +
      `Rendering minimal view.`
    );
    return <SafeFallbackView message="Role verification mismatch. Contact administration." />;
  }

  const roleConfig = ROLE_CONFIGS[profile.role];

  return (
    <div className="min-h-screen bg-portal text-white">
      <div ref={containerRef} className="max-w-6xl mx-auto px-6 md:px-12 py-24">
        <div className="profile-content space-y-12">
          {/* Identity Header */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 border border-white/10 bg-black/40 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-display font-bold uppercase italic leading-none">
                  <SplitText trigger="load">{profile.identity.fullName.toUpperCase()}</SplitText>
                </h1>
                <div className="flex items-center space-x-3 mt-2">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[9px] font-bold tracking-widest px-3 py-1">
                    {roleConfig.label.toUpperCase()}
                  </Badge>
                  <span className="text-white/20 text-[10px] font-bold tracking-widest uppercase">
                    {profile.identity.email}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.4em]">
              BErozgar Campus Identity — {profile.identity.verified ? 'Verified' : 'Unverified'}
            </p>
          </div>

          <div className="border-t border-white/5" />

          {/* Role-specific sections — conditional rendering */}
          {profile.role === 'student' && <StudentSections profile={profile} />}
          {profile.role === 'admin' && <AdminSections profile={profile} />}
        </div>
      </div>

      {/* Scanlines — z below cursor: --z-scanline: 80, --z-cursor: 90 (ISSUE-12) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[var(--z-scanline)] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
};

export default ProfilePage;