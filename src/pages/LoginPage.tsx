import { useState, useEffect, useRef, lazy, Suspense } from "react";
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

    // Redirect destination - either from state or default to /home
    const from = (location.state as { from?: string })?.from || "/home";

    // Redirect if already logged in - only once per mount
    useEffect(() => {
        if (isAuthenticated && !authLoading && !hasRedirected.current) {
            hasRedirected.current = true;
            safeNavigate(navigate, location.pathname, from);
        }
    }, [isAuthenticated, authLoading, navigate, from, location.pathname]);

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        if (hasRedirected.current) return;
        
        setIsLoading(true);
        try {
            await login(values.email, values.password);
            toast({
                title: "Access Granted",
                description: "Welcome to the BErozgar Trust Exchange.",
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
            toast({
                title: "Access Denied",
                description: msg,
                variant: "destructive",
            });
            setIsLoading(false);
        }
    }

    async function handleGoogleClick() {
        if (hasRedirected.current || isGoogleLoading) return;

        try {
            const result = await promptSignIn();
            await googleSignIn(result.credential);
            toast({
                title: "Google Sign-In Successful",
                description: `Signed in as ${result.email || 'your Google account'}`,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not authenticate with Google.";
            toast({
                title: "Google Sign-In Failed",
                description: msg,
                variant: "destructive",
            });
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black overflow-hidden">
            {/* ── 3D Lanyard Campus ID Background ── */}
            <Suspense fallback={null}>
                <Lanyard position={[0, 0, 30]} gravity={[0, -40, 0]} fov={20} transparent />
            </Suspense>

            {/* ── "MCTRGIT CAMPUS ID" watermark title ── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[1]">
                <div className="text-center">
                    <p className="text-[10px] md:text-xs tracking-[0.5em] uppercase text-white/10 font-mono mb-2">
                        BEROZGAR // CAMPUS_ECOSYSTEM
                    </p>
                    <h1 className="text-[4rem] md:text-[7rem] lg:text-[9rem] font-bold text-white/[0.04] uppercase leading-none font-display italic tracking-tight">
                        CAMPUS ID
                    </h1>
                </div>
            </div>

            {/* ── Login Form Overlay ── */}
            <div className="absolute inset-0 z-10 flex items-center justify-end p-6 md:p-12 lg:pr-24 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-md">
                    {/* Header */}
                    <div className="mb-8 space-y-3">
                        <div className="flex items-center space-x-2 text-primary">
                            <Shield className="w-4 h-4 animate-pulse" />
                            <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Verified Entry</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white uppercase italic font-display">
                            <SplitText className="inline-block" trigger="load">
                                SECURE ACCESS
                            </SplitText>
                        </h2>
                        <p className="text-white/40 text-sm max-w-sm font-body leading-relaxed">
                            Use your <span className="text-primary font-semibold">@mctrgit.ac.in</span> Google account for instant access.
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-teal-500/20 rounded-2xl blur-xl transition-all duration-1000 group-hover:opacity-100 opacity-50" />

                        <div className="relative bg-[#0a0a0a]/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
                            {/* ── Google Sign-In — Primary CTA ── */}
                            <Button
                                type="button"
                                onClick={handleGoogleClick}
                                disabled={isGoogleLoading || isLoading}
                                className="w-full h-14 mb-4 bg-white hover:bg-gray-50 text-gray-800 font-bold text-base rounded-xl flex items-center justify-center gap-3 transition-all duration-300 border border-gray-200 shadow-lg hover:shadow-xl hover:scale-[1.01]"
                            >
                                <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                {isGoogleLoading ? "Signing in..." : "Continue with Google"}
                            </Button>

                            <p className="text-center text-white/25 text-[10px] mb-6 tracking-wide">
                                Recommended — instant access with your campus Google account
                            </p>

                            {/* ── Email/Password Toggle ── */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex-1 h-px bg-white/10" />
                                <button
                                    type="button"
                                    onClick={() => setShowEmailForm((p) => !p)}
                                    className="text-white/30 text-[10px] uppercase tracking-widest font-bold hover:text-white/50 transition-colors flex items-center gap-1"
                                >
                                    or use email
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`} />
                                </button>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* ── Collapsible Email Form ── */}
                            <div
                                className={`grid transition-all duration-300 ease-in-out ${showEmailForm ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                            >
                                <div className="overflow-hidden">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Email Address</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="you@mctrgit.ac.in"
                                                        {...field}
                                                        className="bg-black/50 border-white/10 text-white h-12 rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-primary transition-all duration-300"
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-red-400 text-[11px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Password</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        {...field}
                                                        className="bg-black/50 border-white/10 text-white h-12 rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-primary transition-all duration-300"
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-red-400 text-[11px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex flex-col space-y-4 pt-4">
                                        <Button
                                            type="submit"
                                            disabled={isLoading || isGoogleLoading}
                                            className="w-full bg-primary hover:bg-teal-400 text-black font-bold h-14 rounded-none group/btn relative overflow-hidden transition-all duration-500"
                                        >
                                            <span className="relative z-10 flex items-center justify-center space-x-2">
                                                {isLoading ? "AUTHORIZING..." : "ENTER PORTAL"}
                                                {!isLoading && <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />}
                                            </span>
                                            <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover/btn:translate-x-0 transition-transform duration-500" />
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                                </div>
                            </div>

                            {/* ── Nav Links (always visible) ── */}
                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-white/40 pt-4 mt-4 border-t border-white/5">
                                <Link to="/signup" className="hover:text-primary transition-colors underline-reveal">
                                    Request Access
                                </Link>
                                <Link to="/" className="hover:text-white transition-colors opacity-50">
                                    Back to Home
                                </Link>
                            </div>

                            <div className="mt-6 flex items-center justify-center space-x-2 text-[9px] text-white/20 uppercase tracking-[0.3em]">
                                <Shield className="w-3 h-3" />
                                <span>Zero-Exposure Security Protocol</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom meta bar ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 text-[9px] uppercase tracking-[0.3em] text-white/15 font-mono pointer-events-none">
                <span>BEROZGAR // CAMPUS_ECOSYSTEM</span>
                <span>EST. 2026 // V0.1.0</span>
            </div>

        </div>
    );
};

export default LoginPage;
