import { useState, memo } from 'react';
import { Bell, CheckCircle2, MessageSquare, ShieldAlert } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface Notification {
    id: string;
    type: 'message' | 'approval' | 'alert' | 'success';
    title: string;
    description: string;
    time: string;
    isRead: boolean;
}

const NotificationCenter = memo(function NotificationCenter({ isDark }: { isDark: boolean }) {
    const [notifications, setNotifications] = useState<Notification[]>([
        {
            id: '1',
            type: 'approval',
            title: 'Listing Approved',
            description: 'Your scientific calculator listing has been verified and is now live.',
            time: '2m ago',
            isRead: false
        },
        {
            id: '2',
            type: 'message',
            title: 'New Transaction Request',
            description: 'A verified student is interested in your 2BHK flat listing.',
            time: '1h ago',
            isRead: false
        },
        {
            id: '3',
            type: 'alert',
            title: 'Security Protocol',
            description: 'Please review the updated consent sharing policy for peer exchanges.',
            time: '3h ago',
            isRead: true
        },
        {
            id: '4',
            type: 'success',
            title: 'Verification Complete',
            description: 'Your institutional ID was successfully audited by the administration.',
            time: '1d ago',
            isRead: true
        }
    ]);

    const [isOpen, setIsOpen] = useState(false);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageSquare className="w-4 h-4 text-primary" />;
            case 'approval': return <ShieldAlert className="w-4 h-4 text-teal-400" />;
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            default: return <Bell className="w-4 h-4 text-white/40" />;
        }
    };

    return (
        <Popover onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button className="relative group" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
                    <div className={`p-2 transition-all duration-300 ${isOpen ? 'rotate-12' : 'group-hover:-rotate-12'}`}>
                        <Bell className={`w-6 h-6 ${isDark ? 'text-portal-foreground' : 'text-foreground'} ${unreadCount > 0 ? 'animate-pulse' : 'opacity-60'}`} />
                    </div>
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 bg-primary text-black font-display font-bold text-[10px] h-5 w-5 flex items-center justify-center rounded-none border-none animate-bounce"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="end"
                className="w-80 md:w-96 bg-[#0a0a0a] border border-white/10 rounded-none p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="space-y-1">
                        <h4 className="text-white font-display font-bold uppercase tracking-tight">Notification Terminal</h4>
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Global Protocol Alerts</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={markAllAsRead}
                        className="text-[9px] uppercase font-bold tracking-widest text-primary hover:text-white p-0 hover:bg-transparent"
                    >
                        Acknowledge All
                    </Button>
                </div>

                {/* List */}
                <ScrollArea className="h-[400px]">
                    <div className="flex flex-col">
                        {notifications.map((notif, i) => (
                            <div
                                key={notif.id}
                                className={`relative p-6 border-b border-white/5 hover:bg-white/5 transition-all duration-300 group cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <div className="flex justify-between items-start">
                                            <h5 className={`text-xs font-bold uppercase tracking-widest ${notif.isRead ? 'text-white/60' : 'text-white'}`}>
                                                {notif.title}
                                            </h5>
                                            <span className="text-[9px] font-bold text-white/20 font-display">{notif.time}</span>
                                        </div>
                                        <p className="text-[11px] text-white/40 leading-relaxed font-body">
                                            {notif.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Glitch interaction on hover */}
                                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors pointer-events-none" />
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="p-4 bg-white/5 flex items-center justify-center">
                    <p className="text-[8px] uppercase font-bold tracking-[0.4em] text-white/20">
                        End of Operational Logs
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
});

export default NotificationCenter;
