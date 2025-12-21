import ReferralSlip from "./referral-slip.model.js";
import ApiError from "#utils/ApiError.js";
import { StatusCodes } from "http-status-codes";
import notificationService from "#modules/notifications/notification.service.js";
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from "#utils/constants.js";
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';

class ReferralSlipService {
  _checkOwnership(record, userId) {
    if (!record.createdBy || record.createdBy.toString() !== userId.toString()) {
      throw new ApiError(
        'You do not have permission to perform this action. You can only modify records you created.',
        StatusCodes.FORBIDDEN
      );
    }
  }

  async createReferralSlip(data, userId) {
    const record = await ReferralSlip.create({
      ...data,
      createdBy: userId
    });
    await record.populate('createdBy', 'firstName lastName role');

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.REFERRAL_SLIP,
      message: `Referral Slip for ${data.referralSlip?.name || 'patient'} has been created`,
      type: NOTIFICATION_TYPES.NEW_RECORD,
      priority: PRIORITY_LEVELS.MEDIUM,
      isActionRequired: false,
      metadata: {
        recordId: record._id,
        patientName: data.referralSlip?.name
      }
    });

    try {
      await cache.delPattern(CACHE_KEYS.REFERRAL_SLIP.PATTERN);
    } catch (error) {
      logger.warn('Failed to invalidate referral slip cache', error);
    }

    return record;
  }

  async getReferralSlipById(id) {
    const cacheKey = CACHE_KEYS.REFERRAL_SLIP.BY_ID(id);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for referral slip by id', error);
    }

    const record = await ReferralSlip.findOne({
      rsId: id,
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName role email')
      .populate('updatedBy', 'firstName lastName role')
      .lean();

    if (!record) {
      throw new ApiError(
        'Referral Slip not found',
        StatusCodes.NOT_FOUND
      );
    }

    try {
      await cache.set(cacheKey, record, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for referral slip by id', error);
    }

    return record;
  }

  async fetchAllReferralSlips(filters = {}) {
    const cacheKey = CACHE_KEYS.REFERRAL_SLIP.ALL(filters);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for all referral slips', error);
    }

    const query = { isDeleted: false };

    if (filters.startDate && filters.endDate) {
      query['referralSlip.date'] = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .populate('updatedBy', 'firstName lastName')
      .sort({ 'referralSlip.date': -1, createdAt: -1 })
      .lean();

    const result = {
      data: records,
      total: records.length,
      timestamp: new Date()
    };

    try {
      await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for all referral slips', error);
    }

    return result;
  }

  async fetchReferralSlipsByUser(userId, filters = {}) {
    const cacheKey = CACHE_KEYS.REFERRAL_SLIP.BY_USER(userId, filters);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for referral slips by user', error);
    }

    const query = {
      createdBy: userId,
      isDeleted: false
    };

    if (filters.startDate && filters.endDate) {
      query['referralSlip.date'] = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .populate('updatedBy', 'firstName lastName')
      .sort({ 'referralSlip.date': -1, createdAt: -1 })
      .lean();

    const result = {
      data: records,
      total: records.length,
      timestamp: new Date()
    };

    try {
      await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for referral slips by user', error);
    }

    return result;
  }

  async updateReferralSlipById(id, updateData, userId) {
    const existingRecord = await ReferralSlip.findOne({
      rsId: id,
      isDeleted: false
    });

    if (!existingRecord) {
      throw new ApiError(
        'Referral Slip not found',
        StatusCodes.NOT_FOUND
      );
    }

    this._checkOwnership(existingRecord, userId);

    const { createdBy, createdAt, isDeleted, deletedAt, deletedBy, ...safeUpdateData } = updateData;

    Object.assign(existingRecord, safeUpdateData);
    existingRecord.updatedBy = userId;

    await existingRecord.save();

    await existingRecord.populate('createdBy', 'firstName lastName role');
    await existingRecord.populate('updatedBy', 'firstName lastName role');

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.REFERRAL_SLIP,
      message: `Referral Slip for ${existingRecord.referralSlip?.name || 'patient'} has been updated`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false,
      metadata: {
        recordId: existingRecord._id,
        patientName: existingRecord.referralSlip?.name
      }
    });

    try {
      await cache.delPattern(CACHE_KEYS.REFERRAL_SLIP.PATTERN);
    } catch (error) {
      logger.warn('Failed to invalidate referral slip cache', error);
    }

    return existingRecord;
  }

  async deleteReferralSlipById(id, userId) {
    const record = await ReferralSlip.findOne({
      rsId: id,
      isDeleted: false
    });

    if (!record) {
      throw new ApiError(
        'Referral Slip not found',
        StatusCodes.NOT_FOUND
      );
    }

    this._checkOwnership(record, userId);

    await record.softDelete(userId);

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.REFERRAL_SLIP,
      message: `Referral Slip for ${record.referralSlip?.name || 'patient'} has been deleted`,
      type: NOTIFICATION_TYPES.RECORD_DELETE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false,
      metadata: {
        recordId: record._id,
        patientName: record.referralSlip?.name
      }
    });

    try {
      await cache.delPattern(CACHE_KEYS.REFERRAL_SLIP.PATTERN);
    } catch (error) {
      logger.warn('Failed to invalidate referral slip cache', error);
    }

    return {
      message: 'Referral Slip successfully deleted',
      deletedAt: record.deletedAt,
      patientName: record.referralSlip?.name
    };
  }

  async restoreReferralSlip(id, userId) {
    const record = await ReferralSlip.findOne({
      rsId: id,
      isDeleted: true
    });

    if (!record) {
      throw new ApiError(
        'Deleted Referral Slip not found',
        StatusCodes.NOT_FOUND
      );
    }

    this._checkOwnership(record, userId);

    await record.restore();

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.REFERRAL_SLIP,
      message: `Referral Slip for ${record.referralSlip?.name || 'patient'} has been restored`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false,
      metadata: {
        recordId: record._id,
        patientName: record.referralSlip?.name
      }
    });

    try {
      await cache.delPattern(CACHE_KEYS.REFERRAL_SLIP.PATTERN);
    } catch (error) {
      logger.warn('Failed to invalidate referral slip cache', error);
    }

    return {
      message: 'Referral Slip successfully restored',
      record: record.toSafeJSON()
    };
  }

  async updateReturnSlip(id, returnSlipData, userId) {
    const record = await ReferralSlip.findOne({
      rsId: id,
      isDeleted: false
    });

    if (!record) {
      throw new ApiError(
        'Referral Slip not found',
        StatusCodes.NOT_FOUND
      );
    }

    this._checkOwnership(record, userId);

    record.returnSlip = {
      ...record.returnSlip,
      ...returnSlipData
    };
    record.updatedBy = userId;

    await record.save();

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.REFERRAL_SLIP,
      message: `Return Slip for ${record.referralSlip?.name || 'patient'} has been updated`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.MEDIUM,
      isActionRequired: false,
      metadata: {
        recordId: record._id,
        patientName: record.referralSlip?.name
      }
    });

    try {
      await cache.delPattern(CACHE_KEYS.REFERRAL_SLIP.PATTERN);
    } catch (error) {
      logger.warn('Failed to invalidate referral slip cache', error);
    }

    return record;
  }

  async getReferralSlipCount(userId = null) {
    const cacheKey = CACHE_KEYS.REFERRAL_SLIP.COUNT(userId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached !== null) return cached;
    } catch (error) {
      logger.warn('Cache get failed for referral slip count', error);
    }

    const query = { isDeleted: false };
    if (userId) {
      query.createdBy = userId;
    }
    const count = await ReferralSlip.countDocuments(query);

    try {
      await cache.set(cacheKey, count, CACHE_TTL.SHORT);
    } catch (error) {
      logger.warn('Cache set failed for referral slip count', error);
    }

    return count;
  }

  async searchByPatientName(searchQuery, userId = null) {
    const query = {
      'referralSlip.name': new RegExp(searchQuery, 'i'),
      isDeleted: false
    };

    if (userId) {
      query.createdBy = userId;
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'referralSlip.date': -1 })
      .limit(20)
      .lean();

    return {
      data: records,
      total: records.length,
      searchQuery
    };
  }

  async getPendingReturnSlips(userId = null) {
    const query = {
      $or: [
        { 'returnSlip.findings': { $exists: false } },
        { 'returnSlip.findings': '' },
        { 'returnSlip.actionOrRecommendations': { $exists: false } },
        { 'returnSlip.actionOrRecommendations': '' }
      ],
      isDeleted: false
    };

    if (userId) {
      query.createdBy = userId;
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'referralSlip.date': 1 })
      .lean();

    return {
      data: records,
      total: records.length,
      timestamp: new Date()
    };
  }

  async getCompletedReferrals(userId = null) {
    const query = {
      'returnSlip.findings': { $exists: true, $ne: '' },
      'returnSlip.actionOrRecommendations': { $exists: true, $ne: '' },
      isDeleted: false
    };

    if (userId) {
      query.createdBy = userId;
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'returnSlip.date': -1 })
      .lean();

    return {
      data: records,
      total: records.length,
      timestamp: new Date()
    };
  }

  async getRecordsByDateRange(startDate, endDate, userId = null) {
    const query = {
      'referralSlip.date': {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      isDeleted: false
    };

    if (userId) {
      query.createdBy = userId;
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'referralSlip.date': -1 })
      .lean();

    return {
      data: records,
      total: records.length,
      startDate,
      endDate
    };
  }

  async bulkDelete(ids, userId) {
    const records = await ReferralSlip.find({
      rsId: { $in: ids },
      isDeleted: false
    });

    if (records.length === 0) {
      throw new ApiError('No records found to delete', StatusCodes.NOT_FOUND);
    }

    records.forEach(record => {
      this._checkOwnership(record, userId);
    });

    const deletePromises = records.map(record => record.softDelete(userId));
    await Promise.all(deletePromises);

    try {
      await cache.delPattern(CACHE_KEYS.REFERRAL_SLIP.PATTERN);
    } catch (error) {
      logger.warn('Failed to invalidate referral slip cache', error);
    }

    return {
      message: `Successfully deleted ${records.length} record(s)`,
      deletedCount: records.length,
      deletedIds: records.map(r => r._id)
    };
  }



  async getReferralsByReferrer(referrerName, userId = null) {
    const query = {
      'referralSlip.referrerName': new RegExp(referrerName, 'i'),
      isDeleted: false
    };

    if (userId) {
      query.createdBy = userId;
    }

    const records = await ReferralSlip.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'referralSlip.date': -1 })
      .lean();

    return {
      data: records,
      total: records.length,
      referrerName
    };
  }
}

export default new ReferralSlipService();
