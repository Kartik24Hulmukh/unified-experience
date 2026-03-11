import MasterExperience from '@/components/MasterExperience';
import CampusEventsSection from '@/components/CampusEventsSection';
import FooterSection from '@/components/FooterSection';
import { CollegeVerificationBanner } from '@/components/CollegeVerificationBanner';

const Index = () => {
  return (
    <div className="relative" style={{ backgroundColor: '#ffffff' }}>
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
