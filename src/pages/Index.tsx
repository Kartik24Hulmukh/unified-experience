import MasterExperience from '@/components/MasterExperience';
import CampusEventsSection from '@/components/CampusEventsSection';
import FooterSection from '@/components/FooterSection';
import { CollegeVerificationBanner } from '@/components/CollegeVerificationBanner';
import { SEO } from '@/components/SEO';

const Index = () => {
  return (
    <div className="relative" style={{ backgroundColor: '#ffffff' }}>
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
