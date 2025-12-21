
import HealthExaminationRecord from "./health-examination.model.js";
import ApiError from "#utils/ApiError.js";
import { StatusCodes } from "http-status-codes";
import notificationService from "#modules/notifications/notification.service.js";
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from "#utils/constants.js";
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';

class HealthExaminationService {
  _formatPersonName(person, includeRole = false) {
    if (!person) return 'Unknown';
    const name = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    return includeRole && person.role ? `${name} (${person.role})` : name;
  }
  _checkOwnership(record, userId) {
    if (!record.createdBy || record.createdBy.toString() !== userId.toString()) {
      throw new ApiError(
        'You do not have permission to perform this action. You can only modify records you created.',
        StatusCodes.FORBIDDEN
      );
    }
  }
  async createHealthExamination(data, userId) {
    if (data.exam) {
      data.exam.status = 'Pending';
    }

    const record = await HealthExaminationRecord.create({
      ...data,
      createdBy: userId
    });
    await record.populate('createdBy', 'firstName lastName role');
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.HEALTH_EXAMINATION_RECORD,
      message: `Health Examination Record for ${data.name} has been created`,
      type: NOTIFICATION_TYPES.NEW_RECORD,
      priority: data.exam?.priority || PRIORITY_LEVELS.LOW,
      isActionRequired: false,
    });

    await cache.delPattern(CACHE_KEYS.HEALTH_EXAM.PATTERN);
    return record;
  }
  async getHealthExaminationById(heId) {
    const cacheKey = CACHE_KEYS.HEALTH_EXAM.BY_ID(heId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache read error:', error);
    }

    const record = await HealthExaminationRecord.findOne({
      heId,
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName role email')
      .populate('updatedBy', 'firstName lastName role')
      .populate('exam.physician.userId', 'firstName lastName role email')
      .lean();
    if (!record) {
      throw new ApiError(
        `Health Examination Record with ID ${heId} not found`,
        StatusCodes.NOT_FOUND
      );
    }

    await cache.set(cacheKey, record, CACHE_TTL.MEDIUM);
    return record;
  }
  async getHealthExaminationByMongoId(id) {
    const cacheKey = CACHE_KEYS.HEALTH_EXAM.BY_MONGO_ID(id);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache read error:', error);
    }

    const record = await HealthExaminationRecord.findOne({
      _id: id,
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName role email')
      .populate('updatedBy', 'firstName lastName role')
      .populate('exam.physician.userId', 'firstName lastName role email')
      .lean();
    if (!record) {
      throw new ApiError(
        `Health Examination Record not found`,
        StatusCodes.NOT_FOUND
      );
    }

    await cache.set(cacheKey, record, CACHE_TTL.MEDIUM);
    return record;
  }
  async fetchAllHealthExaminations(filters = {}) {
    const cacheKey = CACHE_KEYS.HEALTH_EXAM.ALL(filters);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache read error:', error);
    }

    const query = { isDeleted: false };
    if (filters.division) {
      query.division = filters.division;
    }
    if (filters.department) {
      query.department = filters.department;
    }
    if (filters.priority) {
      query['exam.priority'] = filters.priority;
    }
    if (filters.startDate && filters.endDate) {
      query['exam.date'] = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }
    const records = await HealthExaminationRecord.find(query)
      .populate('createdBy', 'firstName lastName role')
      .populate('updatedBy', 'firstName lastName')
      .sort({ 'exam.date': -1, createdAt: -1 })
      .lean();

    const result = {
      data: records,
      total: records.length,
      timestamp: new Date()
    };

    await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    return result;
  }
  async fetchHealthExaminationsByUser(userId, filters = {}) {
    const cacheKey = CACHE_KEYS.HEALTH_EXAM.BY_USER(userId, filters);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache read error:', error);
    }

    const query = {
      createdBy: userId,
      isDeleted: false
    };
    if (filters.division) {
      query.division = filters.division;
    }
    if (filters.department) {
      query.department = filters.department;
    }
    if (filters.priority) {
      query['exam.priority'] = filters.priority;
    }
    if (filters.startDate && filters.endDate) {
      query['exam.date'] = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }
    const records = await HealthExaminationRecord.find(query)
      .populate('createdBy', 'firstName lastName role')
      .populate('updatedBy', 'firstName lastName')
      .sort({ 'exam.date': -1, createdAt: -1 })
      .lean();

    const result = {
      data: records,
      total: records.length,
      timestamp: new Date()
    };

    await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    return result;
  }
  async updateHealthExaminationById(heId, updateData, userId) {
    const existingRecord = await HealthExaminationRecord.findOne({
      heId,
      isDeleted: false
    });
    if (!existingRecord) {
      throw new ApiError(
        `Health Examination Record with ID ${heId} not found`,
        StatusCodes.NOT_FOUND
      );
    }
    this._checkOwnership(existingRecord, userId);
    const { heId: _, createdBy, createdAt, isDeleted, deletedAt, deletedBy, ...safeUpdateData } = updateData;
    Object.assign(existingRecord, safeUpdateData);
    existingRecord.updatedBy = userId;
    existingRecord.updatedAt = new Date();
    await existingRecord.save();
    await existingRecord.populate('createdBy', 'firstName lastName role');
    await existingRecord.populate('updatedBy', 'firstName lastName role');
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.HEALTH_EXAMINATION_RECORD,
      message: `Health Examination Record for ${existingRecord.name} has been updated`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: existingRecord.exam?.priority || PRIORITY_LEVELS.LOW,
      isActionRequired: false,
    });

    await cache.delPattern(CACHE_KEYS.HEALTH_EXAM.PATTERN);
    return existingRecord;
  }
  async deleteHealthExaminationById(heId, userId) {
    const record = await HealthExaminationRecord.findOne({
      heId,
      isDeleted: false
    });
    if (!record) {
      throw new ApiError(
        `Health Examination Record with ID ${heId} not found`,
        StatusCodes.NOT_FOUND
      );
    }
    this._checkOwnership(record, userId);
    await record.softDelete(userId);
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.HEALTH_EXAMINATION_RECORD,
      message: `Health Examination Record for ${record.name} has been deleted`,
      type: NOTIFICATION_TYPES.RECORD_DELETE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false,
    });

    await cache.delPattern(CACHE_KEYS.HEALTH_EXAM.PATTERN);
    return {
      message: 'Health Examination Record successfully deleted',
      deletedAt: record.deletedAt,
      heId: record.heId,
      patientName: record.name
    };
  }
  async restoreHealthExamination(heId, userId) {
    const record = await HealthExaminationRecord.findOne({
      heId,
      isDeleted: true
    });
    if (!record) {
      throw new ApiError(
        `Deleted Health Examination Record with ID ${heId} not found`,
        StatusCodes.NOT_FOUND
      );
    }
    this._checkOwnership(record, userId);
    await record.restore();
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.HEALTH_EXAMINATION_RECORD,
      message: `Health Examination Record for ${record.name} has been restored`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false,
    });
    return {
      message: 'Health Examination Record successfully restored',
      record: record.toSafeJSON()
    };
  }
  async markAsCompleted(heId, userId) {
    const record = await HealthExaminationRecord.findOne({
      heId,
      isDeleted: false
    });
    if (!record) {
      throw new ApiError(
        `Health Examination Record with ID ${heId} not found`,
        StatusCodes.NOT_FOUND
      );
    }
    // this._checkOwnership(record, userId);
    await record.markAsCompleted(userId);
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.HEALTH_EXAMINATION_RECORD,
      message: `Health Examination Record for ${record.name} has been marked as completed`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false,
    });

    await cache.delPattern(CACHE_KEYS.HEALTH_EXAM.PATTERN);

    return {
      message: 'Health Examination marked as completed',
      record: record.toSafeJSON()
    };
  }
  async getHealthExaminationCount(userId = null) {
    const query = { isDeleted: false };
    if (userId) {
      query.createdBy = userId;
    }
    return await HealthExaminationRecord.countDocuments(query);
  }
  async getStatsByDivision(division, year = new Date().getFullYear()) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    const stats = await HealthExaminationRecord.aggregate([
      {
        $match: {
          division,
          'exam.date': { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            priority: '$exam.priority',
            department: '$department'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.department',
          priorities: {
            $push: {
              priority: '$_id.priority',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);
    return {
      division,
      year,
      stats,
      timestamp: new Date()
    };
  }
  async getStatsByDepartment(department, year = new Date().getFullYear()) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    const stats = await HealthExaminationRecord.aggregate([
      {
        $match: {
          department,
          'exam.date': { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$exam.priority',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    const total = await HealthExaminationRecord.countDocuments({
      department,
      'exam.date': { $gte: startDate, $lte: endDate },
      isDeleted: false
    });
    return {
      department,
      year,
      stats,
      total,
      timestamp: new Date()
    };
  }
  async searchByName(searchQuery, userId = null) {
    const query = {
      name: new RegExp(searchQuery, 'i'),
      isDeleted: false
    };
    if (userId) {
      query.createdBy = userId;
    }
    const records = await HealthExaminationRecord.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'exam.date': -1 })
      .limit(20)
      .lean();
    return {
      data: records,
      total: records.length,
      searchQuery
    };
  }
  async getRecordsByPriority(priority, userId = null) {
    const query = {
      'exam.priority': priority,
      isDeleted: false
    };
    if (userId) {
      query.createdBy = userId;
    }
    const records = await HealthExaminationRecord.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'exam.date': -1 })
      .lean();
    return {
      data: records,
      total: records.length,
      priority
    };
  }
  async getPendingFollowUps(userId = null) {
    const query = {
      'exam.requiresFollowUp': true,
      'exam.followUpDate': { $lte: new Date() },
      isDeleted: false
    };
    if (userId) {
      query.createdBy = userId;
    }
    const records = await HealthExaminationRecord.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'exam.followUpDate': 1 })
      .lean();
    return {
      data: records,
      total: records.length,
      timestamp: new Date()
    };
  }
  async getRecordsByDateRange(startDate, endDate, userId = null) {
    const query = {
      'exam.date': {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      isDeleted: false
    };
    if (userId) {
      query.createdBy = userId;
    }
    const records = await HealthExaminationRecord.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ 'exam.date': -1 })
      .lean();
    return {
      data: records,
      total: records.length,
      startDate,
      endDate
    };
  }
  async bulkDelete(heIds, userId) {
    const records = await HealthExaminationRecord.find({
      heId: { $in: heIds },
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
    return {
      message: `Successfully deleted ${records.length} record(s)`,
      deletedCount: records.length,
      deletedIds: records.map(r => r.heId)
    };
  }

  async approveHealthExamination(heId, approvalData, userId) {
    const record = await HealthExaminationRecord.findOne({
      heId,
      isDeleted: false
    });

    if (!record) {
      throw new ApiError(
        `Health Examination Record with ID ${heId} not found`,
        StatusCodes.NOT_FOUND
      );
    }

    // Update physician information
    if (!record.exam) {
      record.exam = {};
    }

    record.exam.physician = {
      signature: approvalData.physicianSignature,
      name: approvalData.physicianName,
      licenseNumber: approvalData.licenseNumber || '',
      date: new Date(),
      userId: userId
    };

    // Add remarks if provided
    if (approvalData.remarks) {
      record.exam.remarks = approvalData.remarks;
    }

    // Mark as completed
    record.exam.status = 'Completed';
    record.updatedBy = userId;
    record.updatedAt = new Date();

    await record.save();
    await record.populate('createdBy', 'firstName lastName role');
    await record.populate('updatedBy', 'firstName lastName role');
    await record.populate('exam.physician.userId', 'firstName lastName role email');

    // Create notification
    await notificationService.createNotification({
      recipientId: record.createdBy._id || record.createdBy,
      title: NOTIFICATION_TITLE.HEALTH_EXAMINATION_RECORD,
      message: `Health Examination Record for ${record.name} has been approved by Dr. ${approvalData.physicianName}`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: record.exam?.priority || PRIORITY_LEVELS.LOW,
      isActionRequired: false,
    });

    await cache.delPattern(CACHE_KEYS.HEALTH_EXAM.PATTERN);

    return {
      message: 'Health Examination Record approved successfully',
      data: record
    };
  }
}

export default new HealthExaminationService();
