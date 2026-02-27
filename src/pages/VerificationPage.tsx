import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Shield, RefreshCw, ArrowRight, Lock, Mail } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api-client";
import { safeNavigate } from "@/lib/utils";
import AuthPortal from "@/components/AuthPortal";
import SplitText from "@/components/SplitText";
import { Button } from "@/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "@/components/ui/use-toast";

const VerificationPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { verifyOtp, isAuthenticated, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [otp, setOtp] = useState("");
    const [timeLeft, setTimeLeft] = useState(120);
    const hasRedirected = useRef(false);

    // Get pending data from sessionStorage to display and for resend
    const pendingData = (() => {
        try {
            const raw = sessionStorage.getItem('berozgar_pending');
            return raw ? JSON.parse(raw) as { email: string; fullName: string; password: string } : null;
        } catch {
            return null;
        }
    })();
    const pendingEmail = pendingData?.email ?? null;

    // Redirect if already authenticated - only once per mount
    useEffect(() => {
        if (isAuthenticated && !authLoading && !hasRedirected.current) {
            hasRedirected.current = true;
            safeNavigate(navigate, location.pathname, "/home");
        }
    }, [isAuthenticated, authLoading, navigate, location.pathname]);

    // Single interval on mount — setter callback handles stopping at 0
    // Avoids the chained re-registration bug where a new interval was created
    // every time timeLeft changed (old and new intervals both running).
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Guard: if no pending signup data and not authenticated, redirect to signup
    useEffect(() => {
        if (!pendingData && !isAuthenticated && !authLoading) {
            navigate('/signup', { replace: true });
        }
    }, [pendingData, isAuthenticated, authLoading, navigate]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    const handleVerify = async () => {
        if (otp.length < 6 || hasRedirected.current) return;

        setIsLoading(true);
        try {
            await verifyOtp(otp);
            toast({
                title: "Email Verified!",
                description: "Your account is ready. You are now logged in.",
            });
            // Navigation is handled by the useEffect watching isAuthenticated
        } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            // AUTH-UX-01: distinguish expired OTP from wrong OTP so the user
            // knows whether to resend or just retype.
            const isExpired = /expired|expir/i.test(msg);
            toast({
                title: isExpired ? "Code Expired" : "Verification Failed",
                description: isExpired
                    ? "Your code has expired. Click \"Resend Code\" to get a new one."
                    : "Invalid or incorrect code. Please check and try again.",
                variant: "destructive",
            });
            setIsLoading(false);
        }
    };

    const resendOtp = async () => {
        if (!pendingData) {
            toast({
                title: "Cannot Resend",
                description: "No pending registration found. Please sign up again.",
                variant: "destructive",
            });
            return;
        }
        try {
            // AUTH-UX-02: use the dedicated resend endpoint (not /auth/signup).
            // Calling signup again hits the 3/min rate limit and returns 409 Conflict.
            await api.post('/auth/resend-otp', {
                email: pendingData.email,
            }, { skipAuth: true });
            setTimeLeft(120);
            toast({
                title: "Code Resent",
                description: "A new verification code has been sent to your email.",
            });
        } catch {
            toast({
                title: "Resend Failed",
                description: "Could not resend verification code. Please try again.",
                variant: "destructive",
            });
        }
    };

    return (
        <AuthPortal>
            <div className="flex flex-col items-center justify-center text-center space-y-12 max-w-2xl mx-auto">
                {/* Header Section */}
                <div className="space-y-6">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />
                        <div className="relative w-24 h-24 bg-black border border-white/10 rounded-full flex items-center justify-center mx-auto">
                            <Mail className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight font-display uppercase italic italic-syne">
                            <SplitText className="inline-block" trigger="load">
                                VERIFY EMAIL
                            </SplitText>
                        </h1>
                        <p className="text-white/40 text-sm tracking-[0.3em] uppercase">
                            Enter the 6-digit code sent to your inbox
                        </p>
                        {pendingEmail && (
                            <p className="text-primary/60 text-xs mt-2 font-mono">
                                {pendingEmail}
                            </p>
                        )}
                    </div>
                </div>

                {/* OTP delivery guidance */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm w-full">
                    <div className="flex items-start gap-3">
                        <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-white/50 text-xs text-left leading-relaxed">
                            Use the verification code sent to your registered email address.
                            If you cannot find it, check your spam folder or resend the code.
                        </p>
                    </div>
                </div>

                {/* OTP Input Section */}
                <div className="space-y-8 w-full flex flex-col items-center">
                    <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={(val) => setOtp(val)}
                        className="gap-4"
                    >
                        <InputOTPGroup className="gap-4">
                            {[0, 1, 2, 3, 4, 5].map((idx) => (
                                <InputOTPSlot
                                    key={idx}
                                    index={idx}
                                    className="w-12 h-16 md:w-16 md:h-20 bg-black/50 border-white/10 text-white text-2xl font-display focus:border-primary transition-all duration-300"
                                />
                            ))}
                        </InputOTPGroup>
                    </InputOTP>

                    <div className="flex flex-col items-center space-y-4 w-full max-w-sm">
                        <Button
                            onClick={handleVerify}
                            disabled={isLoading || otp.length < 6}
                            className="w-full bg-primary hover:bg-teal-400 text-black font-bold h-14 rounded-none group relative overflow-hidden transition-all duration-500"
                        >
                            <span className="relative z-10 flex items-center justify-center space-x-2">
                                {isLoading ? "VERIFYING..." : "VERIFY & LOGIN"}
                                {!isLoading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                            </span>
                            <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                        </Button>

                        <div className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-widest text-white/40 px-2">
                            <button
                                onClick={resendOtp}
                                disabled={timeLeft > 0}
                                className={`flex items-center space-x-1 transition-colors ${timeLeft > 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-primary cursor-pointer'}`}
                            >
                                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Resend Code</span>
                            </button>
                            <span className={timeLeft < 30 ? 'text-red-500' : ''}>
                                {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                            </span>
                        </div>

                        <Link to="/login" className="text-white/30 text-[10px] uppercase tracking-widest hover:text-primary transition-colors mt-2">
                            Back to Sign In
                        </Link>
                    </div>
                </div>

                {/* Visual Decoration */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="relative h-24 w-24 opacity-30 grayscale flex items-center justify-center">
                    <Shield className="w-16 h-16 text-white/20" strokeWidth={1} />
                </div>

                <p className="text-white/20 text-[9px] uppercase tracking-[0.2em] font-body max-w-xs">
                    Once verified, your login credentials are confirmed and you'll be signed in automatically.
                </p>
            </div>
        </AuthPortal>
    );
};

export default VerificationPage;
