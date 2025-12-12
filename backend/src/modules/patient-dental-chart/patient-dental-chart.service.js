import PatientDentalChart from './patient-dental-chart.model.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import notificationService from '../notifications/notification.service.js';
import { NOTIFICATION_TYPES, NOTIFICATION_TITLE, PRIORITY_LEVELS } from '#utils/constants.js';

class PatientDentalChartService {
  async getAllRecords() {
    const records = await PatientDentalChart.find({ isDeleted: false })
      .populate([
        { path: 'student', select: 'firstName lastName stdId' },
        { path: 'personnel', select: 'firstName lastName perId' },
        { path: 'attendedBy', select: 'firstName lastName role' }
      ])
      .sort({ createdAt: -1 });

    return records;
  }

  async getRecordById(id) {
    const record = await PatientDentalChart.findOne({
      $or: [{ _id: id }, { pdcId: id }],
      isDeleted: false
    }).populate([
      { path: 'student', select: 'firstName lastName stdId schoolId' },
      { path: 'personnel', select: 'firstName lastName perId schoolId' },
      { path: 'attendedBy', select: 'firstName lastName role' }
    ]);

    if (!record) {
      throw new ApiError('Patient dental chart not found', StatusCodes.NOT_FOUND);
    }

    return record;
  }

  async getRecordsByPatient(patientId, patientType) {
    const query = { isDeleted: false };

    if (patientType === 'student') {
      query.student = patientId;
    } else if (patientType === 'personnel') {
      query.personnel = patientId;
    }

    const records = await PatientDentalChart.find(query)
      .populate([
        { path: 'student', select: 'firstName lastName middleName stdId age sex birthdate address contactNo' },
        { path: 'personnel', select: 'firstName lastName middleName perId age sex birthdate address contactNo' },
        { path: 'attendedBy', select: 'firstName lastName role' }
      ])
      .sort({ createdAt: -1 });

    return records;
  }

  async createRecord(recordData) {
    const record = await PatientDentalChart.create(recordData);

    await record.populate([
      { path: 'student', select: 'firstName lastName stdId' },
      { path: 'personnel', select: 'firstName lastName perId' },
      { path: 'attendedBy', select: 'firstName lastName role' }
    ]);

    // Send notification
    if (recordData.attendedBy) {
      const patientName = recordData.walkInPatient?.firstName
        ? `${recordData.walkInPatient.firstName} ${recordData.walkInPatient.lastName}`
        : recordData.student
          ? `Student ID: ${recordData.student}`
          : `Personnel ID: ${recordData.personnel}`;

      await notificationService.createNotification({
        recipientId: recordData.attendedBy,
        title: NOTIFICATION_TITLE.PATIENT_DENTAL_CHART || 'Patient Dental Chart',
        message: `New Patient Information Record created for ${patientName}`,
        type: NOTIFICATION_TYPES.NEW_RECORD,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    }

    return record;
  }

  async updateRecord(id, updateData) {
    const record = await PatientDentalChart.findOneAndUpdate(
      { $or: [{ _id: id }, { pdcId: id }], isDeleted: false },
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
      throw new ApiError('Patient dental chart not found', StatusCodes.NOT_FOUND);
    }

    // Send notification
    if (record.attendedBy) {
      const patientName = record.walkInPatient?.firstName
        ? `${record.walkInPatient.firstName} ${record.walkInPatient.lastName}`
        : record.student
          ? `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim()
          : record.personnel
            ? `${record.personnel.firstName || ''} ${record.personnel.lastName || ''}`.trim()
            : 'Patient';

      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.PATIENT_DENTAL_CHART || 'Patient Dental Chart',
        message: `Patient Information Record for ${patientName} has been updated`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    return record;
  }

  async deleteRecord(id) {
    const record = await PatientDentalChart.findOneAndUpdate(
      { $or: [{ _id: id }, { pdcId: id }] },
      { isDeleted: true },
      { new: true }
    );

    if (!record) {
      throw new ApiError('Patient dental chart not found', StatusCodes.NOT_FOUND);
    }

    return true;
  }

  async getDashboardStats(filters = {}) {
    const matchQuery = { isDeleted: false };

    if (filters.startDate && filters.endDate) {
      matchQuery.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }

    const stats = await PatientDentalChart.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          studentRecords: {
            $sum: { $cond: [{ $ne: ['$student', null] }, 1, 0] }
          },
          personnelRecords: {
            $sum: { $cond: [{ $ne: ['$personnel', null] }, 1, 0] }
          },
          walkInRecords: {
            $sum: { $cond: [{ $ne: ['$walkInPatient.firstName', null] }, 1, 0] }
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

export default new PatientDentalChartService();
