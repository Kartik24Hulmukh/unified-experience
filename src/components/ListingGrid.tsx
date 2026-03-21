import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Shield } from 'lucide-react';

interface ListingItem {
    id: string;
    title: string;
    price: string;
    category: string;
    image?: string;
    module?: string;
}

interface ListingGridProps {
    items: ListingItem[];
}

const ListingGrid = memo(({ items }: ListingGridProps) => {
    return (
        <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4 md:px-0"
        >
            {items.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 border border-white/10 rotate-45 flex items-center justify-center mb-6">
                        <div className="w-4 h-4 bg-white/10" />
                    </div>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-widest">No results found</p>
                </div>
            )}
            {items.map((item, index) => (
                <Link
                    key={item.id}
                    to={`/listing/${item.id}`}
                    className="listing-card-entry group relative aspect-[4/5] bg-white/5 border border-white/10 overflow-hidden cursor-pointer block animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both"
                    style={{ animationDelay: `${index * 80}ms` }}
                >
                    {/* Image Layer */}
                    <div className="absolute inset-0 grayscale group-hover:grayscale-0 transition-all duration-700 overflow-hidden">
                        {item.image ? (
                            <img src={item.image} alt={item.title} width={400} height={500} className="w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700 transform-gpu" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black/40 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20" style={{
                                    backgroundImage: `linear-gradient(rgba(0,212,170,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.3) 1px, transparent 1px)`,
                                    backgroundSize: '20px 20px'
                                }} />
                                <div className="w-16 h-16 border border-primary/20 rotate-45 flex items-center justify-center relative z-10 bg-black/50 backdrop-blur-sm">
                                    <div className="w-4 h-4 bg-primary/40 animate-pulse" />
                                </div>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    </div>

                    {/* Glitch Overlay Effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none bg-primary mix-blend-overlay" />

                    {/* Content Layer */}
                    <div className="absolute inset-0 p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="px-3 py-1 bg-black/70 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-primary">
                                {item.category}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="w-3 h-3 text-white" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <h3 className="text-white font-display text-2xl font-bold uppercase leading-tight line-clamp-2 pr-4">
                                    {item.title}
                                </h3>
                                <span className="text-primary font-display text-xl font-bold">
                                    ₹{item.price}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    </div>
                                    <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/40">
                                        MCTRGIT
                                    </span>
                                </div>
                                <Shield className="w-3 h-3 text-white/20" />
                            </div>
                        </div>
                    </div>

                    {/* Hover Frame */}
                    <div className="absolute inset-0 border-2 border-primary opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:-translate-y-0" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-4 translate-y-4 group-hover:translate-x-0 group-hover:-translate-y-0" />
                </Link>
            ))}
        </div>
    );
});

export default ListingGrid;
