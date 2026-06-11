import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MoverRating { mover_id: string; score: number; stars: number; updated_at: string; }
export interface RatingEvent {
  id: string;
  mover_id: string;
  event_type: string;
  delta: number;
  reason: string | null;
  source_id: string | null;
  source_table: string | null;
  created_by: string | null;
  created_at: string;
}
export interface MoverProfile { id: string; first_name: string; last_name: string; email: string | null; avatar_url: string | null; }

export function useMoverRating(moverId?: string) {
  return useQuery({
    queryKey: ["mover-rating", moverId],
    enabled: !!moverId,
    queryFn: async () => {
      const { data, error } = await supabase.from("mover_ratings").select("*").eq("mover_id", moverId!).maybeSingle();
      if (error) throw error;
      return (data as MoverRating | null) ?? { mover_id: moverId!, score: 40, stars: 4.0, updated_at: new Date().toISOString() };
    },
  });
}

export function useMoverRatingEvents(moverId?: string) {
  return useQuery({
    queryKey: ["mover-rating-events", moverId],
    enabled: !!moverId,
    queryFn: async () => {
      const { data, error } = await supabase.from("mover_rating_events").select("*").eq("mover_id", moverId!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RatingEvent[];
    },
  });
}

export function useAllMoverRatings() {
  return useQuery({
    queryKey: ["all-mover-ratings"],
    queryFn: async () => {
      const { data: roles, error: e1 } = await supabase.from("user_roles").select("user_id").eq("role", "mover");
      if (e1) throw e1;
      const moverIds = (roles ?? []).map((r: any) => r.user_id);
      if (moverIds.length === 0) return [];
      const [{ data: profiles }, { data: ratings }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, email, avatar_url").in("id", moverIds),
        supabase.from("mover_ratings").select("*").in("mover_id", moverIds),
      ]);
      const map = new Map((ratings ?? []).map((r: any) => [r.mover_id, r]));
      return (profiles ?? []).map((p: any) => ({
        ...p,
        rating: map.get(p.id) ?? { mover_id: p.id, score: 40, stars: 4.0, updated_at: null },
      }));
    },
  });
}

export function useAllRatingEvents(limit = 1000) {
  return useQuery({
    queryKey: ["all-rating-events", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mover_rating_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RatingEvent[];
    },
  });
}
