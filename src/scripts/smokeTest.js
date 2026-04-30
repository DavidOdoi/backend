/* eslint-disable no-console */
const BASE_URL = process.env.BACKEND_URL || "http://localhost:5000";
const PASSWORD = process.env.SMOKE_PASSWORD || "SmokePass123!";

function randomEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
}

async function call(path, options = {}, label = path) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${message}`);
  }
  return body;
}

async function main() {
  console.log(`Running smoke test against ${BASE_URL}`);

  const health = await call("/health", {}, "health");
  console.log("Health:", health?.message || "OK");

  const traderEmail = randomEmail("trader");
  const staffEmail = randomEmail("staff");

  const registerTrader = await call(
    "/api/v1/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Trader",
        email: traderEmail,
        phone: "+256700000001",
        password: PASSWORD,
        role: "customer"
      })
    },
    "register trader"
  );
  const traderToken = registerTrader?.data?.token;
  if (!traderToken) throw new Error("register trader failed: missing token");
  console.log("Registered trader:", traderEmail);

  const registerStaff = await call(
    "/api/v1/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Staff",
        email: staffEmail,
        phone: "+256700000002",
        password: PASSWORD,
        role: "staff"
      })
    },
    "register staff"
  );
  const staffToken = registerStaff?.data?.token;
  if (!staffToken) throw new Error("register staff failed: missing token");
  console.log("Registered staff:", staffEmail);

  const authHeadersTrader = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${traderToken}`
  };
  const authHeadersStaff = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${staffToken}`
  };

  const createdLoad = await call(
    "/api/v1/loads",
    {
      method: "POST",
      headers: authHeadersTrader,
      body: JSON.stringify({
        pickupLocation: "Kampala Industrial Area",
        deliveryLocation: "Nairobi CBD",
        cargoType: "general",
        weight: 8,
        pickupCity: "Kampala",
        deliveryCity: "Nairobi",
        truckType: "flatbed",
        budget: 320000
      })
    },
    "create load"
  );
  const load = createdLoad?.data;
  if (!load?._id) throw new Error("create load failed: missing load id");
  console.log("Created load:", load._id, "tracking:", load.trackingId);

  const tracked = await call(`/api/v1/loads/track/${encodeURIComponent(load.trackingId)}`, {}, "track load");
  console.log("Track endpoint status:", tracked?.data?.status);

  const createdPayment = await call(
    "/api/v1/payments",
    {
      method: "POST",
      headers: authHeadersTrader,
      body: JSON.stringify({
        shipmentId: load._id,
        amount: 320000,
        method: "mobile_money",
        autoConfirm: true
      })
    },
    "create payment"
  );
  const payment = createdPayment?.data;
  if (!payment?._id) throw new Error("create payment failed: missing payment id");
  console.log("Created payment:", payment._id, "status:", payment.status);

  const createdTruck = await call(
    "/api/v1/trucks",
    {
      method: "POST",
      headers: authHeadersStaff,
      body: JSON.stringify({
        plateNumber: `SMK-${Math.floor(Math.random() * 9000 + 1000)}`,
        type: "flatbed",
        capacity: 20,
        currentLocation: "Kampala"
      })
    },
    "create truck"
  );
  const truck = createdTruck?.data;
  if (!truck?._id) throw new Error("create truck failed: missing truck id");
  console.log("Created truck:", truck._id);

  await call("/api/v1/dashboard/overview", { headers: { Authorization: `Bearer ${traderToken}` } }, "dashboard overview");
  await call("/api/v1/users/me", { headers: { Authorization: `Bearer ${traderToken}` } }, "users me");
  await call("/api/v1/payments?mine=true", { headers: { Authorization: `Bearer ${traderToken}` } }, "payments mine");
  await call("/api/v1/trucks", { headers: { Authorization: `Bearer ${staffToken}` } }, "trucks list");

  console.log("Smoke test completed successfully.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
