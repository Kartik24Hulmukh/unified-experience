import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import gsap from 'gsap';
import { AlertTriangle, ArrowLeft, Shield, Clock, Tag, MapPin, User, MessageSquare, Edit2, Trash2, Phone, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useListing, useCreateRequest, useUpdateListing, useDeleteListing } from '@/hooks/api/useApi';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRestriction } from '@/hooks/useRestriction';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
    const canRequestContact = canPerform('REQUEST_CONTACT');

    const [message, setMessage] = useState('');
    const [requestSent, setRequestSent] = useState(false);

    // Edit/Delete state
    const { user } = useAuth();
    const isOwner = user?.id && listingResponse?.data?.owner?.id === user.id;
    const updateListing = useUpdateListing();
    const deleteListing = useDeleteListing();
    
    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({ title: '', price: '', category: '', description: '' });

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
            <header className="border-b border-white/5 px-4 pt-24 pb-6 sm:px-8 md:px-16 md:pt-28 md:pb-8 flex justify-between items-center">
                <Button
                    variant="ghost"
                    onClick={() => window.history.length > 1 ? navigate(-1) : navigate(`/${listing.module}`)}
                    className="text-white/40 hover:text-white uppercase text-[10px] font-bold tracking-widest -ml-2"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>

                {isOwner && (
                    <div className="flex gap-4">
                        <Button 
                            variant="outline" 
                            className="bg-black/40 border-primary/30 text-primary hover:bg-primary/10 tracking-widest uppercase text-[10px]"
                            onClick={() => {
                                setEditFormData({
                                    title: listing.title,
                                    price: listing.price,
                                    category: listing.category,
                                    description: listing.description || ''
                                });
                                setIsEditModalOpen(true);
                            }}
                        >
                            <Edit2 className="w-3.5 h-3.5 mr-2" />
                            Edit
                        </Button>
                        <Button 
                            variant="destructive"
                            className="tracking-widest uppercase text-[10px]"
                            onClick={() => setIsDeleteModalOpen(true)}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                        </Button>
                    </div>
                )}
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

                {/* Visual Section: Carousel & Map */}
                {(listing.module === 'accommodation' || listing.module === 'resale') && (
                    <div className={`grid grid-cols-1 ${listing.module === 'accommodation' ? 'md:grid-cols-2' : ''} gap-10`}>
                        {/* Image Carousel Mockup (Unified Style) */}
                        <div className="space-y-4">
                            <h3 className="text-white/40 uppercase tracking-widest text-[9px] font-bold">
                                {listing.module === 'accommodation' ? 'Property Visuals' : 'Item Visuals'}
                            </h3>
                            <div className="aspect-video sm:aspect-square border border-white/10 bg-black/40 relative group overflow-hidden">
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

                        {/* Location Map (Responsive Iframe) - Only for Accommodation */}
                        {listing.module === 'accommodation' && (
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
                        )}
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
                                {(listing.module === 'mess' || listing.module === 'hospital' || listing.module === 'accommodation') ? 'Contact Owner' : listing.module === 'academics' ? 'Resource Access' : 'Request Exchange'}
                            </h3>
                        </div>

                        {!isAuthenticated ? (
                            <div className="text-center py-6 space-y-4">
                                <p className="text-white/50 uppercase text-sm font-bold tracking-widest font-display">Sign in to contact</p>
                                <p className="text-white/30 text-xs">Only verified RGIT students can access contact details.</p>
                                <Link to="/login" className="inline-block px-8 py-3 bg-primary text-black font-bold uppercase text-[10px] tracking-widest hover:bg-teal-400 transition-colors">
                                    Sign In →
                                </Link>
                            </div>
                        ) : !canRequestContact ? (
                            <div className="text-center py-6 space-y-2">
                                <Shield className="w-8 h-8 text-amber-400/60 mx-auto animate-pulse" />
                                <p className="text-amber-400/80 text-sm uppercase font-bold tracking-widest font-display">Access Restricted</p>
                                <p className="text-white/30 text-xs">Verify your college email to unlock contact details.</p>
                                <Link to="/profile" className="inline-block mt-2 text-primary text-[10px] uppercase font-bold tracking-widest hover:underline">
                                    Verify Email →
                                </Link>
                            </div>
                        ) : (
                            <>
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

                                {listing.module === 'accommodation' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <Button 
                                            className="h-12 bg-white text-black hover:bg-white/90 rounded-none font-bold uppercase text-[10px] tracking-widest"
                                            onClick={() => window.open(`tel:+919876543210`, '_self')}
                                        >
                                            <Phone className="w-4 h-4 mr-2" />
                                            Contact Owner
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            className="h-12 border-white/10 bg-black/40 hover:bg-black/60 rounded-none text-white font-bold uppercase text-[10px] tracking-widest"
                                            onClick={() => toast({ title: "Viewing Requested", description: "The owner will contact you shortly."})}
                                        >
                                            <Clock className="w-4 h-4 mr-2" />
                                            Book Viewing
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}

                        {listing.module === 'resale' && (
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
                        
                        {listing.module === 'academics' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <Button 
                                    className="h-12 bg-white text-black hover:bg-white/90 rounded-none font-bold uppercase text-[10px] tracking-widest"
                                    onClick={() => {
                                        toast({ title: "Downloading...", description: "Resource download started."});
                                    }}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Resource
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="h-12 border-white/10 bg-black/40 hover:bg-black/60 rounded-none text-white font-bold uppercase text-[10px] tracking-widest"
                                    onClick={() => {
                                        toast({ title: "Preview Available", description: "Resource preview opened in new tab."});
                                        window.open('#', '_blank');
                                    }}
                                >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview Document
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="bg-portal border-white/10 text-white sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display font-bold uppercase italic tracking-widest text-primary">Edit Listing</DialogTitle>
                        <DialogDescription className="text-white/40">Update the details of your listing below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Title</label>
                            <Input 
                                value={editFormData.title} 
                                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} 
                                className="bg-black/40 border-white/10 rounded-none focus-visible:ring-1 focus-visible:ring-primary h-12"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Price</label>
                                <Input 
                                    type="number"
                                    value={editFormData.price} 
                                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })} 
                                    className="bg-black/40 border-white/10 rounded-none focus-visible:ring-1 focus-visible:ring-primary h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Category</label>
                                <Input 
                                    value={editFormData.category} 
                                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })} 
                                    className="bg-black/40 border-white/10 rounded-none focus-visible:ring-1 focus-visible:ring-primary h-12"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Description</label>
                            <textarea 
                                value={editFormData.description} 
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} 
                                className="w-full bg-black/40 border border-white/10 text-sm rounded-none focus-visible:ring-1 focus-visible:ring-primary p-3 min-h-[100px] text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="ghost" className="text-white/50 hover:text-white rounded-none uppercase text-[10px] tracking-widest font-bold" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button 
                            className="bg-primary text-black hover:bg-teal-400 rounded-none uppercase text-[10px] tracking-widest font-bold"
                            disabled={updateListing.isPending}
                            onClick={() => {
                                updateListing.mutate(
                                    { id: listing.id, data: { ...editFormData, price: parseFloat(editFormData.price || '0') } as unknown },
                                    {
                                        onSuccess: () => {
                                            toast({ title: 'Listing updated.', description: 'Your listing has been updated successfully.' });
                                            setIsEditModalOpen(false);
                                        },
                                        onError: () => toast({ title: 'Error', description: 'Failed to update listing.', variant: 'destructive' })
                                    }
                                );
                            }}
                        >
                            {updateListing.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <AlertDialogContent className="bg-portal border-red-500/20 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-400 font-display text-2xl uppercase tracking-widest italic">
                            <AlertTriangle className="w-6 h-6" /> Delete Listing?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">
                            This action cannot be undone. This will permanently remove your listing and cancel any active exchange requests.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="bg-transparent text-white hover:bg-white/10 border-white/20 rounded-none uppercase text-[10px] tracking-widest font-bold h-10">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-none uppercase text-[10px] tracking-widest font-bold h-10"
                            onClick={(e) => {
                                e.preventDefault();
                                deleteListing.mutate({ id: listing.id }, {
                                    onSuccess: () => {
                                        toast({ title: 'Listing deleted' });
                                        setIsDeleteModalOpen(false);
                                        navigate(`/${listing.module}`);
                                    },
                                    onError: () => toast({ title: 'Error', description: 'Could not delete listing.', variant: 'destructive' })
                                });
                            }}
                        >
                            {deleteListing.isPending ? 'Deleting...' : 'Yes, Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ListingDetailPage;
