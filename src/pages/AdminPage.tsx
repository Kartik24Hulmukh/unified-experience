import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import logger from '@/lib/logger';
import {
    ShieldCheck,
    Users,
    AlertTriangle,
    Terminal,
    Check,
    X,
    MoreVertical,
    Activity,
    Lock,
    Search,
    Filter,
    RefreshCw
} from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SplitText from '@/components/SplitText';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { useAuth } from '@/contexts/AuthContext';
import {
    filterAdminAuditLogs,
    filterAdminDisputes,
    filterAdminFraudUsers,
    filterAdminPendingListings,
    getAdminSearchConfig,
    type AdminTab,
} from '@/lib/admin-console';
import { canRunAdminRecovery, canModerateContent } from '@/lib/user-journey';
import {
    useAdminPending, useAdminStats, useUpdateListingStatus,
    useDisputes, useUpdateDisputeStatus, useAdminAuditLog, useAdminFraudDashboard, useAdminRecovery
} from '@/hooks/api/useApi';
import type { PendingItem, Dispute, AuditLogEntry } from '@/hooks/api/useApi';
import {
    createListingMachine,
    type ListingMachine,
    InvalidTransitionError,
} from '@/lib/fsm';
import { toast } from '@/components/ui/use-toast';

type ConfirmationState = {
    title: string;
    description: string;
    confirmLabel: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
} | null;

