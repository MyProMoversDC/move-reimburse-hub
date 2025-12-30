import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useUnreadMessages = (userId: string) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;

    try {
      // Get all conversations where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setUnreadCount(0);
        setHasUnread(false);
        return;
      }

      let totalUnread = 0;

      // Count unread messages across all conversations
      for (const participant of participantData) {
        let query = supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', participant.conversation_id)
          .neq('sender_id', userId);

        if (participant.last_read_at) {
          query = query.gt('created_at', participant.last_read_at);
        }

        const { count } = await query;
        totalUnread += count || 0;
      }

      setUnreadCount(totalUnread);
      setHasUnread(totalUnread > 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('unread-messages-tracker')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as { sender_id: string };
          // If the message is from someone else, refresh the count
          if (newMessage.sender_id !== userId) {
            fetchUnreadCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // When last_read_at is updated, refresh the count
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCount]);

  return { unreadCount, hasUnread, refetch: fetchUnreadCount };
};
