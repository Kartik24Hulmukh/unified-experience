import MasterExperience from '@/components/MasterExperience';
import CampusEventsSection from '@/components/CampusEventsSection';
import FooterSection from '@/components/FooterSection';

const Index = () => {
  return (
    <div className="relative" style={{ backgroundColor: '#ffffff' }}>
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
