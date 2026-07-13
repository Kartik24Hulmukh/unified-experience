import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FileText, ArrowLeft } from 'lucide-react';

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Terms of Service — BErozgar</title>
        <meta name="description" content="BErozgar terms of service — the rules and conditions for using the campus resource exchange platform." />
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
          <FileText className="w-6 h-6 text-primary" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Legal Document</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-4">
          Terms of Service
        </h1>
        <p className="text-foreground/40 text-sm font-mono mb-12">
          Last updated: July 2026 · Effective immediately
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-foreground/70">

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By creating an account or using BErozgar ("<strong>the Platform</strong>"), you agree to these Terms of
              Service. If you do not agree, do not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">2. Eligibility</h2>
            <p className="leading-relaxed">
              BErozgar is exclusively for currently enrolled students of affiliated institutions. You must provide a
              valid institutional email address and complete email verification to access most features. Use by
              non-students, former students without active enrollment, or automated bots is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">3. Account Responsibilities</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>You are responsible for maintaining the confidentiality of your password.</li>
              <li>You must not share your account or credentials with others.</li>
              <li>You must notify us immediately of any unauthorized access to your account.</li>
              <li>One account per person is permitted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">4. Listings and Content</h2>
            <p className="leading-relaxed mb-3">
              When you create a listing, you confirm that:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>You own or have the right to sell/share the item or resource.</li>
              <li>All information in the listing is accurate and not misleading.</li>
              <li>The listing does not contain prohibited content (see Section 6).</li>
            </ul>
            <p className="mt-3">Listings are subject to moderation and may be removed without notice if they violate these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">5. Transactions</h2>
            <p className="leading-relaxed">
              BErozgar facilitates peer-to-peer exchanges. We are not a party to any transaction between users and
              accept no liability for the quality, safety, legality, or delivery of goods exchanged. All transactions
              are at your own risk. We strongly recommend meeting in safe, public campus locations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">6. Prohibited Content</h2>
            <p className="leading-relaxed mb-3">The following are strictly prohibited:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Illegal items, counterfeit goods, or stolen property.</li>
              <li>Weapons, controlled substances, or hazardous materials.</li>
              <li>Content that is defamatory, harassing, or discriminatory.</li>
              <li>Spam, fraudulent listings, or misleading pricing.</li>
              <li>Unauthorized sharing of copyrighted academic materials (piracy).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">7. Intellectual Property</h2>
            <p className="leading-relaxed">
              The BErozgar platform, including its code, design, and branding, is the property of BErozgar and its
              contributors. You retain ownership of content you post, but grant us a non-exclusive licence to display
              it on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">8. Termination</h2>
            <p className="leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these terms, with or without prior
              notice. You may delete your account at any time by contacting support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">9. Limitation of Liability</h2>
            <p className="leading-relaxed">
              BErozgar is provided "as is" without warranties of any kind. We are not liable for any indirect,
              incidental, or consequential damages arising from your use of the platform, including losses from
              peer-to-peer transactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">10. Changes to Terms</h2>
            <p className="leading-relaxed">
              We may update these terms. Continued use of the platform after changes take effect constitutes
              acceptance. Material changes will be communicated at least 14 days in advance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-foreground mb-3">11. Governing Law</h2>
            <p className="leading-relaxed">
              These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of
              courts in the state where the institution is located.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex gap-6 text-xs font-mono text-foreground/30">
          <Link to="/privacy" className="hover:text-foreground/60 transition-colors">Privacy Policy</Link>
          <Link to="/" className="hover:text-foreground/60 transition-colors">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
