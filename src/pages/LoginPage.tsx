import React, { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, ArrowRight, ChevronDown, Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { safeNavigate } from "@/lib/utils";
import { useGoogleIdentity } from "@/hooks/useGoogleIdentity";
import { useIsMobile } from "@/hooks/use-mobile";
import SplitText from "@/components/SplitText";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { APP_VERSION } from "@/lib/app-meta";

// UX-1 FIX: renamed from ErrorBoundary to LoginPageErrorBoundary.
// The original name shadowed the global @/components/ErrorBoundary in this
// file's scope, masking any future import and losing monitoring integration.
class LoginPageErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean, errorMsg: string }> {
    constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) { super(props); this.state = { hasError: false, errorMsg: '' }; }
    static getDerivedStateFromError(error: unknown) { return { hasError: true, errorMsg: error?.message || String(error) }; }
    render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

const Lanyard = lazy(() => import("@/components/Lanyard"));

const loginSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, googleSignIn, isAuthenticated, isLoading: authLoading, user } = useAuth();
    const { promptSignIn, isLoading: isGoogleLoading, hasRealGIS } = useGoogleIdentity();
    const isMobile = useIsMobile();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(true);
    const hasRedirected = useRef(false);

    const isAdminRole = (role: unknown) => String(role ?? '').trim().toLowerCase() === 'admin';
    const requestedDestination = typeof (location.state as { from?: unknown } | null)?.from === 'string'
        ? (location.state as { from?: string }).from!
        : '/home';

    const getPostLoginDestination = useCallback((role: unknown) => {
        if (requestedDestination && requestedDestination !== '/home') {
            return requestedDestination;
        }
        return isAdminRole(role) ? '/admin' : '/home';
    }, [requestedDestination]);

    useEffect(() => {
        if (isAuthenticated && !authLoading && user) {
            if (!hasRedirected.current) {
                hasRedirected.current = true;
                const destination = getPostLoginDestination(user.role);
                navigate(destination, { replace: true });
            }
        }
    }, [authLoading, getPostLoginDestination, isAuthenticated, navigate, user]);

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setIsLoading(true);
        try {
            const loggedInUser = await login(values.email, values.password);
            toast({ title: "Access Granted", description: "Welcome to the BErozgar Trust Exchange." });
            
            // Immediately navigate here as a fallback
            const destination = getPostLoginDestination(loggedInUser?.role);
            navigate(destination, { replace: true });
        } catch (err: unknown) {
            hasRedirected.current = false;
            const msg = err?.response?.data?.error || err?.response?.data?.message || (err instanceof Error ? err.message : "Invalid credentials. Please try again.");
            toast({ title: "Access Denied", description: msg, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleGoogleClick() {
        if (isGoogleLoading) return;
        try {
            const result = await promptSignIn();
            const loggedInUser = await googleSignIn(result.credential);
            toast({ title: "Google Sign-In Successful", description: `Signed in as ${result.email || 'your Google account'}` });
            
            const destination = getPostLoginDestination(loggedInUser?.role);
            navigate(destination, { replace: true });
        } catch (err: unknown) {
            hasRedirected.current = false;
            const msg = err?.response?.data?.error || err?.response?.data?.message || (err instanceof Error ? err.message : "Could not authenticate with Google.");
            toast({ title: "Google Sign-In Failed", description: msg, variant: "destructive" });
        }
    }

    // Early return: prevent flash of login form for already-authenticated users
    if (isAuthenticated && !authLoading) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-[hsl(var(--color-bg))] text-[hsl(var(--color-text))]">
            {/* Subtle atmosphere without introducing a separate teal page identity */}
            <div className="absolute inset-0 pointer-events-none opacity-25" style={{ background: 'var(--gradient-auth)' }} />

            {/* ── 3D Lanyard Campus ID ── desktop only; Rapier physics is too heavy on mobile ── */}
            {!isMobile && (
              <div className="absolute inset-0 z-0 opacity-50">
                  <LoginPageErrorBoundary fallback={<div className="hidden" />}>
                      <Suspense fallback={<div className="absolute inset-0 m-auto w-[400px] h-[500px] rounded-[40px] border border-primary/20 bg-primary/5 animate-pulse shadow-2xl backdrop-blur-sm" />}>
                          <Lanyard position={[0, 0, 25]} gravity={[0, -40, 0]} fov={22} transparent />
                      </Suspense>
                  </LoginPageErrorBoundary>
              </div>
            )}

            {/* ── Watermark (decorative, not a page heading) ── */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none select-none z-[1] opacity-5" aria-hidden="true">
                <div className="text-[6rem] sm:text-[10rem] md:text-[14rem] lg:text-[20rem] font-bold text-white uppercase leading-none font-display italic tracking-tighter">
                    TRUST
                </div>
            </div>

            {/* ── Login Form Overlay ── */}
            <div className="absolute inset-0 z-10 flex items-center justify-center lg:justify-end p-4 sm:p-6 md:p-12 lg:pr-32 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-md">
                    <div className="mb-8 space-y-4">
                        <div className="flex items-center space-x-3 text-primary">
                            <div className="w-12 h-px bg-primary/30" />
                            <span className="text-[10px] font-bold tracking-[0.4em] uppercase">Campus Gateway</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white uppercase italic font-display leading-tight">
                            Secure<br />Sign In
                        </h1>
                    </div>

                    <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute -inset-2 bg-primary/10 rounded-[2rem] blur-2xl" />

                        <div className="relative bg-black/60 border border-white/5 p-6 sm:p-10 rounded-[1.5rem] shadow-2xl backdrop-blur-2xl">
                            {hasRealGIS && (
                            <Button
                                type="button"
                                onClick={handleGoogleClick}
                                disabled={isGoogleLoading || isLoading}
                                variant="secondary"
                                className="group mb-6 flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-white font-black text-sm text-gray-900 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 hover:bg-gray-100 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                {isGoogleLoading ? "VERIFYING..." : "SECURE SINGLE SIGN-ON"}
                            </Button>
                            )}

                            {hasRealGIS && (
                            <div className="flex items-center gap-6 mb-6">
                                <div className="flex-1 h-px bg-white/5" />
                                <button onClick={() => setShowEmailForm(!showEmailForm)} className="tap-target px-3 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors">
                                    {showEmailForm ? "HIDE AUTH" : "USE LEGACY MAIL"}
                                </button>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>
                            )}

                            {showEmailForm && (
                            <div className="grid transition-all duration-300 grid-rows-[1fr] opacity-100 mb-6">
                                <div className="overflow-hidden">
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                            <FormField control={form.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/60 text-xs uppercase tracking-widest">Campus Email</FormLabel>
                                                    <FormControl><Input id="email" data-testid="email-input" autoComplete="email" placeholder="your.name@mctrgit.ac.in" {...field} className="bg-white/5 border-white/5 text-white h-14 rounded-lg placeholder:text-white/30" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="password" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/60 text-xs uppercase tracking-widest">Password</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input id="password" data-testid="password-input" autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" {...field} className="bg-white/5 border-white/5 text-white h-14 rounded-lg placeholder:text-white/30 pr-12" />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(p => !p)}
                                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                                                            >
                                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <Button data-testid="login-submit" type="submit" variant="primary" disabled={isLoading} className="h-16 w-full rounded-xl border-white/25 font-black text-white hover:border-white hover:bg-white hover:text-black" style={{ minHeight: 48, minWidth: 48 }}>
                                                {isLoading ? "AUTHORIZING..." : "ENTER PORTAL"}
                                            </Button>
                                        </form>
                                    </Form>
                                </div>
                            </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                                <Link to="/signup" className="tap-target px-2 hover:text-[hsl(var(--color-accent-primary))] transition-colors">Request Account</Link>
                                <Link to="/" className="tap-target px-2 hover:text-white transition-colors">Cancel Access</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-4 z-10 pointer-events-none flex flex-col space-y-2 text-[9px] uppercase tracking-[0.5em] text-white/10 font-mono sm:left-12">
                <span>SYSTEM_STATUS: ONLINE</span>
            </div>

            <footer className="absolute bottom-4 right-4 z-10 text-[9px] font-mono uppercase tracking-[0.3em] text-white/25 sm:right-12">
                {APP_VERSION} // Campus OS
            </footer>
        </div>
    );
};

export default LoginPage;
