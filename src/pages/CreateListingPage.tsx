import { useState, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { Shield, ArrowLeft } from 'lucide-react';
import ResourceListingForm from '@/components/ResourceListingForm';
import { useAuth } from '@/contexts/AuthContext';
import { useRestriction } from '@/hooks/useRestriction';
import { toast } from '@/components/ui/use-toast';
import { SEO } from '@/components/SEO';

const MODULE_CONFIGS = [
  {
    id: 'resale',
    title: 'Resale Marketplace',
    description: 'Sell textbooks, electronics, and supplies.',
    color: 'from-orange-500 to-red-500',
    categories: [
      { value: 'books', label: 'Books & Notes' },
      { value: 'electronics', label: 'Electronics & Gadgets' },
      { value: 'tools', label: 'Engineering Tools' },
      { value: 'stationery', label: 'Stationery' },
      { value: 'other', label: 'Other Items' },
    ]
  },
  {
    id: 'accommodation',
    title: 'Accommodation',
    description: 'List PGs, flats, and flatmate requests.',
    color: 'from-cyan-400 to-teal-300',
    categories: [
      { value: 'pg', label: 'PG Accommodation' },
      { value: 'flat', label: 'Flat / Apartment' },
      { value: 'flatmate', label: 'Flatmate Search' },
      { value: 'hostel', label: 'Hostel Room' },
    ]
  },
  {
    id: 'essentials',
    title: 'Campus Essentials',
    description: 'Offer services like laundry, tiffins, or transport.',
    color: 'from-purple-500 to-pink-500',
    categories: [
      { value: 'food', label: 'Tiffin / Mess Service' },
      { value: 'laundry', label: 'Laundry Service' },
      { value: 'transport', label: 'Carpool / Transport' },
      { value: 'repair', label: 'Electronics Repair' },
      { value: 'other', label: 'Other Services' },
    ]
  }
];

export default function CreateListingPage() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { canPerform } = useRestriction();
  const canCreateListing = canPerform('CREATE_LISTING');

  useLayoutEffect(() => {
    // Redirect if not authenticated (should be covered by route guard but extra safety)
    if (!isAuthenticated) {
      toast({ title: 'Sign In Required', description: 'Please sign in to create a listing.', variant: 'destructive' });
      navigate('/login');
      return;
    }
    if (!canCreateListing) {
      toast({ title: 'Action Unavailable', description: 'Your account is restricted from creating listings.', variant: 'destructive' });
      navigate('/profile');
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo('.anim-slide-up',
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out' }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [isAuthenticated, canCreateListing, navigate]);

  const activeConfig = MODULE_CONFIGS.find(m => m.id === selectedModule);

  return (
    <>
      <SEO title="Create Listing" description="Create a new listing across campus modules." />
      <div 
        ref={containerRef} 
        className="min-h-screen bg-black text-white pt-[100px] px-4 md:px-8 pb-20"
      >
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="anim-slide-up mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-5xl font-display font-bold mb-2">
                Create Listing
              </h1>
              <p className="text-white/40 font-mono text-xs uppercase tracking-widest">
                System // Data Entry // Secured
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 border border-green-500/20 bg-green-500/10 rounded-full">
              <Shield className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">Verified Mode</span>
            </div>
          </div>

          {!selectedModule ? (
            // Module Selection
            <div className="anim-slide-up space-y-6">
              <h2 className="text-xl font-display mb-6 text-white/80">Select a category for your listing:</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MODULE_CONFIGS.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedModule(mod.id)}
                    className="group relative p-6 border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 text-left overflow-hidden flex flex-col h-full"
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${mod.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
                    <h3 className="text-xl font-display font-bold mb-2 uppercase tracking-wide group-hover:text-white transition-colors text-white/90">
                      {mod.title}
                    </h3>
                    <p className="text-white/50 text-sm font-body line-clamp-2">
                      {mod.description}
                    </p>
                    <div className="mt-auto pt-6 flex items-center gap-2 group-hover:translate-x-2 transition-transform duration-300">
                      <span className="text-xs uppercase tracking-widest font-mono text-white/50 group-hover:text-white/80">Select</span>
                      <div className="w-4 h-px bg-white/50 group-hover:bg-white/80" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Form Display
            <div className="anim-slide-up bg-white/[0.02] border border-white/10 p-6 md:p-10 rounded-sm">
              <button 
                onClick={() => setSelectedModule(null)}
                className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 text-xs font-mono uppercase tracking-widest"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Categories
              </button>

              <div className="mb-8">
                <h2 className="text-2xl font-display font-bold mb-2">
                  New {activeConfig?.title} Listing
                </h2>
                <div className={`h-px w-16 bg-gradient-to-r ${activeConfig?.color}`} />
              </div>

              {activeConfig && (
                <ResourceListingForm 
                  moduleName={activeConfig.title}
                  categories={activeConfig.categories}
                  onSuccess={() => {
                    toast({ title: 'Listing Created', description: 'Your listing has been submitted for review.' });
                    navigate('/profile');
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
