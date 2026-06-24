// Cluster a day's inv_job_orders into N routes (k-means + nearest-neighbor).
// Writes to planning_routes / planning_stops.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Stop { job_id: string; address: string; lat: number; lng: number; }

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function kmeans(points: Stop[], k: number, iters = 50): number[] {
  if (points.length === 0) return [];
  if (k <= 1) return points.map(() => 0);
  k = Math.min(k, points.length);
  const centroids: { lat: number; lng: number }[] = [{ lat: points[0].lat, lng: points[0].lng }];
  while (centroids.length < k) {
    let bestIdx = 0, bestDist = -1;
    for (let i = 0; i < points.length; i++) {
      let minD = Infinity;
      for (const c of centroids) { const d = haversine(points[i], c); if (d < minD) minD = d; }
      if (minD > bestDist) { bestDist = minD; bestIdx = i; }
    }
    centroids.push({ lat: points[bestIdx].lat, lng: points[bestIdx].lng });
  }
  const assignments = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = haversine(points[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    const sums = Array.from({ length: k }, () => ({ lat: 0, lng: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const a = assignments[i]; sums[a].lat += points[i].lat; sums[a].lng += points[i].lng; sums[a].n += 1;
    }
    for (let c = 0; c < k; c++) if (sums[c].n > 0) centroids[c] = { lat: sums[c].lat / sums[c].n, lng: sums[c].lng / sums[c].n };
    if (!changed) break;
  }
  return assignments;
}
function orderStops(stops: Stop[]): Stop[] {
  if (stops.length <= 1) return stops;
  const centroid = { lat: stops.reduce((s, p) => s + p.lat, 0) / stops.length, lng: stops.reduce((s, p) => s + p.lng, 0) / stops.length };
  let startIdx = 0, startD = Infinity;
  for (let i = 0; i < stops.length; i++) { const d = haversine(stops[i], centroid); if (d < startD) { startD = d; startIdx = i; } }
  const remaining = stops.slice();
  const ordered: Stop[] = [remaining.splice(startIdx, 1)[0]];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) { const d = haversine(last, remaining[i]); if (d < bestD) { bestD = d; bestI = i; } }
    ordered.push(remaining.splice(bestI, 1)[0]);
  }
  return ordered;
}
async function geocode(address: string, token: string) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const f = j?.features?.[0];
    if (!f?.center || !Array.isArray(f.center)) return null;
    return { lng: f.center[0] as number, lat: f.center[1] as number };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const MAPBOX = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!MAPBOX) return new Response(JSON.stringify({ error: "MAPBOX_ACCESS_TOKEN missing" }), { status: 500, headers: corsHeaders });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const r = (roles ?? []).map((x: any) => x.role);
    if (!r.includes("admin") && !r.includes("operations_manager")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const service_date = String(body?.service_date ?? "").slice(0, 10);
    const route_count = Math.max(1, Math.min(20, Number(body?.route_count) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(service_date)) {
      return new Response(JSON.stringify({ error: "service_date (YYYY-MM-DD) required" }), { status: 400, headers: corsHeaders });
    }

    const { data: jobs } = await admin
      .from("inv_job_orders")
      .select("id, pickup_address, dropoff_address")
      .eq("job_date", service_date);

    const withAddr = (jobs ?? []).filter((j: any) => (j.pickup_address ?? j.dropoff_address ?? "").trim().length > 0);
    if (withAddr.length === 0) {
      return new Response(JSON.stringify({ error: "No jobs with address for that date" }), { status: 400, headers: corsHeaders });
    }

    const stops: Stop[] = [];
    const skipped: any[] = [];
    for (const j of withAddr as any[]) {
      const addr = j.pickup_address ?? j.dropoff_address;
      const g = await geocode(addr, MAPBOX);
      if (!g) { skipped.push({ id: j.id, address: addr, reason: "geocode_failed" }); continue; }
      stops.push({ job_id: j.id, address: addr, lat: g.lat, lng: g.lng });
    }
    if (stops.length === 0) {
      return new Response(JSON.stringify({ error: "Could not geocode any addresses", skipped }), { status: 400, headers: corsHeaders });
    }

    const k = Math.min(route_count, stops.length);
    const assignments = kmeans(stops, k);
    const clusters: Stop[][] = Array.from({ length: k }, () => []);
    stops.forEach((s, i) => clusters[assignments[i]].push(s));
    const ordered = clusters.map(orderStops);

    // Wipe prior draft routes for this date
    const { data: prior } = await admin
      .from("planning_routes").select("id").eq("route_date", service_date).eq("status", "draft");
    if (prior && prior.length > 0) {
      await admin.from("planning_routes").delete().in("id", prior.map((p: any) => p.id));
    }

    const result: any[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const cluster = ordered[i];
      if (cluster.length === 0) continue;
      const { data: route, error: rErr } = await admin
        .from("planning_routes")
        .insert({
          route_date: service_date,
          name: `Route ${i + 1}`,
          status: "draft",
          optimized_payload: { total_routes: k, stop_count: cluster.length },
          created_by: u.user.id,
        })
        .select("id, name").single();
      if (rErr) throw rErr;
      const stopRows = cluster.map((s, idx) => ({
        route_id: route.id,
        inv_job_order_id: s.job_id,
        stop_order: idx + 1,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
      }));
      const { error: sErr } = await admin.from("planning_stops").insert(stopRows);
      if (sErr) throw sErr;
      result.push({ ...route, stops: stopRows });
    }

    return new Response(JSON.stringify({ success: true, routes: result, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
