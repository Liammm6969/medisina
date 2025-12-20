import ChiefComplaintModel from "./chief-complaint.model.js";
import ApiError from "#utils/ApiError.js";
import { StatusCodes } from "http-status-codes";
import notificationService from "#modules/notifications/notification.service.js";
import dailyTreatmentRecordService from "#modules/daily-treatment-record/daily-treatment-record.service.js";
import personnelService from "#modules/personnel/personnel.service.js";
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS, TREATMENT_STATUS } from "#utils/constants.js";
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import { uploadFileToCloudinary } from '#utils/cloudinary.js';

class ChiefComplaintService {
  async createChiefComplaint(data, file = null) {
    const personnel = await personnelService.getPersonnelById(data.perId);

    const complaintData = {
      personnel: personnel._id,
      ...data
    };

    if (file && file.buffer) {
      try {
        const baseName = `chief_complaint_${Date.now()}`.replace(/\s+/g, "_");
        const uploaded = await uploadFileToCloudinary(file, data.perId, baseName);

        const mimeType = file.mimetype || 'application/octet-stream';
        const extension = mimeType.split('/')[1] || 'file';

        complaintData.attachmentUrl = uploaded.secure_url;
        complaintData.cloudinaryPublicId = uploaded.public_id;
        complaintData.attachmentName = file.originalname || `file.${extension}`;
        complaintData.attachmentType = extension;
        complaintData.attachmentSize = file.size || 0;
        complaintData.attachmentMimeType = mimeType;

        logger.info(`File uploaded to Cloudinary for chief complaint ${data.perId}:`, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id
        });
      } catch (uploadError) {
        logger.error('File upload error:', uploadError);
        throw new ApiError('Failed to upload file attachment', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }

    const complaint = await ChiefComplaintModel.create(complaintData);

    await dailyTreatmentRecordService.createRecord({
      dateOfTreatment: new Date(),
      personnel: personnel._id,
      patientName: `${personnel.firstName} ${personnel.lastName}`,
      chiefComplaint: data.complaint,
      treatment: complaint.treatmentOrRecommendation,
      remarks: TREATMENT_STATUS.PENDING_REVIEW,
      attendedBy: data.createdBy
    });
    await notificationService.createNotification({
      recipientId: data.createdBy,
      title: NOTIFICATION_TITLE.CONSULTATION_AND_TREATMENT,
      message: `Chief Complaint for Personnel ${personnel.firstName} has been created, waiting for review and approval`,
      type: NOTIFICATION_TYPES.APPROVAL,
      priority: PRIORITY_LEVELS.MEDIUM,
      isActionRequired: true
    })

    await cache.delPattern(CACHE_KEYS.CHIEF_COMPLAINT.PATTERN);
    return complaint;

  }

  async getChiefComplaintById(perId) {
    const personnel = personnelService.getPersonnelById(perId)
    const complaint = await ChiefComplaintModel.findOne({ personnel: personnel._id })
      .populate([
        { path: 'personnel', select: 'perId firstName middleName lastName' },
        { path: 'createdBy', select: 'firstName role' }
      ])
      .lean();

    if (!complaint) {
      throw new ApiError("Chief complaint not found", StatusCodes.NOT_FOUND);
    }
    return complaint;
  }

  async updateChiefComplaint(perId, data, file = null) {
    const { perId: _, ...updateData } = data;

    const personnel = await personnelService.getPersonnelById(perId);

    // Handle file upload if provided
    if (file && file.buffer) {
      try {
        const baseName = `chief_complaint_${Date.now()}`.replace(/\s+/g, "_");
        const uploaded = await uploadFileToCloudinary(file, perId, baseName);

        const mimeType = file.mimetype || 'application/octet-stream';
        const extension = mimeType.split('/')[1] || 'file';

        updateData.attachmentUrl = uploaded.secure_url;
        updateData.cloudinaryPublicId = uploaded.public_id;
        updateData.attachmentName = file.originalname || `file.${extension}`;
        updateData.attachmentType = extension;
        updateData.attachmentSize = file.size || 0;
        updateData.attachmentMimeType = mimeType;

        logger.info(`File uploaded to Cloudinary for chief complaint ${perId}:`, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id
        });
      } catch (uploadError) {
        logger.error('File upload error:', uploadError);
        throw new ApiError('Failed to upload file attachment', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }

    const updatedComplaint = await ChiefComplaintModel.findOneAndUpdate(
      { personnel: personnel._id },
      updateData,
      { new: true }
    );
    if (!updatedComplaint) throw new ApiError('No Complaint available to update', StatusCodes.NOT_FOUND)

    await notificationService.createNotification({
      recipientId: data.createdBy,
      title: NOTIFICATION_TITLE.CONSULTATION_AND_TREATMENT,
      message: `Chief Complaint for Personnel ${personnel.firstName} has been updated`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    })

    await cache.delPattern(CACHE_KEYS.CHIEF_COMPLAINT.PATTERN);
    return updatedComplaint;
  }

  async deleteChiefComplaint(perId, userId) {
    const personnel = await personnelService.getPersonnelById(perId)
    const record = await ChiefComplaintModel.findOneAndDelete({ personnel: personnel._id });
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.CONSULTATION_AND_TREATMENT,
      message: `Chief Complaint for Personnel ${personnel.firstName} has been deleted`,
      type: NOTIFICATION_TYPES.RECORD_DELETE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    })

    await cache.delPattern(CACHE_KEYS.CHIEF_COMPLAINT.PATTERN);
    return record;
  }

