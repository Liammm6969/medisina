import morgan from 'morgan'
import compression from 'compression'
import helmet from 'helmet';
import cookieParser from 'cookie-parser'
import logger from '#logger/logger.js';
import config from '../config.js';

export function initProd(app) {

  app.set('trust proxy', 1);

  app.use(cookieParser(config.COOKIE_SECRET));
  app.use(morgan('dev', {
    stream: {
      write: message => logger.info(message.trim())
    }
  }));
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-ancestors": ["'self'", "https://srv1202622.hstgr.cloud","https://sgod-shs.vercel.app"],
      },
    },
  }));
  app.disable('x-powered-by');
}