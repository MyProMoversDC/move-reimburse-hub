import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MoverNotification {
  id: string;
  notification_type: string;
  reference_type: string;
  reference_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const useMoverNotifications = (userId: string) => {
  const [notifications, setNotifications] = useState<MoverNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('mover_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
      setHasUnread(unread > 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('mover_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('mover_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('mover-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mover_notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mover_notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  return { 
    notifications, 
    unreadCount, 
    hasUnread, 
    markAsRead, 
    markAllAsRead, 
    refetch: fetchNotifications 
  };
};
