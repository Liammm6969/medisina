import PersonnelHealthCard from './personnel-health-card.model.js';
import Personnel from '../personnel/personnel.model.js';
import dssService from './personnel-health-card-dss.service.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import PersonnelModel from '../personnel/personnel.model.js';
import Notification from '#modules/notifications/notification.model.js';
import notificationService from '#modules/notifications/notification.service.js';
import { NOTIFICATION_STATUS, NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from '#utils/constants.js';
import { limitConcurrency } from '#utils/concurrency.js';
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import { uploadFileToCloudinary } from '#utils/cloudinary.js';

class PersonnelHealthCardService {
  async createHealthCard(healthCardData) {
    const personnelRecord = await Personnel.findOne({ perId: healthCardData.perId });
    if (!personnelRecord) {
      throw new ApiError('Personnel Not Found, Please create personnel information first', StatusCodes.NOT_FOUND);
    }
    const newHealthCard = await PersonnelHealthCard.create({
      personnel: personnelRecord._id,
      ...healthCardData,
    });
    await Notification.create({
      recipientId: personnelRecord._id,
      title: "PERSONNEL HEALTH CARD",
      message: "New health card for personnel has been created, waiting for review and approval",
      type: 'APPROVAL',
      priority: "MEDIUM",
      isActionRequired: true
    })

    await cache.delPattern(CACHE_KEYS.PERSONNEL_HEALTH_CARD.PATTERN);

    return await newHealthCard.save();

  }

  async getHealthCardById(phcId) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.BY_ID(JSON.stringify(phcId));

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health card by id', error);
    }

    const record = await PersonnelHealthCard.findOne({ phcId })
      .populate('interviewedBy.user', 'firstName lastName').lean()
    if (!record) throw new ApiError(`Health card not found`, StatusCodes.NOT_FOUND);

    const personnel = await Personnel.findById(record.personnel).lean();
    const enrichedCard = {
      ...record,
      personnel: personnel
    };
    const dssResult = await dssService.personnelHealthCardDSS(enrichedCard);
    const result = { ...enrichedCard, dss: dssResult };

    try {
      await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for health card by id', error);
    }

    return result;
  }
  async getHealthCardCount() {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.COUNT;

    try {
      const cached = await cache.get(cacheKey);
      if (cached !== null) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health card count', error);
    }

    const count = await PersonnelHealthCard.estimatedDocumentCount();

    try {
      await cache.set(cacheKey, count, CACHE_TTL.SHORT);
    } catch (error) {
      logger.warn('Cache set failed for health card count', error);
    }

    return count;
  }
  async updateHealthCardById(phcId, updateData) {
    const updated = await PersonnelHealthCard.findOneAndUpdate(
      { phcId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) throw new ApiError("Health card not found", StatusCodes.NOT_FOUND);

    const personnel = await Personnel.findById(updated.personnel).lean();

    await cache.delPattern(CACHE_KEYS.PERSONNEL_HEALTH_CARD.PATTERN);

    return { ...updated, };
  }

  async getAllHealthCards(associatedSchools, page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const personnelQuery = { isDeleted: false };
    if (associatedSchools && Array.isArray(associatedSchools) && associatedSchools.length > 0) {
      personnelQuery.schoolId = { $in: associatedSchools };
    } 
  
    const personnelList = await Personnel.find(personnelQuery).lean();
    const personnelIds = personnelList.map(p => p._id);
    const personnelMap = Object.fromEntries(personnelList.map(p => [p._id.toString(), p]));

    const query = personnelIds.length > 0 ? { personnel: { $in: personnelIds } } : {};

    const [records, total] = await Promise.all([
      PersonnelHealthCard.find(query)
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonnelHealthCard.countDocuments(query)
    ]);

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          firstName: p?.firstName,
          lastName: p?.lastName,
          perId: p?.perId,
          ...card,
          personnel: p
        };

        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    return {
      data: enrichedCards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async deleteHealthCardById(phcId) {

    const record = await PersonnelHealthCard.findOneAndDelete({ phcId });
    if (!record) throw new ApiError('Health card record not found', StatusCodes.NOT_FOUND);

    await cache.delPattern(CACHE_KEYS.PERSONNEL_HEALTH_CARD.PATTERN);

    return record;
  }

  async getHealthCardsByCondition(condition) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.BY_CONDITION(condition);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health cards by condition', error);
    }

    const records = await PersonnelHealthCard.findByHealthCondition(condition).lean();
    const personnelIds = records.map(r => r.personnel);
    const personnelList = await Personnel.find({ _id: { $in: personnelIds } }).lean();
    const personnelMap = Object.fromEntries(personnelList.map(p => [p._id.toString(), p]));

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          ...card,
          personnel: p
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    try {
      await cache.set(cacheKey, enrichedCards, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for health cards by condition', error);
    }

    return enrichedCards;
  }

  async getHealthCardsByAgeRange(minAge, maxAge) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.BY_AGE_RANGE(minAge, maxAge);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health cards by age range', error);
    }

    const records = await PersonnelHealthCard.findByAgeRange(minAge, maxAge);
    const personnelIds = records.map(r => r.personnel).filter(Boolean);
    const personnelList = await Personnel.find({ _id: { $in: personnelIds } }).lean();
    const personnelMap = Object.fromEntries(personnelList.map(p => [p._id.toString(), p]));

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          ...card,
          personnel: p
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    try {
      await cache.set(cacheKey, enrichedCards, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for health cards by age range', error);
    }

    return enrichedCards;
  }

  async getHealthCardsBySymptoms(symptoms) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.BY_SYMPTOMS(symptoms);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health cards by symptoms', error);
    }

    const records = await PersonnelHealthCard.findBySymptoms(symptoms).lean();
    const personnelIds = records.map(r => r.personnel).filter(Boolean);
    const personnelList = await Personnel.find({ _id: { $in: personnelIds } }).lean();
    const personnelMap = Object.fromEntries(personnelList.map(p => [p._id.toString(), p]));

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          ...card,
          personnel: p
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    try {
      await cache.set(cacheKey, enrichedCards, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for health cards by symptoms', error);
    }

    return enrichedCards;
  }

  async getHealthCardsByGender(gender) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.BY_GENDER(gender);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health cards by gender', error);
    }

    const personnel = await Personnel.find({ gender }).lean();
    const personnelIds = personnel.map(p => p._id);
    const records = await PersonnelHealthCard.find({ personnel: { $in: personnelIds } }).lean();
    const personnelMap = Object.fromEntries(personnel.map(p => [p._id.toString(), p]));

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          ...card,
          personnel: p
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    try {
      await cache.set(cacheKey, enrichedCards, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for health cards by gender', error);
    }

    return enrichedCards;
  }

  async getRecentHealthCards(days, userId) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.RECENT(days, userId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for recent health cards', error);
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const records = await PersonnelHealthCard.find({ createdAt: { $gte: sinceDate }, "interviewedBy.user": userId })
      .populate([
        { path: 'interviewedBy.user', select: 'firstName lastName role' },
      ]).lean();
    const personnelIds = records.map(r => r.personnel).filter(Boolean);
    const personnelList = await Personnel.find({ _id: { $in: personnelIds } }).lean();
    const personnelMap = Object.fromEntries(personnelList.map(p => [p._id.toString(), p]));

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          ...card,
          personnel: p
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    try {
      await cache.set(cacheKey, enrichedCards, CACHE_TTL.SHORT);
    } catch (error) {
      logger.warn('Cache set failed for recent health cards', error);
    }

    return enrichedCards;
  }

  async getHealthCardsByPersonnel(phcId) {
    const cacheKey = CACHE_KEYS.PERSONNEL_HEALTH_CARD.BY_PERSONNEL(phcId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for health cards by personnel', error);
    }

    const records = await PersonnelHealthCard.find({ phcId }).lean();
    const personnelIds = records.map(r => r.personnel).filter(Boolean);
    const personnelList = await Personnel.find({ _id: { $in: personnelIds } }).lean();
    const personnelMap = Object.fromEntries(personnelList.map(p => [p._id.toString(), p]));

    const enrichedCards = await limitConcurrency(
      records,
      async (card) => {
        const p = personnelMap[card.personnel?.toString()];
        const enriched = {
          ...card,
          personnel: p
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    try {
      await cache.set(cacheKey, enrichedCards, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for health cards by personnel', error);
    }
    return enrichedCards;
  }

  async getHealthSummaryReport() {
    const cards = await this.getAllHealthCards();
    const dashboard = await dssService.personnelHealthDashboard(cards);
    return {
      totalPersonnel: cards.length,
      ...dashboard,
      generatedAt: new Date(),
    };
  }
  async searchPersonnelWithHealthCard(query) {
    const personnel = await Personnel.find({
      $or: [
        { firstName: { $regex: query, $options: "i" } },
        { middleName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { phcId: query }
      ].filter(Boolean)
    }).lean();

    if (!personnel || personnel.length === 0) {
      throw new ApiError("No personnel found", StatusCodes.NOT_FOUND);
    }

    const personnelIds = personnel.map(p => p._id);

    const cards = await PersonnelHealthCard.find({ personnel: { $in: personnelIds } }).lean();

    // Use limitConcurrency with concurrency of 5 for DSS enrichment
    const enrichedCards = await limitConcurrency(
      cards,
      async (card) => {
        const p = personnel.find(per => per._id.toString() === card.personnel.toString());
        const enriched = {
          ...card,
          personnel: {
            phcId: p?.phcId,
            fullName: p?.fullName,
            age: p.age,
            gender: p?.gender,
            dateOfBirth: p?.dateOfBirth,
            civilStatus: p?.civilStatus,
            position: p?.position,
            schoolDistrictDivision: p?.schoolDistrictDivision,
            yearsInService: p?.yearsInService,
          },
        };
        const dss = await dssService.personnelHealthCardDSS(enriched);
        return { ...enriched, dss };
      },
      5
    );

    return enrichedCards;
  }

  async approveHealthRecord(perId, doctorId, treatment, remarks, file, fileMetadata) {
    const personnel = await PersonnelModel.findOne({ perId })
    if (!personnel) {
      throw new ApiError("Personnel not found", StatusCodes.NOT_FOUND);
    }


    let attachmentData = {};
    if (file) {
      try {
        const baseName = `personnel_health_${personnel.firstName + personnel.lastName + personnel.schoolName}_${Date.now()}`.replace(/\s+/g, "_");
        const uploaded = await uploadFileToCloudinary(file, perId, baseName);

        const mimeType = file.mimetype || 'application/octet-stream';
        const extension = mimeType.split('/')[1] || 'file';

        attachmentData = {
          attachmentUrl: uploaded.secure_url,
          cloudinaryPublicId: uploaded.public_id,
          attachmentName: fileMetadata?.fileName || file.originalname || `file.${extension}`,
          attachmentType: fileMetadata?.fileType || extension,
          attachmentSize: fileMetadata?.fileSize || file.size || 0,
          attachmentMimeType: fileMetadata?.mimeType || mimeType,
        };

        logger.info(`File uploaded to Cloudinary for personnel ${perId}:`, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id
        });
      } catch (uploadError) {
        logger.error('File upload error:', uploadError);
        throw new ApiError('Failed to upload file attachment', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }


    const record = await PersonnelHealthCard.findOneAndUpdate(
      { personnel: personnel._id, isApproved: false },
      {
        $set: {
          isApproved: true,
          approvedBy: doctorId,
          approvedAt: new Date(),
          treatment: treatment || '',
          remarks: remarks || '',
          ...attachmentData
        }
      },
      { new: true }
    );

    if (!record) {
      throw new ApiError("Personnel health record not found or already approved", StatusCodes.NOT_FOUND);
    }

    const notificationRecipient = record?.interviewedBy?.user;
    if (notificationRecipient) {
      const personnelName = [personnel?.firstName, personnel?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || personnel?.perId || 'Personnel';

      await notificationService.createNotification({
        recipientId: notificationRecipient,
        title: NOTIFICATION_TITLE.PERSONNEL_HEALTH_CARD,
        message: `${personnelName}'s health record has been approved by the doctor.`,
        type: NOTIFICATION_TYPES.APPROVED,
        status: NOTIFICATION_STATUS.UNREAD,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.PERSONNEL_HEALTH_CARD.PATTERN);

    return record;
  }

  async getPendingApprovals(page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PersonnelHealthCard.find({ isApproved: false })
        .populate([
          { path: "personnel", select: "perId firstName lastName middleName position age gender schoolDistrictDivision schoolName" },
          { path: "interviewedBy.user", select: "firstName role schoolDistrictDivision schoolName" }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonnelHealthCard.countDocuments({ isApproved: false })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getApprovedRecords(page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PersonnelHealthCard.find({ isApproved: true })
        .populate([
          { path: "personnel", select: "perId firstName lastName middleName position age gender" },
          { path: "interviewedBy.user", select: "firstName role" },
          { path: "approvedBy", select: "firstName lastName role" }
        ])
        .sort({ approvedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonnelHealthCard.countDocuments({ isApproved: true })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}
export default new PersonnelHealthCardService();
