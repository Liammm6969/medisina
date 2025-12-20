import 'dotenv/config'

const config = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || 'localhost',
  CLIENT_URL: process.env.CLIENT_URL,
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  SESSION_SECRET: process.env.SESSION_SECRET,
  COOKIE_SECRET: process.env.COOKIE_SECRET || process.env.SESSION_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
  mongoDb: {
    MONGO_URI: process.env.MONGO_URI,
    options: {
      minPoolSize: Number(process.env.OPTIONS_DB_MINIMUMPOOLSIZE || 1),
      maxPoolSize: Number(process.env.OPTIONS_DB_MAXIMUMPOOLSIZE || 10),
      serverSelectionTimeoutMS: Number(process.env.OPTIONS_DB_SERVERSELECTIONTIMEOUTMILLISECONDS || 5000),
      socketTimeoutMS: Number(process.env.OPTIONS_DB_SOCKETTIMEOUTMILLISECONDS || 45000),
      maxIdleTimeMS: Number(process.env.OPTIONS_DB_MAXIDLETIMEMS || 10000),
      retryWrites: true,
      retryReads: true,
    }
  },
  jwt: {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1h',
    JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  cloudinary: {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  },
  googleClient: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  },
  email: {
    EMAIL_SERVICE: process.env.EMAIL_SERVICE,
    EMAIL_PASSWORD: process.env.EMAIL_PASS,
    EMAIL_USER: process.env.EMAIL_USER
  },
  redis: {
    REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  },
}

export default config;