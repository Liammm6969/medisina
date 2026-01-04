import redisClient from '#config/redis.js';
import logger from '#logger/logger.js';

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600;
  }

  async connect() {
    try {
      if (this.isConnected) {
        return true;
      }

      await redisClient.connect();
      this.client = redisClient.getClient();
      this.isConnected = redisClient.getConnectionStatus();

      logger.info('Cache layer initialized with Redis');
      return true;
    } catch (error) {
      logger.error('Failed to initialize cache layer:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) return false;
    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error.message);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error.message);
      return null;
    }
  }

  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    const cached = await this.get(key);
    if (cached !== null) {
      return { data: cached, hit: true };
    }
    const freshData = await fetchFn();
    await this.set(key, freshData, ttl);
    return { data: freshData, hit: false };
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error.message);
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isConnected || !this.client) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      logger.error(`Cache DEL pattern error for pattern ${pattern}:`, error.message);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  async flushAll() {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.flushDb();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache FLUSHALL error:', error.message);
      return false;
    }
  }

  async ttl(key) {
    if (!this.isConnected || !this.client) return -1;
    try {
      const ttl = await this.client.ttl(key);
      return ttl;
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error.message);
      return -1;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await redisClient.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export default new RedisCache();