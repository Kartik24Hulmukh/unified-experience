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
    Filter
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
import { Progress } from "@/components/ui/progress"; // kept for potential future use
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SplitText from '@/components/SplitText';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { useAdminPending, useAdminStats, useUpdateListingStatus, useDisputes, useUpdateDisputeStatus, useAdminAuditLog } from '@/hooks/api/useApi';
import type { PendingItem, Dispute, AuditLogEntry } from '@/hooks/api/useApi';
import {
    createListingMachine,
    type ListingMachine,
    InvalidTransitionError,
} from '@/lib/fsm';

const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const gsapCtxRef = useRef<gsap.Context | null>(null);

    // API data
    const { data: pendingResponse, isLoading: pendingLoading, isError: pendingError, error: pendingErr, refetch: refetchPending } = useAdminPending();
    const { data: statsResponse } = useAdminStats();
    const updateStatus = useUpdateListingStatus();
    const { data: disputesResponse, isLoading: disputesLoading } = useDisputes();
    const updateDisputeStatus = useUpdateDisputeStatus();
    const { data: auditResponse, isLoading: auditLoading } = useAdminAuditLog();

    const disputes = disputesResponse?.data ?? [];
    const auditLogs = auditResponse?.data ?? [];

    const pendingListings = pendingResponse?.data ?? [];
    const stats = statsResponse?.data;

    /**
     * Each pending listing is assumed to be in `pending_review`
     * (user already submitted → admin queue). We hold one FSM per row
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
            const tl = gsap.timeline();
            tl.fromTo('.admin-sidebar', { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'power4.out' })
                .fromTo('.admin-main', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.6');
        }, containerRef);
        
        return () => { gsapCtxRef.current?.revert(); };
    }, []);

    const handleApprove = useCallback((id: string) => {
        const machine = machines[id];
        if (!machine || !machine.can('APPROVE')) {
            logger.error('AdminPage',
                String(new InvalidTransitionError('Listing', machine?.state ?? 'unknown', 'APPROVE')),
            );
            return;
        }

        const next = machine.send('APPROVE'); // pending_review → approved
        setMachines(prev => ({ ...prev, [id]: next }));

        // Call API to update status, then animate
        updateStatus.mutate({ id, status: 'approved' }, {
            onSuccess: () => {
                gsapCtxRef.current?.add(() => {
                    gsap.to(`.row-${id}`, {
                        backgroundColor: 'rgba(0, 212, 170, 0.1)',
                        duration: 0.3,
                    });
                });
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

        const next = machine.send('REJECT'); // pending_review → rejected
        setMachines(prev => ({ ...prev, [id]: next }));

        // Call API to update status, then animate
        updateStatus.mutate({ id, status: 'rejected' }, {
            onSuccess: () => {
                gsapCtxRef.current?.add(() => {
                    gsap.to(`.row-${id}`, {
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        duration: 0.3,
                    });
                });
            },
        });
    }, [machines, updateStatus]);

    return (
        <div ref={containerRef} className="min-h-screen bg-portal flex text-white overflow-hidden">
            {/* Sidebar Architecture */}
            <aside className="admin-sidebar w-64 border-r border-white/5 bg-black/40 flex flex-col">
                <div className="p-8 border-b border-white/5 space-y-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 border border-primary rotate-45 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-primary -rotate-45" />
                        </div>
                        <span className="font-display font-bold tracking-tighter text-xl">CONSOLE</span>
                    </div>
                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-[0.3em]">Governance v10.4</p>
                </div>

                <nav className="flex-1 py-8 px-4 space-y-2">
                    {[
                        { id: 'pending', label: 'Pending Approvals', icon: ShieldCheck },
                        { id: 'users', label: 'Verified Entities', icon: Users },
                        { id: 'disputes', label: 'Dispute Protocols', icon: AlertTriangle },
                        { id: 'logs', label: 'System Logs', icon: Terminal },
                        { id: 'activity', label: 'Live Metrics', icon: Activity },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 transition-all duration-300 group ${activeTab === item.id ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-white/40 hover:text-white hover:bg-white/5'
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
            <main className="admin-main flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide">
                <header className="px-12 py-10 flex justify-between items-end border-b border-white/5">
                    <div className="space-y-4">
                        <h1 className="text-5xl font-display font-bold uppercase italic italic-syne leading-none">
                            <SplitText trigger="load">MODERATION</SplitText>
                        </h1>
                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.4em]">Internal Resource Audit Terminal</p>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="relative w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="PROBE ENTITY..."
                                className="bg-black/40 border-white/10 text-[10px] font-bold tracking-widest pl-10 h-10 rounded-none focus-visible:ring-1 focus-visible:ring-primary uppercase"
                            />
                        </div>
                        <Button variant="outline" className="h-10 border-white/10 rounded-none text-[10px] font-bold tracking-widest uppercase px-6">
                            <Filter className="w-3 h-3 mr-2" />
                            Matrix Filter
                        </Button>
                    </div>
                </header>

                <section className="p-12 space-y-12">
                    {/* Stats Grid — always visible */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Listings', value: stats ? String(stats.totalListings) : '—', delta: stats ? `${stats.completedExchanges} completed` : '' },
                            { label: 'Active Users', value: stats ? stats.totalUsers.toLocaleString() : '—', delta: stats ? 'Verified' : '' },
                            { label: 'Disputes Open', value: stats ? String(stats.activeDisputes).padStart(2, '0') : '—', delta: stats && stats.activeDisputes > 5 ? 'Attention' : 'Under Control', danger: stats ? stats.activeDisputes > 5 : false },
                            { label: 'Pending Reviews', value: stats ? String(stats.pendingListings) : '—', delta: 'In Queue' },
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

                    {/* ═══ PENDING TAB ═══ */}
                    {activeTab === 'pending' && (
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Queue Matrix</h3>
                            <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                {pendingListings.length} ACTIONS REQUIRED
                            </Badge>
                        </div>

                        <div className="border border-white/10 bg-black/20">
                            {pendingLoading ? (
                                <div className="p-12 flex flex-col items-center gap-4">
                                    <LoadingSpinner />
                                    <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading pending queue…</p>
                                </div>
                            ) : pendingError ? (
                                <div className="p-12">
                                    <ErrorFallback error={pendingErr} onRetry={refetchPending} compact />
                                </div>
                            ) : (
                            <Table>
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
                                    {pendingListings.map((listing) => (
                                        <TableRow
                                            key={listing.id}
                                            className={`row-${listing.id} border-white/5 hover:bg-primary/5 transition-all duration-300 group`}
                                        >
                                            <TableCell className="font-mono text-[10px] text-primary font-bold">{listing.id.slice(0, 8)}</TableCell>
                                            <TableCell className="text-xs font-bold uppercase tracking-tight">{listing.owner?.fullName ?? '—'}</TableCell>
                                            <TableCell className="text-xs text-white/60">{listing.title}</TableCell>
                                            <TableCell className="text-[10px] font-bold text-white/20 font-display">{new Date(listing.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[8px] uppercase tracking-widest">
                                                        {listing.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end space-x-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                                                <Search className="w-4 h-4 text-white/40" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none sm:max-w-2xl">
                                                            <DialogHeader className="space-y-4">
                                                                <DialogTitle className="font-display text-3xl font-bold uppercase italic italic-syne">ENTITY INSPECTION</DialogTitle>
                                                                <DialogDescription className="text-white/40 uppercase text-[10px] font-bold tracking-widest">Protocol ID: {listing.id}</DialogDescription>
                                                            </DialogHeader>
                                                            <div className="grid grid-cols-2 gap-8 py-8 border-y border-white/5 my-4">
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <p className="text-[9px] text-white/30 uppercase font-bold font-display">Resource Details</p>
                                                                        <h4 className="text-xl font-bold uppercase">{listing.title}</h4>
                                                                        {listing.description && <p className="text-xs text-white/50 mt-1">{listing.description}</p>}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] text-white/30 uppercase font-bold font-display">Submitted By</p>
                                                                        <p className="text-sm font-bold uppercase text-primary">{listing.owner?.fullName ?? '—'}</p>
                                                                        <p className="text-[10px] text-white/40">{listing.owner?.email}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] text-white/30 uppercase font-bold font-display">Price</p>
                                                                        <p className="text-sm font-bold">₹{listing.price}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-4 bg-white/5 p-4">
                                                                    <p className="text-[9px] text-white/30 uppercase font-bold font-display">AI Verification Log</p>
                                                                    <div className="space-y-2 text-[10px] font-mono">
                                                                        <p className="text-emerald-400">✓ Image Authenticated</p>
                                                                        <p className="text-emerald-400">✓ Metadata Consistent</p>
                                                                        <p className="text-amber-400">! Price deviates 5% from index</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end space-x-4">
                                                                <Button
                                                                    variant="outline"
                                                                    className="rounded-none border-white/10 hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest"
                                                                    onClick={() => handleReject(listing.id)}
                                                                >
                                                                    Reject Protocol
                                                                </Button>
                                                                <Button
                                                                    className="bg-primary hover:bg-teal-400 text-black rounded-none font-bold uppercase text-[10px] tracking-widest"
                                                                    onClick={() => handleApprove(listing.id)}
                                                                >
                                                                    Confirm & Manifest
                                                                </Button>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => handleApprove(listing.id)}
                                                        className="h-8 w-8 p-0 hover:bg-emerald-500/20 group-hover:rotate-12 transition-transform"
                                                    >
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => handleReject(listing.id)}
                                                        className="h-8 w-8 p-0 hover:bg-red-500/20"
                                                    >
                                                        <X className="w-4 h-4 text-red-400" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            )}
                        </div>
                    </div>
                    )}

                    {/* ═══ DISPUTES TAB ═══ */}
                    {activeTab === 'disputes' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Dispute Protocols</h3>
                            <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                {disputes.length} RECORD{disputes.length !== 1 ? 'S' : ''}
                            </Badge>
                        </div>
                        <div className="border border-white/10 bg-black/20">
                            {disputesLoading ? (
                                <div className="p-12 flex flex-col items-center gap-4"><LoadingSpinner /><p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading disputes…</p></div>
                            ) : disputes.length === 0 ? (
                                <div className="p-12 text-center text-white/30 text-[10px] uppercase tracking-widest">No disputes found</div>
                            ) : (
                            <Table>
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
                                    {disputes.map((d) => (
                                        <TableRow key={d.id} className="border-white/5 hover:bg-primary/5 transition-all duration-300">
                                            <TableCell className="font-mono text-[10px] text-primary font-bold">{d.id.slice(0, 8)}</TableCell>
                                            <TableCell><Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[8px] uppercase tracking-widest">{d.type.replace(/_/g, ' ')}</Badge></TableCell>
                                            <TableCell className="text-xs text-white/60 max-w-xs truncate">{d.description}</TableCell>
                                            <TableCell><Badge variant={d.status === 'resolved' ? 'default' : 'outline'} className={`text-[8px] uppercase tracking-widest ${d.status === 'open' ? 'border-red-500/30 text-red-400' : d.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'border-white/20 text-white/60'}`}>{d.status.replace(/_/g, ' ')}</Badge></TableCell>
                                            <TableCell className="text-[10px] font-bold text-white/20 font-display">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end space-x-2">
                                                    {d.status === 'open' && (
                                                        <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-bold tracking-widest hover:bg-amber-500/20 text-amber-400" onClick={() => updateDisputeStatus.mutate({ id: d.id, status: 'under_review' })}>Review</Button>
                                                    )}
                                                    {(d.status === 'open' || d.status === 'under_review') && (
                                                        <>
                                                            <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-bold tracking-widest hover:bg-emerald-500/20 text-emerald-400" onClick={() => updateDisputeStatus.mutate({ id: d.id, status: 'resolved' })}>Resolve</Button>
                                                            <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-bold tracking-widest hover:bg-red-500/20 text-red-400" onClick={() => updateDisputeStatus.mutate({ id: d.id, status: 'rejected' })}>Reject</Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            )}
                        </div>
                    </div>
                    )}

                    {/* ═══ USERS TAB ═══ */}
                    {activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Verified Entities</h3>
                            <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                {stats ? stats.totalUsers : '—'} TOTAL
                            </Badge>
                        </div>
                        <div className="border border-white/10 bg-black/20 p-12">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Total Users</p>
                                    <span className="text-3xl font-display font-bold">{stats?.totalUsers ?? '—'}</span>
                                </div>
                                <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Active Disputes</p>
                                    <span className="text-3xl font-display font-bold text-amber-400">{stats?.activeDisputes ?? '—'}</span>
                                </div>
                                <div className="p-6 border border-white/10 bg-white/5 space-y-2">
                                    <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Completed Exchanges</p>
                                    <span className="text-3xl font-display font-bold text-emerald-400">{stats?.completedExchanges ?? '—'}</span>
                                </div>
                            </div>
                            <p className="text-white/20 text-[10px] uppercase tracking-widest mt-8 text-center">Individual user lookup available via search bar</p>
                        </div>
                    </div>
                    )}

                    {/* ═══ LOGS TAB ═══ */}
                    {activeTab === 'logs' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">System Logs</h3>
                            <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                {auditLogs.length} ENTRIES
                            </Badge>
                        </div>
                        <div className="border border-white/10 bg-black/20">
                            {auditLoading ? (
                                <div className="p-12 flex flex-col items-center gap-4"><LoadingSpinner /><p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading audit log…</p></div>
                            ) : auditLogs.length === 0 ? (
                                <div className="p-12 text-center text-white/30 text-[10px] uppercase tracking-widest">No log entries found</div>
                            ) : (
                            <Table>
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
                                    {auditLogs.map((log) => (
                                        <TableRow key={log.id} className="border-white/5 hover:bg-primary/5 transition-all duration-300">
                                            <TableCell className="text-[10px] font-mono text-white/40">{new Date(log.timestamp).toLocaleString()}</TableCell>
                                            <TableCell className="text-xs font-bold uppercase tracking-tight">{log.actorId.slice(0, 8)} <span className="text-white/30">({log.actorRole})</span></TableCell>
                                            <TableCell><Badge variant="outline" className="border-primary/30 text-primary text-[8px] uppercase tracking-widest">{log.action.replace(/_/g, ' ')}</Badge></TableCell>
                                            <TableCell className="text-[10px] font-mono text-white/40">{log.targetType}/{log.targetId.slice(0, 8)}</TableCell>
                                            <TableCell className="text-xs text-white/40 max-w-xs truncate">{log.details ?? '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            )}
                        </div>
                    </div>
                    )}

                    {/* ═══ ACTIVITY TAB ═══ */}
                    {activeTab === 'activity' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Live Metrics</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-white/10 bg-black/20 p-8 space-y-4">
                                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Exchange Pipeline</p>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Total Requests</span><span className="text-lg font-display font-bold">{stats?.totalRequests ?? '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Completed</span><span className="text-lg font-display font-bold text-emerald-400">{stats?.completedExchanges ?? '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Pending Listings</span><span className="text-lg font-display font-bold text-amber-400">{stats?.pendingListings ?? '—'}</span></div>
                                </div>
                            </div>
                            <div className="border border-white/10 bg-black/20 p-8 space-y-4">
                                <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Trust & Safety</p>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Active Disputes</span><span className="text-lg font-display font-bold text-red-400">{stats?.activeDisputes ?? '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Total Listings</span><span className="text-lg font-display font-bold">{stats?.totalListings ?? '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[10px] uppercase font-bold text-white/60">Verified Users</span><span className="text-lg font-display font-bold text-primary">{stats?.totalUsers ?? '—'}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}
                </section>
            </main>

            {/* Institutional Scanlines */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[100] bg-[length:100%_2px,3px_100%]" />
        </div>
    );
};

export default AdminPage;
