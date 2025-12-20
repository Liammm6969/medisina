import express from 'express'
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import routeNotFound from '#middleware/routeNotFound.js'
import Route from '#modules/index.js'
import logger from '#logger/logger.js';
import config from '#config/config.js';
import passport from 'passport'
import cache from '#utils/cache.js';

import { initCORS } from '#config/startup/cors.js'
import { initializePassport } from '#config/passport.js';
import { logAuditTrails } from '#middleware/auditTrail.js';
import { initRateLimit } from '#config/startup/apilimiter.js';
import { initProd } from '#config/startup/prod.js';
import { healthCheck } from '#middleware/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


initializePassport()
initCORS(app)
initProd(app)
initRateLimit(app)

const redisClient = createClient({
  url: config.redis.REDIS_URL,
  password: config.redis.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => logger.error('Redis Session Error:', err.message));
redisClient.on('connect', () => logger.info('Redis session store connecting...'));
redisClient.on('ready', () => logger.info('Redis session store ready'));

await redisClient.connect();

const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'medisina:sess:',
});

const sessionMiddleware = session({
  store: redisStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 30,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  },
  name: 'medisync.sid',
  rolling: true,
  proxy: true,
});

app.use(sessionMiddleware);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(passport.initialize());
app.use(passport.session());
app.use(logAuditTrails)

app.get('/health', healthCheck);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/v1', Route);

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use(routeNotFound)

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    meta: `path:${req.url} | method:${req.method} | error:${err.message}`
  });
  const status = err.statusCode || 500;

  if (res.headersSent) {
    return next(err);
  }

  if (err.isJoi) {
    return res.status(status).json({
      field: err.details[0].context.key,
      error: err.details[0].message.replace(/[""]/g, '')
    });
  }

  const errorResponse = {
    error: err.message,
    timestamp: new Date().toUTCString(),
    path: req.path
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  return res.status(status).json(errorResponse);
});

const initCache = async () => {
  try {
    await cache.connect();
    logger.info('Data cache initialized');
  } catch (error) {
    logger.warn('Data cache initialization failed, continuing without cache:', error.message);
  }
};

initCache();

export { sessionMiddleware, redisClient };
export default app