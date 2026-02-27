import { useState, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowLeft, Shield, Clock, Tag, MapPin, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useListing, useCreateRequest } from '@/hooks/api/useApi';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { useToast } from '@/hooks/use-toast';

const ListingDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);

    const { data: listingResponse, isLoading, isError, error, refetch } = useListing(id ?? '');
    const createRequest = useCreateRequest();

    const [message, setMessage] = useState('');
    const [requestSent, setRequestSent] = useState(false);

    const listing = listingResponse?.data;

    useLayoutEffect(() => {
        if (!containerRef.current || !listing) return;
        const ctx = gsap.context(() => {
            // Explicit initial state prevents FOUC on Strict Mode double-invocation
            gsap.set('.detail-content', { y: 30, opacity: 0 });
            gsap.to('.detail-content', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 });
        }, containerRef);
        return () => ctx.revert();
    }, [listing]);

    const handleRequestExchange = () => {
        if (!id || createRequest.isPending || requestSent) return;
        createRequest.mutate(
            { listingId: id, message: message || undefined },
            {
                onSuccess: () => {
                    setRequestSent(true);
                    toast({
                        title: 'Request Sent',
                        description: 'Your exchange request has been sent to the seller.',
                    });
                },
                onError: (err) => {
                    toast({
                        title: 'Request Failed',
                        description: err.message || 'Could not send exchange request.',
                        variant: 'destructive',
                    });
                },
            },
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-portal flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (isError || !listing) {
        return (
            <div className="min-h-screen bg-portal flex items-center justify-center p-8">
                <ErrorFallback error={error} onRetry={refetch} />
            </div>
        );
    }

    const statusColor: Record<string, string> = {
        approved: 'border-emerald-500/30 text-emerald-400',
        pending_review: 'border-amber-500/30 text-amber-400',
        rejected: 'border-red-500/30 text-red-400',
        draft: 'border-white/20 text-white/40',
    };

    return (
        <div ref={containerRef} className="min-h-screen bg-portal text-white">
            {/* Header */}
            <header className="px-8 md:px-16 py-8 border-b border-white/5">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="text-white/40 hover:text-white uppercase text-[10px] font-bold tracking-widest -ml-2"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
            </header>

            {/* Detail Content */}
            <div className="detail-content max-w-4xl mx-auto px-8 md:px-16 py-12 space-y-10">
                {/* Title + Status */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className={`text-[8px] uppercase tracking-widest ${statusColor[listing.status] ?? 'border-white/20 text-white/40'}`}>
                            {listing.status.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="border-primary/30 text-primary text-[8px] uppercase tracking-widest">
                            {listing.module}
                        </Badge>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-display font-bold uppercase italic leading-tight">
                        {listing.title}
                    </h1>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 border border-white/10 bg-black/20 space-y-2">
                        <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-primary" />
                            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Price</p>
                        </div>
                        <span className="text-3xl font-display font-bold text-primary">₹{listing.price}</span>
                    </div>
                    <div className="p-6 border border-white/10 bg-black/20 space-y-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-white/40" />
                            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Category</p>
                        </div>
                        <span className="text-lg font-bold uppercase">{listing.category}</span>
                    </div>
                    <div className="p-6 border border-white/10 bg-black/20 space-y-2">
                        <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-white/40" />
                            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Listed</p>
                        </div>
                        <span className="text-lg font-bold">{new Date(listing.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                {/* Description */}
                {listing.description && (
                    <div className="p-8 border border-white/10 bg-black/20 space-y-3">
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Description</p>
                        <p className="text-white/70 leading-relaxed">{listing.description}</p>
                    </div>
                )}

                {/* Institution */}
                <div className="flex items-center gap-3 text-white/40">
                    <MapPin className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">{listing.institution}</span>
                </div>

                {/* Request Exchange */}
                {listing.status === 'approved' && (
                    <div className="p-8 border border-primary/20 bg-primary/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest">Request Exchange</h3>
                        </div>

                        {requestSent ? (
                            <div className="text-center py-6 space-y-2">
                                <div className="w-12 h-12 mx-auto border-2 border-emerald-400 rotate-45 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-emerald-400 -rotate-45" />
                                </div>
                                <p className="text-emerald-400 font-bold uppercase text-sm tracking-widest">Request Sent Successfully</p>
                                <p className="text-white/40 text-xs">The seller will review your request and get back to you.</p>
                                {/* UX-09: /profile had no requests section — link to /resale to continue browsing */}
                                <Link to="/resale" className="inline-block mt-4 text-primary text-[10px] uppercase font-bold tracking-widest hover:underline">
                                    ← Back to Listings
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[9px] text-white/30 uppercase font-bold tracking-widest flex items-center gap-2">
                                        <MessageSquare className="w-3 h-3" />
                                        Message (optional)
                                    </label>
                                    <Input
                                        placeholder="Hi, I'm interested in this item..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="bg-black/40 border-white/10 text-sm rounded-none focus-visible:ring-1 focus-visible:ring-primary"
                                    />
                                </div>
                                <Button
                                    onClick={handleRequestExchange}
                                    disabled={createRequest.isPending}
                                    className="w-full bg-primary hover:bg-teal-400 text-black rounded-none font-bold uppercase text-[10px] tracking-widest h-12"
                                >
                                    {createRequest.isPending ? 'Sending...' : 'Send Exchange Request'}
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ListingDetailPage;
