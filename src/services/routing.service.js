// OpenRouteService API integration for routing and distance matrix
// Provides better route calculations for logistics matching
const fetchFn = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then((mod) => mod.default(...args));

const OPENROUTE_BASE = "https://api.openrouteservice.org/v2";

const getOpenRouteKey = () => process.env.OPENROUTE_API_KEY;

// Get route between two points with distance and duration
async function getDirections(origin, destination) {
  const apiKey = getOpenRouteKey();
  if (!apiKey || !origin || !destination) return null;

  const url = `${OPENROUTE_BASE}/directions/driving-car/json`;

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat]
        ]
      })
    });
    if (!res.ok) return null;

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    return {
      distanceKm: (route.summary?.distance || 0) / 1000,
      durationMin: (route.summary?.duration || 0) / 60,
      geometry: route.geometry
    };
  } catch (err) {
    console.warn("OpenRouteService directions failed:", err?.message || err);
    return null;
  }
}

// Get distance matrix for multiple destinations from origin
async function getDistanceMatrix(origin, destinations) {
  const apiKey = getOpenRouteKey();
  if (!apiKey || !origin || destinations.length === 0) return [];

  // Build coordinates array: origin first, then destinations
  const allLocations = [origin, ...destinations];
  const locationsStr = allLocations
    .map((loc) => `${loc.lng},${loc.lat}`)
    .join("|");

  const url = `${OPENROUTE_BASE}/matrix/driving-car/json`;

  const body = {
    locations: allLocations.map((loc) => [loc.lng, loc.lat]),
    metrics: ["distance", "duration"],
    units: "km"
  };

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const error = await res.json();
      console.warn("OpenRouteService matrix error:", error);
      return [];
    }

    const data = await res.json();

    if (!data.distances || !data.durations) return [];

    // distances and durations are matrices where [i][j] is from location i to location j
    // We want distances and durations from origin (index 0) to each destination
    const distances = data.distances[0] || [];
    const durations = data.durations[0] || [];

    return destinations.map((_, idx) => {
      const destIdx = idx + 1; // +1 because origin is index 0
      return {
        distanceKm: distances[destIdx] || undefined,
        durationMin: (durations[destIdx] || 0) / 60 // Convert seconds to minutes
      };
    });
  } catch (err) {
    console.warn("OpenRouteService matrix failed:", err?.message || err);
    return [];
  }
}

// Enrich drivers with distance/duration from load pickup location
async function enrichDriversWithDistance(load, drivers) {
  if (!load?.pickupGeo) return drivers;

  const driversWithGeo = drivers.filter(
    (d) => d.currentLocationGeo?.lat && d.currentLocationGeo?.lng
  );

  if (driversWithGeo.length === 0) return drivers;

  const matrix = await getDistanceMatrix(
    load.pickupGeo,
    driversWithGeo.map((d) => d.currentLocationGeo)
  );

  if (matrix.length === 0) return drivers;

  driversWithGeo.forEach((driver, idx) => {
    const entry = matrix[idx];
    if (entry) {
      driver._distanceKm = entry.distanceKm;
      driver._durationMin = entry.durationMin;
    }
  });

  return drivers;
}

module.exports = {
  getDirections,
  getDistanceMatrix,
  enrichDriversWithDistance
};
