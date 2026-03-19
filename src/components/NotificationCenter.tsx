import { useState, useMemo, memo } from 'react';
import { Bell, CheckCircle2, MessageSquare, ShieldAlert, Clock } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useRequests } from '@/hooks/api/useApi';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
    id: string;
    type: 'message' | 'approval' | 'alert' | 'success';
    title: string;
    description: string;
    time: string;
    isRead: boolean;
}

const ACK_STORAGE_KEY = 'berozgar_ack_notifications';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getAcknowledged(): Set<string> {
    try {
        const raw = localStorage.getItem(ACK_STORAGE_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function saveAcknowledged(ids: Set<string>) {
    try {
        localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify([...ids]));
    } catch { /* storage quota issues — silently fail */ }
}

function statusToNotification(req: { id: string; status: string; updatedAt: string; listingId: string }, userId: string, buyerId: string): Notification | null {
    const updatedAt = new Date(req.updatedAt);
    if (Date.now() - updatedAt.getTime() > ONE_DAY_MS) return null;

    const isBuyer = buyerId === userId;
    const timeLabel = updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    switch (req.status) {
        case 'ACCEPTED':
            return {
                id: `${req.id}:ACCEPTED`,
                type: 'approval',
                title: 'Request Accepted',
                description: isBuyer
                    ? 'The seller has accepted your request. Coordinate your meeting.'
                    : 'You accepted a request. Coordinate with the buyer for the exchange.',
                time: timeLabel,
                isRead: false,
            };
        case 'MEETING_SCHEDULED':
            return {
                id: `${req.id}:MEETING_SCHEDULED`,
                type: 'message',
                title: 'Meeting Scheduled',
                description: 'A meeting has been scheduled for this exchange.',
                time: timeLabel,
                isRead: false,
            };
        case 'COMPLETED':
            return {
                id: `${req.id}:COMPLETED`,
                type: 'success',
                title: 'Exchange Completed',
                description: 'The exchange was successfully completed. Trust score updated.',
                time: timeLabel,
                isRead: false,
            };
        case 'DECLINED':
            return {
                id: `${req.id}:DECLINED`,
                type: 'alert',
                title: 'Request Declined',
                description: isBuyer
                    ? 'Your request was declined. The listing may still be available.'
                    : 'You declined a request.',
                time: timeLabel,
                isRead: false,
            };
        case 'CANCELLED':
            return {
                id: `${req.id}:CANCELLED`,
                type: 'alert',
                title: 'Request Cancelled',
                description: 'This exchange request was cancelled.',
                time: timeLabel,
                isRead: false,
            };
        case 'DISPUTED':
            return {
                id: `${req.id}:DISPUTED`,
                type: 'alert',
                title: 'Dispute Filed',
                description: 'A dispute has been raised for this exchange. Admin review pending.',
                time: timeLabel,
                isRead: false,
            };
        case 'RESOLVED':
            return {
                id: `${req.id}:RESOLVED`,
                type: 'success',
                title: 'Dispute Resolved',
                description: 'The dispute for this exchange has been resolved by an admin.',
                time: timeLabel,
                isRead: false,
            };
        default:
            return null;
    }
}

const NotificationCenter = memo(function NotificationCenter({ isDark }: { isDark: boolean }) {
    const { user } = useAuth();
    const userId = user?.id ?? '';

    // Poll requests every 30 seconds to pick up status changes without a WebSocket
    // UX-04 FIX: refetchIntervalInBackground:false pauses polling when the tab
    // is hidden, saving battery/bandwidth on mobile and reducing server load.
    const { data: requestsData } = useRequests(undefined, {
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
        enabled: !!userId,
    });

    const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(getAcknowledged);

    const [isOpen, setIsOpen] = useState(false);

    const notifications = useMemo<Notification[]>(() => {
        const requests = requestsData?.data ?? [];
        return requests
            .flatMap((req) => {
                const notif = statusToNotification(req, userId, req.buyerId);
                return notif ? [notif] : [];
            })
            .map((n) => ({ ...n, isRead: acknowledgedIds.has(n.id) }))
            .sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));
    }, [requestsData, acknowledgedIds, userId]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAllAsRead = () => {
        // HIGH-04 FIX: prune acknowledged IDs to only include current notification IDs.
        // Without this, the set grows without bound across sessions as old request IDs
        // accumulate in localStorage, eventually degrading JSON parse/serialize perf.
        const currentIds = new Set(notifications.map(n => n.id));
        const allIds = new Set([...currentIds, ...[...acknowledgedIds].filter(id => currentIds.has(id))]);
        setAcknowledgedIds(allIds);
        saveAcknowledged(allIds);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageSquare className="w-4 h-4 text-primary" />;
            case 'approval': return <ShieldAlert className="w-4 h-4 text-teal-400" />;
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            case 'alert': return <Bell className="w-4 h-4 text-amber-400" />;
            default: return <Clock className="w-4 h-4 text-white/40" />;
        }
    };

    return (
        <Popover onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                {/* tap-target ensures the bell is at least 48×48 px on coarse-pointer devices */}
                <button className="relative group tap-target" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
                    <div className={`p-2 transition-all duration-300 ${isOpen ? 'rotate-12' : 'group-hover:-rotate-12'}`}>
                        <Bell className={`w-6 h-6 ${isDark ? 'text-portal-foreground' : 'text-foreground'} ${unreadCount > 0 ? 'opacity-100' : 'opacity-60'}`} />
                    </div>
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 bg-primary text-black font-display font-bold text-[10px] h-5 w-5 flex items-center justify-center rounded-none border-none"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="end"
                className="w-[min(24rem,calc(100vw-1rem))] max-h-[min(80vh,32rem)] bg-[#0a0a0a] border border-white/10 rounded-none p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/5 p-4 sm:p-6">
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
                <ScrollArea className="h-[min(65vh,24rem)]">
                    <div className="flex flex-col">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/20">
                                <Bell className="w-8 h-8 opacity-30" />
                                <p className="text-[10px] uppercase font-bold tracking-widest">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
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
                        ))
                        )}
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
