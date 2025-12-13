import PersonnelModel from "./personnel.model.js";
import User from "../auth/auth.model.js";
import ApiError from "#utils/ApiError.js";
import { StatusCodes } from "http-status-codes";
import PersonnelHealthCardService from '#modules/personnel-health-card/personnel-health-card.service.js'
import SchoolHealthExamCardService from "#modules/school-health-exam-card/school-health-exam-card.service.js"
import ChiefComplaintService from "#modules/chief-complaint/chief-complaint.service.js"
import notificationService from "#modules/notifications/notification.service.js";
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from "#utils/constants.js";
import logger from '#logger/logger.js';
import PersonnelHealthCardModel from '#modules/personnel-health-card/personnel-health-card.model.js';
import DailyTreatmentRecordModel from '#modules/daily-treatment-record/daily-treatment-record.model.js';
import PrescriptionModel from '#modules/prescription/prescription.model.js';
import HealthExaminationModel from '#modules/health-examination-record/health-examination.model.js';
import ChiefComplaintModel from '#modules/chief-complaint/chief-complaint.model.js';
import DentalTreatmentRecordModel from '#modules/dental-treatment-record/dental-treatment-record.model.js';
import DentalRecordChartModel from '#modules/dental-record-chart/dental-record-chart.model.js';

