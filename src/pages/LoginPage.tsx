import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import gsap from "gsap";
import { Shield, ArrowRight, Github } from "lucide-react";

import AuthPortal from "@/components/AuthPortal";
import Portal3D from "@/components/Portal3D";
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

const loginSchema = z.object({
    email: z.string().email({ message: "Invalid institutional email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

const LoginPage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setIsLoading(true);
        // Simulate API call
        console.log(values);

        setTimeout(() => {
            setIsLoading(false);
            toast({
                title: "Access Granted",
                description: "Welcome to the BErozgar Trust Exchange.",
            });
            navigate("/");
        }, 1500);
    }

    return (
        <AuthPortal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left Column: Typography & 3D */}
                <div className="flex flex-col space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-primary">
                            <Shield className="w-5 h-5 animate-pulse" />
                            <span className="text-sm font-medium tracking-[0.2em] uppercase">Verified Entry</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight font-display uppercase italic italic-syne">
                            <SplitText className="inline-block" trigger="load">
                                SECURE ACCESS PORTAL
                            </SplitText>
                        </h1>

                        <p className="text-white/60 text-lg max-w-md font-body leading-relaxed">
                            Internal exchange protocol for verified MCTRGIT students only.
                            Privacy-aware by design.
                        </p>
                    </div>

                    <div className="relative h-64 w-64 lg:h-96 lg:w-96 grayscale opacity-80 hover:grayscale-0 transition-all duration-700">
                        <Portal3D />
                    </div>
                </div>

                {/* Right Column: Form */}
                <div className="relative group">
                    {/* Decorative Glitch Background */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-teal-500/20 rounded-2xl blur-xl transition-all duration-1000 group-hover:opacity-100 opacity-50" />

                    <div className="relative bg-[#0a0a0a] border border-white/10 p-8 md:p-12 rounded-2xl shadow-2xl backdrop-blur-3xl overflow-hidden">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Institutional Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="email@mctrgit.edu.in"
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
                                            <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Access Code</FormLabel>
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
                                        disabled={isLoading}
                                        className="w-full bg-primary hover:bg-teal-400 text-black font-bold h-14 rounded-none group relative overflow-hidden transition-all duration-500"
                                    >
                                        <span className="relative z-10 flex items-center justify-center space-x-2">
                                            {isLoading ? "AUTHORIZING..." : "ENTER PORTAL"}
                                            {!isLoading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                                        </span>
                                        <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                                    </Button>

                                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-white/40 pt-4 border-t border-white/5">
                                        <Link to="/signup" className="hover:text-primary transition-colors cursor-none underline-reveal">
                                            Request Credentials
                                        </Link>
                                        <Link to="/forgot-password" className="hover:text-white transition-colors cursor-none opacity-50">
                                            Reset Access
                                        </Link>
                                    </div>
                                </div>
                            </form>
                        </Form>

                        {/* Subtle disclaimer */}
                        <div className="mt-8 flex items-center justify-center space-x-2 text-[9px] text-white/20 uppercase tracking-[0.3em]">
                            <Shield className="w-3 h-3" />
                            <span>Zero-Exposure Security Protocol Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </AuthPortal>
    );
};

export default LoginPage;
