import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { X } from 'lucide-react';

interface ListingFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const ListingFormModal = ({ isOpen, onClose, title, children }: ListingFormModalProps) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const gsapCtxRef = useRef<gsap.Context | null>(null);

    // Initialize gsap.context once for lifecycle cleanup
    useEffect(() => {
        const origOverflow = document.body.style.overflow;
        gsapCtxRef.current = gsap.context(() => {});
        return () => {
            gsapCtxRef.current?.revert();
            document.body.style.overflow = origOverflow;
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            gsapCtxRef.current?.add(() => {
                const tl = gsap.timeline();

                // Liquid reveal animation
                tl.set(overlayRef.current, { visibility: 'visible' })
                    .fromTo(
                        portalRef.current,
                        { clipPath: 'circle(0% at 50% 50%)', opacity: 1 },
                        {
                            clipPath: 'circle(150% at 50% 50%)',
                            duration: 1.2,
                            ease: 'power4.inOut'
                        }
                    )
                    .fromTo(
                        contentRef.current,
                        { opacity: 0, y: 50 },
                        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
                        '-=0.4'
                    );
            });
        } else {
            document.body.style.overflow = 'unset';
            if (overlayRef.current) {
                gsapCtxRef.current?.add(() => {
                    gsap.to(portalRef.current, {
                        clipPath: 'circle(0% at 50% 50%)',
                        duration: 0.8,
                        ease: 'power3.inOut',
                        onComplete: () => {
                            gsap.set(overlayRef.current, { visibility: 'hidden' });
                        }
                    });
                });
            }
        }
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100] invisible flex items-center justify-center p-4 md:p-8"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                ref={portalRef}
                className="absolute inset-0 bg-black"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            />

            <div
                ref={contentRef}
                className="relative w-full max-w-6xl h-full max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-none shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
                {/* Header - Mobile Only */}
                <div className="flex md:hidden items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-white font-display text-xl uppercase font-bold tracking-tight">{title}</h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors" aria-label="Close dialog">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-8 md:p-12">
                    {children}
                </div>

                {/* Close Button - Desktop */}
                <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="hidden md:flex absolute top-8 right-8 text-white/30 hover:text-white transition-all duration-300 hover:rotate-90 z-10"
                >
                    <X className="w-8 h-8" />
                </button>
            </div>
        </div>
    );
};

export default ListingFormModal;
