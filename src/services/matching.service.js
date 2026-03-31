const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const norm = (value) => (value || "").toString().toLowerCase();
const includesText = (haystack, needle) => haystack && needle && norm(haystack).includes(norm(needle));

// Distance-aware scoring: closer and faster is better.
function distanceScore(distanceKm) {
  if (distanceKm === undefined || distanceKm === null) return 0;
  if (distanceKm < 20) return 15;
  if (distanceKm < 50) return 10;
  if (distanceKm < 100) return 5;
  return 0;
}

function durationScore(durationMin) {
  if (durationMin === undefined || durationMin === null) return 0;
  if (durationMin < 30) return 10;
  if (durationMin < 60) return 7;
  if (durationMin < 120) return 4;
  return 0;
}

function meetsStrictRequirements(load, driver) {
  if (typeof load.weight === "number" && typeof driver.maxWeight === "number" && load.weight > driver.maxWeight) {
    return false;
  }
  if (load.truckType) {
    if (!Array.isArray(driver.truckTypes) || !driver.truckTypes.some((t) => includesText(t, load.truckType))) {
      return false;
    }
  }
  if (Array.isArray(load.specialRequirements) && load.specialRequirements.length > 0) {
    const missing = load.specialRequirements.filter(
      (req) => !driver.specialCapabilities?.some((cap) => includesText(cap, req))
    );
    if (missing.length > 0) return false;
  }
  return true;
}

function scoreDriverForLoad(load, driver) {
  let score = 0;
  const reasons = [];

  // Capacity
  if (typeof load.weight === "number" && typeof driver.maxWeight === "number") {
    if (load.weight <= driver.maxWeight) {
      score += 25;
      reasons.push("Meets weight capacity");
    } else if (load.weight <= driver.maxWeight * 1.25) {
      score += 10;
      reasons.push("Slightly over weight capacity");
    } else {
      reasons.push("Over weight capacity");
      score -= 10;
    }
  }

  // Truck type compatibility
  if (load.truckType && Array.isArray(driver.truckTypes)) {
    if (driver.truckTypes.some((t) => includesText(t, load.truckType))) {
      score += 15;
      reasons.push("Truck type matches requirement");
    }
  } else if (Array.isArray(driver.truckTypes) && driver.truckTypes.length) {
    score += 5; // generic truck availability
    reasons.push("Truck available");
  }

  // Cargo specialization
  if (load.cargoType && Array.isArray(driver.cargoTypes)) {
    if (driver.cargoTypes.some((c) => includesText(c, load.cargoType))) {
      score += 10;
      reasons.push("Driver handles this cargo type");
    }
  }

  // Special requirements
  if (Array.isArray(load.specialRequirements) && load.specialRequirements.length) {
    const missing = load.specialRequirements.filter(
      (req) => !driver.specialCapabilities?.some((cap) => includesText(cap, req))
    );
    if (missing.length === 0) {
      score += 10;
      reasons.push("Supports all special requirements");
    } else {
      score -= 10;
      reasons.push("Missing capabilities: " + missing.join(", "));
    }
  }

  // Route suitability
  const pickup = load.pickupCity || load.pickupLocation;
  const delivery = load.deliveryCity || load.deliveryLocation;
  const routes = driver.preferredRoutes || [];

  const routeHit =
    routes.some((r) => includesText(pickup, r.from) || includesText(delivery, r.to)) ||
    includesText(driver.currentLocation, pickup);

  if (routeHit) {
    score += 25;
    reasons.push("Operates on this route");
  }

  // Availability
  const availability = driver.availability?.status || "available";
  if (availability === "available") {
    score += 10;
  } else if (availability === "busy") {
    score -= 5;
  }

  // Rating & experience
  const rating = typeof driver.rating === "number" ? driver.rating : 4.5;
  score += clamp((rating / 5) * 10, 0, 10);

  if (typeof driver.experienceYears === "number") {
    if (driver.experienceYears >= 5) score += 5;
    else if (driver.experienceYears >= 2) score += 2;
  }

  // Price preference (if load has budget and driver pricePerKm set)
  if (load.budget && driver.pricePerKm) {
    score += 5; // placeholder bonus; could be refined with distance later
    reasons.push("Within budget indicator");
  }

  // Distance (if precomputed)
  if (typeof driver._distanceKm === "number") {
    const dScore = distanceScore(driver._distanceKm);
    score += dScore;
    reasons.push(`Proximity bonus (${driver._distanceKm.toFixed(1)} km)`);
  }
  if (typeof driver._durationMin === "number") {
    const tScore = durationScore(driver._durationMin);
    score += tScore;
    reasons.push(`ETA bonus (${Math.round(driver._durationMin)} min)`);
  }

  score = clamp(score, 0, 100);

  return { score, reasons };
}

function findMatches(load, drivers, limit = 5, options = { strict: true }) {
  const eligible = options.strict ? drivers.filter((driver) => meetsStrictRequirements(load, driver)) : drivers;
  const scored = eligible.map((driver) => {
    const { score, reasons } = scoreDriverForLoad(load, driver);
    return {
      driver,
      score,
      reasons,
      distanceKm: driver._distanceKm,
      durationMin: driver._durationMin
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { findMatches };