const AdminPage = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
    // Track which detail dialog is open (keyed by listing id) so we can close it after actions
    const [openDialogs, setOpenDialogs] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const gsapCtxRef = useRef<gsap.Context | null>(null);
    const { user } = useAuth();
    const recoveryMutation = useAdminRecovery();
    const recoveryEnabled = canRunAdminRecovery(user?.privilegeLevel);
    const canModerate = canModerateContent(user?.privilegeLevel);

    // API data
    const { data: pendingResponse, isLoading: pendingLoading, isError: pendingError, error: pendingErr, refetch: refetchPending } = useAdminPending();
    const { data: statsResponse } = useAdminStats();
    const updateStatus = useUpdateListingStatus();
    const { data: disputesResponse, isLoading: disputesLoading } = useDisputes();
    const updateDisputeStatus = useUpdateDisputeStatus();
    const { data: auditResponse, isLoading: auditLoading } = useAdminAuditLog();
    const { data: fraudResponse, isLoading: fraudLoading } = useAdminFraudDashboard();

    const disputes = useMemo(() => disputesResponse?.data ?? [], [disputesResponse?.data]);
    const auditLogs = useMemo(() => auditResponse?.data ?? [], [auditResponse?.data]);
    const fraudData = fraudResponse?.data ?? null;
    const fraudUsers = useMemo(() => fraudData?.flaggedUsers ?? [], [fraudData]);

    const pendingListings = useMemo(() => pendingResponse?.data ?? [], [pendingResponse?.data]);
    const stats = statsResponse?.data;
    const searchConfig = getAdminSearchConfig(activeTab);

    // Filter pending listings by search query (title or owner name)
    const filteredListings = useMemo(() => filterAdminPendingListings(pendingListings, searchQuery), [pendingListings, searchQuery]);
    const filteredDisputes = useMemo(() => filterAdminDisputes(disputes, searchQuery), [disputes, searchQuery]);
    const filteredAuditLogs = useMemo(() => filterAdminAuditLogs(auditLogs, searchQuery), [auditLogs, searchQuery]);
    const filteredFraudUsers = useMemo(() => filterAdminFraudUsers(fraudUsers, searchQuery), [fraudUsers, searchQuery]);

    /**
     * Each pending listing is assumed to be in `pending_review`
    * (user already submitted -> admin queue). We hold one FSM per row
     * so transitions are validated before any UI mutation.
     */
    const [machines, setMachines] = useState<Record<string, ListingMachine>>({});

    // Sync FSM machines with API data
    useEffect(() => {
        if (!pendingListings.length) return;
        setMachines(prev => {
            const next = { ...prev };
            for (const l of pendingListings) {
                if (!next[l.id]) {
                    next[l.id] = createListingMachine().send('SUBMIT');
                }
            }
            return next;
        });
    }, [pendingListings]);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        // Use gsap.context for proper scoping and cleanup
        gsapCtxRef.current = gsap.context(() => {
            // Respect reduced-motion preference — skip the slide-in animation and
            // just make both panels immediately visible.
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReduced) {
                gsap.set(['.admin-sidebar', '.admin-main'], { x: 0, y: 0, opacity: 1, clearProps: 'all' });
                return;
            }

            const tl = gsap.timeline();
            tl.fromTo('.admin-sidebar', { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'power4.out' })
                .fromTo('.admin-main', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.6');
        }, containerRef);

        return () => { gsapCtxRef.current?.revert(); };
    }, []);

    useEffect(() => {
        setSearchQuery('');
    }, [activeTab]);

    const handleApprove = useCallback((id: string) => {
        const machine = machines[id];
        if (!machine || !machine.can('APPROVE')) {
            logger.error('AdminPage',
                String(new InvalidTransitionError('Listing', machine?.state ?? 'unknown', 'APPROVE')),
            );
            return;
        }

        const prev = machine;                                   // NEW-BUG-06 FIX: snapshot before mutation
        const next = machine.send('APPROVE'); // pending_review -> approved
        setMachines(prev => ({ ...prev, [id]: next }));

        // Call API to update status, then animate
        updateStatus.mutate({ id, status: 'approved' }, {
            onSuccess: () => {
                // UX-03: toast confirmation so admin knows the action landed
                toast({ title: 'Listing Approved', description: 'The listing is now live for students to view.' });
                // Close the detail dialog if it was open
                setOpenDialogs(prev => ({ ...prev, [id]: false }));
                gsapCtxRef.current?.add(() => {
                    gsap.to(`.row-${id}`, { backgroundColor: 'rgba(0, 212, 170, 0.1)', duration: 0.3 });
                });
            },
            onError: () => {
                // NEW-BUG-06 FIX: roll back the local FSM snapshot so the button is re-enabled
                // and admin can retry without a page refresh.
                setMachines(m => ({ ...m, [id]: prev }));
                toast({ title: 'Approval Failed', description: 'Could not approve listing. Please try again.', variant: 'destructive' });
            },
        });
    }, [machines, updateStatus]);

    const handleReject = useCallback((id: string) => {
        const machine = machines[id];
        if (!machine || !machine.can('REJECT')) {
            logger.error('AdminPage',
                String(new InvalidTransitionError('Listing', machine?.state ?? 'unknown', 'REJECT')),
            );
            return;
        }

        const prev = machine;                                   // NEW-BUG-06 FIX: snapshot before mutation
        const next = machine.send('REJECT'); // pending_review -> rejected
        setMachines(prev => ({ ...prev, [id]: next }));

        // Call API to update status, then animate
        updateStatus.mutate({ id, status: 'rejected' }, {
            onSuccess: () => {
                // UX-03: toast confirmation
                toast({ title: 'Listing Rejected', description: 'The listing has been rejected and removed from the queue.' });
                // Close the detail dialog if it was open
                setOpenDialogs(prev => ({ ...prev, [id]: false }));
                gsapCtxRef.current?.add(() => {
                    gsap.to(`.row-${id}`, { backgroundColor: 'rgba(239, 68, 68, 0.1)', duration: 0.3 });
                });
            },
            onError: () => {
                // NEW-BUG-06 FIX: roll back the local FSM snapshot
                setMachines(m => ({ ...m, [id]: prev }));
                toast({ title: 'Rejection Failed', description: 'Could not reject listing. Please try again.', variant: 'destructive' });
            },
        });
    }, [machines, updateStatus]);

    const handleDisputeStatus = useCallback((id: string, status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED') => {
        const messages = {
            UNDER_REVIEW: { title: 'Dispute Under Review', description: 'Status updated to Under Review.' },
            RESOLVED: { title: 'Dispute Resolved', description: 'The dispute has been marked as resolved.' },
            REJECTED: { title: 'Dispute Rejected', description: 'The dispute has been closed as rejected.' },
        };

        updateDisputeStatus.mutate(
            { id, status },
            {
                onSuccess: () => toast(messages[status]),
                onError: () => toast({ title: 'Update Failed', variant: 'destructive' }),
            },
        );
    }, [updateDisputeStatus]);

    const openConfirmation = useCallback((nextState: ConfirmationState) => {
        setConfirmation(nextState);
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div ref={containerRef} className="min-h-[100dvh] bg-portal flex text-white overflow-hidden relative">
            {/* Sidebar Architecture - Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Architecture */}
            <aside className={`fixed inset-y-0 left-0 z-50 lg:relative lg:flex lg:translate-x-0 w-64 border-r border-white/5 bg-black/90 lg:bg-black/40 flex flex-col transition-transform duration-300 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="p-8 border-b border-white/5 space-y-4 relative">
                    <button 
                        onClick={() => setIsSidebarOpen(false)}
                        aria-label="Close sidebar"
                        className="lg:hidden absolute top-8 right-4 text-white/40 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 border border-primary rotate-45 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-primary -rotate-45" />
                        </div>
                        <span className="font-display font-bold tracking-tighter text-xl">CONSOLE</span>
                    </div>
                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-[0.3em]">Governance v10.4</p>
                </div>

                <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'pending', label: 'Pending Approvals', icon: ShieldCheck },
                        { id: 'users', label: 'Verified Entities', icon: Users },
                        { id: 'disputes', label: 'Dispute Protocols', icon: AlertTriangle },
                        { id: 'fraud', label: 'Fraud Dashboard', icon: Activity },
                        { id: 'logs', label: 'System Logs', icon: Terminal },
                        { id: 'activity', label: 'Live Metrics', icon: Activity },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveTab(item.id as AdminTab);
                                setIsSidebarOpen(false);
                            }}
                            aria-label={item.label}
                            className={`w-full flex items-center space-x-3 px-4 py-3 transition-all duration-300 group focus:outline-none focus:bg-primary/5 ${activeTab === item.id ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-white/40 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            <span className="text-[11px] uppercase font-bold tracking-widest">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-8 border-t border-white/5 mt-auto">
                    <div className="flex items-center space-x-2 text-white/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] uppercase font-bold tracking-widest">Admin Authorization: Valid</span>
                    </div>
                </div>
            </aside>

            {/* Main Command Center */}
            <main className="admin-main flex-1 flex flex-col h-[100dvh] overflow-y-auto scrollbar-hide">
                <header className="px-4 sm:px-8 md:px-12 py-6 sm:py-10 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/5 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 lg:hidden">
                            <button 
                                onClick={() => setIsSidebarOpen(true)}
                                aria-label="Open sidebar"
                                className="p-2 border border-white/10 text-white/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            >
                                <MoreVertical className="w-5 h-5 rotate-90" />
                            </button>
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold uppercase italic italic-syne leading-none">
                            <SplitText trigger="load">MODERATION</SplitText>
                        </h1>
                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.4em]">Internal Resource Audit Terminal</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                        <div className="relative w-full sm:w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder={searchConfig.placeholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                disabled={!searchConfig.enabled}
                                className="bg-black/40 border-white/10 text-[10px] font-bold tracking-widest pl-10 h-10 rounded-none focus-visible:ring-1 focus-visible:ring-primary uppercase disabled:opacity-30 disabled:cursor-not-allowed w-full"
                            />
                        </div>
                        <div className="flex items-center justify-between w-full md:w-auto gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] uppercase tracking-[0.2em] opacity-40 font-mono">Identity</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{user?.fullName?.split(' ')[0] || 'Admin'}</span>
                                </div>
                                <div className="relative w-10 h-10 rounded-full border border-white/20 flex items-center justify-center bg-white text-black text-xs font-bold uppercase transition-all duration-300 hover:scale-110 cursor-default">
                                    {user?.fullName?.[0] || 'K'}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                disabled
                                title="Filters coming soon"
                                className="h-10 border-white/10 rounded-none text-[10px] font-bold tracking-widest uppercase px-4 sm:px-6 opacity-30 cursor-not-allowed"
                            >
                                <Filter className="w-3 h-3 mr-2" />
                                <span className="hidden xs:inline">Matrix Filter</span>
                            </Button>
                        </div>
                    </div>
                </header>

                <section className="p-4 sm:p-8 md:p-12 space-y-8 md:space-y-12">
                    {/* Stats Grid - always visible */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Listings', value: stats ? String(stats.totalListings) : '--', delta: stats ? `${stats.completedExchanges} completed` : '' },
                            { label: 'Active Users', value: stats ? stats.totalUsers.toLocaleString() : '--', delta: stats ? 'Verified' : '' },
                            { label: 'Disputes Open', value: stats ? String(stats.activeDisputes).padStart(2, '0') : '--', delta: stats && stats.activeDisputes > 5 ? 'Attention' : 'Under Control', danger: stats ? stats.activeDisputes > 5 : false },
                            { label: 'Pending Reviews', value: stats ? String(stats.pendingListings) : '--', delta: 'In Queue' },
                        ].map((stat, i) => (
                            <div key={i} className="p-6 border border-white/10 bg-black/20 space-y-2 group hover:border-primary/30 transition-all duration-500">
                                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">{stat.label}</p>
                                <div className="flex justify-between items-end">
                                    <span className="text-3xl font-display font-bold">{stat.value}</span>
                                    <span className={`text-[10px] font-bold ${stat.danger ? 'text-red-400' : 'text-primary'}`}>{stat.delta}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* â•â•â• PENDING TAB â•â•â• */}
                    {activeTab === 'pending' && (
                        <>
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Queue Matrix</h3>
                                <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                    {filteredListings.length} ACTIONS REQUIRED
                                </Badge>
                            </div>

                            <div className="border border-white/10 bg-black/20 overflow-x-auto scrollbar-hide">
                                {pendingLoading ? (
                                    <div className="p-12 flex flex-col items-center gap-4">
                                        <LoadingSpinner />
                                        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading pending queue...</p>
                                    </div>
                                ) : pendingError ? (
                                    <div className="p-12">
                                        <ErrorFallback error={pendingErr} onRetry={refetchPending} compact />
                                    </div>
                                ) : (
                                    <div className="w-full overflow-x-auto relative pb-4"><Table className="min-w-[800px]">
                                        <TableHeader className="bg-white/5">
                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Protocol ID</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Verified User</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Resource Entity</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Entry Date</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12 w-48">Validation Rank</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredListings.map((listing) => (
                                                <TableRow
                                                    key={listing.id}
                                                    className={`row-${listing.id} border-white/5 hover:bg-primary/5 transition-all duration-300 group`}
                                                >
                                                    <TableCell className="font-mono text-[10px] text-primary font-bold">{listing.id.slice(0, 8)}</TableCell>
                                                    <TableCell className="text-xs font-bold uppercase tracking-tight">{listing.owner?.fullName ?? '--'}</TableCell>
                                                    <TableCell className="text-xs text-white/60">{listing.title}</TableCell>
                                                    <TableCell className="text-[10px] font-bold text-white/20 font-display">{new Date(listing.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <div className="space-y-2">
                                                            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[8px] uppercase tracking-widest">
                                                                {listing.status.toLowerCase().replace(/_/g, ' ')}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end space-x-2">
                                                            <Dialog
                                                                open={openDialogs[listing.id] ?? false}
                                                                onOpenChange={(open) => setOpenDialogs(prev => ({ ...prev, [listing.id]: open }))}
                                                            >
                                                                <DialogTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        className="h-8 w-8 p-0 hover:bg-white/10"
                                                                        onClick={() => setOpenDialogs(prev => ({ ...prev, [listing.id]: true }))}
                                                                    >
                                                                        <Search className="w-4 h-4 text-white/40" />
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none sm:max-w-2xl">
                                                                    <DialogHeader className="space-y-4">
                                                                        <DialogTitle className="font-display text-3xl font-bold uppercase italic italic-syne">ENTITY INSPECTION</DialogTitle>
                                                                        <DialogDescription className="text-white/40 uppercase text-[10px] font-bold tracking-widest">Protocol ID: {listing.id}</DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 border-y border-white/5 my-4">
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <p className="text-[9px] text-white/30 uppercase font-bold font-display">Resource Details</p>
                                                                                <h4 className="text-xl font-bold uppercase">{listing.title}</h4>
                                                                                {listing.description && <p className="text-xs text-white/50 mt-1">{listing.description}</p>}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[9px] text-white/30 uppercase font-bold font-display">Submitted By</p>
                                                                                <p className="text-sm font-bold uppercase text-primary">{listing.owner?.fullName ?? '--'}</p>
                                                                                <p className="text-[10px] text-white/40">{listing.owner?.email}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[9px] text-white/30 uppercase font-bold font-display">Price</p>
                                                                                <p className="text-sm font-bold">Rs {listing.price}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-4 bg-white/5 p-4">
                                                                            <p className="text-[9px] text-white/30 uppercase font-bold font-display">Moderation Snapshot</p>
                                                                            <div className="space-y-3 text-[10px] font-mono text-white/60">
                                                                                <div className="flex items-center justify-between gap-4">
                                                                                    <span>Status</span>
                                                                                    <span>{listing.status.toLowerCase().replace(/_/g, ' ')}</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-between gap-4">
                                                                                    <span>Category</span>
                                                                                    <span>{listing.category ?? 'unclassified'}</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-between gap-4">
                                                                                    <span>Submitted</span>
                                                                                    <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
                                                                                </div>
                                                                                <p className="text-white/30 leading-relaxed pt-2 border-t border-white/10">
                                                                                    Review the listing details and trust context before approving or rejecting the submission.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {canModerate && (
                                                                    <div className="flex justify-end space-x-4">
                                                                        <Button
                                                                            variant="outline"
                                                                            className="rounded-none border-white/10 hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest"
                                                                            onClick={() => openConfirmation({
                                                                                title: 'Reject listing?',
                                                                                description: 'This will remove the listing from the review queue and mark it as rejected.',
                                                                                confirmLabel: 'Reject Listing',
                                                                                variant: 'destructive',
                                                                                onConfirm: () => handleReject(listing.id),
                                                                            })}
                                                                        >
                                                                            Reject Protocol
                                                                        </Button>
                                                                        <Button
                                                                            className="bg-primary hover:bg-teal-400 text-black rounded-none font-bold uppercase text-[10px] tracking-widest"
                                                                            onClick={() => openConfirmation({
                                                                                title: 'Approve listing?',
                                                                                description: 'This will make the listing visible to students immediately.',
                                                                                confirmLabel: 'Approve Listing',
                                                                                onConfirm: () => handleApprove(listing.id),
                                                                            })}
                                                                        >
                                                                            Confirm & Manifest
                                                                        </Button>
                                                                    </div>
                                                                    )}
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table></div>
                                )}
                            </div>
                        </>
                    )}

                    {/* â•â•â• DISPUTES TAB â•â•â• */}
                    {activeTab === 'disputes' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Dispute Protocols</h3>
                                <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                    {filteredDisputes.length} RECORD{filteredDisputes.length !== 1 ? 'S' : ''}
                                </Badge>
                            </div>
                            <div className="border border-white/10 bg-black/20 overflow-x-auto scrollbar-hide">
                                    {disputesLoading ? (
                                    <div className="p-12 flex flex-col items-center gap-4"><LoadingSpinner /><p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading disputes...</p></div>
                                ) : filteredDisputes.length === 0 ? (
                                    <div className="p-12 text-center text-white/30 text-[10px] uppercase tracking-widest">No disputes found</div>
                                ) : (
                                    <div className="w-full overflow-x-auto relative pb-4"><Table className="min-w-[800px]">
                                        <TableHeader className="bg-white/5">
                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">ID</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Type</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Description</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Status</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Filed</TableHead>
                                                <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredDisputes.map((d) => (
                                                <TableRow key={d.id} className="border-white/5 hover:bg-primary/5 transition-all duration-300">
                                                    <TableCell className="font-mono text-[10px] text-primary font-bold">{d.id.slice(0, 8)}</TableCell>
                                                    <TableCell><Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[8px] uppercase tracking-widest">{d.type.replace(/_/g, ' ')}</Badge></TableCell>
                                                    <TableCell className="text-xs text-white/60 max-w-xs truncate" title={d.description}>{d.description}</TableCell>
                                                    <TableCell><Badge variant={d.status === 'RESOLVED' ? 'default' : 'outline'} className={`text-[8px] uppercase tracking-widest ${d.status === 'OPEN' ? 'border-red-500/30 text-red-400' : d.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'border-white/20 text-white/60'}`}>{d.status.replace(/_/g, ' ')}</Badge></TableCell>
                                                    <TableCell className="text-[10px] font-bold text-white/20 font-display">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        {canModerate ? (
                                                        <div className="flex justify-end space-x-2">
                                                            {d.status === 'OPEN' && (
                                                                <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-bold tracking-widest hover:bg-amber-500/20 text-amber-400" onClick={() => openConfirmation({
                                                                    title: 'Move dispute to review?',
                                                                    description: 'This will mark the dispute as under review for moderation follow-up.',
                                                                    confirmLabel: 'Start Review',
                                                                    onConfirm: () => handleDisputeStatus(d.id, 'UNDER_REVIEW'),
                                                                })}>Review</Button>
                                                            )}
                                                            {(d.status === 'OPEN' || d.status === 'UNDER_REVIEW') && (
                                                                <>
                                                                    <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-bold tracking-widest hover:bg-emerald-500/20 text-emerald-400" onClick={() => openConfirmation({
                                                                        title: 'Resolve dispute?',
                                                                        description: 'This marks the dispute as resolved and closes the moderation flow.',
                                                                        confirmLabel: 'Resolve Dispute',
                                                                        onConfirm: () => handleDisputeStatus(d.id, 'RESOLVED'),
                                                                    })}>Resolve</Button>
                                                                    <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-bold tracking-widest hover:bg-red-500/20 text-red-400" onClick={() => openConfirmation({
                                                                        title: 'Reject dispute?',
                                                                        description: 'This closes the dispute as rejected. Use this only if the report is invalid.',
                                                                        confirmLabel: 'Reject Dispute',
                                                                        variant: 'destructive',
                                                                        onConfirm: () => handleDisputeStatus(d.id, 'REJECTED'),
                                                                    })}>Reject</Button>
                                                                </>
                                                            )}
                                                        </div>
                                                        ) : (
                                                        <span className="text-[9px] text-white/20 uppercase tracking-widest">Read-only</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table></div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* â•â•â• USERS TAB â•â•â• */}
                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Verified Entities</h3>
                                <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                    {stats ? stats.totalUsers : '--'} TOTAL
                                </Badge>
                            </div>
                            <div className="border border-white/10 bg-black/20 p-12">
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                    <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Total Users</p>
                                        <span className="text-3xl font-display font-bold">{stats?.totalUsers ?? '--'}</span>
                                    </div>
                                    <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Active Disputes</p>
                                        <span className="text-3xl font-display font-bold text-amber-400">{stats?.activeDisputes ?? '--'}</span>
                                    </div>
                                    <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Completed Exchanges</p>
                                        <span className="text-3xl font-display font-bold text-emerald-400">{stats?.completedExchanges ?? '--'}</span>
                                    </div>
                                </div>
                                <p className="text-white/20 text-[10px] uppercase tracking-widest mt-8 text-center">Search is available on moderation tabs with list data</p>
                            </div>
                        </div>
                    )}

                    {/* â•â•â• FRAUD TAB â•â•â• */}
                    {activeTab === 'fraud' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Fraud Dashboard</h3>
                                <div className="flex items-center gap-3">
                                    {recoveryEnabled && (
                                        <Button
                                            type="button"
                                            onClick={() => recoveryMutation.mutate(undefined, {
                                                onSuccess: (response) => {
                                                    const result = response.data;
                                                    toast({
                                                        title: 'Recovery Scan Complete',
                                                        description: `${result.expiredRequests} stale requests expired and ${result.recoveredListings} listings recovered.`,
                                                    });
                                                },
                                                onError: (error) => {
                                                    toast({
                                                        title: 'Recovery Failed',
                                                        description: error instanceof Error ? error.message : 'Could not run the recovery scan.',
                                                        variant: 'destructive',
                                                    });
                                                },
                                            })}
                                            disabled={recoveryMutation.isPending}
                                            className="rounded-none bg-primary hover:bg-teal-400 text-black text-[10px] font-bold tracking-widest uppercase"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${recoveryMutation.isPending ? 'animate-spin' : ''}`} />
                                            {recoveryMutation.isPending ? 'Running Recovery' : 'Run Recovery Scan'}
                                        </Button>
                                    )}
                                    <Badge variant="outline" className="border-red-500/30 text-red-400 text-[9px] font-bold tracking-widest px-4 py-1">
                                        TRUST &amp; SAFETY
                                    </Badge>
                                </div>
                            </div>
                            {fraudLoading ? (
                                <div className="p-12 flex flex-col items-center gap-4">
                                    <LoadingSpinner />
                                    <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading fraud data...</p>
                                </div>
                            ) : !fraudData ? (
                                <div className="border border-white/10 bg-black/20 p-12 text-center text-white/30 text-[10px] uppercase tracking-widest">
                                    No fraud data available
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                        <div className="p-6 border border-red-500/20 bg-red-500/5 space-y-2">
                                            <p className="text-[9px] text-red-400/60 uppercase font-bold tracking-widest">High Risk Users</p>
                                            <span className="text-3xl font-display font-bold text-red-400">{fraudData.highRisk}</span>
                                        </div>
                                        <div className="p-6 border border-amber-500/20 bg-amber-500/5 space-y-2">
                                            <p className="text-[9px] text-amber-400/60 uppercase font-bold tracking-widest">Flagged Users</p>
                                            <span className="text-3xl font-display font-bold text-amber-400">{fraudData.totalFlagged}</span>
                                        </div>
                                        <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Medium Risk Users</p>
                                            <span className="text-3xl font-display font-bold">{fraudData.mediumRisk}</span>
                                        </div>
                                    </div>
                                    {filteredFraudUsers.length > 0 && (
                                        <div className="border border-white/10 bg-black/20">
                                            <Table>
                                                <TableHeader className="bg-white/5">
                                                    <TableRow className="border-white/5 hover:bg-transparent">
                                                        <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">User</TableHead>
                                                        <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Risk Level</TableHead>
                                                        <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Flags</TableHead>
                                                        <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Active Disputes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredFraudUsers.map((flag) => (
                                                        <TableRow key={flag.userId} className="border-white/5 hover:bg-primary/5 transition-all duration-300">
                                                            <TableCell className="font-mono text-[10px] text-primary font-bold">{flag.userId?.slice(0, 8) ?? '--'}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={`text-[8px] uppercase tracking-widest ${flag.riskLevel === 'HIGH' ? 'border-red-500/30 text-red-400' : flag.riskLevel === 'MEDIUM' ? 'border-amber-500/30 text-amber-400' : 'border-white/20 text-white/60'}`}>
                                                                    {flag.riskLevel ?? 'UNKNOWN'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-white/60 max-w-xs truncate" title={flag.flags.join(', ')}>{flag.flags.join(', ') || '--'}</TableCell>
                                                            <TableCell className="text-[10px] font-bold text-white/20">{flag.activeDisputes}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table></div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* â•â•â• LOGS TAB â•â•â• */}
                    {activeTab === 'logs' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">System Logs</h3>
                                <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                    {filteredAuditLogs.length} ENTRIES
                                </Badge>
                            </div>
                            <div className="border border-white/10 bg-black/20 overflow-x-auto scrollbar-hide">
                                 {auditLoading ? (
                                     <div className="p-12 flex flex-col items-center gap-4"><LoadingSpinner /><p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading audit log...</p></div>
                                 ) : filteredAuditLogs.length === 0 ? (
                                     <div className="p-12 text-center text-white/30 text-[10px] uppercase tracking-widest">No log entries found</div>
                                 ) : (
                                     <div className="w-full overflow-x-auto relative pb-4"><Table className="min-w-[800px]">
                                         <TableHeader className="bg-white/5">
                                             <TableRow className="border-white/5 hover:bg-transparent">
                                                 <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Timestamp</TableHead>
                                                 <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Actor</TableHead>
                                                 <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Action</TableHead>
                                                 <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Target</TableHead>
                                                 <TableHead className="text-white/40 uppercase text-[9px] font-bold tracking-widest h-12">Details</TableHead>
                                             </TableRow>
                                         </TableHeader>
                                         <TableBody>
                                             {filteredAuditLogs.map((log) => (
                                                 <TableRow key={log.id} className="border-white/5 hover:bg-primary/5 transition-all duration-300">
                                                     <TableCell className="text-[10px] font-mono text-white/40">{new Date(log.timestamp).toLocaleString()}</TableCell>
                                                     <TableCell className="text-xs font-bold uppercase tracking-tight">{log.actorId.slice(0, 8)} <span className="text-white/30">({log.actorRole})</span></TableCell>
                                                     <TableCell><Badge variant="outline" className="border-primary/30 text-primary text-[8px] uppercase tracking-widest">{log.action.replace(/_/g, ' ')}</Badge></TableCell>
                                                     <TableCell className="text-[10px] font-mono text-white/40">{log.targetType}/{log.targetId.slice(0, 8)}</TableCell>
                                                     <TableCell className="text-xs text-white/40 max-w-xs truncate">{log.details ?? '--'}</TableCell>
                                                 </TableRow>
                                             ))}
                                         </TableBody>
                                     </Table></div>
                                 )}
                             </div>
                        </div>
                    )}

                    {/* â•â•â• ACTIVITY TAB â•â•â• */}
                    {activeTab === 'activity' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Live Metrics</h3>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="border border-white/10 bg-black/20 p-8 space-y-4">
                                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Exchange Pipeline</p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Total Requests</span><span className="text-lg font-display font-bold">{stats?.totalRequests ?? '--'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Completed</span><span className="text-lg font-display font-bold text-emerald-400">{stats?.completedExchanges ?? '--'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Pending Listings</span><span className="text-lg font-display font-bold text-amber-400">{stats?.pendingListings ?? '--'}</span></div>
                                    </div>
                                </div>
                                <div className="border border-white/10 bg-black/20 p-8 space-y-4">
                                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Trust & Safety</p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Active Disputes</span><span className="text-lg font-display font-bold text-red-400">{stats?.activeDisputes ?? '--'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Total Listings</span><span className="text-lg font-display font-bold">{stats?.totalListings ?? '--'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Verified Users</span><span className="text-lg font-display font-bold text-primary">{stats?.totalUsers ?? '--'}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* Institutional Scanlines - z below cursor (--z-scanline: 80, --z-cursor: 90) */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[var(--z-scanline)] bg-[length:100%_2px,3px_100%]" />

            <AlertDialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
                <AlertDialogContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-display text-2xl font-bold uppercase tracking-widest">
                            {confirmation?.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/50">
                            {confirmation?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-none border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className={`rounded-none font-bold uppercase text-[10px] tracking-widest ${confirmation?.variant === 'destructive' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-primary hover:bg-teal-400 text-black'}`}
                            onClick={() => {
                                confirmation?.onConfirm();
                                setConfirmation(null);
                            }}
                        >
                            {confirmation?.confirmLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Scanlines - z below cursor: --z-scanline: 80, --z-cursor: 90 (ISSUE-12) */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[var(--z-scanline)] bg-[length:100%_2px,3px_100%]" />
        </div >
    );
};

export default AdminPage;
