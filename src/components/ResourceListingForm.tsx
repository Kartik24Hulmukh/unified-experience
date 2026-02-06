import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, Shield, CheckCircle2, ArrowRight } from "lucide-react";

import SplitText from "@/components/SplitText";
import LivePreviewCard from "@/components/LivePreviewCard";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

const listingSchema = z.object({
    title: z.string().min(5, { message: "Title must be at least 5 characters" }).max(50),
    category: z.string({ required_error: "Please select a category" }),
    price: z.string().refine((val) => !isNaN(Number(val)), { message: "Price must be a number" }),
    description: z.string().min(20, { message: "Description must be at least 20 characters" }).max(500),
    consent: z.boolean().refine((val) => val === true, {
        message: "You must agree to the privacy protocol",
    }),
});

interface ListingFormProps {
    moduleName: string;
    moduleColor?: string;
    onSuccess: () => void;
}

const ResourceListingForm = ({ moduleName, moduleColor = "#00d4aa", onSuccess }: ListingFormProps) => {
    const [step, setStep] = useState(1);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const form = useForm<z.infer<typeof listingSchema>>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            title: "",
            category: "",
            price: "",
            description: "",
            consent: false,
        },
    });

    const watchAll = form.watch();

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    async function onSubmit(values: z.infer<typeof listingSchema>) {
        // Simulate submission
        console.log(values);
        toast({
            title: "Protocol Initialized",
            description: "Listing submitted for admin verification.",
        });
        setTimeout(() => {
            onSuccess();
        }, 2000);
    }

    return (
        <div className="flex flex-col md:flex-row gap-16 h-full">
            <div className="flex-1 max-w-2xl space-y-12">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-primary">
                        <Shield className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-[0.3em]">Institutional Asset Entry</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl text-white font-display font-bold uppercase italic italic-syne leading-none">
                        <SplitText trigger="load">MANIFEST RESOURCE</SplitText>
                    </h2>
                    <p className="text-white/40 font-body text-sm uppercase tracking-widest">
                        Module: {moduleName} Protocol Alpha
                    </p>
                </div>

                {/* Stepper */}
                <div className="flex items-center space-x-4 border-b border-white/5 pb-8">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`flex items-center space-x-2 transition-all duration-500 ${step === s ? 'opacity-100' : 'opacity-30'}`}
                        >
                            <span className={`w-8 h-8 flex items-center justify-center font-display font-bold border ${step >= s ? 'border-primary text-primary' : 'border-white/20 text-white'}`}>
                                0{s}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:block">
                                {s === 1 ? 'Details' : s === 2 ? 'Media' : 'Consent'}
                            </span>
                            {s < 3 && <div className="w-8 h-px bg-white/10 mx-2" />}
                        </div>
                    ))}
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {step === 1 && (
                            <div className="space-y-6 animate-fade-up">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Resource Title</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="What are you offering?"
                                                    {...field}
                                                    className="bg-black/40 border-white/10 text-white h-14 rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-primary"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-red-400 text-[10px]" />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="category"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-black/40 border-white/10 text-white h-14 rounded-none border-b-2 border-x-0 border-t-0 focus:ring-0">
                                                            <SelectValue placeholder="Select Category" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none">
                                                        <SelectItem value="books">Engineering Books</SelectItem>
                                                        <SelectItem value="calculators">Calculators</SelectItem>
                                                        <SelectItem value="instruments">Instruments</SelectItem>
                                                        <SelectItem value="electronics">Electronics</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-red-400 text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Price Index (INR)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="0.00"
                                                        {...field}
                                                        className="bg-black/40 border-white/10 text-white h-14 rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-primary"
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-red-400 text-[10px]" />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Technical Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Specify condition, edition, or technical specifications..."
                                                    className="bg-black/40 border-white/10 text-white min-h-[120px] rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-primary resize-none p-4"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-red-400 text-[10px]" />
                                        </FormItem>
                                    )}
                                />

                                <Button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="w-full bg-white hover:bg-primary text-black font-bold h-14 rounded-none group transition-all duration-500"
                                >
                                    NEXT PHASE <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1" />
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-8 animate-fade-up">
                                <div className="space-y-4">
                                    <FormLabel className="text-white/40 uppercase tracking-widest text-[9px] font-bold">Asset Visualization</FormLabel>
                                    <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 hover:border-primary/50 transition-colors cursor-pointer group bg-black/20">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Upload" className="w-full h-full object-contain p-4 grayscale group-hover:grayscale-0 transition-all" />
                                        ) : (
                                            <div className="flex flex-col items-center space-y-4">
                                                <Upload className="w-12 h-12 text-white/20 group-hover:text-primary transition-all duration-500" />
                                                <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Inject Media Layer</span>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </label>
                                    <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] italic">Capture original asset images. Stock photos result in approval rejection.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setStep(1)}
                                        className="h-14 rounded-none border border-white/10 hover:bg-white/5 text-white/60 font-bold"
                                    >
                                        BACK
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setStep(3)}
                                        className="h-14 rounded-none bg-white hover:bg-primary text-black font-bold group transition-all duration-500"
                                    >
                                        CONTINUE <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-12 animate-fade-up">
                                <div className="p-8 border border-primary/20 bg-primary/5 space-y-6">
                                    <h4 className="text-primary font-display font-bold uppercase tracking-widest">Privacy Protocol 3.1</h4>

                                    <FormField
                                        control={form.control}
                                        name="consent"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="mt-1 border-primary data-[state=checked]:bg-primary rounded-none"
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel className="text-[11px] text-white/80 font-body leading-relaxed">
                                                        I consent to sharing my internal institutional ID only with verified academic buyers who initiate a legitimate transaction request. I acknowledge that misrepresentation leads to permanent exclusion from the BErozgar ecosystem.
                                                    </FormLabel>
                                                    <FormMessage className="text-red-400 text-[10px]" />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setStep(2)}
                                        className="h-14 rounded-none border border-white/10 hover:bg-white/5 text-white/60 font-bold"
                                    >
                                        BACK
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="h-14 rounded-none bg-primary hover:bg-teal-400 text-black font-bold relative overflow-hidden group transition-all duration-500"
                                    >
                                        <span className="relative z-10 flex items-center">
                                            MANIFEST LISTING <CheckCircle2 className="ml-2 w-4 h-4" />
                                        </span>
                                        <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 opacity-50" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>
                </Form>
            </div>

            {/* Right Column: Live Preview */}
            <div className="hidden lg:flex flex-1 justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent blur-3xl opacity-30" />
                <LivePreviewCard
                    data={{
                        title: watchAll.title,
                        price: watchAll.price,
                        category: watchAll.category,
                        description: watchAll.description,
                        image: imagePreview
                    }}
                />
            </div>
        </div>
    );
};

export default ResourceListingForm;
