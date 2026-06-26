import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2 } from "lucide-react";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { supabase } from "@/integrations/supabase/client";

interface Ping {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignmentRowId: string; // mover_job_assignments.id
  moverName: string;
  jobNumber: string;
}

const fmtEst = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
  }) + " EST";

const MoverLiveTrackDialog = ({ open, onOpenChange, assignmentRowId, moverName, jobNumber }: Props) => {
  const { token, loading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const trailRef = useRef<string | null>(null);
  const [pings, setPings] = useState<Ping[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchPings = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("job_location_pings")
      .select("latitude,longitude,recorded_at,accuracy")
      .eq("mover_assignment_id", assignmentRowId)
      .order("recorded_at", { ascending: true })
      .limit(500);
    setPings((data ?? []) as Ping[]);
    setFetching(false);
  };

  useEffect(() => {
    if (!open) return;
    fetchPings();
    const interval = setInterval(fetchPings, 20000);
    const ch = supabase
      .channel(`job_pings_${assignmentRowId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_location_pings", filter: `mover_assignment_id=eq.${assignmentRowId}` },
        () => fetchPings()
      )
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignmentRowId]);

  // Init map
  useEffect(() => {
    if (!open || !token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.0, 40.7],
      zoom: 10,
    });
    return () => { mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; trailRef.current = null; };
  }, [open, token]);

  // Reset map when dialog closes
  useEffect(() => {
    if (!open && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      trailRef.current = null;
    }
  }, [open]);

  // Render pings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pings.length === 0) return;
    const last = pings[pings.length - 1];
    const lngLat: [number, number] = [last.longitude, last.latitude];

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,.5)";
      markerRef.current = new mapboxgl.Marker(el).setLngLat(lngLat).addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }

    const coords = pings.map((p) => [p.longitude, p.latitude]);
    const geojson = { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: coords }, properties: {} };

    const apply = () => {
      if (trailRef.current && map.getSource(trailRef.current)) {
        (map.getSource(trailRef.current) as mapboxgl.GeoJSONSource).setData(geojson as any);
      } else {
        const id = "trail";
        trailRef.current = id;
        if (!map.getSource(id)) {
          map.addSource(id, { type: "geojson", data: geojson as any });
          map.addLayer({ id, type: "line", source: id, paint: { "line-color": "#2563eb", "line-width": 3, "line-opacity": 0.7 } });
        }
      }
      if (pings.length === 1) map.flyTo({ center: lngLat, zoom: 14 });
      else {
        const b = new mapboxgl.LngLatBounds();
        coords.forEach((c) => b.extend(c as [number, number]));
        map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [pings]);

  const last = pings[pings.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Live Track — {moverName}
          </DialogTitle>
          <DialogDescription>Job #{jobNumber} · Updates every 20 seconds</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{pings.length} ping{pings.length === 1 ? "" : "s"}</Badge>
          {last && <span className="text-muted-foreground">Last: {fmtEst(last.recorded_at)}</span>}
          {fetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {loading ? (
          <div className="h-[420px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !token ? (
          <p className="text-destructive p-4">Mapbox token unavailable.</p>
        ) : (
          <div ref={containerRef} className="w-full h-[420px] rounded-lg overflow-hidden border" />
        )}

        {pings.length === 0 && !fetching && (
          <p className="text-sm text-muted-foreground text-center">
            No GPS data yet. Tracking starts when the mover taps "Moving to customer site".
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MoverLiveTrackDialog;
