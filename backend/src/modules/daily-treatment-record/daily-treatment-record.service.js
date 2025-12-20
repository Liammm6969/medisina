import DailyTreatmentRecord from './daily-treatment-record.model.js'
import { limitedAll } from '#utils/concurrency.js';
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import notificationService from '#modules/notifications/notification.service.js';
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from '#utils/constants.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';


class DailyTreatmentService {

  async getAllRecords(filters = {}) {
    //     const cacheKey = CACHE_KEYS.DAILY_TREATMENT.ALL(filters);

    //     try {
    //       const cachedData = await cache.get(cacheKey);
    //       if (cachedData) {
    // logger.info(`Cache hit: ${cacheKey}`);
    // return cachedData;
    // }
    // } catch (error) {
    // logger.warn('Cache read error, proceeding with DB query:', error);
    // }

    const { startDate, endDate, gradeLevel, search, limit = 50, attendedBy, schoolId } = filters;

    const query = { isDeleted: false };

    if (startDate || endDate) {
      query.dateOfTreatment = {};
      if (startDate) {
        query.dateOfTreatment.$gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.dateOfTreatment.$lte = endOfDay;
      }
    }

    if (gradeLevel) {
      query.gradeLevel = gradeLevel;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { patientName: searchRegex },
        { chiefComplaint: searchRegex },
        { treatment: searchRegex },
        { schoolId: searchRegex },
        { dtrId: searchRegex }
      ];
    }
    if (attendedBy) {
      query.attendedBy = attendedBy
    }

