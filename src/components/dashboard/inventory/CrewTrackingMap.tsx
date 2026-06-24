import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

interface Ping {
  user_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  profiles?: { first_name: string; last_name: string };
}

const CrewTrackingMap = () => {
  const { token, loading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [pings, setPings] = useState<Ping[]>([]);

  const fetchLatest = async () => {
    // Fetch most recent ping per mover in last 2 hours
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("mover_location_pings")
      .select("user_id,lat,lng,recorded_at,profiles!mover_location_pings_user_id_fkey(first_name,last_name)")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(500);
    const seen = new Set<string>();
    const latest: Ping[] = [];
    (data || []).forEach((p: any) => {
      if (!seen.has(p.user_id)) { seen.add(p.user_id); latest.push(p); }
    });
    setPings(latest);
  };

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.0, 40.7],
      zoom: 9,
    });
    fetchLatest();
    const interval = setInterval(fetchLatest, 30000);
    const ch = supabase.channel("mover_pings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mover_location_pings" },
          () => fetchLatest()).subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(ch); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    // Clear old
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};
    pings.forEach(p => {
      const name = `${p.profiles?.first_name || ""} ${p.profiles?.last_name || ""}`.trim() || "Mover";
      const el = document.createElement("div");
      el.style.cssText = "width:14px;height:14px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.4)";
      const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<b>${name}</b><br/>${new Date(p.recorded_at).toLocaleString()}`))
        .addTo(map);
      markersRef.current[p.user_id] = m;
    });
    if (pings.length) {
      const bounds = new mapboxgl.LngLatBounds();
      pings.forEach(p => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 });
    }
  }, [pings]);

  return (
    <Card>
      <CardHeader className="bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Crew Tracking (Live)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Shows the latest location of each mover from the past 2 hours. Updates every 30 seconds.
        </div>
        {loading ? <p className="p-4">Loading map...</p>
        : !token ? <p className="p-4 text-destructive">Mapbox token unavailable.</p>
        : <div ref={containerRef} className="w-full h-[500px]" />}
      </CardContent>
    </Card>
  );
};

export default CrewTrackingMap;
