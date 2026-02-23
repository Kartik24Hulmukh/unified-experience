import { useRef, useLayoutEffect, memo } from 'react';
import gsap from 'gsap';
import { Shield, Sparkles } from 'lucide-react';

interface LivePreviewCardProps {
    data: {
        title: string;
        price: string;
        category: string;
        description: string;
        image: string | null;
    };
}

const LivePreviewCard = memo(function LivePreviewCard({ data }: LivePreviewCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    // useLayoutEffect for GSAP-based tilt effect
    useLayoutEffect(() => {
        if (!cardRef.current) return;

        const card = cardRef.current;
        const ctx = gsap.context(() => {}, card);

        // Tilt effect on mouse move
        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            const { left, top, width, height } = card.getBoundingClientRect();
            const x = (clientX - left) / width - 0.5;
            const y = (clientY - top) / height - 0.5;

            ctx.add(() => {
                gsap.to(card, {
                    rotateY: x * 15,
                    rotateX: -y * 15,
                    transformPerspective: 1000,
                    duration: 0.5,
                    overwrite: true,
                });
            });
        };

        const handleMouseLeave = () => {
            ctx.add(() => {
                gsap.to(card, {
                    rotateY: 0,
                    rotateX: 0,
                    duration: 0.5,
                    overwrite: true,
                });
            });
        };

        // Scope mousemove to the card only (not entire window)
        card.addEventListener('mousemove', handleMouseMove);
        card.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            card.removeEventListener('mousemove', handleMouseMove);
            card.removeEventListener('mouseleave', handleMouseLeave);
            ctx.revert();
        };
    }, []);

    return (
        <div className="w-full max-w-sm sticky top-0">
            <div className="mb-6 space-y-2">
                <div className="flex items-center space-x-2 text-primary/60">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Real-time Manifestation</span>
                </div>
                <h4 className="text-white/40 text-xs uppercase tracking-widest font-bold font-display">Listing Preview</h4>
            </div>

            <div
                ref={cardRef}
                className="group relative h-[450px] w-full bg-black border border-white/10 overflow-hidden transform-gpu"
            >
                {/* Card Image Wrapper */}
                <div className="relative h-2/3 bg-white/5 overflow-hidden">
                    {data.image ? (
                        <img
                            src={data.image}
                            alt="Preview"
                            className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center space-y-4 opacity-20">
                            <div className="w-16 h-16 border border-white/30 rotate-45 flex items-center justify-center">
                                <div className="w-6 h-6 bg-white/30" />
                            </div>
                            <span className="text-[10px] uppercase tracking-widest">Media Pending</span>
                        </div>
                    )}

                    <div className="absolute top-4 right-4 px-3 py-1 bg-primary text-black text-[10px] font-bold uppercase tracking-widest">
                        {data.category || 'Category'}
                    </div>
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                        <h3 className="text-white font-display text-2xl font-bold uppercase truncate pr-4">
                            {data.title || 'Product Title'}
                        </h3>
                        <span className="text-primary font-display text-xl font-bold">
                            {data.price ? `₹${data.price}` : '₹00'}
                        </span>
                    </div>

                    <p className="text-white/40 text-[11px] font-body line-clamp-3 leading-relaxed">
                        {data.description || 'Provide a compelling description of your resource here...'}
                    </p>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 rounded-full bg-white/10" />
                            <span className="text-[9px] uppercase text-white/40 font-bold tracking-widest">Verified Seller Instance</span>
                        </div>
                        <Shield className="w-4 h-4 text-white/20" />
                    </div>
                </div>

                {/* Glitch Overlay */}
                <div className="absolute inset-0 pointer-events-none border-2 border-primary/0 group-hover:border-primary/20 transition-all duration-300" />
            </div>

            <p className="mt-6 text-white/20 text-[9px] uppercase tracking-[0.2em] leading-relaxed text-center">
                This resource will undergo multi-layer admin verification before being published to the exchange.
            </p>
        </div>
    );
});

export default LivePreviewCard;
