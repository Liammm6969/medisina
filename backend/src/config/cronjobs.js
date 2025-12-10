import cron from 'node-cron';
import logger from '#logger/logger.js';
import Notification from '#modules/notifications/notification.model.js';
import AuditTrailModel from '#modules/audit-trail/audit-trail.model.js';
import fetch from "node-fetch";

const deleteOldNotifications = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });

    logger.info(`Cron job: Deleted ${result.deletedCount} old notifications (older than 30 days)`);
  } catch (error) {
    logger.error('Error deleting old notifications:', error);
  }
};


const deleteOldAuditTrails = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await AuditTrailModel.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });

    logger.info(`Cron job: Deleted ${result.deletedCount} old audit trails (older than 30 days)`);
  } catch (error) {
    logger.error('Error deleting old audit trails:', error);
  }
};

export const ping = () => {


  const URL = "https://medisina-da3o.onrender.com/health";

  cron.schedule("*/10 * * * *", async () => {
    try {
      await fetch(URL);
      logger.info("Pinged self to stay awake");
    } catch (err) {
      logger.error("Ping failed");
    }
  });

}

export const initializeCronJobs = () => {

  cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled cleanup job for notifications and audit trails');
    await deleteOldNotifications();
    await deleteOldAuditTrails();
  }, {
    scheduled: true,
    timezone: "Asia/Manila"
  });
  ping()
  logger.info('Cron jobs initialized: Daily cleanup of notifications and audit trails at 2:00 AM');
};

export default {
  initializeCronJobs,
  deleteOldNotifications,
  deleteOldAuditTrails,
  ping
};
