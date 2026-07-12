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
import { useParams, Link } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { CollegeVerificationBanner } from '@/components/CollegeVerificationBanner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import SplitText from '@/components/SplitText';
import {
  getExchangeRequestActions,
  partitionExchangeRequests,
} from '@/lib/user-journey';
import { logAdminAction } from '@/services/auditService';
import {
  useCreateDispute,
  useListings,
  useRequests,
  useUpdateRequestEvent,
  type ExchangeRequest,
} from '@/hooks/api/useApi';

/* ═══════════════════════════════════════════════════
   Minimal Safe View (fallback)
   ═══════════════════════════════════════════════════ */

function SafeFallbackView({ message }: { message: string }) {
  return (
    <div className="min-h-[100dvh] bg-portal flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <Shield className="w-12 h-12 text-white/20 mx-auto" />
        <p className="text-white/40 text-sm font-body">{message}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Student Requests Inbox
   Shows sent (buyer) and received (seller) requests with action buttons.
   ═══════════════════════════════════════════════════ */

const STATUS_COLORS: Record<string, string> = {
  SENT: 'border-amber-500/30 text-amber-400',
  ACCEPTED: 'border-emerald-500/30 text-emerald-400',
  DECLINED: 'border-red-500/30 text-red-400',
  MEETING_SCHEDULED: 'border-blue-500/30 text-blue-400',
  COMPLETED: 'border-primary/30 text-primary',
  CANCELLED: 'border-white/20 text-white/40',
  WITHDRAWN: 'border-white/20 text-white/40',
  DISPUTED: 'border-red-500/30 text-red-400',
  RESOLVED: 'border-emerald-500/30 text-emerald-400',
  EXPIRED: 'border-white/20 text-white/40',
  IDLE: 'border-white/20 text-white/40',
};

function RequestsInbox({ userId }: { userId: string }) {
  const { data: buyerRes, isLoading: buyerLoading } = useRequests({ role: 'buyer' });
  const { data: sellerRes, isLoading: sellerLoading } = useRequests({ role: 'seller' });
  const updateEvent = useUpdateRequestEvent();
  const createDispute = useCreateDispute();
  const [disputeRequest, setDisputeRequest] = useState<ExchangeRequest | null>(null);
  const [disputeType, setDisputeType] = useState<'fraud' | 'item_not_as_described' | 'no_show' | 'other'>('other');
  const [disputeDescription, setDisputeDescription] = useState('');

  const buyerRequests = buyerRes?.data ?? [];
  const sellerRequests = sellerRes?.data ?? [];
  const allRequests = [...sellerRequests, ...buyerRequests];
  // Deduplicate by id (in case user is both buyer and seller of different items)
  const seen = new Set<string>();
  const uniqueRequests = allRequests.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  const { activeRequests, historyRequests } = partitionExchangeRequests(uniqueRequests);

  const actionLabels: Record<string, { title: string; description: string }> = {
    ACCEPT: { title: 'Request Accepted', description: 'The buyer can now continue the exchange.' },
    DECLINE: { title: 'Request Declined', description: 'The request has been closed.' },
    WITHDRAW: { title: 'Request Withdrawn', description: 'Your request has been withdrawn.' },
    SCHEDULE: { title: 'Meeting Scheduled', description: 'The exchange is ready for the final handoff.' },
    CANCEL: { title: 'Exchange Cancelled', description: 'The current exchange has been cancelled.' },
    CONFIRM: { title: 'Exchange Completed', description: 'The exchange is complete. Your profile activity will refresh automatically.' },
  };

  const handleAction = (req: ExchangeRequest, event: string) => {
    if (event === 'DISPUTE') {
      setDisputeRequest(req);
      setDisputeType('other');
      setDisputeDescription('');
      return;
    }

    updateEvent.mutate(
      { id: req.id, event },
      {
        onSuccess: () => {
          const feedback = actionLabels[event];
          if (feedback) {
            toast({ title: feedback.title, description: feedback.description });
          }
        },
        onError: (error) => {
          toast({
            title: 'Request Update Failed',
            description: error instanceof Error ? error.message : 'Could not update the exchange request.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const submitDispute = () => {
    if (!disputeRequest || !disputeDescription.trim()) return;

    const againstId = disputeRequest.buyerId === userId ? disputeRequest.sellerId : disputeRequest.buyerId;

    createDispute.mutate(
      {
        type: disputeType,
        againstId,
        requestId: disputeRequest.id,
        listingId: disputeRequest.listingId,
        description: disputeDescription.trim(),
      },
      {
        onSuccess: () => {
          toast({
            title: 'Dispute Filed',
            description: 'The dispute has been recorded and the exchange is now flagged for review.',
          });
          setDisputeRequest(null);
          setDisputeDescription('');
          setDisputeType('other');
        },
        onError: (error) => {
          toast({
            title: 'Dispute Failed',
            description: error instanceof Error ? error.message : 'Could not file the dispute.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const renderRequests = (requests: ExchangeRequest[]) => (
    <div className="space-y-3">
      {requests.map((req) => {
        const isBuyer = req.buyerId === userId;
        const role = isBuyer ? 'Buyer' : 'Seller';
        const actions = getExchangeRequestActions(req, userId);

        return (
          <div key={req.id} className="p-6 border border-white/10 bg-black/20 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">
                  Request ID · {role}
                </p>
                <p className="font-mono text-[11px] text-primary font-bold">{req.id.slice(0, 8)}</p>
                {req.message && (
                  <p className="text-xs text-white/50 max-w-sm">{req.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[8px] uppercase tracking-widest ${STATUS_COLORS[req.status] ?? 'border-white/20 text-white/40'}`}>
                  {req.status.replace(/_/g, ' ')}
                </Badge>
                <span className="text-[9px] font-bold text-white/20">{new Date(req.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            {actions.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-2 border-t border-white/5">
                {actions.map((action) => (
                  <button
                    key={`${req.id}-${action.event}`}
                    onClick={() => handleAction(req, action.event)}
                    disabled={updateEvent.isPending || createDispute.isPending}
                    className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest border transition-colors ${
                      action.variant === 'destructive'
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'border-primary/30 text-primary hover:bg-primary/10'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
        Exchange Requests
      </h3>

      {buyerLoading || sellerLoading ? (
        <div className="p-8 border border-white/10 bg-black/20 text-center text-white/30 text-[10px] uppercase tracking-widest">
          Loading requests…
        </div>
      ) : uniqueRequests.length === 0 ? (
        <div className="p-8 border border-white/10 bg-black/20 text-center space-y-2">
          <ArrowLeftRight className="w-6 h-6 text-white/10 mx-auto" />
          <p className="text-white/30 text-[10px] uppercase tracking-widest">No exchange requests yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">Active</p>
              <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                {activeRequests.length} OPEN
              </Badge>
            </div>
            {activeRequests.length > 0 ? renderRequests(activeRequests) : (
              <div className="p-6 border border-white/10 bg-black/20 text-center text-white/30 text-[10px] uppercase tracking-widest">
                No active exchange requests
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">History</p>
              <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                {historyRequests.length} CLOSED
              </Badge>
            </div>
            {historyRequests.length > 0 ? renderRequests(historyRequests) : (
              <div className="p-6 border border-white/10 bg-black/20 text-center text-white/30 text-[10px] uppercase tracking-widest">
                No completed or closed exchanges yet
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!disputeRequest} onOpenChange={(open) => !open && setDisputeRequest(null)}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold uppercase tracking-widest">Report Dispute</DialogTitle>
            <DialogDescription className="text-white/40">
              Flag this exchange for admin review. This will mark the request as disputed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">Dispute Type</p>
              <Select value={disputeType} onValueChange={(value: 'fraud' | 'item_not_as_described' | 'no_show' | 'other') => setDisputeType(value)}>
                <SelectTrigger className="bg-black/40 border-white/10 rounded-none">
                  <SelectValue placeholder="Select a dispute type" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none">
                  <SelectItem value="fraud">Fraud</SelectItem>
                  <SelectItem value="item_not_as_described">Item Not As Described</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">What happened?</p>
              <Textarea
                value={disputeDescription}
                onChange={(event) => setDisputeDescription(event.target.value)}
                placeholder="Describe the issue so the admin team can review it."
                className="min-h-32 bg-black/40 border-white/10 rounded-none text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisputeRequest(null)}
              className="rounded-none border-white/10 hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitDispute}
              disabled={createDispute.isPending || !disputeDescription.trim()}
              className="bg-primary hover:bg-teal-400 text-black rounded-none font-bold uppercase text-[10px] tracking-widest"
            >
              {createDispute.isPending ? 'Submitting...' : 'Submit Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Student Profile Sections
   ═══════════════════════════════════════════════════ */


function MyListings({ listings, isLoading }: { listings: Array<{title?: string; category?: string; price?: string | number; status?: string; id?: string; module?: string; createdAt?: string; [key: string]: unknown}>; isLoading: boolean }) {
  const PAGE_SIZE = 8;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when listings change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [listings.length]);

  const visibleListings = listings.slice(0, visibleCount);
  const hasMore = visibleCount < listings.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          My Listings
        </h3>
        <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
          {listings.length} TOTAL
        </Badge>
      </div>

      {isLoading ? (
        <div className="p-8 border border-white/10 bg-black/20 text-center text-white/30 text-[10px] uppercase tracking-widest">
          Loading listings…
        </div>
      ) : listings.length === 0 ? (
        <div className="p-8 border border-white/10 bg-black/20 text-center space-y-2">
          <Package className="w-6 h-6 text-white/10 mx-auto" />
          <p className="text-white/30 text-[10px] uppercase tracking-widest">No listings created yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleListings.map((item) => {
              const createdAtDate = item.createdAt ? new Date(item.createdAt as string) : null;
              const dateStr = createdAtDate && !isNaN(createdAtDate.getTime())
                ? createdAtDate.toLocaleDateString()
                : null;
              return (
                <Link key={item.id} to={`/listing/${item.id}`} className="block p-4 border border-white/10 bg-black/20 space-y-3 group hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className={`text-[8px] uppercase tracking-widest ${
                      item.status === 'APPROVED' ? 'border-emerald-500/30 text-emerald-400' : 
                      item.status === 'PENDING_REVIEW' ? 'border-amber-500/30 text-amber-400' : 
                      item.status === 'INTEREST_RECEIVED' || item.status === 'IN_TRANSACTION' ? 'border-blue-500/30 text-blue-400' :
                      'border-red-500/30 text-red-400'
                    }`}>
                      {(item.status as string).replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-[10px] font-mono text-white/20 uppercase">{item.module}</span>
                  </div>
                  <p className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">{item.title}</p>
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-white/40">₹{item.price}</span>
                    {dateStr && <span className="text-white/20">{dateStr}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="px-6 py-2 border border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40 hover:border-primary/30 hover:text-primary/70 transition-all"
              >
                Show {Math.min(PAGE_SIZE, listings.length - visibleCount)} More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudentSections({ profile, userId }: { profile: Profile; userId: string }) {
  if (!isStudentProfile(profile)) return null;

  // Lift listings fetch here so both Activity Summary and MyListings use the same count
  const { data: listingsRes, isLoading: listingsLoading } = useListings({ ownerId: userId });
  const listings = listingsRes?.data ?? [];

  const { data } = profile;
  const stats = [
    // Use actual fetched count so this matches MyListings TOTAL badge
    { label: 'Listings', value: listings.length.toString(), icon: Package },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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

      {/* Reputation & Contributions */}
      <div className="space-y-6">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Reputation
        </h3>
        <div className="p-6 border border-white/10 bg-black/20 space-y-4">
          <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Campus Reputation</p>
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-3xl font-display font-bold">{data.reputation}</span>
              <span className="text-[10px] font-bold text-primary">/100</span>
            </div>
            <Progress value={data.reputation} className="h-1 bg-white/5" />
          </div>
        </div>
      </div>

      {/* My Listings — same data as Activity Summary count */}
      <MyListings listings={listings} isLoading={listingsLoading} />

      {/* Requests Inbox */}
      <RequestsInbox userId={userId} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
        <div className="flex flex-wrap items-start sm:items-center gap-3">
          <div className="w-12 h-12 border border-white/10 bg-black/40 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold uppercase italic leading-none break-words">
              {view.identity.fullName.toUpperCase()}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 min-w-0">
              <Badge variant="outline" className="border-primary/30 text-primary text-[9px] font-bold tracking-widest px-3 py-1">
                STUDENT
              </Badge>
              <span className="text-white/20 text-[10px] font-bold tracking-widest uppercase break-all">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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

    const controller = new AbortController();
    setDrilldownLoading(true);
    setDrilldownError(null);

    const load = async () => {
      try {
        const response = await api.get<{ data: AdminStudentView }>(
          `/admin/users/${targetUserId}`,
          { signal: controller.signal },
        );
        const view = response.data;
        if (controller.signal.aborted) return;
        logAdminAction(user.id, targetUserId, 'ADMIN_VIEW_STUDENT');
        setDrilldownView(view);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Failed to load student profile';
        logger.error('ProfilePage:Drilldown', message);
        setDrilldownError(message);
      } finally {
        if (!controller.signal.aborted) setDrilldownLoading(false);
      }
    };

    load();
    return () => { controller.abort(); };
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
        <div className="min-h-[100dvh] bg-portal flex items-center justify-center">
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
      <div className="min-h-[100dvh] bg-portal text-white">
        <div ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-24">
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
      <div className="min-h-[100dvh] bg-portal flex items-center justify-center">
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
    <div className="min-h-[100dvh] bg-portal text-white">
      <div ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-24">
        <div className="profile-content space-y-12">
          {/* Identity Header */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start sm:items-center gap-3">
              <div className="w-12 h-12 border border-white/10 bg-black/40 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold uppercase italic leading-none break-words">
                  <SplitText trigger="load">{profile.identity.fullName.toUpperCase()}</SplitText>
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 min-w-0">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[9px] font-bold tracking-widest px-3 py-1">
                    {roleConfig.label.toUpperCase()}
                  </Badge>
                  <span className="text-white/20 text-[10px] font-bold tracking-widest uppercase break-all">
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

          {/* Public user upgrade banner */}
          <CollegeVerificationBanner />

          {/* Role-specific sections — conditional rendering */}
          {(profile.role === 'student_verified' || profile.role === 'public_user') && <StudentSections profile={profile} userId={user.id} />}
          {profile.role === 'admin' && <AdminSections profile={profile} />}
        </div>
      </div>

      {/* Scanlines — z below cursor: --z-scanline: 80, --z-cursor: 90 (ISSUE-12) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[var(--z-scanline)] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
};

export default ProfilePage;