  async listChiefComplaints(userId) {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.ALL(userId || 'all');

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const filter = userId ? { createdBy: userId } : {};

    const complaints = await ChiefComplaintModel.find(filter)
      .populate([
        { path: 'personnel', select: 'perId firstName middleName lastName schoolName' },
        { path: 'createdBy', select: 'firstName role' }
      ])
      .sort({ createdAt: -1 })
      .lean();

    //     await cache.set(cacheKey, complaints, CACHE_TTL.MEDIUM);
    return complaints;
  }

  async getChiefComplaintByPersonnelName(personnelName) {
    const personnel = await personnelService.getPersonnelByName(personnelName);

    if (!personnel) {
      throw new ApiError(`Personnel not found with name: ${personnelName}`, StatusCodes.NOT_FOUND);
    }

    const complaints = await ChiefComplaintModel.find({ personnel: personnel._id })
      .populate([
        { path: 'personnel', select: 'perId firstName middleName lastName' },
        { path: 'createdBy', select: 'firstName role' }
      ])
      .lean();

    if (!complaints || complaints.length === 0) {
      throw new ApiError(`No chief complaints found for name: ${personnelName}`, StatusCodes.NOT_FOUND);
    }

    return complaints;
  }

  async approveChiefComplaint(perId, doctorId, treatment, remarks, file, fileMetadata) {
    const personnel = await personnelService.getPersonnelById(perId)
    if (!personnel) {
      throw new ApiError("Personnel not found", StatusCodes.NOT_FOUND);
    }

    // Handle file upload first if provided to avoid partial updates on timeout
    let attachmentData = {};
    if (file && file.buffer) {
      try {
        const baseName = `chief_complaint_${Date.now()}`.replace(/\s+/g, "_");
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

        logger.info(`File uploaded to Cloudinary for chief complaint ${perId}:`, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id
        });
      } catch (uploadError) {
        logger.error('File upload error:', uploadError);
        throw new ApiError('Failed to upload file attachment', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }

    // Use atomic findOneAndUpdate to prevent race conditions
    const complaint = await ChiefComplaintModel.findOneAndUpdate(
      { personnel: personnel._id, isApproved: false },
      {
        $set: {
          isApproved: true,
          approvedBy: doctorId,
          approvedAt: new Date(),
          treatmentOrRecommendation: treatment || '',
          ...attachmentData
        }
      },
      { new: true }
    );

    if (!complaint) {
      throw new ApiError("Chief complaint record not found or already approved", StatusCodes.NOT_FOUND);
    }

    // Update daily treatment record - wrapped in try-catch to prevent blocking approval
    try {
      const dailyTreatment = await dailyTreatmentRecordService.getRecordById({ personnel: personnel._id });
      if (dailyTreatment) {
        await dailyTreatmentRecordService.updateRecord(dailyTreatment._id, { remarks: remarks || "" });
      }
    } catch (error) {
      logger.error('Failed to update daily treatment record remarks:', error);
      // Continue with approval even if daily treatment update fails
    }

    await notificationService.createNotification({
      recipientId: complaint.createdBy,
      title: NOTIFICATION_TITLE.CONSULTATION_AND_TREATMENT,
      message: "Chief Complaint has been reviewed and approved",
      type: NOTIFICATION_TYPES.APPROVED,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    })

    await cache.delPattern(CACHE_KEYS.CHIEF_COMPLAINT.PATTERN);
    return complaint;
  }

  async getPendingApprovals() {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.PENDING;

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const complaints = await ChiefComplaintModel.find({ isApproved: false })
      .populate([
        { path: 'personnel', select: 'perId firstName lastName schoolName' },
        { path: 'createdBy', select: 'firstName lastName role schoolName' }
      ])
      .sort({ createdAt: -1 })
      .lean();

    //     await cache.set(cacheKey, complaints, CACHE_TTL.SHORT);
    return complaints;
  }

  async getApprovedComplaints() {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.APPROVED;

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const complaints = await ChiefComplaintModel.find({ isApproved: true })
      .populate([
        { path: 'personnel', select: 'perId firstName lastName position' },
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'approvedBy', select: 'firstName lastName role' }
      ])
      .sort({ approvedAt: -1 })
      .lean();

    //     await cache.set(cacheKey, complaints, CACHE_TTL.MEDIUM);
    return complaints;
  }

