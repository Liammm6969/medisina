import app, { sessionMiddleware } from './src/app.js'
import config from './src/config/config.js'
import logger from './src/logger/logger.js';
import mongoose from 'mongoose';
import { initializeSocket } from './src/config/socket.js';
import { initializeCronJobs } from './src/config/cronjobs.js';
import cache from './src/utils/cache.js';

let server
let io

const connectDB = async () => {
  try {
    if (config.mongoDb.MONGO_URI.includes('mongodb+srv')) {
      logger.info('Using atlas');
    }
    await mongoose.connect(config.mongoDb.MONGO_URI, {
      ...config.mongoDb.options
    });

    logger.info('Connected to MongoDB successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return true;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

const startServer = async () => {
  try {

    await connectDB();

    await cache.connect();

    server = app.listen(config.PORT, () => {

      logger.info(`Server is running on port ${config.PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    io = initializeSocket(server, sessionMiddleware);
    logger.info('WebSocket server initialized');

    initializeCronJobs();

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};


const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async (err) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }

      logger.info('HTTP server closed');

      try {
        // Close Socket.IO connections
        if (io) {
          io.close(() => {
            logger.info('Socket.IO server closed');
          });
        }
        // await cache.disconnect();
        // logger.info('Cache connection closed');
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (dbError) {
        logger.error('Error closing connections:', dbError);
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

  } else {
    try {
      // await cache.disconnect();
      // logger.info('Cache connection closed');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (dbError) {
      logger.error('Error closing connections:', dbError);
    }
    process.exit(0);
  }
};


const unexpectedErrorHandler = (error, origin) => {
  logger.error(`Unexpected error (${origin}):`, error);
  gracefulShutdown('UNEXPECTED_ERROR');
};


process.on('uncaughtException', (error) => {
  unexpectedErrorHandler(error, 'uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  unexpectedErrorHandler(reason, 'unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
