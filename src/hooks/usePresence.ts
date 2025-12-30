import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceState {
  [key: string]: { user_id: string; online_at: string }[];
}

export const usePresence = (userId: string) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state: PresenceState = presenceChannel.presenceState();
        const online = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.user_id) {
              online.add(presence.user_id);
            }
          });
        });
        
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          newPresences.forEach((p: any) => {
            if (p.user_id) updated.add(p.user_id);
          });
          return updated;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          leftPresences.forEach((p: any) => {
            if (p.user_id) updated.delete(p.user_id);
          });
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [userId]);

  const isUserOnline = useCallback(
    (checkUserId: string) => onlineUsers.has(checkUserId),
    [onlineUsers]
  );

  return { onlineUsers, isUserOnline };
};
