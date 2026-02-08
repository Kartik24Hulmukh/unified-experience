import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/* ─── Types ─── */

export type UserRole = 'student' | 'admin' | 'faculty';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  verified: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* ─── Storage helpers ─── */

const STORAGE_KEY = 'berozgar_auth';

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/* ─── Pending signup (pre-verification) ─── */

const PENDING_KEY = 'berozgar_pending';

interface PendingUser {
  fullName: string;
  email: string;
  password: string;
}

function savePending(data: PendingUser) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(data));
}

function loadPending(): PendingUser | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPending() {
  localStorage.removeItem(PENDING_KEY);
}

/* ─── Role detection from email ─── */

function detectRole(email: string): UserRole {
  const lower = email.toLowerCase();
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('faculty') || lower.includes('prof')) return 'faculty';
  return 'student';
}

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadUser();
    setState({
      user: stored,
      isAuthenticated: !!stored,
      isLoading: false,
    });
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 1200));

    const role = detectRole(email);
    const user: User = {
      id: crypto.randomUUID(),
      fullName: email.split('@')[0].replace(/[._]/g, ' '),
      email,
      role,
      verified: true,
    };

    saveUser(user);
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const signup = useCallback(async (fullName: string, email: string, password: string) => {
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 1200));

    // Save as pending — user must verify OTP before becoming authenticated
    savePending({ fullName, email, password });
  }, []);

  const verifyOtp = useCallback(async (_otp: string) => {
    // Simulate OTP verification
    await new Promise((r) => setTimeout(r, 1200));

    const pending = loadPending();
    if (!pending) throw new Error('No pending registration found');

    const role = detectRole(pending.email);
    const user: User = {
      id: crypto.randomUUID(),
      fullName: pending.fullName,
      email: pending.email,
      role,
      verified: true,
    };

    clearPending();
    saveUser(user);
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    saveUser(null);
    clearPending();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Hook ─── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
