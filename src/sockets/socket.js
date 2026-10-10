import { Server } from 'socket.io';

/**
 * Initializes Socket.io server attached to the HTTP server instance.
 * Handles initial connection/disconnection handshake logging for signaling layer verification.
 * 
 * @param {import('http').Server} httpServer 
 * @returns {Server} io
 */
export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected | Socket ID: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected | Socket ID: ${socket.id} | Reason: ${reason}`);
    });
  });

  return io;
};
