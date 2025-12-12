import DentalRecordChart from './dental-record-chart.model.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import logger from '#logger/logger.js';
import notificationService from '#modules/notifications/notification.service.js';
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from '#utils/constants.js';

class DentalRecordChartService {

  async getAllRecords() {
    const records = await DentalRecordChart.find({ isDeleted: false })
      .populate([
        {
          path: 'student',
          select: 'firstName lastName stdId schoolName gradeLevel attendingPersonnel',
          populate: { path: 'attendingPersonnel', select: 'firstName lastName schoolDistrictDivision' }
        },
        { path: 'personnel', select: 'firstName lastName perId position' },
        { path: 'attendedBy', select: 'firstName lastName role' },
        { path: 'lastModifiedBy', select: 'firstName lastName role' }
      ])
      .sort({ dateOfExamination: -1, updatedAt: -1 })
      .lean();

    return records;
  }

  async getRecordById(id) {
    const record = await DentalRecordChart.findOne({
      $or: [{ _id: id }, { drcId: id }],
      isDeleted: false
    })
      .populate([
        { path: 'student', select: 'firstName lastName stdId schoolName gradeLevel' },
        { path: 'personnel', select: 'firstName lastName perId position' },
        { path: 'attendedBy', select: 'firstName lastName role' },
        { path: 'lastModifiedBy', select: 'firstName lastName role' }
      ]);

    if (!record) {
      throw new ApiError('Dental record chart not found', StatusCodes.NOT_FOUND);
    }
    return record;
  }

  async getRecordsByPatient(patientId, patientType) {
    const query = { isDeleted: false };

    if (patientType === 'student') {
      query.student = patientId;
    } else if (patientType === 'personnel') {
      query.personnel = patientId;
    } else {
      throw new ApiError('Invalid patient type', StatusCodes.BAD_REQUEST);
    }

    const records = await DentalRecordChart.find(query)
      .populate([
        { path: 'student', select: 'firstName lastName schoolName' },
        { path: 'personnel', select: 'firstName lastName schoolName' },
        { path: 'attendedBy', select: 'firstName lastName role' },
        { path: 'lastModifiedBy', select: 'firstName lastName role' }
      ])
      .sort({ dateOfExamination: -1 })
      .lean();
    return records;
  }

  async createRecord(recordData) {
    // Validate at least one patient reference exists
    if (!recordData.student && !recordData.personnel && !recordData.walkInPatient?.name) {
      throw new ApiError('Either student, personnel, or walk-in patient information is required', StatusCodes.BAD_REQUEST);
    }

    // Ensure only one type of patient is set
    if (recordData.student && recordData.personnel) {
      throw new ApiError('Cannot assign both student and personnel to the same record', StatusCodes.BAD_REQUEST);
    }

    if ((recordData.student || recordData.personnel) && recordData.walkInPatient?.name) {
      throw new ApiError('Cannot assign walk-in patient with student or personnel', StatusCodes.BAD_REQUEST);
    }

    const record = await DentalRecordChart.create(recordData);

    // Send notification if attendedBy is present
    if (recordData.attendedBy) {
      const patientName = recordData.walkInPatient?.name
        ? recordData.walkInPatient.name
        : recordData.student
          ? `Student ID: ${recordData.student}`
          : `Personnel ID: ${recordData.personnel}`;

      await notificationService.createNotification({
        recipientId: recordData.attendedBy,
        title: NOTIFICATION_TITLE.DENTAL_RECORD_CHART || 'Dental Record Chart',
        message: `New Dental Record Chart created for ${patientName}`,
        type: NOTIFICATION_TYPES.NEW_RECORD,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    }

    return record;
  }

  async updateRecord(id, updateData) {
    const record = await DentalRecordChart.findOneAndUpdate(
      { $or: [{ _id: id }, { drcId: id }], isDeleted: false },
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate([
      { path: 'student', select: 'firstName lastName stdId' },
      { path: 'personnel', select: 'firstName lastName perId' },
      { path: 'attendedBy', select: 'firstName lastName role' }
    ]);

    if (!record) {
      throw new ApiError('Dental record chart not found', StatusCodes.NOT_FOUND);
    }

    // Send notification
    if (record.attendedBy) {
      const patientName = record.walkInPatient?.name
        ? record.walkInPatient.name
        : record.student
          ? `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim()
          : record.personnel
            ? `${record.personnel.firstName || ''} ${record.personnel.lastName || ''}`.trim()
            : 'Patient';

      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.DENTAL_RECORD_CHART || 'Dental Record Chart',
        message: `Dental Record Chart for ${patientName} has been updated`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    return record;
  }

  async deleteRecord(id) {
    const record = await DentalRecordChart.findOneAndUpdate(
      { $or: [{ _id: id }, { drcId: id }] },
      { isDeleted: true },
      { new: true }
    );

    if (!record) {
      throw new ApiError('Dental record chart not found', StatusCodes.NOT_FOUND);
    }

    // Send notification
    if (record.attendedBy) {
      const patientInfo = record.walkInPatient?.name
        ? record.walkInPatient.name
        : record.student
          ? `Student ID: ${record.student}`
          : `Personnel ID: ${record.personnel}`;

      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.DENTAL_RECORD_CHART || 'Dental Record Chart',
        message: `Dental Record Chart for ${patientInfo} has been deleted`,
        type: NOTIFICATION_TYPES.RECORD_DELETE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    return true;
  }

  async getDashboardStats(filters = {}) {
    const matchQuery = { isDeleted: false };

    if (filters.startDate && filters.endDate) {
      matchQuery.dateOfExamination = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }

    const stats = await DentalRecordChart.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          studentRecords: {
            $sum: {
              $cond: [
                { $ifNull: ['$student', false] },
                1,
                0
              ]
            }
          },
          personnelRecords: {
            $sum: {
              $cond: [
                { $ifNull: ['$personnel', false] },
                1,
                0
              ]
            }
          },
          walkInRecords: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ['$walkInPatient.name', false] },
                    { $ne: ['$walkInPatient.name', ''] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    return stats[0] || {
      totalRecords: 0,
      studentRecords: 0,
      personnelRecords: 0,
      walkInRecords: 0
    };
  }
}

export default new DentalRecordChartService();
