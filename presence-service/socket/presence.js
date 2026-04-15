// Maps userId to { userData, sockets }
const userSessions = new Map();
const simulationState = require('../simulationState');

const getOnlineUsers = () => {
  return Array.from(userSessions.values()).map((entry) => entry.userData);
};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected to presence WS: ${socket.id}`);

    socket.on('user_online', (userData) => {
      // Crash simulation - return early
      if (simulationState.crash) {
        socket.emit('presence_error', { error: 'Service crashed (simulated)' });
        return;
      }

      // Error simulation - return early without updating
      if (simulationState.error) {
        socket.emit('presence_error', { error: 'Presence update failed (simulated)' });
        return;
      }

      // Latency simulation - wrap existing logic in setTimeout for non-blocking behavior
      if (simulationState.latency) {
        setTimeout(() => {
          const { userId } = userData;
          if (!userId) return;

          let entry = userSessions.get(userId);
          if (!entry) {
            entry = { userData, sockets: new Set() };
            userSessions.set(userId, entry);
          }
          entry.userData = userData;
          entry.sockets.add(socket.id);

          console.log(`User ${userData.username} is online on socket ${socket.id}`);
          io.emit('online_users', getOnlineUsers());
        }, 5000);
        return;
      }

      // Normal operation (simulation OFF)
      const { userId } = userData;
      if (!userId) return;

      let entry = userSessions.get(userId);
      if (!entry) {
        entry = { userData, sockets: new Set() };
        userSessions.set(userId, entry);
      }
      entry.userData = userData;
      entry.sockets.add(socket.id);

      console.log(`User ${userData.username} is online on socket ${socket.id}`);
      io.emit('online_users', getOnlineUsers());
    });

    socket.on('disconnect', () => {
      for (const [userId, entry] of userSessions.entries()) {
        if (entry.sockets.has(socket.id)) {
          entry.sockets.delete(socket.id);
          if (entry.sockets.size === 0) {
            userSessions.delete(userId);
            console.log(`User ${entry.userData.username} is offline`);
          }
          break;
        }
      }
      console.log(`User disconnected from presence WS: ${socket.id}`);
      io.emit('online_users', getOnlineUsers());
    });
  });
};
