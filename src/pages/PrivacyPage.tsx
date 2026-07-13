import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Shield, ArrowLeft } from 'lucide-react';

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Privacy Policy — BErozgar</title>
        <meta name="description" content="BErozgar privacy policy — how we collect, use, and protect your personal data on the campus resource exchange platform." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Back nav */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors mb-12 tap-target"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-primary" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Legal Document</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-foreground/40 text-sm font-mono mb-12">
          Last updated: July 2026 · Effective immediately
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-foreground/70">

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">1. Who We Are</h2>
            <p className="leading-relaxed">
              BErozgar ("<strong>we</strong>", "<strong>our</strong>", "<strong>us</strong>") operates the campus resource
              exchange platform at <strong>rgitrozgar.in</strong>. We provide a peer-to-peer exchange service for academic
              resources, accommodation listings, and resale goods for verified students of affiliated institutions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">2. Data We Collect</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Account data:</strong> Name, institutional email address, and password hash (never stored in plain text).</li>
              <li><strong>Profile data:</strong> Branch, year, optional bio, and listings you create.</li>
              <li><strong>Usage data:</strong> Page views, feature interactions, and session duration for product analytics.</li>
              <li><strong>Device data:</strong> Browser type, OS, and approximate location (country/region) for security monitoring.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">3. How We Use Your Data</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>To authenticate your session and protect your account.</li>
              <li>To display your listings and profile to other verified students.</li>
              <li>To send transactional emails (account verification, password reset).</li>
              <li>To improve platform features based on anonymized usage patterns.</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p className="mt-4">We do <strong>not</strong> sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">4. Data Sharing</h2>
            <p className="leading-relaxed">
              Your name, institution, and listing details are visible to other authenticated BErozgar users. We do not
              share personally identifiable information with external advertising networks. Infrastructure providers
              (hosting, email delivery) process data on our behalf under strict data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">5. Cookies &amp; Session Storage</h2>
            <p className="leading-relaxed">
              We use HTTP-only cookies for secure session management. We use localStorage for non-sensitive preferences
              such as theme and dismissed banners. We do not use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">6. Data Retention</h2>
            <p className="leading-relaxed">
              Account data is retained for the duration of your account. You may request deletion by contacting us.
              Anonymized usage data may be retained for up to 24 months for analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">7. Your Rights</h2>
            <p className="leading-relaxed">
              You have the right to access, correct, or delete your personal data. To exercise these rights, contact us
              at the address below. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">8. Security</h2>
            <p className="leading-relaxed">
              We use HTTPS/TLS for all data in transit. Passwords are stored using bcrypt hashing. Access controls
              restrict data to authenticated and authorised users. We conduct periodic security reviews.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">9. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this policy. Material changes will be communicated via email or a prominent in-app notice
              at least 14 days before taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">10. Contact</h2>
            <p className="leading-relaxed">
              For privacy questions, data requests, or concerns, contact the BErozgar team through the platform's
              official institutional channels. We aim to respond within 5 business days.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex gap-6 text-xs font-mono text-foreground/30">
          <Link to="/terms" className="hover:text-foreground/60 transition-colors">Terms of Service</Link>
          <Link to="/" className="hover:text-foreground/60 transition-colors">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
