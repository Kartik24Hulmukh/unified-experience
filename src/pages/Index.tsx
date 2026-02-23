import MasterExperience from '@/components/MasterExperience';

const Index = () => {
  return (
    <div className="relative" style={{ backgroundColor: '#ffffff' }}>
      {/* Unified Master Experience - Hero + Portal Transition + Modules */}
      <MasterExperience />

      {/* Footer section after scroll */}
      <footer className="min-h-screen bg-portal flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-portal-foreground font-display text-4xl md:text-6xl font-bold mb-8">
            A Trust-Centric
            <br />
            <span className="text-portal-foreground/60">Campus Ecosystem</span>
          </h2>

          <p className="text-portal-foreground/50 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-body leading-relaxed">
            BErozgar transforms informal student practices into a structured,
            trusted platform for academic exchange, accommodation discovery,
            and daily living support.
          </p>

          <div className="flex flex-wrap justify-center gap-8 mb-16">
            <div className="text-left">
              <p className="text-portal-foreground/30 text-sm uppercase tracking-widest mb-2">Institution</p>
              <p className="text-portal-foreground font-display text-xl">MCTRGIT</p>
            </div>
            <div className="text-left">
              <p className="text-portal-foreground/30 text-sm uppercase tracking-widest mb-2">Status</p>
              <p className="text-portal-foreground font-display text-xl">Active Development</p>
            </div>
            <div className="text-left">
              <p className="text-portal-foreground/30 text-sm uppercase tracking-widest mb-2">Users</p>
              <p className="text-portal-foreground font-display text-xl">MCTRGIT Students Only</p>
            </div>
          </div>

          {/* Core Principles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
            {[
              { title: 'Trust First', desc: 'Verified users, admin oversight' },
              { title: 'Privacy by Design', desc: 'No public personal data' },
              { title: 'Governance', desc: 'Admin arbitration over automation' },
              { title: 'Institutional', desc: 'Aligned with campus culture' },
            ].map((principle, i) => (
              <div key={i} className="border-l border-portal-foreground/20 pl-4">
                <h3 className="text-portal-foreground font-display text-sm uppercase tracking-wider mb-1">
                  {principle.title}
                </h3>
                <p className="text-portal-foreground/40 text-xs font-body">
                  {principle.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-24 pt-8 border-t border-portal-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-portal-foreground/30 text-sm font-body">
              © 2026 BErozgar — Rozgar for Resources
            </p>
            <p className="text-portal-foreground/30 text-sm font-body">
              Non-Commercial • Privacy-Aware • Admin-Governed
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
