import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '#logger/logger.js';
import Notification from '#modules/notifications/notification.model.js';
import AuditTrailModel from '#modules/audit-trail/audit-trail.model.js';
import config from '#config/config.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../../backups');

const deleteOldNotifications = async () => {
  try {
    const result = await Notification.deleteMany({});
    logger.info(`Cron job: Deleted ${result.deletedCount} notifications`);
  } catch (error) {
    logger.error('Error deleting old notifications:', error);
  }
};

const deleteOldAuditTrails = async () => {
  try {
    const result = await AuditTrailModel.deleteMany({});
    logger.info(`Cron job: Deleted ${result.deletedCount} old audit trails`);
  } catch (error) {
    logger.error('Error deleting old audit trails:', error);
  }
};

const backupMongoDB = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `mongodb_backup_${timestamp}`);

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const mongoUri = config.mongoDb.MONGO_URI;
    const command = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;

    await execAsync(command);
    logger.info(`MongoDB backup completed: ${backupPath}`);

    await cleanOldBackups('mongodb_backup_', 4);

    return backupPath;
  } catch (error) {
    logger.error('MongoDB backup failed:', error.message);
    throw error;
  }
};

const backupUploads = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uploadsDir = path.join(__dirname, '../../uploads');
    const backupFile = path.join(BACKUP_DIR, `uploads_backup_${timestamp}.tar.gz`);

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const command = `tar -czf "${backupFile}" -C "${path.dirname(uploadsDir)}" uploads`;

    await execAsync(command);
    logger.info(`Uploads backup completed: ${backupFile}`);

    await cleanOldBackups('uploads_backup_', 4);

    return backupFile;
  } catch (error) {
    logger.error('Uploads backup failed:', error.message);
    throw error;
  }
};

const cleanOldBackups = async (prefix, keepCount) => {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith(prefix))
      .sort()
      .reverse();

    const toDelete = backups.slice(keepCount);
    for (const file of toDelete) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
      logger.info(`Deleted old backup: ${file}`);
    }
  } catch (error) {
    logger.error('Error cleaning old backups:', error.message);
  }
};

const runWeeklyBackup = async () => {
  logger.info('Starting weekly backup...');
  try {
    await backupMongoDB();
    await backupUploads();
    logger.info('Weekly backup completed successfully');
  } catch (error) {
    logger.error('Weekly backup failed:', error.message);
  }
};

export const initializeCronJobs = () => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled cleanup job for notifications and audit trails');
    await deleteOldNotifications();
    await deleteOldAuditTrails();
  }, {
    scheduled: true,
    timezone: "Asia/Manila"
  });

  cron.schedule('0 3 * * 0', async () => {
    logger.info('Running weekly backup job');
    await runWeeklyBackup();
  }, {
    scheduled: true,
    timezone: "Asia/Manila"
  });

  logger.info('Cron jobs initialized: Daily cleanup at 2:00 AM, Weekly backup at 3:00 AM Sunday');
};

export default {
  initializeCronJobs,
  deleteOldNotifications,
  deleteOldAuditTrails,
  backupMongoDB,
  backupUploads,
  runWeeklyBackup,
};
