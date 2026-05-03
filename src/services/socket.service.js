const { Server } = require("socket.io");

let io = null;

function init(httpServer, corsOrigins = []) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    // User joins their personal notification room
    socket.on("join", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });

    socket.on("leave", (userId) => {
      if (userId) socket.leave(`user:${userId}`);
    });

    // Join a load's tracking room (trader watches, driver broadcasts)
    socket.on("join:load", (loadId) => {
      if (loadId) socket.join(`load:${loadId}`);
    });

    socket.on("leave:load", (loadId) => {
      if (loadId) socket.leave(`load:${loadId}`);
    });

    // Driver pushes a GPS update — server re-emits to the load room
    // Payload: { loadId, lat, lng, heading?, speed?, accuracy? }
    socket.on("location:update", (payload) => {
      const { loadId, lat, lng } = payload || {};
      if (loadId && typeof lat === "number" && typeof lng === "number") {
        io.to(`load:${loadId}`).emit("driver:location", {
          loadId,
          lat,
          lng,
          heading: payload.heading ?? null,
          speed: payload.speed ?? null,
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  return io;
}

function emitToUser(userId, event, data) {
  if (io && userId) {
    io.to(`user:${String(userId)}`).emit(event, data);
  }
}

function emitToLoad(loadId, event, data) {
  if (io && loadId) {
    io.to(`load:${String(loadId)}`).emit(event, data);
  }
}

function getIO() {
  return io;
}

module.exports = { init, emitToUser, emitToLoad, getIO };
