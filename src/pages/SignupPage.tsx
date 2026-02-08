import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Mail, Shield, ArrowRight, Check } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
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

const signupSchema = z.object({
    fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Invalid institutional email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

const SignupPage = () => {
    const navigate = useNavigate();
    const { signup, isAuthenticated } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Redirect if already logged in
    if (isAuthenticated) {
        navigate("/home", { replace: true });
    }

    const form = useForm<z.infer<typeof signupSchema>>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            fullName: "",
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof signupSchema>) {
        setIsLoading(true);
        try {
            await signup(values.fullName, values.email, values.password);
            toast({
                title: "Registration Initialized",
                description: "Please verify your institutional email to complete the process.",
            });
            navigate("/verify");
        } catch (err) {
            toast({
                title: "Registration Failed",
                description: "Could not create your account. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <AuthPortal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left Column: Form */}
                <div className="order-2 lg:order-1 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-l from-primary/20 to-teal-500/20 rounded-2xl blur-xl transition-all duration-1000 group-hover:opacity-100 opacity-50" />

                    <div className="relative bg-[#0a0a0a] border border-white/10 p-8 md:p-12 rounded-2xl shadow-2xl backdrop-blur-3xl overflow-hidden">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Student Name</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <User className="absolute left-0 top-3 w-4 h-4 text-white/30" />
                                                    <Input
                                                        placeholder="John Doe"
                                                        {...field}
                                                        className="bg-black/50 border-white/10 text-white h-12 rounded-none border-b-2 border-x-0 border-t-0 pl-8 focus-visible:ring-0 focus-visible:border-primary transition-all duration-300"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-red-400 text-[11px]" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Institutional Email</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Mail className="absolute left-0 top-3 w-4 h-4 text-white/30" />
                                                    <Input
                                                        placeholder="email@mctrgit.edu.in"
                                                        {...field}
                                                        className="bg-black/50 border-white/10 text-white h-12 rounded-none border-b-2 border-x-0 border-t-0 pl-8 focus-visible:ring-0 focus-visible:border-primary transition-all duration-300"
                                                    />
                                                </div>
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
                                            <FormLabel className="text-white/70 uppercase tracking-widest text-[10px] font-bold">Create Access Code</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Shield className="absolute left-0 top-3 w-4 h-4 text-white/30" />
                                                    <Input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        {...field}
                                                        className="bg-black/50 border-white/10 text-white h-12 rounded-none border-b-2 border-x-0 border-t-0 pl-8 focus-visible:ring-0 focus-visible:border-primary transition-all duration-300"
                                                    />
                                                </div>
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
                                            {isLoading ? "INITIALIZING..." : "JOIN EXCHANGE"}
                                            {!isLoading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                                        </span>
                                        <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                                    </Button>

                                    <div className="flex items-center justify-center text-[11px] font-bold uppercase tracking-widest text-white/40 pt-4 border-t border-white/5">
                                        <span className="mr-2">Existing entity?</span>
                                        <Link to="/login" className="text-primary hover:text-teal-300 transition-colors underline-reveal">
                                            Access Portal
                                        </Link>
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>

                {/* Right Column: Information */}
                <div className="order-1 lg:order-2 flex flex-col space-y-8 lg:pl-12">
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight font-display uppercase italic italic-syne">
                            <SplitText className="inline-block" trigger="load">
                                CREDENTIAL EXTRACTION
                            </SplitText>
                        </h1>

                        <p className="text-white/60 text-lg max-w-md font-body leading-relaxed">
                            Create your secure identity for the BErozgar academic ecosystem.
                            Only institutional domains are accepted for verified participation.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-6">
                        {[
                            "Verified student-only marketplace",
                            "Privacy-first communication",
                            "Internal accommodation hub",
                            "Zero data commercialization"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start space-x-3 text-white/70">
                                <Check className="w-5 h-5 text-primary shrink-0" />
                                <span className="text-sm font-body tracking-wide">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="relative h-48 w-48 opacity-40 hover:opacity-100 transition-opacity duration-700 self-center lg:self-start">
                        <Portal3D />
                    </div>
                </div>
            </div>
        </AuthPortal>
    );
};

export default SignupPage;
