import { useState, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, X, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

interface FilterOption {
    id: string;
    label: string;
    count?: number;
}

interface FilterPayload {
    price?: [number, number];
    categories?: string[];
}

interface ModuleSearchFilterProps {
    onSearch: (query: string) => void;
    onFilterChange: (filters: FilterPayload) => void;
    resultCount: number;
    categories: FilterOption[];
    priceRange: [number, number];
}

const ModuleSearchFilter = ({
    onSearch,
    onFilterChange,
    resultCount,
    categories,
    priceRange,
}: ModuleSearchFilterProps) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [localPrice, setLocalPrice] = useState<[number, number]>([priceRange[0], priceRange[1]]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsCountRef = useRef<HTMLSpanElement>(null);
    const gsapCtxRef = useRef<gsap.Context | null>(null);

    // Initialize gsap.context once for lifecycle cleanup
    useEffect(() => {
        gsapCtxRef.current = gsap.context(() => {});
        return () => { gsapCtxRef.current?.revert(); };
    }, []);

    // Animate search input expansion
    useEffect(() => {
        const searchEl = document.querySelector('.search-container') as HTMLElement;
        if (!searchEl) return;
        gsapCtxRef.current?.add(() => {
            if (isSearchExpanded) {
                gsap.to(searchEl, {
                    width: "100%",
                    maxWidth: "400px",
                    duration: 0.6,
                    ease: "power3.out",
                    onComplete: () => searchInputRef.current?.focus()
                });
            } else {
                gsap.to(searchEl, {
                    width: "48px",
                    duration: 0.4,
                    ease: "power3.in"
                });
            }
        });
    }, [isSearchExpanded]);

    // Animate result count changes
    useEffect(() => {
        if (resultsCountRef.current) {
            gsapCtxRef.current?.add(() => {
                gsap.fromTo(resultsCountRef.current,
                    { scale: 1.5, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }
                );
            });
        }
    }, [resultCount]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onSearch(e.target.value);
    };

    return (
        <div className="flex flex-col space-y-8 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 md:px-0">

                {/* Search Bar */}
                <div className="relative flex h-12 min-w-0 items-center md:flex-1 md:max-w-md">
                    <div className={`search-container relative flex items-center bg-white/5 border border-white/10 overflow-hidden rounded-none h-full transition-[width] duration-300 ${isSearchExpanded ? 'w-full sm:w-[320px]' : 'w-[48px]'}`}>
                        <button
                            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                            className="tap-target absolute left-0 z-10 h-12 w-12 text-white/50 transition-colors hover:text-white"
                            aria-label={isSearchExpanded ? 'Close search' : 'Open search'}
                        >
                            {isSearchExpanded ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                        </button>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="SEARCH PROTOCOL..."
                            className={`bg-transparent text-white text-xs font-bold uppercase tracking-widest outline-none transition-all duration-300 ${isSearchExpanded ? 'w-full pl-12 pr-4 opacity-100 pointer-events-auto' : 'w-0 px-0 opacity-0 pointer-events-none'}`}
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </div>
                </div>

                {/* Global Result Counter */}
                <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6">
                    <div className="flex min-w-0 items-end gap-2">
                        <span ref={resultsCountRef} className="text-2xl sm:text-3xl md:text-5xl font-display font-bold text-white leading-none">
                            {resultCount}
                        </span>
                        <span className="break-anywhere text-[10px] uppercase font-bold tracking-[0.3em] text-white/40">Entities Found</span>
                    </div>

                    <div className="h-8 w-px bg-white/10 hidden md:block" />

                    {/* Responsive Filter Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex border-white/10 bg-transparent rounded-none h-12 w-12 md:w-auto p-0 md:px-6 items-center justify-center space-x-0 md:space-x-3 text-white/60 hover:text-white hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest transition-all duration-300"
                            >
                                <SlidersHorizontal className="w-5 h-5 md:w-4 md:h-4" />
                                <span className="hidden md:inline">Filter Architecture</span>
                            </Button>
                        </SheetTrigger>

                        <SheetContent
                            side="right"
                            className="touch-scroll-y safe-area-bottom safe-area-top w-full max-w-none border-l border-white/10 bg-black p-5 pb-28 sm:max-w-md sm:p-8 sm:pb-8 overflow-y-auto scrollbar-hide"
                        >
                            <SheetHeader className="space-y-4 mb-12">
                                <div className="w-8 h-8 border border-primary rotate-45 flex items-center justify-center mb-2">
                                    <div className="w-3 h-3 bg-primary" />
                                </div>
                                <SheetTitle className="text-white font-display text-4xl font-bold uppercase italic italic-syne">
                                    FILTER<br />PROTOCOL
                                </SheetTitle>
                                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Select operational parameters</p>
                            </SheetHeader>

                            <div className="space-y-12">
                                {/* Categories */}
                                <div className="space-y-6">
                                    <h4 className="text-white/30 text-[9px] uppercase font-bold tracking-[0.3em] border-b border-white/5 pb-2">Category Matrix</h4>
                                    <div className="grid grid-cols-1 gap-4">
                                        {categories.map((cat) => (
                                            <div key={cat.id} className="group flex items-center justify-between gap-3 cursor-pointer p-2 transition-colors hover:bg-white/5">
                                                <div className="flex min-w-0 items-center gap-4">
                                                    <Checkbox
                                                        id={cat.id}
                                                        checked={selectedCategories.includes(cat.id)}
                                                        onCheckedChange={(checked) => {
                                                            setSelectedCategories(prev =>
                                                                checked
                                                                    ? [...prev, cat.id]
                                                                    : prev.filter(id => id !== cat.id)
                                                            );
                                                        }}
                                                        className="border-white/20 data-[state=checked]:bg-primary rounded-none"
                                                    />
                                                    <label
                                                        htmlFor={cat.id}
                                                        className="break-anywhere min-w-0 cursor-pointer text-xs font-bold uppercase tracking-widest text-white/80 transition-colors group-hover:text-white"
                                                    >
                                                        {cat.label}
                                                    </label>
                                                </div>
                                                {cat.count !== undefined && (
                                                    <span className="text-[9px] font-bold text-white/20 font-display">{cat.count}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Range */}
                                <div className="space-y-6">
                                    <h4 className="text-white/30 text-[9px] uppercase font-bold tracking-[0.3em] border-b border-white/5 pb-2">Resource Valuation (INR)</h4>
                                    <div className="px-2">
                                        <Slider
                                            defaultValue={[priceRange[1]]}
                                            min={priceRange[0]}
                                            max={priceRange[1] * 2}
                                            step={100}
                                            onValueChange={(val) => setLocalPrice([priceRange[0], val[0]])}
                                            className="mt-6"
                                        />
                                        <div className="flex justify-between mt-6 text-[10px] font-bold uppercase text-white/60 font-display">
                                            <span>Rs {localPrice[0]}</span>
                                            <span>Rs {localPrice[1]}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="sticky bottom-0 -mx-5 mt-8 border-t border-white/10 bg-black/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
                                    <Button
                                        className="relative h-14 w-full overflow-hidden rounded-none bg-primary text-xs font-bold uppercase tracking-widest text-black transition-all duration-500 group hover:bg-teal-400"
                                        onClick={() => onFilterChange({ price: localPrice, categories: selectedCategories })}
                                    >
                                        <span className="relative z-10 flex items-center">
                                            APPLY FILTERS <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1" />
                                        </span>
                                        <div className="absolute inset-0 translate-x-[-100%] bg-white opacity-20 transition-transform duration-500 group-hover:translate-x-0" />
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
};

export default ModuleSearchFilter;
