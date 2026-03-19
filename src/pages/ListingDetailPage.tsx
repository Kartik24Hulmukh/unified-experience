import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowLeft, Shield, Clock, Tag, MapPin, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useListing, useCreateRequest } from '@/hooks/api/useApi';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRestriction } from '@/hooks/useRestriction';

const ListingDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);

    const { data: listingResponse, isLoading, isError, error, refetch } = useListing(id ?? '');
    const createRequest = useCreateRequest();
    const { isAuthenticated } = useAuth();
    const { canPerform } = useRestriction();
    const canRequestExchange = canPerform('REQUEST_EXCHANGE');

    const [message, setMessage] = useState('');
    const [requestSent, setRequestSent] = useState(false);

    // MED-UNMOUNT FIX: track mount state so mutation callbacks don't fire
    // setState/toast on an unmounted component after user navigates away.
    const mountedRef = useRef(true);
    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

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
        if (!isAuthenticated) {
            toast({ title: 'Sign In Required', description: 'Please sign in to request an exchange.', variant: 'destructive' });
            return;
        }
        if (!canRequestExchange) {
            toast({ title: 'Action Restricted', description: 'Your account is restricted from requesting exchanges. Verify your college email to unlock this feature.', variant: 'destructive' });
            return;
        }
        createRequest.mutate(
            { listingId: id, message: message || undefined },
            {
                onSuccess: () => {
                    if (!mountedRef.current) return;
                    setRequestSent(true);
                    toast({
                        title: 'Request Sent',
                        description: 'Your exchange request has been sent to the seller.',
                    });
                },
                onError: (err) => {
                    if (!mountedRef.current) return;
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
            <div className="min-h-[100dvh] bg-portal flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (isError || !listing) {
        return (
            <div className="min-h-[100dvh] bg-portal flex items-center justify-center p-8">
                <ErrorFallback error={error} onRetry={refetch} />
            </div>
        );
    }

    // NEW-BUG-07 FIX: DB returns uppercase statuses ('APPROVED', 'PENDING_REVIEW');
    // normalise once here so all comparisons below use consistent lowercase keys.
    const statusKey = (listing.status ?? '').toLowerCase();
    const statusColor: Record<string, string> = {
        approved: 'border-emerald-500/30 text-emerald-400',
        pending_review: 'border-amber-500/30 text-amber-400',
        rejected: 'border-red-500/30 text-red-400',
        draft: 'border-white/20 text-white/40',
    };

    return (
        <div ref={containerRef} className="min-h-[100dvh] bg-portal text-white">
            {/* Header */}
            <header className="border-b border-white/5 px-4 pt-24 pb-6 sm:px-8 md:px-16 md:pt-28 md:pb-8">
                <Button
                    variant="ghost"
                    onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/resale')}
                    className="text-white/40 hover:text-white uppercase text-[10px] font-bold tracking-widest -ml-2"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
            </header>

            {/* Detail Content */}
            <div className="detail-content max-w-4xl mx-auto px-4 py-10 sm:px-8 md:px-16 md:py-12 space-y-10">
                {/* Title + Status */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className={`text-[8px] uppercase tracking-widest ${statusColor[statusKey] ?? 'border-white/20 text-white/40'}`}>
                            {statusKey.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="border-primary/30 text-primary text-[8px] uppercase tracking-widest">
                            {listing.module}
                        </Badge>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-display font-bold uppercase italic leading-tight break-words whitespace-normal">
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

                {/* Visual Section: Carousel & Map (Accommodation Specific) */}
                {listing.module === 'accommodation' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Image Carousel Mockup (Unified Style) */}
                        <div className="space-y-4">
                            <h3 className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Property Visuals</h3>
                            <div className="aspect-square border border-white/10 bg-black/40 relative group overflow-hidden">
                                <div className="absolute inset-0 z-0">
                                    <img 
                                        src="/logo.png" 
                                        className="w-full h-full object-cover grayscale opacity-20 scale-105 group-hover:scale-110 transition-transform duration-1000" 
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                                </div>

                                {/* Mock Carousel Controls */}
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none border border-white/10 bg-black/60 backdrop-blur-md text-white hover:bg-white hover:text-black">
                                        <ArrowLeft className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none border border-white/10 bg-black/60 backdrop-blur-md text-white hover:bg-white hover:text-black rotate-180">
                                        <ArrowLeft className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Indicators */}
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className={`w-8 h-0.5 ${i === 1 ? 'bg-primary' : 'bg-white/20'}`} />
                                    ))}
                                </div>

                                <div className="absolute top-6 left-6 z-10">
                                     <div className="px-3 py-1 bg-primary text-black text-[8px] font-bold uppercase tracking-[0.2em]">
                                        01 of 03
                                     </div>
                                </div>
                            </div>
                        </div>

                        {/* Location Map (Responsive Iframe) */}
                        <div className="space-y-4">
                            <h3 className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Location Protocol</h3>
                            <div className="aspect-square border border-white/10 bg-black/40 overflow-hidden relative">
                                <iframe 
                                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15077.53123456789!2d72.8532!3d19.176!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDEwJzMzLjYiTiA3MsKwNTEnMTEuNSJF!5e0!3m2!1sen!2sin!4v1634567890123!5m2!1sen!2sin"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0, filter: 'grayscale(1) invert(0.9) brightness(0.8)' }}
                                    allowFullScreen
                                    loading="lazy"
                                />
                                {/* Scanneline Effect Overlay */}
                                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,191,255,0.03)_1px,transparent_1px)] bg-[length:100%_4px]" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Amenities Matrix (Accommodation Specific) */}
                {listing.module === 'accommodation' && (
                    <div className="space-y-4">
                        <h3 className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Amenities Matrix</h3>
                        <div className="flex flex-wrap gap-3">
                            {['High-Speed WiFi', 'AC Units', 'Secure Parking', 'Laundry Services', '24-7 Security', 'Home Meals', 'Campus Shuttle'].map((item) => (
                                <div key={item} className="px-4 py-3 border border-white/10 bg-black/20 text-[10px] uppercase font-bold tracking-widest flex items-center gap-3 group hover:border-primary/50 transition-colors">
                                    <div className="w-1.5 h-1.5 bg-primary group-hover:scale-150 transition-transform" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Download Button (Academics Specific) */}
                {listing.module === 'academics' && (
                    <div className="p-8 border border-white/10 bg-black/20 space-y-6">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest">Resource Access</h3>
                        </div>
                        <p className="text-white/50 text-xs leading-relaxed">
                            This academic resource has been verified by the MCTRGIT administration. Verification ensures it follows official curriculum standards.
                        </p>
                        <Button 
                            className="w-full bg-white text-black hover:bg-white/90 rounded-none font-bold uppercase text-[10px] tracking-[0.2em] h-12"
                            onClick={() => toast({ title: "Initializing Secure Download", description: "Resource buffer loading..." })}
                        >
                            Download Encrypted Protocol (.PDF)
                        </Button>
                    </div>
                )}

                {/* Description */}
                {listing.description && (
                    <div className="p-8 border border-white/10 bg-black/20 space-y-3">
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Description</p>
                        <p className="text-white/70 leading-relaxed">{listing.description}</p>
                    </div>
                )}

                {/* Institution — single-campus app, always MCTRGIT */}
                <div className="flex items-center gap-3 text-white/40">
                    <MapPin className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">MCTRGIT</span>
                </div>

                {/* Request Exchange or Contact Service — only show for approved listings */}
                {statusKey === 'approved' && (
                    <div className="p-8 border border-primary/20 bg-primary/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-display font-bold uppercase tracking-widest">
                                {(listing.module === 'mess' || listing.module === 'hospital') ? 'Contact Service' : 'Request Exchange'}
                            </h3>
                        </div>

                        {(listing.module === 'mess' || listing.module === 'hospital') && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <Button 
                                    className="h-12 bg-white text-black hover:bg-white/90 rounded-none font-bold uppercase text-[10px] tracking-widest"
                                    onClick={() => window.open(`tel:+919876543210`, '_self')}
                                >
                                    <Phone className="w-4 h-4 mr-2" />
                                    Call Provider
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="h-12 border-white/10 bg-black/40 hover:bg-black/60 rounded-none text-white font-bold uppercase text-[10px] tracking-widest"
                                    onClick={() => window.open(`https://wa.me/919876543210`, '_blank')}
                                >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    WhatsApp
                                </Button>
                            </div>
                        )}

                        {(listing.module === 'resale' || listing.module === 'accommodation') && (
                            <>
                                {!isAuthenticated ? (
                                    <div className="text-center py-6 space-y-4">
                                        <p className="text-white/50 uppercase text-sm font-bold tracking-widest">Sign in to request an exchange</p>
                                        <p className="text-white/30 text-xs">Only verified RGIT students can request exchanges.</p>
                                        <Link to="/login" className="inline-block px-8 py-3 bg-primary text-black font-bold uppercase text-[10px] tracking-widest hover:bg-teal-400 transition-colors">
                                            Sign In →
                                        </Link>
                                    </div>
                                ) : !canRequestExchange ? (
                                    <div className="text-center py-6 space-y-2">
                                        <Shield className="w-8 h-8 text-amber-400/60 mx-auto" />
                                        <p className="text-amber-400/80 text-sm uppercase font-bold tracking-widest">Access Restricted</p>
                                        <p className="text-white/30 text-xs">Verify your college email to unlock exchange requests.</p>
                                        <Link to="/profile" className="inline-block mt-2 text-primary text-[10px] uppercase font-bold tracking-widest hover:underline">
                                            Verify Email →
                                        </Link>
                                    </div>
                                ) : requestSent ? (
                                    <div className="text-center py-6 space-y-2">
                                        <div className="w-12 h-12 mx-auto border-2 border-emerald-400 rotate-45 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-emerald-400 -rotate-45" />
                                        </div>
                                        <p className="text-emerald-400 font-bold uppercase text-sm tracking-widest">Request Sent Successfully</p>
                                        <p className="text-white/40 text-xs">The seller will review your request and get back to you.</p>
                                        <Link to={`/${listing.module}`} className="inline-block mt-4 text-primary text-[10px] uppercase font-bold tracking-widest hover:underline">
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
                            </>
                        )}
                    </div>
                )}

                {/* Non-approved listing status message */}
                {statusKey !== 'approved' && (
                    <div className="p-8 border border-white/10 bg-black/20 space-y-3 text-center">
                        <Shield className="w-8 h-8 text-white/20 mx-auto" />
                        <p className="text-white/40 text-sm uppercase font-bold tracking-widest">
                            {statusKey === 'interest_received'
                                ? 'This listing is under consideration by another buyer. Check back — it becomes available if their request is declined.'
                                : statusKey === 'in_transaction'
                                    ? 'This listing is in an active exchange and temporarily unavailable. Check back if the exchange is cancelled.'
                                    : statusKey === 'pending_review'
                                        ? 'This listing is pending admin review and is not yet available for exchange.'
                                        : statusKey === 'rejected'
                                            ? 'This listing has been rejected and is no longer available.'
                                            : 'This listing is currently unavailable for exchange.'}
                        </p>
                        <Link to="/resale" className="inline-block mt-2 text-primary text-[10px] uppercase font-bold tracking-widest hover:underline">
                            ← Browse Available Listings
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ListingDetailPage;
