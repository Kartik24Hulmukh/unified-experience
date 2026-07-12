import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api-client';
import { toast } from '@/components/ui/use-toast';
import { ShieldCheck, X } from 'lucide-react';

/**
 * Banner shown to PUBLIC_USER accounts nudging them to verify their
 * college email for full feature access. Includes a one-click upgrade
 * flow that checks the college registry server-side.
 */
export function CollegeVerificationBanner() {
  const { user, isAuthenticated } = useAuth();
  const STORAGE_KEY = 'berozgar_verify_banner_dismissed';
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
  };

  // Only show for authenticated public users
  if (!isAuthenticated || !user || user.role !== 'public_user' || dismissed) {
    return null;
  }

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ data: { message: string; upgraded: boolean } }>(
        '/profile/link-college-email',
      );
      const { message, upgraded } = res.data;
      toast({
        title: upgraded ? 'Account Upgraded!' : 'Verification Status',
        description: message,
        variant: upgraded ? 'default' : 'destructive',
      });
      if (upgraded) {
        // Force a full page reload to refresh auth state with new role
        window.location.reload();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unable to verify college email. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
      <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
      <p className="text-sm text-amber-200/80 flex-1">
        <span className="font-semibold text-amber-300">Verify your college email</span>{' '}
        to unlock full features like resale listings, exchange requests, and trust scoring.
      </p>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="shrink-0 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
      >
        {loading ? 'Checking…' : 'Verify Now'}
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-amber-400/40 hover:text-amber-400/70 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
