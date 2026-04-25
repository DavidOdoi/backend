const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const norm = (value) => (value || "").toString().toLowerCase().trim();
const includesText = (haystack, needle) =>
  !!(haystack && needle && norm(haystack).includes(norm(needle)));

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geoNear(geoA, geoB, thresholdKm) {
  if (!geoA?.lat || !geoA?.lng || !geoB?.lat || !geoB?.lng) return false;
  return haversineKm(geoA.lat, geoA.lng, geoB.lat, geoB.lng) <= thresholdKm;
}

// ─── Hard filters ────────────────────────────────────────────────────────────

function meetsStrictRequirements(load, driver) {
  // Weight capacity
  if (typeof load.weight === "number" && typeof driver.maxWeight === "number") {
    if (load.weight > driver.maxWeight) return false;
  }

  // Truck type
  if (load.truckType) {
    if (!Array.isArray(driver.truckTypes) || !driver.truckTypes.some((t) => includesText(t, load.truckType))) {
      return false;
    }
  }

  // Special requirements
  if (Array.isArray(load.specialRequirements) && load.specialRequirements.length > 0) {
    const missing = load.specialRequirements.filter(
      (req) => !driver.specialCapabilities?.some((cap) => includesText(cap, req))
    );
    if (missing.length > 0) return false;
  }

  // Off-duty drivers are a hard disqualifier
  if (driver.availability?.status === "off") return false;

  // Availability window: if load has pickupDate and driver has a set window, they must overlap
  if (load.pickupDate && driver.availability?.from && driver.availability?.to) {
    const pickupTime = new Date(load.pickupDate).getTime();
    const availFrom = new Date(driver.availability.from).getTime();
    const availTo = new Date(driver.availability.to).getTime();
    if (pickupTime < availFrom || pickupTime > availTo) return false;
  }

  return true;
}

// ─── Scoring components ───────────────────────────────────────────────────────

// 1. Proximity — 0 to 25 pts
// Continuous exponential decay so every km difference matters.
// 25 × e^(−km/80): driver 10 km away ≈ 22 pts, 50 km ≈ 14 pts, 150 km ≈ 5 pts
function scoreProximity(distanceKm) {
  if (distanceKm === undefined || distanceKm === null) return 0;
  return Math.round(25 * Math.exp(-distanceKm / 80) * 10) / 10;
}

// 2. Price fit — 0 to 20 pts
// Compares estimated fare (pricePerKm × distance) against the load budget.
// At-budget → 0 pts. Half the budget → 10 pts. Far under budget → up to 20 pts.
function scorePriceFit(load, driver, distanceKm) {
  if (!load.budget || !driver.pricePerKm || distanceKm === undefined) return 0;
  const estimatedFare = driver.pricePerKm * distanceKm;
  if (estimatedFare <= 0) return 0;
  const ratio = (load.budget - estimatedFare) / load.budget;
  return clamp(Math.round(ratio * 20 * 10) / 10, 0, 20);
}

// 3. Route familiarity — 0 to 20 pts
// Uses geocoordinates (Haversine) when available — falls back to text matching.
// Full paired match (from AND to both within threshold) → 20 pts.
// Driver currently near pickup → 10 pts.
// One end matches → 5 pts.
const ROUTE_THRESHOLD_KM = 50; // within 50 km counts as a route endpoint match

function scoreRoute(load, driver) {
  const pickup = norm(load.pickupCity || load.pickupLocation || "");
  const delivery = norm(load.deliveryCity || load.deliveryLocation || "");
  const routes = driver.preferredRoutes || [];

  // --- Geo-based matching (preferred) ---
  const pickupGeo = load.pickupGeo;
  const deliveryGeo = load.deliveryGeo;

  if (pickupGeo && deliveryGeo) {
    const geoPairedMatch = routes.some(
      (r) =>
        geoNear(r.fromGeo, pickupGeo, ROUTE_THRESHOLD_KM) &&
        geoNear(r.toGeo, deliveryGeo, ROUTE_THRESHOLD_KM)
    );
    if (geoPairedMatch) return 20;

    // Driver's current position near pickup
    if (geoNear(driver.currentLocationGeo, pickupGeo, ROUTE_THRESHOLD_KM)) return 10;

    const geoPartialMatch = routes.some(
      (r) =>
        geoNear(r.fromGeo, pickupGeo, ROUTE_THRESHOLD_KM) ||
        geoNear(r.toGeo, deliveryGeo, ROUTE_THRESHOLD_KM)
    );
    if (geoPartialMatch) return 5;

    // Both load and driver have geo but nothing matched
    return 0;
  }

  // --- Text-based fallback ---
  const pairedMatch = routes.some(
    (r) => includesText(r.from, pickup) && includesText(r.to, delivery)
  );
  if (pairedMatch) return 20;

  if (pickup && includesText(driver.currentLocation, pickup)) return 10;

  const partialMatch = routes.some(
    (r) => includesText(r.from, pickup) || includesText(r.to, delivery)
  );
  if (partialMatch) return 5;

  return 0;
}

