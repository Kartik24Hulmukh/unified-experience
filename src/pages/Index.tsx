import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MasterExperience from '@/components/MasterExperience';
import CampusEventsSection from '@/components/CampusEventsSection';
import FooterSection from '@/components/FooterSection';
import { CollegeVerificationBanner } from '@/components/CollegeVerificationBanner';
import { SEO } from '@/components/SEO';

const Index = () => {
  useEffect(() => {
    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(refreshTimer);
  }, []);

  return (
    <div className="relative bg-background">
      <SEO title="Home" description="Welcome to BErozgar, the ultimate campus portal connecting students with resale, housing, and campus events." />
      
      {/* Public user upgrade nudge */}
      <div className="px-4 pt-4">
        <CollegeVerificationBanner />
      </div>

      {/* Unified Master Experience - Hero + Portal Transition + Modules */}
      <MasterExperience />

      {/* Campus Events horizontal scroll section */}
      <CampusEventsSection />

      {/* Footer */}
      <FooterSection />
    </div>
  );
};

export default Index;
