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

interface ModuleSearchFilterProps {
    onSearch: (query: string) => void;
    onFilterChange: (filters: any) => void;
    resultCount: number;
    categories: FilterOption[];
    priceRange: [number, number];
    moduleColor?: string;
}

const ModuleSearchFilter = ({
    onSearch,
    onFilterChange,
    resultCount,
    categories,
    priceRange,
    moduleColor = "#00d4aa"
}: ModuleSearchFilterProps) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [localPrice, setLocalPrice] = useState([priceRange[0], priceRange[1]]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsCountRef = useRef<HTMLSpanElement>(null);

    // Animate search input expansion
    useEffect(() => {
        if (isSearchExpanded) {
            gsap.to(".search-container", {
                width: "100%",
                maxWidth: "400px",
                duration: 0.6,
                ease: "power3.out",
                onComplete: () => searchInputRef.current?.focus()
            });
        } else {
            gsap.to(".search-container", {
                width: "48px",
                duration: 0.4,
                ease: "power3.in"
            });
        }
    }, [isSearchExpanded]);

    // Animate result count changes
    useEffect(() => {
        if (resultsCountRef.current) {
            gsap.fromTo(resultsCountRef.current,
                { scale: 1.5, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }
            );
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
                <div className="relative flex items-center h-12">
                    <div className="search-container relative flex items-center bg-white/5 border border-white/10 overflow-hidden rounded-none h-full w-[48px]">
                        <button
                            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                            className="absolute left-0 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white transition-colors z-10"
                        >
                            {isSearchExpanded ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                        </button>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="SEARCH PROTOCOL..."
                            className={`w-full bg-transparent pl-12 pr-4 text-white text-xs font-bold uppercase tracking-widest outline-none transition-opacity duration-300 ${isSearchExpanded ? 'opacity-100' : 'opacity-0'}`}
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </div>
                </div>

                {/* Global Result Counter */}
                <div className="flex items-center space-x-6">
                    <div className="flex items-baseline space-x-2">
                        <span ref={resultsCountRef} className="text-3xl md:text-5xl font-display font-bold text-white leading-none">
                            {resultCount}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/40">Entities Found</span>
                    </div>

                    <div className="h-8 w-px bg-white/10 hidden md:block" />

                    {/* Desktop Filter Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                className="hidden md:flex border-white/10 bg-transparent rounded-none h-12 px-6 space-x-3 text-white/60 hover:text-white hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest transition-all duration-300"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                <span>Filter Architecture</span>
                            </Button>
                        </SheetTrigger>

                        {/* Mobile/Tablet Filter Trigger */}
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                className="md:hidden flex h-12 w-12 p-0 border-white/10 bg-transparent items-center justify-center"
                            >
                                <SlidersHorizontal className="w-5 h-5 text-white/60" />
                            </Button>
                        </SheetTrigger>

                        <SheetContent
                            side="right"
                            className="bg-black border-l border-white/10 w-full sm:max-w-md p-8 overflow-y-auto scrollbar-hide"
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
                                            <div key={cat.id} className="flex items-center justify-between group cursor-pointer p-2 hover:bg-white/5 transition-colors">
                                                <div className="flex items-center space-x-4">
                                                    <Checkbox id={cat.id} className="border-white/20 data-[state=checked]:bg-primary rounded-none" />
                                                    <label
                                                        htmlFor={cat.id}
                                                        className="text-xs text-white/80 font-bold uppercase tracking-widest cursor-pointer group-hover:text-white transition-colors"
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
                                            defaultValue={[priceRange[0], priceRange[1]]}
                                            max={priceRange[1] * 2}
                                            step={100}
                                            onValueChange={(val) => setLocalPrice(val)}
                                            className="mt-6"
                                        />
                                        <div className="flex justify-between mt-6 text-[10px] font-bold uppercase text-white/60 font-display">
                                            <span>₹{localPrice[0]}</span>
                                            <span>₹{localPrice[1]}</span>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-14 bg-primary hover:bg-teal-400 text-black font-bold text-xs uppercase tracking-widest rounded-none group transition-all duration-500 overflow-hidden relative"
                                    onClick={() => onFilterChange({ price: localPrice })}
                                >
                                    <span className="relative z-10 flex items-center">
                                        APPLY FILTERS <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1" />
                                    </span>
                                    <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 opacity-20" />
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
};

export default ModuleSearchFilter;