// 4. Cargo expertise — 0 to 15 pts
function scoreCargoExpertise(load, driver) {
  if (!load.cargoType || !Array.isArray(driver.cargoTypes) || !driver.cargoTypes.length) return 0;
  return driver.cargoTypes.some((c) => includesText(c, load.cargoType)) ? 15 : 0;
}

// 5. Reliability — 0 to 15 pts (rating 0–7 + experience 0–4 + completion rate 0–4)
function scoreReliability(driver) {
  // Rating: 0–7 pts
  const rating = typeof driver.rating === "number" ? driver.rating : 4.5;
  const ratingPts = clamp((rating / 5) * 7, 0, 7);

  // Experience: 0–4 pts
  let expPts = 0;
  if (typeof driver.experienceYears === "number") {
    if (driver.experienceYears >= 5) expPts = 4;
    else if (driver.experienceYears >= 3) expPts = 3;
    else if (driver.experienceYears >= 1) expPts = 1;
  }

  // Completion rate: 0–4 pts
  let completionPts = 2; // new driver with no history gets benefit of the doubt
  const total = driver.totalTrips || 0;
  if (total > 0) {
    const completed = driver.completedTrips || 0;
    const rate = (completed / total) * 100;
    if (rate >= 95) completionPts = 4;
    else if (rate >= 85) completionPts = 3;
    else if (rate >= 70) completionPts = 2;
    else if (rate >= 50) completionPts = 1;
    else completionPts = 0;
  }

  return Math.round((ratingPts + expPts + completionPts) * 10) / 10;
}

// 6. Availability status — 0 to 5 pts
function scoreAvailability(driver) {
  return driver.availability?.status === "available" ? 5 : 0;
}

// 7. ETA bonus — 0 to 5 pts (small bonus, pushes very close drivers higher)
function scoreETA(durationMin) {
  if (durationMin === undefined || durationMin === null) return 0;
  if (durationMin < 30) return 5;
  if (durationMin < 60) return 3;
  if (durationMin < 120) return 1;
  return 0;
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

function scoreDriverForLoad(load, driver) {
  const reasons = [];
  let score = 0;
  const distKm = driver._distanceKm;

  // 1. Proximity (0–25)
  const proximityPts = scoreProximity(distKm);
  score += proximityPts;
  if (distKm !== undefined) {
    reasons.push(`${distKm.toFixed(1)} km from pickup (+${proximityPts.toFixed(1)} pts)`);
  } else {
    reasons.push("Distance unknown — no proximity score");
  }

  // 2. Price fit (0–20)
  const pricePts = scorePriceFit(load, driver, distKm);
  score += pricePts;
  if (load.budget && driver.pricePerKm && distKm !== undefined) {
    const est = Math.round(driver.pricePerKm * distKm);
    reasons.push(`Est. cost KES ${est} vs budget KES ${load.budget} (+${pricePts.toFixed(1)} pts)`);
  }

  // 3. Route familiarity (0–20)
  const routePts = scoreRoute(load, driver);
  score += routePts;
  if (routePts === 20) reasons.push("Preferred route: full match");
  else if (routePts === 10) reasons.push("Driver currently near pickup");
  else if (routePts === 5) reasons.push("Partial route match");

  // 4. Cargo expertise (0–15)
  const cargoPts = scoreCargoExpertise(load, driver);
  score += cargoPts;
  if (cargoPts > 0) reasons.push(`Specialises in ${load.cargoType}`);

  // 5. Reliability (0–15)
  const relPts = scoreReliability(driver);
  score += relPts;
  const compRate = driver.totalTrips > 0
    ? `${Math.round((driver.completedTrips / driver.totalTrips) * 100)}% completion`
    : "new driver";
  reasons.push(`${driver.rating?.toFixed(1) ?? "4.5"}★, ${driver.experienceYears ?? 0} yrs exp, ${compRate}`);

  // 6. Availability (0–5)
  const availPts = scoreAvailability(driver);
  score += availPts;
  reasons.push(availPts > 0 ? "Currently available" : "Driver is busy");

  // 7. ETA bonus (0–5)
  if (driver._durationMin !== undefined) {
    const etaPts = scoreETA(driver._durationMin);
    score += etaPts;
    if (etaPts > 0) reasons.push(`ETA to pickup: ~${Math.round(driver._durationMin)} min`);
  }

  return { score: clamp(Math.round(score), 0, 100), reasons };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function findMatches(load, drivers, limit = 5, options = { strict: true }) {
  const eligible = options.strict
    ? drivers.filter((d) => meetsStrictRequirements(load, d))
    : drivers;

  const scored = eligible.map((driver) => {
    const { score, reasons } = scoreDriverForLoad(load, driver);
    const estimatedFare =
      driver.pricePerKm && driver._distanceKm !== undefined
        ? Math.round(driver.pricePerKm * driver._distanceKm)
        : null;

    return {
      driver,
      score,
      reasons,
      distanceKm: driver._distanceKm,
      durationMin: driver._durationMin,
      estimatedFare
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { findMatches };
