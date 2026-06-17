import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listNotifications,
  markAllRead,
  type Notification,
} from "@/lib/api/notifications.functions";

interface NotificationBellProps {
  unreadCount: number;
  onOpened: () => void;
}

const TYPE_ICON: Record<Notification["type"], string> = {
  prompt_sold: "💰",
  review_received: "⭐",
  report_resolved: "✅",
  review_reply: "💬",
};

export function NotificationBell({ unreadCount, onOpened }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (open: boolean) => {
    if (!open) return;
    onOpened();
    if (notifications !== null) return;
    setLoading(true);
    try {
      const list = await listNotifications();
      setNotifications(list);
      await markAllRead();
    } catch (err) {
      console.error("Failed to load notifications", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex items-center justify-center size-9 border-2 border-ink bg-white hover:bg-accent-yellow transition-colors"
        >
          <span className="text-lg">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-magenta text-white text-[10px] font-bold border-2 border-ink">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[60] w-80 p-0 border-2 border-ink shadow-pop bg-white rounded-none">
        <div className="border-b-2 border-ink px-4 py-2 font-display uppercase text-sm">
          Notifications
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-xs font-bold uppercase text-ink/40 animate-pulse">
              Loading…
            </p>
          ) : !notifications || notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs font-bold uppercase text-ink/40">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => {
              const content = (
                <div className="px-4 py-3 border-b border-ink/10 last:border-0 hover:bg-accent-yellow/40 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{TYPE_ICON[n.type]}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-xs uppercase">{n.title}</p>
                      {n.body && <p className="text-xs text-ink/60 mt-0.5">{n.body}</p>}
                    </div>
                  </div>
                </div>
              );
              return n.referenceId ? (
                <Link key={n.id} to="/prompt/$id" params={{ id: n.referenceId }}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
