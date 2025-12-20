import { NOTIFICATION_TYPES, NOTIFICATION_STATUS } from '#utils/constants.js';
import Notification from './notification.model.js'
import logger from '../../logger/logger.js';
import authService from '#modules/auth/auth.service.js';
import ApiError from '#utils/ApiError.js';
import { emitToUser, emitToRole } from '../../config/socket.js';
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';

class NotificationService {

  async createNotification(notificationBody, session = null) {
    const options = session ? { session } : {};
    const [notification] = await Notification.create([notificationBody], options);

    try {
      emitToUser(notificationBody.recipientId.toString(), 'notification:new', {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        status: notification.status,
        isActionRequired: notification.isActionRequired,
        createdAt: notification.createdAt,
      });
    } catch (error) {
      logger.warn('Failed to emit WebSocket notification:', error);
    }

    await cache.delPattern(CACHE_KEYS.NOTIFICATION.PATTERN);
    return notification;
  }

  async createBulkNotifications(notificationBodies, session = null) {
    const options = session ? { session, ordered: true } : { ordered: true };
    const notifications = await Notification.create(notificationBodies, options);

    try {
      notifications.forEach((notification, index) => {
        const recipientId = notificationBodies[index].recipientId;
        emitToUser(recipientId.toString(), 'notification:new', {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          status: notification.status,
          isActionRequired: notification.isActionRequired,
          createdAt: notification.createdAt,
        });
      });
    } catch (error) {
      logger.warn('Failed to emit bulk WebSocket notifications:', error);
    }

    await cache.delPattern(CACHE_KEYS.NOTIFICATION.PATTERN);
    return notifications;
  }

  async getMyNotifications(recipientId) {
    const cacheKey = CACHE_KEYS.NOTIFICATION.MY(recipientId);

    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const notifications = await Notification
      .find({ recipientId, status: NOTIFICATION_STATUS.UNREAD })
      .sort({ createdAt: -1 })
      .lean();

    await cache.set(cacheKey, notifications, CACHE_TTL.SHORT);
    return notifications;
  }

  async getAllNotifications() {
    const cacheKey = CACHE_KEYS.NOTIFICATION.ALL;

    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const notifications = await Notification
      .find({
        status: { $in: [NOTIFICATION_STATUS.UNREAD, NOTIFICATION_STATUS.READ] }
      })
      .sort({ createdAt: -1 })
      .lean();

    await cache.set(cacheKey, notifications, CACHE_TTL.SHORT);
    return notifications;
  }

  async getNotificationById(id) {
    return await Notification.findById(id);
  }

  async markAsRead(notificationId) {
    const notification = await this.getNotificationById(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    const updatedNotification = await notification.markAsRead();

    try {
      emitToUser(notification.recipientId.toString(), 'notification:read', {
        id: notificationId,
      });
    } catch (error) {
      logger.warn('Failed to emit WebSocket read update:', error);
    }

    await cache.delPattern(CACHE_KEYS.NOTIFICATION.PATTERN);
    return updatedNotification;
  }

  async markAllAsRead(recipientId) {
    const result = await Notification.deleteMany({ recipientId })

    try {
      emitToUser(recipientId.toString(), 'notification:allRead', {
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      logger.warn('Failed to emit WebSocket all read update:', error);
    }

    await cache.delPattern(CACHE_KEYS.NOTIFICATION.PATTERN);
    return { modifiedCount: result.modifiedCount };
  }

  async deleteNotification(notificationId) {
    const notification = await this.getNotificationById(notificationId);
    if (!notification) {
      throw new ApiError('Notification not found', 404);
    }

    await Notification.findByIdAndDelete(notificationId);

    try {
      emitToUser(notification.recipientId.toString(), 'notification:deleted', {
        id: notificationId,
      });
    } catch (error) {
      logger.warn('Failed to emit WebSocket delete event:', error);
    }

    await cache.delPattern(CACHE_KEYS.NOTIFICATION.PATTERN);
    return notification;
  }

  async getUnreadCount(recipientId) {
    const cacheKey = CACHE_KEYS.NOTIFICATION.UNREAD_COUNT(recipientId);

    const cached = await cache.get(cacheKey);
    if (cached !== null) return cached;

    const count = await Notification.countUnreadByUser(recipientId);
    await cache.set(cacheKey, count, CACHE_TTL.SHORT);
    return count;
  }

  async getDoctorActivityNotifications(filters = {}) {
    const { activityType, limit = 9999, } = filters;

    const activityFilter = {};

    if (activityType) {
      activityFilter.title = { $regex: activityType, $options: 'i' };
    }

    let query = Notification.find()
      .populate('recipientId', 'firstName lastName role ')
      .sort({ createdAt: -1 })
      .limit(limit);

    let activities = await query.lean();

    const summary = await this._getActivitySummary(activityFilter);

    return {
      activities: activities.map(activity => ({
        id: activity._id,
        title: activity.title,
        message: activity.message,
        type: activity.type,
        user: activity.recipientId ? {
          id: activity.recipientId._id,
          name: `${activity.recipientId.firstName} ${activity.recipientId.lastName} `,
          role: activity.recipientId.role,
        } : null,
        priority: activity.priority,
        status: activity.status,
        timestamp: activity.createdAt,
        actionRequired: activity.isActionRequired,

      })),
      summary
    };
  }

  async _getActivitySummary(filter) {
    const totalActivities = await Notification.countDocuments(filter);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayActivities = await Notification.countDocuments({
      ...filter,
      createdAt: { $gte: todayStart }
    });

    const activityBreakdown = await Notification.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$title',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return {
      totalActivities,
      todayActivities,
      breakdown: activityBreakdown.map(item => ({
        activityType: item._id,
        count: item.count
      }))
    };
  }
}

const notificationService = new NotificationService();

export default notificationService;
