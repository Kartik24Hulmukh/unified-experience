import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, RefreshCw, ArrowRight, Lock } from "lucide-react";

import AuthPortal from "@/components/AuthPortal";
import Portal3D from "@/components/Portal3D";
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
    const [isLoading, setIsLoading] = useState(false);
    const [otp, setOtp] = useState("");
    const [timeLeft, setTimeLeft] = useState(120);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    const handleVerify = () => {
        if (otp.length < 6) return;

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            toast({
                title: "Protocol Success",
                description: "Your identity has been verified. Welcome student.",
            });
            navigate("/");
        }, 1500);
    };

    const resendOtp = () => {
        setTimeLeft(120);
        toast({
            title: "Sequence Refreshed",
            description: "A new verification code has been dispatched.",
        });
    };

    return (
        <AuthPortal>
            <div className="flex flex-col items-center justify-center text-center space-y-12 max-w-2xl mx-auto">
                {/* Header Section */}
                <div className="space-y-6">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />
                        <div className="relative w-24 h-24 bg-black border border-white/10 rounded-full flex items-center justify-center mx-auto">
                            <Lock className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight font-display uppercase italic italic-syne">
                            <SplitText className="inline-block" trigger="load">
                                VERIFY IDENTITY
                            </SplitText>
                        </h1>
                        <p className="text-white/40 text-sm tracking-[0.3em] uppercase">
                            Secure sequence dispatched to institutional inbox
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
                                {isLoading ? "VALIDATING..." : "VERIFY ENTITY"}
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
                                <span>Resend Sequence</span>
                            </button>
                            <span className={timeLeft < 30 ? 'text-red-500' : ''}>
                                {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Visual Decoration */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="relative h-24 w-24 opacity-30 grayscale saturate-0">
                    <Portal3D />
                </div>

                <p className="text-white/20 text-[9px] uppercase tracking-[0.2em] font-body max-w-xs">
                    Multi-layer verification ensures zero-trust security between academic entities.
                </p>
            </div>
        </AuthPortal>
    );
};

export default VerificationPage;