class PersonnelService {
  async createPersonnel(data, userId) {

    const duplicate = await PersonnelModel.isDuplicateName(data.firstName, data.lastName);

    if (duplicate) throw new ApiError(`A personnel with ${data.firstName} ${data.lastName} already exists.`, StatusCodes.CONFLICT);

    const personnel = await PersonnelModel.create({
      ...data,
      createdBy: userId
    });

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.PERSONNEL_BIO_DATA,
      message: `Personnel Bio Data for ${data.firstName} has been created`,
      type: NOTIFICATION_TYPES.NEW_RECORD,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    })

    return personnel.toPersonnelJSON()
  }
  async getPersonnelCount() {
    const count = await PersonnelModel.countDocuments({ isDeleted: false });
    return count;
  }

  async getPersonnelById(perId) {
    const personnel = await PersonnelModel.findOne({
      perId,
      isDeleted: false
    }).lean();

    if (!personnel) {
      throw new ApiError(`Personnel with ID ${perId} not found`, StatusCodes.NOT_FOUND);
    }

    return personnel;
  }
  async getPersonnelByUserId(userId) {


    const personnel = await PersonnelModel.findOne({
      createdBy: userId,
      isDeleted: false
    }).lean();



    return personnel;
  }

  async getMyPersonnelRecord(userId) {
    // Get personnel by user ID
    const personnel = await PersonnelModel.findOne({
      createdBy: userId,
      isDeleted: false
    }).lean();

    const [healthCards, chiefComplaints] = await Promise.all([
      PersonnelHealthCardModel.find({
        personnel: personnel?._id,
      })
        .populate('interviewedBy.user', 'firstName lastName role civilStatus dateOfBirth gender age position')
        .populate('approvedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean(),

      ChiefComplaintModel.find({
        personnel: personnel?._id
      })
        .populate('createdBy', 'firstName lastName role')
        .populate('approvedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return {
      personnel,
      healthCards,
      chiefComplaints
    };
  }

  async getPersonnelByName(personnelName) {
    const personnel = await PersonnelModel.findOne({
      isDeleted: false,
      $or: [
        { firstName: new RegExp(personnelName, "i") },
        { lastName: new RegExp(personnelName, "i") },
        { middleName: new RegExp(personnelName, "i") }
      ]
    }).lean();

    if (!personnel) {
      throw new ApiError(`Personnel ${personnelName} not found`, StatusCodes.NOT_FOUND);
    }

    return personnel;
  }
  async fetchAllPersonnel(userId, page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const [personnel, total] = await Promise.all([
      PersonnelModel.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonnelModel.countDocuments({ isDeleted: false })
    ]);

    return {
      data: personnel,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }


  async fetchAllPersonnelByUser(userId, schoolDistrictDivision, page = 1, limit = 100) {
    const query = {
      isDeleted: false
    };

    let districts = schoolDistrictDivision;

    if (!districts || (Array.isArray(districts) && districts.length === 0)) {
      const currentUser = await PersonnelModel.findById(userId).select('schoolDistrictDivision').lean();
      districts = currentUser?.schoolDistrictDivision;
    }

    const nurseUsers = await User.find({ role: 'Nurse', isDeleted: false }).select('_id').lean();
    const nurseUserIds = nurseUsers.map(nurse => nurse._id);

    if (districts && Array.isArray(districts) && districts.length > 0) {
      query.$and = [
        { createdBy: { $in: nurseUserIds } },
        {
          $or: [
            { createdBy: userId },
            { schoolDistrictDivision: { $in: districts } }
          ]
        }
      ];
    } else {
      query.$and = [
        { createdBy: { $in: nurseUserIds } },
        { createdBy: userId }
      ];
    }

    const skip = (page - 1) * limit;

    const [personnel, total] = await Promise.all([
      PersonnelModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonnelModel.countDocuments(query)
    ]);
    return personnel;
  }

  async searchPersonnel(query, userId, schoolDistrictDivision, options = {}) {
    const { limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;

    let searchQuery = {
      isDeleted: false
    };

    // Add search conditions if query is provided
    if (query && query.trim().length >= 2) {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchQuery.$or = [
        { firstName: searchRegex },
        { middleName: searchRegex },
        { lastName: searchRegex },
        { perId: searchRegex },
        { position: searchRegex },
        { department: searchRegex },
      ];
    }

    // Add district/user filtering
    let districts = schoolDistrictDivision;
    if (!districts || (Array.isArray(districts) && districts.length === 0)) {
      const currentUser = await PersonnelModel.findById(userId).select('schoolDistrictDivision').lean();
      districts = currentUser?.schoolDistrictDivision;
    }

    const nurseUsers = await User.find({ role: 'Nurse', isDeleted: false }).select('_id').lean();
    const nurseUserIds = nurseUsers.map(nurse => nurse._id);

    if (districts && Array.isArray(districts) && districts.length > 0) {
      searchQuery.$and = [
        { createdBy: { $in: nurseUserIds } },
        {
          $or: [
            { createdBy: userId },
            { schoolDistrictDivision: { $in: districts } }
          ]
        }
      ];
    } else {
      searchQuery.$and = [
        { createdBy: { $in: nurseUserIds } },
        { createdBy: userId }
      ];
    }

    const [personnel, total] = await Promise.all([
      PersonnelModel.find(searchQuery)
        .select('firstName middleName lastName perId position department gender dateOfBirth schoolDistrictDivision')
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonnelModel.countDocuments(searchQuery)
    ]);

    return {
      personnel,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updatePersonnelById(perId, updateData, userId) {
    const existingPersonnel = await PersonnelModel.findOne({
      perId,
      isDeleted: false
    });

    if (!existingPersonnel) {
      throw new ApiError(`Personnel with ID ${perId} not found`, StatusCodes.NOT_FOUND);
    }

    if (updateData.perId) {
      const idToCheck = updateData.perId || existingPersonnel.perId;

      const duplicateCheck = await existingPersonnel.isDuplicateId(idToCheck);

      if (duplicateCheck) {
        throw new ApiError(`Another personnel with this ${duplicateCheck} already exists.`, StatusCodes.CONFLICT);
      }
    }

    const { password, ...safeUpdateData } = updateData;


    const updatedPersonnel = await PersonnelModel.findByIdAndUpdate(
      existingPersonnel._id,
      {
        ...safeUpdateData,
        updatedAt: new Date(),
        updatedBy: userId
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-password -resetPasswordToken');
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.PERSONNEL_BIO_DATA,
      message: `Personnel Bio Data for ${updatedPersonnel.firstName} has been updated`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    })

    return updatedPersonnel;
  }

  async deletePersonnelById(perId, userId) {
    const personnel = await PersonnelModel.findOne({
      perId,
      isDeleted: false
    });

    if (!personnel) {
      throw new ApiError(`Personnel with ID ${perId} not found`, StatusCodes.NOT_FOUND);
    }

    await personnel.softDelete(userId);
    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.PERSONNEL_BIO_DATA,
      message: `Personnel Bio Data for ${personnel.firstName} has been deleted`,
      type: NOTIFICATION_TYPES.RECORD_DELETE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    })

    return {
      message: 'Personnel successfully deleted',
      deletedAt: personnel.deletedAt
    };
  }

  async restorePersonnel(perId) {
    const personnel = await PersonnelModel.findOne({
      perId,
      isDeleted: true
    });

    if (!personnel) {
      throw new ApiError(`Deleted personnel with ID ${perId} not found`, StatusCodes.NOT_FOUND);
    }

    await personnel.restoreDeleted();

    return {
      message: 'Personnel successfully restored',
      personnel: personnel.toPersonnelJSON()
    };
  }


  async getHealthRecordsForApproval(page = 1, limit = 100) {
    const personnelPendingApprovals = await PersonnelHealthCardService.getPendingApprovals(page, limit);
    const schoolPendingApprovals = await SchoolHealthExamCardService.getPendingApprovals();
    const chiefComplaintPendingApprovals = await ChiefComplaintService.getPendingApprovals();

    const result = {
      personnelRecords: personnelPendingApprovals.data || personnelPendingApprovals,
      schoolRecords: schoolPendingApprovals,
      chiefComplaints: chiefComplaintPendingApprovals,
      pagination: personnelPendingApprovals.pagination,
      total: (personnelPendingApprovals.pagination?.total || personnelPendingApprovals.length) +
        schoolPendingApprovals.length +
        chiefComplaintPendingApprovals.length,
      timestamp: new Date()
    };

    return result;
  }

  async getApprovedHealthRecords(page = 1, limit = 100) {
    const personnelApprovedRecords = await PersonnelHealthCardService.getApprovedRecords(page, limit);
    const schoolApprovedRecords = await SchoolHealthExamCardService.getApprovedRecords();
    const chiefComplaintApprovedRecords = await ChiefComplaintService.getApprovedComplaints();

    const result = {
      personnelRecords: personnelApprovedRecords.data || personnelApprovedRecords,
      schoolRecords: schoolApprovedRecords,
      chiefComplaints: chiefComplaintApprovedRecords,
      pagination: personnelApprovedRecords.pagination,
      total: (personnelApprovedRecords.pagination?.total || personnelApprovedRecords.length) +
        schoolApprovedRecords.length +
        chiefComplaintApprovedRecords.length,
      timestamp: new Date()
    };
    return result;
  }

  async approvePersonnelHealthRecord(perId, doctorId, treatment, remarks, file, fileMetadata) {
    return await PersonnelHealthCardService.approveHealthRecord(perId, doctorId, treatment, remarks, file, fileMetadata);
  }

  async approveSchoolHealthRecord(stdId, gradeLevel, doctorId, treatment, remarks, file,
    fileMetadata) {
    return await SchoolHealthExamCardService.approveHealthRecord(stdId, gradeLevel, doctorId, treatment, remarks, file,
      fileMetadata);
  }
  async approveChiefComplaint(perId, doctorId, treatment, remarks, file, fileMetadata) {
    return await ChiefComplaintService.approveChiefComplaint(perId, doctorId, treatment, remarks, file, fileMetadata);
  }

  async getCompletePersonnelHistory(perId) {
    const personnel = await this.getPersonnelById(perId);

    if (!personnel) {
      throw new ApiError(`Personnel with ID ${perId} not found`, StatusCodes.NOT_FOUND);
    }

    // Fetch all records in parallel
    const [
      healthCards,
      dentalTreatments,
      dentalRecordCharts,
      dailyTreatments,
      prescriptions,
      healthExaminations,
      chiefComplaints
    ] = await Promise.all([
      // Personnel Health Cards
      PersonnelHealthCardModel.find({
        personnel: personnel._id,
      })
        .populate('interviewedBy.user', 'firstName lastName role')
        .populate('approvedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean(),

      // Dental Treatment Records
      DentalTreatmentRecordModel.find({
        personnel: personnel._id,
        isDeleted: false
      })
        .populate('attendedBy', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean(),

      // Dental Record Charts
      DentalRecordChartModel.find({
        personnel: personnel._id,
        isDeleted: false
      })
        .populate('attendedBy', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ dateOfExamination: -1 })
        .lean(),

      // Daily Treatment Records
      DailyTreatmentRecordModel.find({
        personnel: personnel._id,
        isDeleted: false
      })
        .populate('attendedBy', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ dateOfTreatment: -1 })
        .lean(),

      // Prescriptions
      PrescriptionModel.find({
        patientName: {
          $regex: `${personnel.firstName}.*${personnel.lastName}`,
          $options: 'i'
        },
        isDeleted: false
      })
        .populate('prescribedBy', 'firstName lastName role')
        .populate('attendingExaminer', 'firstName lastName role')
        .sort({ prescribedDate: -1 })
        .lean(),

      // Health Examinations
      HealthExaminationModel.find({
        name: `${personnel.firstName} ${personnel.lastName}`,
        isDeleted: false
      })
        .populate('createdBy', 'firstName lastName role')
        .populate('exam.physician.userId', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []),

      // Chief Complaints
      ChiefComplaintModel.find({
        personnel: personnel._id,
        isDeleted: false
      })
        .populate('createdBy', 'firstName lastName role')
        .populate('approvedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => [])
    ]);

    // Format and aggregate timeline
    const timeline = [];


    // Add health cards to timeline - each card is a single examination record
    healthCards.forEach(record => {
      timeline.push({
        type: 'Health Examination',
        date: record.interviewedBy?.interviewDate || record.createdAt,
        examiner: record.interviewedBy?.user ? `${record.interviewedBy.user.firstName} ${record.interviewedBy.user.lastName}` : 'Unknown',
        isApproved: record.isApproved,
        approvedBy: record.approvedBy ? `${record.approvedBy.firstName} ${record.approvedBy.lastName}` : null,
        findings: {
          familyHistory: record.familyHistory,
          pastMedicalHistory: record.pastMedicalHistory,
          presentHealthStatus: record.presentHealthStatus,
          testResults: record.testResults,
          socialHistory: record.socialHistory,
          obGynHistory: record.obGynHistory,
          maleExamination: record.maleExamination
        },
        treatment: record.treatment,
        remarks: record.remarks,
        recordId: record._id,
        details: record
      });
    });

    // Add dental treatments to timeline
    dentalTreatments.forEach(record => {
      if (record.treatments && Array.isArray(record.treatments)) {
        record.treatments.forEach(treatment => {
          timeline.push({
            type: 'Dental Treatment',
            date: treatment.dateOfService || record.createdAt,
            provider: record.attendedBy ? `${record.attendedBy.firstName} ${record.attendedBy.lastName}` : 'Unknown',
            procedure: treatment.procedure,
            toothNumber: treatment.toothNo,
            amountCharged: treatment.amountCharged,
            recordId: record._id,
            details: treatment
          });
        });
      }
    });

    // Add dental record charts to timeline
    dentalRecordCharts.forEach(record => {
      timeline.push({
        type: 'Dental Record Chart',
        date: record.dateOfExamination || record.createdAt,
        provider: record.attendedBy ? `${record.attendedBy.firstName} ${record.attendedBy.lastName}` : 'Unknown',
        permanentTeeth: record.permanentTeeth?.length || 0,
        temporaryTeeth: record.temporaryTeeth?.length || 0,
        periodontalScreening: record.periodontalScreening,
        remarks: record.remarks,
        recordId: record._id,
        details: record
      });
    });

    // Add daily treatments to timeline
    dailyTreatments.forEach(record => {
      timeline.push({
        type: 'Daily Treatment',
        date: record.dateOfTreatment || record.createdAt,
        provider: record.attendedBy ? `${record.attendedBy.firstName} ${record.attendedBy.lastName}` : 'Unknown',
        complaint: record.chiefComplaint,
        treatment: record.treatment,
        remarks: record.remarks,
        recordId: record._id,
        details: record
      });
    });

    // Add prescriptions to timeline
    prescriptions.forEach(record => {
      timeline.push({
        type: 'Prescription',
        date: record.prescribedDate || record.createdAt,
        provider: record.prescribedBy ? `${record.prescribedBy.firstName} ${record.prescribedBy.lastName}` : (record.doctorName || 'Unknown'),
        medications: record.medications,
        notes: record.notes,
        recordId: record._id,
        details: record
      });
    });

    // Add health examinations to timeline
    healthExaminations.forEach(record => {
      const physicianName = record.exam?.physician?.userId
        ? `${record.exam.physician.userId.firstName} ${record.exam.physician.userId.lastName}`
        : (record.exam?.physician?.name || 'Unknown');

      timeline.push({
        type: 'Medical Examination',
        date: record.exam?.date || record.createdAt,
        provider: physicianName,
        findings: record.exam?.findings,
        priority: record.exam?.priority,
        status: record.exam?.status,
        recordId: record._id,
        details: record
      });
    });

    // Add chief complaints to timeline
    chiefComplaints.forEach(record => {
      timeline.push({
        type: 'Chief Complaint',
        date: record.createdAt,
        provider: record.createdBy ? `${record.createdBy.firstName} ${record.createdBy.lastName}` : 'Unknown',
        complaint: record.complaint,
        findings: record.findings,
        treatment: record.treatmentOrRecommendation,
        isApproved: record.isApproved,
        recordId: record._id,
        details: record
      });
    });

    // Sort timeline by date (most recent first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      personnel: {
        perId: personnel.perId,
        name: `${personnel.firstName} ${personnel.middleName || ''} ${personnel.lastName}`.trim(),
        position: personnel.position,
        schoolName: personnel.schoolName,
        schoolDistrictDivision: personnel.schoolDistrictDivision,
        dateOfBirth: personnel.dateOfBirth,
        age: personnel.age,
        gender: personnel.gender,
        civilStatus: personnel.civilStatus,
        yearsInService: personnel.yearsInService,
        firstYearInService: personnel.firstYearInService
      },
      summary: {
        totalRecords: timeline.length,
        healthCards: healthCards.length,
        dentalTreatments: dentalTreatments.length,
        dentalRecordCharts: dentalRecordCharts.length,
        dailyTreatments: dailyTreatments.length,
        prescriptions: prescriptions.length,
        healthExaminations: healthExaminations.length,
        chiefComplaints: chiefComplaints.length,
        lastVisit: timeline[0]?.date || null,
        firstVisit: timeline[timeline.length - 1]?.date || null
      },
      records: {
        healthCards,
        dentalTreatments,
        dentalRecordCharts,
        dailyTreatments,
        prescriptions,
        healthExaminations,
        chiefComplaints
      },
      timeline
    };
  }
}

export default new PersonnelService();