  async getComplaintTrendsBySchool(filters = {}) {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.TRENDS(filters);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const { schoolId, startDate, endDate } = filters;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' }
    ];

    if (schoolId) {
      pipeline.push({
        $match: { 'personnelInfo.schoolId': schoolId }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            complaint: '$complaint',
            schoolId: '$personnelInfo.schoolId',
            schoolName: '$personnelInfo.schoolName'
          },
          count: { $sum: 1 },
          approvedCount: {
            $sum: { $cond: ['$isApproved', 1, 0] }
          },
          latestDate: { $max: '$createdAt' },
          firstDate: { $min: '$createdAt' }
        }
      },
      {
        $group: {
          _id: '$_id.schoolId',
          schoolName: { $first: '$_id.schoolName' },
          complaints: {
            $push: {
              complaint: '$_id.complaint',
              count: '$count',
              approvedCount: '$approvedCount',
              latestDate: '$latestDate',
              firstDate: '$firstDate'
            }
          },
          totalComplaints: { $sum: '$count' },
          totalApproved: { $sum: '$approvedCount' }
        }
      },
      { $sort: { totalComplaints: -1 } }
    );

    const results = await ChiefComplaintModel.aggregate(pipeline);

    const data = {
      schools: results.map(school => ({
        schoolId: school._id.schoolId,
        schoolName: school.schoolName || 'Unknown School',
        totalComplaints: school.totalComplaints,
        totalApproved: school.totalApproved,
        approvalRate: school.totalComplaints > 0
          ? ((school.totalApproved / school.totalComplaints) * 100).toFixed(2)
          : 0,
        complaints: school.complaints.sort((a, b) => b.count - a.count)
      })),
      summary: {
        totalSchools: results.length,
        totalComplaintsAcrossSchools: results.reduce((sum, s) => sum + s.totalComplaints, 0),
        averageComplaintsPerSchool: results.length > 0
          ? (results.reduce((sum, s) => sum + s.totalComplaints, 0) / results.length).toFixed(2)
          : 0
      }
    };

    //     await cache.set(cacheKey, data, CACHE_TTL.LONG);
    return data;
  }


  async getTopCommonComplaints(filters = {}) {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.TOP(filters);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const { schoolId, limit = 10, startDate, endDate } = filters;
  }


  async getTopCommonComplaints(filters = {}) {
    const { schoolId, limit = 10, startDate, endDate } = filters;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' }
    ];

    if (schoolId) {
      pipeline.push({
        $match: { 'personnelInfo.schoolId': schoolId }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: '$complaint',
          count: { $sum: 1 },
          approvedCount: { $sum: { $cond: ['$isApproved', 1, 0] } },
          schoolsAffected: { $addToSet: '$personnelInfo.schoolId' },
          latestOccurrence: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          complaint: '$_id',
          count: 1,
          approvedCount: 1,
          schoolsAffectedCount: { $size: '$schoolsAffected' },
          latestOccurrence: 1,
          percentage: {
            $multiply: [
              { $divide: ['$count', { $sum: '$count' }] },
              100
            ]
          }
        }
      }
    );

    const results = await ChiefComplaintModel.aggregate(pipeline);

    const data = results.map(item => ({
      complaint: item.complaint,
      count: item.count,
      approvedCount: item.approvedCount,
      schoolsAffected: item.schoolsAffectedCount,
      latestOccurrence: item.latestOccurrence,
      status: item.count > 20 ? 'High' : item.count > 10 ? 'Medium' : 'Low'
    }));

    //     await cache.set(cacheKey, data, CACHE_TTL.LONG);
    return data;
  }

  async getComplaintTimeSeries(filters = {}) {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.TIME_SERIES(filters);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const { schoolId, startDate, endDate, groupBy = 'day' } = filters;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    let dateGrouping;
    switch (groupBy) {
      case 'week':
        dateGrouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      case 'day':
      default:
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' }
    ];

    if (schoolId) {
      pipeline.push({
        $match: { 'personnelInfo.schoolId': schoolId }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            date: dateGrouping,
            complaint: '$complaint'
          },
          count: { $sum: 1 },
          schoolId: { $first: '$personnelInfo.schoolId' },
          schoolName: { $first: '$personnelInfo.schoolName' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          complaints: {
            $push: {
              complaint: '$_id.complaint',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' },
          schoolId: { $first: '$schoolId' },
          schoolName: { $first: '$schoolName' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    );

    const results = await ChiefComplaintModel.aggregate(pipeline);

    const data = results.map(item => ({
      date: item._id,
      totalCount: item.totalCount,
      complaints: item.complaints,
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      topComplaint: item.complaints.sort((a, b) => b.count - a.count)[0]
    }));

    //     await cache.set(cacheKey, data, CACHE_TTL.LONG);
    return data;
  }

  async compareSchoolComplaintTrends(schoolIds, filters = {}) {
    const { startDate, endDate } = filters;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' },
      {
        $match: { 'personnelInfo.schoolId': { $in: schoolIds } }
      },
      {
        $group: {
          _id: {
            schoolId: '$personnelInfo.schoolId',
            complaint: '$complaint'
          },
          schoolName: { $first: '$personnelInfo.schoolName' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.schoolId',
          schoolName: { $first: '$schoolName' },
          complaints: {
            $push: {
              complaint: '$_id.complaint',
              count: '$count'
            }
          },
          totalComplaints: { $sum: '$count' }
        }
      },
      { $sort: { totalComplaints: -1 } }
    ]

    const results = await ChiefComplaintModel.aggregate(pipeline);

    const allComplaints = new Set();
    results.forEach(school => {
      school.complaints.forEach(c => allComplaints.add(c.complaint));
    });

    const comparison = {
      schools: results.map(school => ({
        schoolId: school._id,
        schoolName: school.schoolName,
        totalComplaints: school.totalComplaints,
        complaints: school.complaints.sort((a, b) => b.count - a.count)
      })),
      complaintMatrix: Array.from(allComplaints).map(complaint => {
        const complaintData = { complaint };
        results.forEach(school => {
          const found = school.complaints.find(c => c.complaint === complaint);
          complaintData[school._id] = found ? found.count : 0;
        });
        return complaintData;
      })
    };

    return comparison;
  }


  async getComplaintAnalyticsDashboard(filters = {}) {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.ANALYTICS(filters);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const { schoolId } = filters;

    const [
      topComplaints,
      trendsBySchool,
      timeSeries
    ] = await Promise.all([
      this.getTopCommonComplaints(filters),
      this.getComplaintTrendsBySchool(filters),
      this.getComplaintTimeSeries({ ...filters, groupBy: 'week' })
    ]);

    const data = {
      topComplaints,
      schoolTrends: trendsBySchool,
      weeklyTimeSeries: timeSeries,
      generatedAt: new Date(),
      filters: {
        schoolId: schoolId || 'All Schools',
        dateRange: {
          start: filters.startDate || 'All Time',
          end: filters.endDate || 'Present'
        }
      }
    };

    //     await cache.set(cacheKey, data, CACHE_TTL.LONG);
    return data;
  }


  async getAutoSchoolComparison(filters = {}) {
    //     const cacheKey = CACHE_KEYS.CHIEF_COMPLAINT.COMPARISON(filters);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    // logger.warn('Cache read error:', error);
    // }

    const { startDate, endDate, minComplaintsThreshold = 5 } = filters;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' },
      {
        $group: {
          _id: {
            schoolId: '$personnelInfo.schoolId',
            schoolName: '$personnelInfo.schoolName',
            complaint: '$complaint'
          },
          count: { $sum: 1 },
          approvedCount: { $sum: { $cond: ['$isApproved', 1, 0] } },
          dates: { $push: '$createdAt' }
        }
      },
      {
        $group: {
          _id: '$_id.schoolId',
          schoolName: { $first: '$_id.schoolName' },
          complaints: {
            $push: {
              complaint: '$_id.complaint',
              count: '$count',
              approvedCount: '$approvedCount',
              dates: '$dates'
            }
          },
          totalComplaints: { $sum: '$count' },
          totalApproved: { $sum: '$approvedCount' },
          uniqueComplaintTypes: { $sum: 1 }
        }
      },
      { $match: { totalComplaints: { $gte: minComplaintsThreshold } } },
      { $sort: { totalComplaints: -1 } }
    ];

    const schoolsData = await ChiefComplaintModel.aggregate(pipeline);

    if (schoolsData.length === 0) {
      return {
        message: 'No schools found with sufficient complaint data',
        comparison: [],
        insights: [],
        alerts: []
      };
    }

    const totalComplaintsAllSchools = schoolsData.reduce((sum, s) => sum + s.totalComplaints, 0);
    const avgComplaintsPerSchool = totalComplaintsAllSchools / schoolsData.length;

    const allComplaints = new Set();
    schoolsData.forEach(school => {
      school.complaints.forEach(c => allComplaints.add(c.complaint));
    });

    const complaintMatrix = Array.from(allComplaints).map(complaint => {
      const data = {
        complaint,
        totalOccurrences: 0,
        schoolsAffected: [],
        maxInSchool: { schoolId: null, schoolName: null, count: 0 },
        minInSchool: { schoolId: null, schoolName: null, count: Infinity }
      };

      schoolsData.forEach(school => {
        const found = school.complaints.find(c => c.complaint === complaint);
        const count = found ? found.count : 0;

        if (count > 0) {
          data.totalOccurrences += count;
          data.schoolsAffected.push({
            schoolId: school._id,
            schoolName: school.schoolName,
            count
          });

          if (count > data.maxInSchool.count) {
            data.maxInSchool = {
              schoolId: school._id,
              schoolName: school.schoolName,
              count
            };
          }

          if (count < data.minInSchool.count) {
            data.minInSchool = {
              schoolId: school._id,
              schoolName: school.schoolName,
              count
            };
          }
        }
      });

      if (data.schoolsAffected.length > 0) {
        const avg = data.totalOccurrences / data.schoolsAffected.length;
        const variance = data.schoolsAffected.reduce((sum, s) => {
          return sum + Math.pow(s.count - avg, 2);
        }, 0) / data.schoolsAffected.length;
        data.variance = variance;
        data.standardDeviation = Math.sqrt(variance);
      }

      return data;
    }).sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    const insights = [];

    if (complaintMatrix.length > 0) {
      const topComplaint = complaintMatrix[0];
      insights.push({
        type: 'top_complaint',
        severity: 'info',
        title: 'Most Common Complaint',
        message: `"${topComplaint.complaint}" is the most common complaint with ${topComplaint.totalOccurrences} occurrences across ${topComplaint.schoolsAffected.length} schools`,
        data: topComplaint
      });
    }

    const highComplaintSchools = schoolsData.filter(s => s.totalComplaints > avgComplaintsPerSchool * 1.5);
    if (highComplaintSchools.length > 0) {
      insights.push({
        type: 'high_complaint_schools',
        severity: 'warning',
        title: 'Schools with High Complaint Volume',
        message: `${highComplaintSchools.length} school(s) have complaint volumes 50% above average`,
        schools: highComplaintSchools.map(s => ({
          schoolId: s._id,
          schoolName: s.schoolName,
          totalComplaints: s.totalComplaints,
          avgComplaintsRatio: (s.totalComplaints / avgComplaintsPerSchool).toFixed(2)
        }))
      });
    }

    const widespreadComplaints = complaintMatrix.filter(c =>
      c.schoolsAffected.length >= schoolsData.length * 0.5
    );
    if (widespreadComplaints.length > 0) {
      insights.push({
        type: 'widespread_complaints',
        severity: 'warning',
        title: 'Widespread Health Issues',
        message: `${widespreadComplaints.length} complaint(s) appear in 50% or more schools`,
        complaints: widespreadComplaints.map(c => ({
          complaint: c.complaint,
          schoolsAffected: c.schoolsAffected.length,
          totalOccurrences: c.totalOccurrences
        }))
      });
    }

    const alerts = [];
    schoolsData.forEach(school => {
      school.complaints.forEach(complaint => {
        const complaintInfo = complaintMatrix.find(c => c.complaint === complaint.complaint);
        if (complaintInfo && complaintInfo.schoolsAffected.length > 1) {
          const avgForThisComplaint = complaintInfo.totalOccurrences / complaintInfo.schoolsAffected.length;
          if (complaint.count > avgForThisComplaint * 2) {
            alerts.push({
              type: 'potential_outbreak',
              severity: 'high',
              schoolId: school._id,
              schoolName: school.schoolName,
              complaint: complaint.complaint,
              count: complaint.count,
              avgAcrossSchools: avgForThisComplaint.toFixed(1),
              message: `"${complaint.complaint}" at ${school.schoolName} is ${(complaint.count / avgForThisComplaint).toFixed(1)}x higher than average`
            });
          }
        }
      });
    });

    const lowApprovalSchools = schoolsData.filter(s => {
      const approvalRate = s.totalComplaints > 0 ? (s.totalApproved / s.totalComplaints) : 0;
      return approvalRate < 0.5 && s.totalComplaints >= 10;
    });
    if (lowApprovalSchools.length > 0) {
      insights.push({
        type: 'low_approval_rate',
        severity: 'info',
        title: 'Schools with Low Approval Rates',
        message: `${lowApprovalSchools.length} school(s) have less than 50% complaint approval rate`,
        schools: lowApprovalSchools.map(s => ({
          schoolId: s._id,
          schoolName: s.schoolName,
          approvalRate: ((s.totalApproved / s.totalComplaints) * 100).toFixed(1) + '%',
          pendingReview: s.totalComplaints - s.totalApproved
        }))
      });
    }

    return {
      summary: {
        totalSchools: schoolsData.length,
        totalComplaints: totalComplaintsAllSchools,
        avgComplaintsPerSchool: avgComplaintsPerSchool.toFixed(2),
        dateRange: {
          start: startDate || 'All Time',
          end: endDate || 'Present'
        },
        generatedAt: new Date()
      },
      schools: schoolsData.map(school => ({
        schoolId: school._id,
        schoolName: school.schoolName,
        totalComplaints: school.totalComplaints,
        totalApproved: school.totalApproved,
        approvalRate: ((school.totalApproved / school.totalComplaints) * 100).toFixed(1) + '%',
        uniqueComplaintTypes: school.uniqueComplaintTypes,
        topComplaints: school.complaints
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(c => ({
            complaint: c.complaint,
            count: c.count
          })),
        comparisonToAverage: school.totalComplaints > avgComplaintsPerSchool ? 'above' : 'below',
        deviationFromAverage: ((school.totalComplaints - avgComplaintsPerSchool) / avgComplaintsPerSchool * 100).toFixed(1) + '%'
      })),
      complaintMatrix,
      insights,
      alerts,
      recommendations: this._generateAutoRecommendations(insights, alerts)
    };

    //     await cache.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  _generateAutoRecommendations(insights, alerts) {
    const recommendations = [];

    const highSeverityAlerts = alerts.filter(a => a.severity === 'high');
    if (highSeverityAlerts.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'immediate_investigation',
        title: 'Investigate Potential Outbreaks',
        description: `${highSeverityAlerts.length} potential outbreak(s) detected. Immediate investigation recommended.`,
        affectedSchools: [...new Set(highSeverityAlerts.map(a => a.schoolName))]
      });
    }

    const widespreadIssues = insights.find(i => i.type === 'widespread_complaints');
    if (widespreadIssues) {
      recommendations.push({
        priority: 'medium',
        action: 'preventive_measures',
        title: 'Implement Preventive Measures',
        description: 'Widespread health issues detected across multiple schools. Consider district-wide health education and preventive campaigns.',
        complaints: widespreadIssues.complaints.map(c => c.complaint)
      });
    }

    const lowApproval = insights.find(i => i.type === 'low_approval_rate');
    if (lowApproval) {
      recommendations.push({
        priority: 'medium',
        action: 'review_pending',
        title: 'Review Pending Complaints',
        description: 'Some schools have high volumes of unreviewed complaints. Prioritize doctor reviews.',
        affectedSchools: lowApproval.schools.map(s => s.schoolName)
      });
    }

    const highComplaintSchools = insights.find(i => i.type === 'high_complaint_schools');
    if (highComplaintSchools) {
      recommendations.push({
        priority: 'high',
        action: 'resource_allocation',
        title: 'Allocate Additional Resources',
        description: 'Some schools have significantly higher complaint volumes. Consider allocating additional medical staff or resources.',
        affectedSchools: highComplaintSchools.schools.map(s => s.schoolName)
      });
    }

    return recommendations;
  }
}

export default new ChiefComplaintService();

