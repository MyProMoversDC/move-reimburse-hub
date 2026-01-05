import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMoverNotifications, MoverNotification } from "@/hooks/useMoverNotifications";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MoverNotificationBellProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: {
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    markAllRead: 'Mark all as read',
    approval: 'Approved',
    decline: 'Declined',
    appeal_decline: 'Appeal Declined',
    paid: 'Paid',
  },
  es: {
    notifications: 'Notificaciones',
    noNotifications: 'Sin notificaciones',
    markAllRead: 'Marcar todo como leído',
    approval: 'Aprobado',
    decline: 'Rechazado',
    appeal_decline: 'Apelación rechazada',
    paid: 'Pagado',
  },
  ru: {
    notifications: 'Уведомления',
    noNotifications: 'Нет уведомлений',
    markAllRead: 'Отметить все как прочитанные',
    approval: 'Одобрено',
    decline: 'Отклонено',
    appeal_decline: 'Апелляция отклонена',
    paid: 'Оплачено',
  },
};

const getNotificationBadgeVariant = (type: string): "default" | "destructive" | "secondary" | "outline" => {
  switch (type) {
    case 'approval':
    case 'paid':
      return 'default';
    case 'decline':
    case 'appeal_decline':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export const MoverNotificationBell = ({ userId, language }: MoverNotificationBellProps) => {
  const { notifications, unreadCount, hasUnread, markAsRead, markAllAsRead } = useMoverNotifications(userId);
  const t = translations[language];

  const handleNotificationClick = (notification: MoverNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold">{t.notifications}</span>
          {hasUnread && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-7 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {t.markAllRead}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {t.noNotifications}
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex flex-col items-start p-3 cursor-pointer",
                  !notification.is_read && "bg-muted/50"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Badge variant={getNotificationBadgeVariant(notification.notification_type)}>
                    {t[notification.notification_type as keyof typeof t] || notification.notification_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
                <span className="font-medium text-sm">{notification.title}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{notification.message}</span>
                {!notification.is_read && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="h-2 w-2 rounded-full bg-primary block" />
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
