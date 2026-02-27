import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, ArrowRight, ChevronDown } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { safeNavigate } from "@/lib/utils";
import { useGoogleIdentity } from "@/hooks/useGoogleIdentity";
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

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: any) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
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
    const { login, googleSignIn, isAuthenticated, isLoading: authLoading } = useAuth();
    const { promptSignIn, isLoading: isGoogleLoading } = useGoogleIdentity();
    const [isLoading, setIsLoading] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const hasRedirected = useRef(false);

    const from = (location.state as { from?: string })?.from || "/home";

    useEffect(() => {
        if (isAuthenticated && !authLoading && !hasRedirected.current) {
            hasRedirected.current = true;
            safeNavigate(navigate, location.pathname, from);
        }
    }, [isAuthenticated, authLoading, navigate, from, location.pathname]);

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        if (hasRedirected.current) return;
        setIsLoading(true);
        try {
            await login(values.email, values.password);
            toast({ title: "Access Granted", description: "Welcome to the BErozgar Trust Exchange." });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
            toast({ title: "Access Denied", description: msg, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleGoogleClick() {
        if (hasRedirected.current || isGoogleLoading) return;
        try {
            const result = await promptSignIn();
            await googleSignIn(result.credential);
            toast({ title: "Google Sign-In Successful", description: `Signed in as ${result.email || 'your Google account'}` });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not authenticate with Google.";
            toast({ title: "Google Sign-In Failed", description: msg, variant: "destructive" });
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-[#020205] overflow-hidden">
            {/* Ambient Background Gradient for Lanyard Visibility */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #00BCD4 0%, transparent 70%)' }} />

            {/* ── 3D Lanyard Campus ID ── */}
            <div className="absolute inset-0 z-0">
                <ErrorBoundary fallback={<div className="w-full h-full bg-black" />}>
                    <Suspense fallback={null}>
                        <Lanyard position={[0, 0, 25]} gravity={[0, -40, 0]} fov={22} transparent />
                    </Suspense>
                </ErrorBoundary>
            </div>

            {/* ── Watermark ── */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none select-none z-[1] opacity-5">
                <h1 className="text-[12rem] md:text-[20rem] font-bold text-white uppercase leading-none font-display italic tracking-tighter">
                    TRUST
                </h1>
            </div>

            {/* ── Login Form Overlay ── */}
            <div className="absolute inset-0 z-10 flex items-center justify-end p-6 md:p-12 lg:pr-32 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-md">
                    <div className="mb-8 space-y-4">
                        <div className="flex items-center space-x-3 text-primary">
                            <div className="w-12 h-px bg-primary/30" />
                            <span className="text-[10px] font-bold tracking-[0.4em] uppercase">MCTRGIT Gateway</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold text-white uppercase italic font-display leading-tight">
                            Identity<br />Verified
                        </h2>
                    </div>

                    <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute -inset-2 bg-primary/10 rounded-[2rem] blur-2xl" />

                        <div className="relative bg-black/60 border border-white/5 p-10 rounded-[1.5rem] shadow-2xl backdrop-blur-2xl">
                            <Button
                                type="button"
                                onClick={handleGoogleClick}
                                disabled={isGoogleLoading || isLoading}
                                className="group w-full h-16 mb-6 bg-white hover:bg-gray-100 text-gray-900 font-black text-sm rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                {isGoogleLoading ? "VERIFYING..." : "MCTRGIT SINGLE SIGN-ON"}
                            </Button>

                            <div className="flex items-center gap-6 mb-6">
                                <div className="flex-1 h-px bg-white/5" />
                                <button onClick={() => setShowEmailForm(!showEmailForm)} className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors">
                                    {showEmailForm ? "HIDE AUTH" : "USE LEGACY MAIL"}
                                </button>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>

                            <div className={`grid transition-all duration-300 ${showEmailForm ? 'grid-rows-[1fr] opacity-100 mb-6' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                            <FormField control={form.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormControl><Input placeholder="YOU@MCTRGIT.AC.IN" {...field} className="bg-white/5 border-white/5 text-white h-14 rounded-lg placeholder:text-white/40" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="password" render={({ field }) => (
                                                <FormItem>
                                                    <FormControl><Input type="password" placeholder="••••••••" {...field} className="bg-white/5 border-white/5 text-white h-14 rounded-lg placeholder:text-white/40" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-teal-400 text-black font-black h-16 rounded-xl">
                                                {isLoading ? "AUTHORIZING..." : "ENTER PORTAL"}
                                            </Button>
                                        </form>
                                    </Form>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                                <Link to="/signup" className="hover:text-primary transition-colors">Request Account</Link>
                                <Link to="/" className="hover:text-white transition-colors">Cancel Access</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-12 z-10 flex flex-col space-y-2 text-[9px] uppercase tracking-[0.5em] text-white/10 font-mono">
                <span>SYSTEM_STATUS: ONLINE</span>
                <span>AUTH_PROTOCOL: HMAC_HMAC_SHA256</span>
            </div>
        </div>
    );
};

export default LoginPage;
