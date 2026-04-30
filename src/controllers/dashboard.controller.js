const { Load } = require("../models/load.model");
const { Driver } = require("../models/driver.model");
const { Truck } = require("../models/truck.model");
const { Payment } = require("../models/payment.model");

async function getOverview(req, res) {
  const isAdminLike = req.user.role === "admin" || req.user.role === "staff";
  const isDriverLike = req.user.role === "driver" || req.user.role === "staff";

  const loadQuery = {};
  const paymentQuery = {};

  if (!isAdminLike) {
    if (req.user.role === "trader" || req.user.role === "customer") {
      loadQuery.postedBy = req.user._id;
      paymentQuery.payer = req.user._id;
    } else if (isDriverLike && req.user.driverProfile) {
      loadQuery.assignedDriver = req.user.driverProfile;
    }
  }

  const [loads, payments, trucks, drivers] = await Promise.all([
    Load.find(loadQuery).sort({ updatedAt: -1 }).limit(6),
    Payment.find(paymentQuery).sort({ createdAt: -1 }).limit(6),
    isAdminLike ? Truck.countDocuments() : Promise.resolve(null),
    isAdminLike ? Driver.countDocuments() : Promise.resolve(null)
  ]);

  const stats = {
    shipmentsTotal: loads.length,
    shipmentsInTransit: loads.filter((load) => load.status === "in_transit").length,
    shipmentsDelivered: loads.filter((load) => load.status === "delivered").length,
    shipmentsOpen: loads.filter((load) => load.status === "open").length,
    paymentsTotal: payments.length,
    paymentsPaid: payments.filter((payment) => payment.status === "paid").length,
    paymentsPending: payments.filter((payment) => payment.status === "pending").length,
    paymentsFailed: payments.filter((payment) => payment.status === "failed").length,
    fleetTrucks: trucks,
    fleetDrivers: drivers
  };

  const activities = [
    ...loads.map((load) => ({
      type: "shipment",
      title: `Shipment ${load.trackingId || load._id}`,
      status: load.status,
      timestamp: load.updatedAt || load.createdAt
    })),
    ...payments.map((payment) => ({
      type: "payment",
      title: `Payment ${payment.transactionId || payment.externalRef || payment._id}`,
      status: payment.status,
      amount: payment.amount,
      timestamp: payment.updatedAt || payment.createdAt
    }))
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  return res.json({
    success: true,
    data: {
      stats,
      activities
    }
  });
}

module.exports = { getOverview };