    // First fetch records to check student/personnel schoolId if filter is provided
    let records;
    if (schoolId) {
      // Need to use aggregation to filter by populated schoolId
      records = await DailyTreatmentRecord.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'students',
            localField: 'student',
            foreignField: '_id',
            as: 'studentInfo'
          }
        },
        {
          $lookup: {
            from: 'personnels',
            localField: 'personnel',
            foreignField: '_id',
            as: 'personnelInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'attendedBy',
            foreignField: '_id',
            as: 'attendedByInfo'
          }
        },
        {
          $lookup: {
            from: 'chief_complaints',
            localField: 'chiefComplaint',
            foreignField: '_id',
            as: 'complaintInfo'
          }
        },
        {
          $addFields: {
            recordSchoolId: {
              $cond: {
                if: { $gt: [{ $size: '$studentInfo' }, 0] },
                then: { $arrayElemAt: ['$studentInfo.schoolId', 0] },
                else: {
                  $cond: {
                    if: { $gt: [{ $size: '$personnelInfo' }, 0] },
                    then: { $arrayElemAt: [{ $arrayElemAt: ['$personnelInfo.schoolId', 0] }, 0] },
                    else: null
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            recordSchoolId: schoolId
          }
        },
        {
          $project: {
            _id: 1,
            dtrId: 1,
            patientName: 1,
            dateOfTreatment: 1,
            chiefComplaint: 1,
            treatment: 1,
            schoolId: 1,
            gradeLevel: 1,
            remarks: 1,
            followUp: 1,
            isDeleted: 1,
            createdAt: 1,
            updatedAt: 1,
            student: { $arrayElemAt: ['$studentInfo', 0] },
            personnel: { $arrayElemAt: ['$personnelInfo', 0] },
            attendedBy: { $arrayElemAt: ['$attendedByInfo', 0] }
          }
        },
        { $sort: { dateOfTreatment: -1 } },
        { $limit: parseInt(limit) }
      ]);
    } else {
      records = await DailyTreatmentRecord.find(query)
        .populate([
          { path: 'student', select: 'firstName lastName stdId schoolName gradeLevel schoolId' },
          { path: 'personnel', select: 'firstName lastName perId position schoolDistrictDivision schoolId' },
          { path: 'attendedBy', select: 'firstName lastName role' }
        ])
        .sort({ dateOfTreatment: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    //     await cache.set(cacheKey, records, CACHE_TTL.MEDIUM);
    return records;
  }

  async getRecordById(id) {
    const record = await DailyTreatmentRecord.findOne(id);
    if (!record) {
      throw new ApiError('Treatment record not found', StatusCodes.NOT_FOUND);
    }
    return record;

  }

  async createRecord(recordData) {
    const record = await DailyTreatmentRecord.create(recordData);

    if (recordData.attendedBy) {
      await notificationService.createNotification({
        recipientId: recordData.attendedBy,
        title: NOTIFICATION_TITLE.RECORD_OF_DAILY_TREATMENT,
        message: `Daily Treatment Record for ${recordData.patientName || 'patient'} has been created`,
        type: NOTIFICATION_TYPES.NEW_RECORD,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.DAILY_TREATMENT.PATTERN);
    return record;
  }

  async updateRecord(id, updateData) {
    const record = await DailyTreatmentRecord.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!record) {
      throw new ApiError('Treatment record not found', StatusCodes.NOT_FOUND);
    }

    if (record.attendedBy) {
      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.RECORD_OF_DAILY_TREATMENT,
        message: `Daily Treatment Record for ${record.patientName || 'patient'} has been updated`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.DAILY_TREATMENT.PATTERN);
    return record;
  }

  async deleteRecord(dtrId) {
    const record = await DailyTreatmentRecord.findOneAndDelete({ dtrId });
    if (!record) {
      throw new ApiError('Treatment record not found', StatusCodes.NOT_FOUND);
    }

    if (record.attendedBy) {
      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.RECORD_OF_DAILY_TREATMENT,
        message: `Daily Treatment Record for ${record.patientName || 'patient'} has been deleted`,
        type: NOTIFICATION_TYPES.RECORD_DELETE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    await record.deleteOne();
    await cache.delPattern(CACHE_KEYS.DAILY_TREATMENT.PATTERN);
    return true;
  }


  async getRecordsBySchool(schoolId) {
    const records = await DailyTreatmentRecord.find({
      schoolId: schoolId,
      isDeleted: false
    })
      .populate('student')
      .populate('personnel')
      .populate('attendedBy')
      .lean();

    return records;
  }

  async getDailyCount() {
    const cacheKey = CACHE_KEYS.DAILY_TREATMENT.DAILY_COUNT;

    const cached = await cache.get(cacheKey);
    if (cached !== null) return cached;

    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const count = await DailyTreatmentRecord.countDocuments({
      dateOfTreatment: {
        $gte: startOfToday,
        $lte: endOfToday
      },
      isDeleted: false
    });

    await cache.set(cacheKey, count, CACHE_TTL.SHORT);
    return count;
  }

  async getDashboardStats(filters = {}) {
    //     const cacheKey = CACHE_KEYS.DAILY_TREATMENT.DASHBOARD(filters);

    //     try {
    //       const cachedData = await cache.get(cacheKey);
    //       if (cachedData) {
    // return cachedData;
    // }
    // } catch (error) {
    // logger.warn('Cache read error:', error);
    // }

    const { startDate, endDate, userId } = filters;

    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const queryStartDate = startDate ? new Date(startDate) : startOfToday;
    const queryEndDate = endDate ? new Date(endDate) : endOfToday;

    const dateMatchQuery = {
      dateOfTreatment: {
        $gte: queryStartDate,
        $lte: queryEndDate
      },
      isDeleted: false
    };

    if (userId) {
      dateMatchQuery.attendedBy = userId;
    }

    const totalTreatments = await DailyTreatmentRecord.countDocuments(dateMatchQuery);

    const userMatchQuery = userId ? { attendedBy: userId } : {};

    const uniquePatientsAgg = await DailyTreatmentRecord.aggregate([
      { $match: { ...dateMatchQuery, ...userMatchQuery } },
      {
        $group: {
          _id: null,
          uniqueStudents: { $addToSet: '$student' },
          uniquePersonnel: { $addToSet: '$personnel' }
        }
      },
      {
        $project: {
          totalUnique: {
            $size: {
              $setUnion: ['$uniqueStudents', '$uniquePersonnel']
            }
          }
        }
      }
    ]);

    const uniquePatients = uniquePatientsAgg.length > 0 ? uniquePatientsAgg[0].totalUnique : 0;

    const daysDiff = Math.ceil((queryEndDate - queryStartDate) / (1000 * 60 * 60 * 24)) || 1;
    const averagePerDay = totalTreatments / daysDiff;

    const pendingDoctorReview = await DailyTreatmentRecord.countDocuments(dateMatchQuery);

    const commonComplaintAgg = await DailyTreatmentRecord.aggregate([
      { $match: { ...dateMatchQuery, ...userMatchQuery } },
      {
        $lookup: {
          from: 'chief_complaints',
          localField: 'chiefComplaint',
          foreignField: '_id',
          as: 'complaintDetails'
        }
      },
      {
        $unwind: '$complaintDetails'
      },
      {
        $group: {
          _id: '$complaintDetails.complaint',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 1
      }
    ]);

    const commonComplaint = commonComplaintAgg.length > 0
      ? commonComplaintAgg[0]._id
      : 0;

    const stats = {
      totalTreatments,
      uniquePatients,
      averagePerDay,
      pendingDoctorReview,
      commonComplaint,
      dateRange: {
        start: queryStartDate,
        end: queryEndDate,
        days: daysDiff
      }
    };

    //     await cache.set(cacheKey, stats, CACHE_TTL.MEDIUM);
    return stats;
  }

  async getRecentTreatments(limit = 10, userId) {
    //     const cacheKey = CACHE_KEYS.DAILY_TREATMENT.RECENT(limit, userId);

    //     try {
    //       const cachedData = await cache.get(cacheKey);
    //       if (cachedData) {
    // return cachedData;
    // }
    // } catch (error) {
    // logger.warn('Cache read error:', error);
    // }

    const query = { isDeleted: false };
    if (userId) {
      query.attendedBy = userId;
    }

    const recentTreatments = await DailyTreatmentRecord.find(query)
      .populate('student', 'firstName lastName stdId')
      .populate('personnel', 'firstName lastName')
      .populate('chiefComplaint', 'complaint')
      .populate('attendedBy', 'firstName lastName')
      .sort({ dateOfTreatment: -1 })
      .limit(limit);

    const result = recentTreatments.map(treatment => ({
      id: treatment._id,
      studentName: treatment.student
        ? `${treatment.student.firstName} ${treatment.student.lastName}`
        : 'Unknown Student',
      stdId: treatment.student?.stdId || 'N/A',
      complaint: treatment.chiefComplaint?.complaint || 'No complaint recorded',
      attendedBy: treatment.attendedBy
        ? `${treatment.attendedBy.firstName} ${treatment.attendedBy.lastName}`
        : 'Unknown',
      dateOfTreatment: treatment.dateOfTreatment,
      createdAt: treatment.createdAt
    }));

    //     await cache.set(cacheKey, result, CACHE_TTL.SHORT);
    return result;
  }

  async getTreatmentTrendsBySchool(filters = {}) {
    const { schoolId, startDate, endDate } = filters;

    const matchStage = { isDeleted: false };

    if (startDate || endDate) {
      matchStage.dateOfTreatment = {};
      if (startDate) matchStage.dateOfTreatment.$gte = new Date(startDate);
      if (endDate) matchStage.dateOfTreatment.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      {
        $addFields: {
          schoolId: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolId', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolId', 0] }
            }
          },
          schoolName: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolName', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolName', 0] }
            }
          },
          patientType: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: 'Student',
              else: 'Personnel'
            }
          }
        }
      }
    ];

    // Filter by school if provided
    if (schoolId) {
      pipeline.push({
        $match: { schoolId: schoolId }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            schoolId: '$schoolId',
            schoolName: '$schoolName',
            chiefComplaint: '$chiefComplaint'
          },
          totalTreatments: { $sum: 1 },
          studentTreatments: {
            $sum: { $cond: [{ $eq: ['$patientType', 'Student'] }, 1, 0] }
          },
          personnelTreatments: {
            $sum: { $cond: [{ $eq: ['$patientType', 'Personnel'] }, 1, 0] }
          },
          latestTreatment: { $max: '$dateOfTreatment' },
          firstTreatment: { $min: '$dateOfTreatment' }
        }
      },
      {
        $lookup: {
          from: 'chief_complaint',
          localField: '_id.chiefComplaint',
          foreignField: '_id',
          as: 'complaintDetails'
        }
      },
      {
        $addFields: {
          complaintName: {
            $ifNull: [
              { $arrayElemAt: ['$complaintDetails.complaint', 0] },
              'Unknown Complaint'
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            schoolId: '$_id.schoolId',
            schoolName: '$_id.schoolName'
          },
          treatments: {
            $push: {
              complaint: '$complaintName',
              totalTreatments: '$totalTreatments',
              studentTreatments: '$studentTreatments',
              personnelTreatments: '$personnelTreatments',
              latestTreatment: '$latestTreatment',
              firstTreatment: '$firstTreatment'
            }
          },
          totalSchoolTreatments: { $sum: '$totalTreatments' },
          totalStudentTreatments: { $sum: '$studentTreatments' },
          totalPersonnelTreatments: { $sum: '$personnelTreatments' }
        }
      },
      { $sort: { totalSchoolTreatments: -1 } }
    );

    const results = await DailyTreatmentRecord.aggregate(pipeline);

    return {
      schools: results.map(school => ({
        schoolId: school._id.schoolId,
        schoolName: school._id.schoolName || 'Unknown School',
        totalTreatments: school.totalSchoolTreatments,
        studentTreatments: school.totalStudentTreatments,
        personnelTreatments: school.totalPersonnelTreatments,
        treatments: school.treatments.sort((a, b) => b.totalTreatments - a.totalTreatments)
      })),
      summary: {
        totalSchools: results.length,
        totalTreatmentsAcrossSchools: results.reduce((sum, s) => sum + s.totalSchoolTreatments, 0),
        totalStudentTreatments: results.reduce((sum, s) => sum + s.totalStudentTreatments, 0),
        totalPersonnelTreatments: results.reduce((sum, s) => sum + s.totalPersonnelTreatments, 0),
        averageTreatmentsPerSchool: results.length > 0
          ? (results.reduce((sum, s) => sum + s.totalSchoolTreatments, 0) / results.length).toFixed(2)
          : 0
      }
    };
  }


  async getTopTreatments(filters = {}) {
    const { schoolId, limit = 10, startDate, endDate } = filters;

    const matchStage = { isDeleted: false };

    if (startDate || endDate) {
      matchStage.dateOfTreatment = {};
      if (startDate) matchStage.dateOfTreatment.$gte = new Date(startDate);
      if (endDate) matchStage.dateOfTreatment.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      {
        $addFields: {
          schoolId: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolId', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolId', 0] }
            }
          }
        }
      }
    ];

    if (schoolId) {
      pipeline.push({
        $match: { schoolId: schoolId }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: '$treatment',
          count: { $sum: 1 },
          schoolsAffected: { $addToSet: '$schoolId' },
          latestTreatment: { $max: '$dateOfTreatment' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          treatment: '$_id',
          count: 1,
          schoolsAffectedCount: { $size: '$schoolsAffected' },
          latestTreatment: 1,
          severity: {
            $cond: {
              if: { $gte: ['$count', 50] },
              then: 'High',
              else: {
                $cond: {
                  if: { $gte: ['$count', 20] },
                  then: 'Medium',
                  else: 'Low'
                }
              }
            }
          }
        }
      }
    );

    return await DailyTreatmentRecord.aggregate(pipeline);
  }

  async getTreatmentTimeSeries(filters = {}) {
    const { schoolId, startDate, endDate, groupBy = 'day' } = filters;

    const matchStage = { isDeleted: false };

    if (startDate || endDate) {
      matchStage.dateOfTreatment = {};
      if (startDate) matchStage.dateOfTreatment.$gte = new Date(startDate);
      if (endDate) matchStage.dateOfTreatment.$lte = new Date(endDate);
    }

    // Determine date grouping format
    let dateGrouping;
    switch (groupBy) {
      case 'week':
        dateGrouping = {
          year: { $year: '$dateOfTreatment' },
          week: { $week: '$dateOfTreatment' }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: '$dateOfTreatment' },
          month: { $month: '$dateOfTreatment' }
        };
        break;
      case 'day':
      default:
        dateGrouping = {
          year: { $year: '$dateOfTreatment' },
          month: { $month: '$dateOfTreatment' },
          day: { $dayOfMonth: '$dateOfTreatment' }
        };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      {
        $addFields: {
          schoolId: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolId', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolId', 0] }
            }
          },
          schoolName: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolName', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolName', 0] }
            }
          }
        }
      }
    ];

    if (schoolId) {
      pipeline.push({
        $match: { schoolId: schoolId }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            date: dateGrouping,
            treatment: '$treatment'
          },
          count: { $sum: 1 },
          schoolId: { $first: '$schoolId' },
          schoolName: { $first: '$schoolName' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          treatments: {
            $push: {
              treatment: '$_id.treatment',
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

    const results = await DailyTreatmentRecord.aggregate(pipeline);

    return results.map(item => ({
      date: item._id,
      totalCount: item.totalCount,
      treatments: item.treatments,
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      topTreatment: item.treatments.sort((a, b) => b.count - a.count)[0]
    }));
  }

  async getTreatmentAnalyticsDashboard(filters = {}) {
    const [trendsBySchool, topTreatments, timeSeries, dashboardStats] = await limitedAll([
      () => this.getTreatmentTrendsBySchool(filters),
      () => this.getTopTreatments(filters),
      () => this.getTreatmentTimeSeries({ ...filters, groupBy: 'week' }),
      () => this.getDashboardStats(filters)
    ], 3);

    return {
      schoolTrends: trendsBySchool,
      topTreatments,
      weeklyTimeSeries: timeSeries,
      dashboardStats,
      generatedAt: new Date(),
      filters: {
        schoolId: filters.schoolId || 'All Schools',
        dateRange: {
          start: filters.startDate || 'All Time',
          end: filters.endDate || 'Present'
        }
      }
    };
  }


  async compareSchoolTreatmentPatterns(schoolIds, filters = {}) {
    const { startDate, endDate } = filters;

    const matchStage = { isDeleted: false };

    if (startDate || endDate) {
      matchStage.dateOfTreatment = {};
      if (startDate) matchStage.dateOfTreatment.$gte = new Date(startDate);
      if (endDate) matchStage.dateOfTreatment.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      {
        $lookup: {
          from: 'personnel',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      {
        $addFields: {
          schoolId: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolId', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolId', 0] }
            }
          },
          schoolName: {
            $cond: {
              if: { $gt: [{ $size: '$studentInfo' }, 0] },
              then: { $arrayElemAt: ['$studentInfo.schoolName', 0] },
              else: { $arrayElemAt: ['$personnelInfo.schoolName', 0] }
            }
          }
        }
      },
      {
        $match: { schoolId: { $in: schoolIds } }
      },
      {
        $group: {
          _id: {
            schoolId: '$schoolId',
            treatment: '$treatment'
          },
          schoolName: { $first: '$schoolName' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.schoolId',
          schoolName: { $first: '$schoolName' },
          treatments: {
            $push: {
              treatment: '$_id.treatment',
              count: '$count'
            }
          },
          totalTreatments: { $sum: '$count' }
        }
      },
      { $sort: { totalTreatments: -1 } }
    ];

    const results = await DailyTreatmentRecord.aggregate(pipeline);

    // Extract all unique treatments
    const allTreatments = new Set();
    results.forEach(school => {
      school.treatments.forEach(t => allTreatments.add(t.treatment));
    });

    // Create comparison matrix
    const comparison = {
      schools: results.map(school => ({
        schoolId: school._id,
        schoolName: school.schoolName,
        totalTreatments: school.totalTreatments,
        treatments: school.treatments.sort((a, b) => b.count - a.count)
      })),
      treatmentMatrix: Array.from(allTreatments).map(treatment => {
        const treatmentData = { treatment };
        results.forEach(school => {
          const found = school.treatments.find(t => t.treatment === treatment);
          treatmentData[school._id] = found ? found.count : 0;
        });
        return treatmentData;
      })
    };

    return comparison;
  }

  async getAllRecordsbyId(schoolId) {
    const records = await DailyTreatmentRecord.find({ schoolId }).lean()
    return records
  }
}
export default new DailyTreatmentService()