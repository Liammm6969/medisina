import { Server } from 'socket.io';
import config from './config.js';
import logger from '../logger/logger.js';

let io;


export const initializeSocket = (server, sessionMiddleware) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173','https://sgod-shs.vercel.app'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
  });

  const wrap = (middleware) => (socket, next) => {
    middleware(socket.request, {}, next);
  };

  if (sessionMiddleware) {
    io.use(wrap(sessionMiddleware));
  }

  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;

      if (!session || !session.passport || !session.passport.user) {
        return next(new Error('Authentication required'));
      }

      socket.userId =session.passport.user;
      logger.info(`Socket authenticated: ${socket.userId}`);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id} - User: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);

    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }

    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id} - Reason: ${reason}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });

    socket.emit('connected', {
      message: 'Successfully connected to notification service',
      userId: socket.userId,
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};


export const emitToUser = (userId, event, data) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, skipping emission');
    return;
  }

  io.to(`user:${userId}`).emit(event, data);
  logger.debug(`Emitted ${event} to user ${userId}`);
};


export const emitToRole = (role, event, data) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, skipping emission');
    return;
  }

  io.to(`role:${role}`).emit(event, data);
  logger.debug(`Emitted ${event} to role ${role}`);
};


export const broadcastNotification = (event, data) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, skipping emission');
    return;
  }

  io.emit(event, data);
  logger.debug(`Broadcast ${event} to all clients`);
};

export default {
  initializeSocket,
  getIO,
  emitToUser,
  emitToRole,
  broadcastNotification,
};
