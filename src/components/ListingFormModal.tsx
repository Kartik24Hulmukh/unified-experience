import { useRef, useEffect, useId } from 'react';
import gsap from 'gsap';
import { X } from 'lucide-react';

interface ListingFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const ListingFormModal = ({ isOpen, onClose, title, children }: ListingFormModalProps) => {
    const titleId = useId();
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
        }
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100] invisible flex items-end justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:items-center md:p-8"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            aria-labelledby={titleId}
        >
            <div
                ref={portalRef}
                className="absolute inset-0 bg-black"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            />

            <div
                ref={contentRef}
                className="relative flex w-full max-w-6xl max-h-[min(90dvh,calc(100dvh-1rem))] flex-col overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-2xl md:max-h-[85dvh] md:flex-row"
            >
                <h2 id={titleId} className="sr-only">{title}</h2>
                {/* Header - Mobile Only */}
                <div className="flex md:hidden items-center justify-between p-4 border-b border-white/5">
                    <h2 aria-hidden="true" className="text-white font-display text-lg uppercase font-bold tracking-tight">{title}</h2>
                    {/* tap-target ensures the close button is at least 48×48 px on touch devices */}
                    <button
                        onClick={onClose}
                        className="tap-target text-white/50 hover:text-white transition-colors"
                        aria-label="Close dialog"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Content — reduced padding on mobile so the form
                     doesn't get pushed offscreen when the virtual keyboard opens */}
                <div className="touch-scroll-y min-h-0 flex-1 overflow-y-auto scrollbar-hide p-4 sm:p-8 md:p-12">
                    {children}
                </div>

                {/* Close Button - Desktop */}
                <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="tap-target absolute right-6 top-6 z-10 hidden text-white/30 transition-all duration-300 hover:rotate-90 hover:text-white md:flex"
                >
                    <X className="w-8 h-8" />
                </button>
            </div>
        </div>
    );
};

export default ListingFormModal;
