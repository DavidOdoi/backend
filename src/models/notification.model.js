const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["load_accepted", "load_assigned", "status_update", "new_load_match", "message"],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date }
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = { Notification };
