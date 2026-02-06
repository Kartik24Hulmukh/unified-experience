import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
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
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SplitText from '@/components/SplitText';

const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Mock Data for Admin
    const [pendingListings, setPendingListings] = useState([
        { id: 'L-901', user: 'Kadam (B-22)', item: 'Calculus: Early Trans.', date: '2026-02-04', status: 65 },
        { id: 'L-902', user: 'Sharma (M-11)', item: 'Scientific Calculator', date: '2026-02-05', status: 40 },
        { id: 'L-903', user: 'Mehta (E-08)', item: '1BHK Near Gate 2', date: '2026-02-05', status: 10 },
    ]);

    useEffect(() => {
        // Reveal sidebar and table
        const tl = gsap.timeline();
        tl.fromTo('.admin-sidebar', { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'power4.out' })
            .fromTo('.admin-main', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.6');
    }, []);

    const handleApprove = (id: string) => {
        // Portal confirmation simulation
        gsap.to(`.row-${id}`, {
            backgroundColor: 'rgba(0, 212, 170, 0.1)',
            duration: 0.3,
            onComplete: () => {
                setPendingListings(prev => prev.filter(l => l.id !== id));
            }
        });
    };

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
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Listings', value: '452', delta: '+12%' },
                            { label: 'Active Users', value: '1,280', delta: '+5%' },
                            { label: 'Disputes Open', value: '03', delta: '-50%', danger: true },
                            { label: 'Avg Approval', value: '2.4hr', delta: 'Optimized' },
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

                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">Queue Matrix</h3>
                            <Badge variant="outline" className="border-white/10 text-[9px] font-bold tracking-widest px-4 py-1">
                                {pendingListings.length} ACTIONS REQUIRED
                            </Badge>
                        </div>

                        <div className="border border-white/10 bg-black/20">
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
                                            <TableCell className="font-mono text-[10px] text-primary font-bold">{listing.id}</TableCell>
                                            <TableCell className="text-xs font-bold uppercase tracking-tight">{listing.user}</TableCell>
                                            <TableCell className="text-xs text-white/60">{listing.item}</TableCell>
                                            <TableCell className="text-[10px] font-bold text-white/20 font-display">{listing.date}</TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <Progress value={listing.status} className="h-1 bg-white/5" />
                                                    <p className="text-[8px] uppercase font-bold text-white/30">{listing.status}% AUDITED</p>
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
                                                                        <h4 className="text-xl font-bold uppercase">{listing.item}</h4>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] text-white/30 uppercase font-bold font-display">Submitted By</p>
                                                                        <p className="text-sm font-bold uppercase text-primary">{listing.user}</p>
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
                                                                <Button variant="outline" className="rounded-none border-white/10 hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest">Reject Protocol</Button>
                                                                <Button className="bg-primary hover:bg-teal-400 text-black rounded-none font-bold uppercase text-[10px] tracking-widest">Confirm & Manifest</Button>
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
                                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-red-500/20">
                                                        <X className="w-4 h-4 text-red-400" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </section>
            </main>

            {/* Institutional Scanlines */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[100] bg-[length:100%_2px,3px_100%]" />
        </div>
    );
};

export default AdminPage;
