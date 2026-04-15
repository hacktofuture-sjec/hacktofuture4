const Message = require('../models/Message');
const simulationState = require('../simulationState');

module.exports = (io, options = {}) => {
  const maxConnections = Number(options.maxConnections) || 2;
  const reportSecurityRequest = typeof options.reportSecurityRequest === 'function'
    ? options.reportSecurityRequest
    : null;
  const onConnectionCountChange = typeof options.onConnectionCountChange === 'function'
    ? options.onConnectionCountChange
    : null;
  const onTooManyConnections = typeof options.onTooManyConnections === 'function'
    ? options.onTooManyConnections
    : null;

  let activeConnections = 0;

  io.on('connection', (socket) => {
    activeConnections += 1;
    if (onConnectionCountChange) {
      onConnectionCountChange(activeConnections);
    }

    console.log(`User connected to messaging WS: ${socket.id}`);

    if (activeConnections > maxConnections) {
      console.error(`[Messaging] Too Many Connections: ${activeConnections} active connections (limit ${maxConnections})`);
      if (onTooManyConnections) {
        onTooManyConnections(socket, activeConnections);
      }
      return;
    }

    // Allow user to join their own personal "room" to receive targeted messages
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room ${userId}`);
    });

    socket.on('send_message', async (data) => {
      if (reportSecurityRequest) {
        reportSecurityRequest({
          sourceIp: socket.handshake.address || 'unknown',
          endpoint: '/socket.io/send_message',
          method: 'WS',
          service: 'messaging-service',
        });
      }

      // Crash simulation - return early
      if (simulationState.crash) {
        socket.emit('message_error', { error: 'Service crashed (simulated)' });
        return;
      }

      // Error simulation - return early without processing
      if (simulationState.error) {
        socket.emit('message_error', { error: 'Message failed (simulated)' });
        return;
      }

      // Latency simulation - wrap existing logic in setTimeout
      if (simulationState.latency) {
        setTimeout(async () => {
          try {
            const { sender, receiver, message } = data;
            const newMessage = new Message({ sender, receiver, message });
            await newMessage.save();

            // Emit to receiver's room
            io.to(receiver).emit('receive_message', newMessage);
            // Also echo back to the sender
            socket.emit('receive_message', newMessage);
          } catch (err) {
            console.error('Error saving message', err);
          }
        }, 5000);
        return;
      }

      // Normal operation (simulation OFF)
      try {
        const { sender, receiver, message } = data;
        const newMessage = new Message({ sender, receiver, message });
        await newMessage.save();

        // Emit to receiver's room
        io.to(receiver).emit('receive_message', newMessage);
        // Also echo back to the sender
        socket.emit('receive_message', newMessage);
      } catch (err) {
        console.error('Error saving message', err);
      }
    });

    socket.on('typing', (data) => {
      const { sender, receiver } = data;
      // Emit to receiver's room
      io.to(receiver).emit('typing', { sender });
    });

    socket.on('disconnect', () => {
      activeConnections = Math.max(0, activeConnections - 1);
      if (onConnectionCountChange) {
        onConnectionCountChange(activeConnections);
      }
      console.log(`User disconnected from messaging WS: ${socket.id}`);
    });
  });
};
