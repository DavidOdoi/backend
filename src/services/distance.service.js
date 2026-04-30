// Optional GraphHopper integration for geocoding + distance matrix.
// Requires GRAPHHOPPER_KEY in env. If missing or request fails, silently skips enrichment.
// Mapbox is still supported as a fallback when MAPBOX_TOKEN is set.
const fetchFn = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then((mod) => mod.default(...args));

const GRAPH_HOPPER_BASE = "https://graphhopper.com/api/1";
const MAPBOX_BASE = "https://api.mapbox.com";

const getGraphHopperKey = () => process.env.GRAPHHOPPER_KEY || process.env.GRAPH_HOPPER_KEY;
const getMapboxToken = () => process.env.MAPBOX_TOKEN;

async function geocodeWithGraphHopper(query) {
  const key = getGraphHopperKey();
  if (!key || !query) return null;
  const url = `${GRAPH_HOPPER_BASE}/geocode?q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}&limit=1`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.hits?.[0];
    const lat = hit?.point?.lat ?? hit?.point?.latitude ?? hit?.lat;
    const lng = hit?.point?.lng ?? hit?.point?.lon ?? hit?.lng ?? hit?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  } catch (err) {
    console.warn("GraphHopper geocode failed:", err?.message || err);
    return null;
  }
}

async function geocodeWithMapbox(query) {
  const token = getMapboxToken();
  if (!token || !query) return null;
  const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    if (!center || center.length < 2) return null;
    return { lng: center[0], lat: center[1] };
  } catch (err) {
    console.warn("Mapbox geocode failed:", err?.message || err);
    return null;
  }
}

async function geocodeLocation(query) {
  const graph = await geocodeWithGraphHopper(query);
  if (graph) return graph;
  return geocodeWithMapbox(query);
}

async function getDistanceMatrixGraphHopper(origin, destinations) {
  const key = getGraphHopperKey();
  if (!key || !origin || destinations.length === 0) return [];
  const params = new URLSearchParams();
  params.append("from_point", `${origin.lat},${origin.lng}`);
  destinations.forEach((d) => params.append("to_point", `${d.lat},${d.lng}`));
  params.append("out_array", "distances");
  params.append("out_array", "times");
  params.append("profile", "car");
  params.append("key", key);
  const url = `${GRAPH_HOPPER_BASE}/matrix?${params.toString()}`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return [];
    const data = await res.json();
    const distances = data?.distances?.[0] || [];
    const times = data?.times?.[0] || [];
    return destinations.map((_, idx) => {
      const meters = distances[idx];
      const seconds = times[idx];
      return {
        distanceKm: typeof meters === "number" ? meters / 1000 : undefined,
        durationMin: typeof seconds === "number" ? seconds / 60 : undefined
      };
    });
  } catch (err) {
    console.warn("GraphHopper matrix failed:", err?.message || err);
    return [];
  }
}

async function getDistanceMatrixMapbox(origin, destinations) {
  const token = getMapboxToken();
  if (!token || !origin || destinations.length === 0) return [];
  const coords = [origin, ...destinations].map((c) => `${c.lng},${c.lat}`).join(";");
  const destinationIndexes = destinations.map((_, idx) => idx + 1).join(";");
  const url =
    `${MAPBOX_BASE}/directions-matrix/v1/mapbox/driving/${coords}` +
    `?annotations=distance,duration&sources=0&destinations=${destinationIndexes}&access_token=${token}`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return [];
    const data = await res.json();
    const distances = data?.distances?.[0] || [];
    const durations = data?.durations?.[0] || [];
    return destinations.map((_, idx) => {
      const meters = distances[idx];
      const seconds = durations[idx];
      return {
        distanceKm: typeof meters === "number" ? meters / 1000 : undefined,
        durationMin: typeof seconds === "number" ? seconds / 60 : undefined
      };
    });
  } catch (err) {
    console.warn("Mapbox matrix failed:", err?.message || err);
    return [];
  }
}

async function enrichDriversWithDistance(load, drivers) {
  if (!load?.pickupGeo) return drivers;
  const driversWithGeo = drivers.filter((d) => d.currentLocationGeo?.lat && d.currentLocationGeo?.lng);
  if (driversWithGeo.length === 0) return drivers;

  // Try OpenRouteService first (if API key is set)
  const { enrichDriversWithDistance: enrichWithOpenRoute } = require("./routing.service");
  const enrichedViaOpenRoute = await enrichWithOpenRoute(load, drivers);
  
  // Check if OpenRouteService worked (drivers have distance data)
  const hasDistance = enrichedViaOpenRoute.some((d) => d._distanceKm !== undefined);
  if (hasDistance) {
    return enrichedViaOpenRoute;
  }

  // Fallback to GraphHopper if OpenRouteService fails
  const matrix = (await getDistanceMatrixGraphHopper(load.pickupGeo, driversWithGeo.map((d) => d.currentLocationGeo))) ||
    [];
  if (matrix.length === 0) {
    const fallback = await getDistanceMatrixMapbox(load.pickupGeo, driversWithGeo.map((d) => d.currentLocationGeo));
    fallback.forEach((entry, idx) => {
      if (entry) {
        driversWithGeo[idx]._distanceKm = entry.distanceKm;
        driversWithGeo[idx]._durationMin = entry.durationMin;
      }
    });
    return drivers;
  }

  driversWithGeo.forEach((driver, idx) => {
    const entry = matrix[idx];
    if (entry) {
      driver._distanceKm = entry.distanceKm;
      driver._durationMin = entry.durationMin;
    }
  });

  return drivers;
}

module.exports = { geocodeLocation, enrichDriversWithDistance };
