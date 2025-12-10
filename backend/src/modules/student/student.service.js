import ApiError from "#utils/ApiError.js";
import { StatusCodes } from "http-status-codes";
import StudentModel from "./student.model.js";
// import cache from '#utils/cache.js';
// import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import notificationService from '#modules/notifications/notification.service.js';
import { NOTIFICATION_TYPES, PRIORITY_LEVELS } from '#utils/constants.js';
import SchoolHealthExamCardModel from "#modules/school-health-exam-card/school-health-exam-card.model.js";
import DailyTreatmentRecordModel from "#modules/daily-treatment-record/daily-treatment-record.model.js";
import PrescriptionModel from "#modules/prescription/prescription.model.js";

class StudentService {

  async createStudent(data) {

    if (data.lrn) {
      const isDuplicate = await StudentModel.isLrnExist(data.lrn);

      if (isDuplicate) {
        throw new ApiError(`A student with LRN ${data.lrn} already exists.`, StatusCodes.CONFLICT);
      }
    }
    const existing = await StudentModel.findOne({
      firstName: data.firstName,
      lastName: data.lastName,
    });

    if (existing) {
      throw new ApiError(`Duplicate entry: Student ${data.firstName} ${data.lastName}  already exists`, StatusCodes.CONFLICT);
    }
    const student = await StudentModel.create(data);
    const updatedStudent = await StudentModel.findById(student._id);

    // Create notification for attending personnel if assigned
    if (data.attendingPersonnel) {
      await notificationService.createNotification({
        recipientId: data.attendingPersonnel,
        title: 'STUDENT RECORD',
        message: `New student record for ${data.firstName} ${data.lastName} has been created`,
        type: NOTIFICATION_TYPES.NEW_RECORD,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    //     await cache.delPattern(CACHE_KEYS.STUDENT.PATTERN);
    return updatedStudent;
  }
  async getStudentByLRN(lrn) {
    return await this._findStudentByLRN(lrn);
  }
  async getStudentById(stdId) {
    //     const cacheKey = CACHE_KEYS.STUDENT.BY_ID(stdId);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch (error) {
    //   // logger.warn('Cache read error:', error);
    // }

    const student = await StudentModel.findOne({ stdId, isDeleted: false })
      .select('-__v')
      .lean();

    if (student) {
      //       await cache.set(cacheKey, student, CACHE_TTL.MEDIUM);
    }
    return student;
  }
  async getAllStudentsByAttendingPersonnel(attendingPersonnel, schoolDistrictDivision, options = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const query = { isDeleted: false };

    let districts = schoolDistrictDivision;

    if (!districts || (Array.isArray(districts) && districts.length === 0)) {
      const PersonnelModel = (await import('#modules/personnel/personnel.model.js')).default;
      const personnel = await PersonnelModel.findById(attendingPersonnel).select('schoolDistrictDivision').lean();
      districts = personnel?.schoolDistrictDivision;
    }

    if (districts && Array.isArray(districts) && districts.length > 0) {
      query.$or = [
        { attendingPersonnel },
        { schoolDistrictDivision: { $in: districts } }
      ];
    } else {
      query.attendingPersonnel = attendingPersonnel;
    }

    const [students, total] = await Promise.all([
      StudentModel
        .find(query)
        .select('-__v')
        .populate('attendingPersonnel', 'firstName lastName schoolName schoolDistrictDivision')
        .sort({ lastName: -1, firstName: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StudentModel.countDocuments(query)
    ]);



    return {
      students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  async getAllStudents(options = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const query = { isDeleted: false };

    const [students, total] = await Promise.all([
      StudentModel
        .find(query)
        .select('-__v')
        .populate('attendingPersonnel', 'firstName lastName role')
        .skip(skip)
        .limit(limit)
        .lean(),
      StudentModel.countDocuments(query)
    ]);



    return {
      students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }


  async updateStudentById(stdId, updateData) {

    const currentStudent = await this.getStudentById(stdId);
    if (!currentStudent) {
      throw new ApiError(`Student with ID ${stdId} not found`, StatusCodes.NOT_FOUND);
    }

    if (updateData.lrn && updateData.lrn !== currentStudent.lrn) {
      const isDuplicate = await StudentModel.isLrnExist(updateData.lrn);
      if (isDuplicate) {
        throw new ApiError(`A student with LRN ${updateData.lrn} already exists`, StatusCodes.CONFLICT);
      }
    }

    const updatedStudent = await StudentModel.findOneAndUpdate(
      { _id: currentStudent._id, isDeleted: false },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      throw new ApiError(`Student with ID ${stdId} not found`, StatusCodes.NOT_FOUND);
    }

    if (updatedStudent.attendingPersonnel) {
      await notificationService.createNotification({
        recipientId: updatedStudent.attendingPersonnel,
        title: 'STUDENT RECORD',
        message: `Student record for ${updatedStudent.firstName} ${updatedStudent.lastName} has been updated`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    //     await cache.delPattern(CACHE_KEYS.STUDENT.PATTERN);
    return updatedStudent;
  }

  async softDeleteStudent(stdId) {
    const student = await StudentModel.findOne({ stdId, isDeleted: false });
    if (!student) {
      throw new ApiError(`Student not found`, StatusCodes.NOT_FOUND);
    }

    const studentObjectId = student._id;

    await SchoolHealthExamCardModel.deleteMany({ student: studentObjectId });

    await DailyTreatmentRecordModel.deleteMany({ student: studentObjectId });

    await PrescriptionModel.deleteMany({ student: studentObjectId });

    const updatedStudent = await StudentModel.findOneAndUpdate(
      { stdId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (student.attendingPersonnel) {
      await notificationService.createNotification({
        recipientId: student.attendingPersonnel,
        title: 'STUDENT RECORD',
        message: `Student record for ${student.firstName} ${student.lastName} has been deleted`,
        type: NOTIFICATION_TYPES.RECORD_DELETE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    //     await cache.delPattern(CACHE_KEYS.STUDENT.PATTERN);
    return {
      message: 'Student successfully deleted',
      deletedAt: new Date()
    };
  }

  async restoreStudent(stdId) {
    const student = await StudentModel.findOne({ stdId, isDeleted: true });

    if (!student) {
      throw new ApiError(`Deleted student not found`, StatusCodes.NOT_FOUND);
    }

    const updatedStudent = await StudentModel.findOneAndUpdate(
      { stdId, isDeleted: true },
      { $set: { isDeleted: false } },
      { new: true }
    );

    if (student.attendingPersonnel) {
      await notificationService.createNotification({
        recipientId: student.attendingPersonnel,
        title: 'STUDENT RECORD',
        message: `Student record for ${student.firstName} ${student.lastName} has been restored`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    //     await cache.delPattern(CACHE_KEYS.STUDENT.PATTERN);
    return {
      message: 'Student successfully restored',
      student: updatedStudent
    };
  }



  async searchStudents(query, options = {}) {
    const { limit = 50, page = 1, user } = options;
    const skip = (page - 1) * limit;

    let searchQuery = {
      isDeleted: false,
    };
    if (user) {
      searchQuery.attendingPersonnel = user
    }
    if (query && query.trim().length >= 2) {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchQuery.$or = [
        { firstName: searchRegex },
        { middleName: searchRegex },
        { lastName: searchRegex },
        { gradeLevel: searchRegex },
        { section: searchRegex },
        { stdId: searchRegex },
        { schoolName: searchRegex }
      ];
    }

    // Execute query with pagination and limit
    const [students, total] = await Promise.all([
      StudentModel.find(searchQuery)
        .select('firstName middleName lastName stdId gradeLevel section schoolName birthDate gender attendingPersonnel')
        .populate('attendingPersonnel', 'firstName lastName schoolName schoolDistrictDivision')
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StudentModel.countDocuments(searchQuery)
    ]);
    return {
      students,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getStudentsByGradeLevel(gradeLevel) {
    //     const cacheKey = CACHE_KEYS.STUDENT.BY_GRADE(gradeLevel);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    //   // logger.warn('Cache read error:', error);
    // }

    const students = await StudentModel.find({
      gradeLevel,
      isDeleted: false
    }).sort({ lastName: 1, firstName: 1 });

    //     await cache.set(cacheKey, students, CACHE_TTL.MEDIUM);
    return students;
  }
  async getStudentCount() {
    //     const cacheKey = CACHE_KEYS.STUDENT.COUNT;

    //     try {
    //       const cached = await cache.get(cacheKey);
    //   if (cached !== null) return cached;
    // } catch (error) {
    //   // logger.warn('Cache read error:', error);
    // }

    const count = await StudentModel.countDocuments({ isDeleted: false });
    //     await cache.set(cacheKey, count, CACHE_TTL.SHORT);
    return count;
  }

  async getStudentsBySection(gradeLevel, section) {
    //     const cacheKey = CACHE_KEYS.STUDENT.BY_SECTION(gradeLevel, section);

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    //   // logger.warn('Cache read error:', error);
    // }

    const students = await StudentModel.find({
      gradeLevel,
      section,
      isDeleted: false
    }).sort({ lastName: 1, firstName: 1 });

    //     await cache.set(cacheKey, students, CACHE_TTL.MEDIUM);
    return students;
  }


  async getSPEDStudents() {
    //     const cacheKey = CACHE_KEYS.STUDENT.SPED;

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    //   // logger.warn('Cache read error:', error);
    // }

    const students = await StudentModel.find({
      isSPED: true,
      isDeleted: false
    }).sort({ gradeLevel: 1, lastName: 1, firstName: 1 })
      .select('-dateOfBirth -birthplace -address -telephoneNo -parentGuardian -parentContact')
      .lean();

    //     await cache.set(cacheKey, students, CACHE_TTL.LONG);
    return students;
  }

  async getStudentsByAttendingPersonnel(id) {
    return await StudentModel.find({
      attendingPersonnel: id,
      isDeleted: false
    }).sort({ updatedAt: -1 })
      .select('-dateOfBirth -birthplace -address -telephoneNo -parentGuardian -parentContact')
      .lean();
  }

  async countStudentsByGradeLevel() {
    //     const cacheKey = CACHE_KEYS.STUDENT.GRADE_COUNT;

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch(error) {
    //   // logger.warn('Cache read error:', error);
    // }

    const result = await StudentModel.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$gradeLevel", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const gradeLevelCounts = {};
    result.forEach(item => {
      gradeLevelCounts[item._id] = item.count;
    });

    //     await cache.set(cacheKey, gradeLevelCounts, CACHE_TTL.MEDIUM);
    return gradeLevelCounts;
  }
  async _findStudentByLRN(lrn, includeDeleted = false) {
    const query = { lrn };

    if (!includeDeleted) {
      query.isDeleted = false;
    }

    const student = await StudentModel.findOne(query).lean();

    if (!student) {
      throw new ApiError(`Student with LRN ${lrn} not found`, StatusCodes.NOT_FOUND);
    }

    return student;
  }

  async getCompleteStudentHistory(stdId) {
    const student = await this.getStudentById(stdId);

    if (!student) {
      throw new ApiError(`Student with ID ${stdId} not found`, StatusCodes.NOT_FOUND);
    }

    const DentalTreatmentRecordModel = (await import('#modules/dental-treatment-record/dental-treatment-record.model.js')).default;
    const DentalRecordChartModel = (await import('#modules/dental-record-chart/dental-record-chart.model.js')).default;
    const HealthExaminationModel = (await import('#modules/health-examination-record/health-examination.model.js')).default;
    const ChiefComplaintModel = (await import('#modules/chief-complaint/chief-complaint.model.js')).default;

    const [
      schoolHealthExams,
      dentalTreatments,
      dentalRecordCharts,
      dailyTreatments,
      prescriptions,
      healthExaminations,
      chiefComplaints
    ] = await Promise.all([
      // School Health Exam Cards
      SchoolHealthExamCardModel.find({
        student: student._id,
        isDeleted: false
      })
        .populate('examinations.examiner', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean(),

      // Dental Treatment Records
      DentalTreatmentRecordModel.find({
        student: student._id,
        isDeleted: false
      })
        .populate('attendedBy', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean(),

      // Dental Record Charts
      DentalRecordChartModel.find({
        student: student._id,
        isDeleted: false
      })
        .populate('attendedBy', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ dateOfExamination: -1 })
        .lean(),

      // Daily Treatment Records
      DailyTreatmentRecordModel.find({
        student: student._id,
        isDeleted: false
      })
        .populate('attendedBy', 'firstName lastName role')
        .populate('lastModifiedBy', 'firstName lastName role')
        .sort({ dateOfTreatment: -1 })
        .lean(),

      // Prescriptions
      PrescriptionModel.find({
        patientName: {
          $regex: `${student.firstName}.*${student.lastName}`,
          $options: 'i'
        },
        isDeleted: false
      })
        .populate('prescribedBy', 'firstName lastName role')
        .populate('attendingExaminer', 'firstName lastName role')
        .sort({ prescribedDate: -1 })
        .lean(),

      // Health Examinations (Personnel)
      HealthExaminationModel.find({
        name: `${student.firstName} ${student.lastName}`,
        isDeleted: false
      })
        .populate('createdBy', 'firstName lastName role')
        .populate('exam.physician.userId', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []), // If model doesn't exist or error, return empty array

      // Chief Complaints
      ChiefComplaintModel.find({
        personnel: student._id,
        isDeleted: false
      })
        .populate('createdBy', 'firstName lastName role')
        .populate('approvedBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []) // If model doesn't exist or error, return empty array
    ]);

    // Format and aggregate timeline
    const timeline = [];

    // Add school health exams to timeline
    schoolHealthExams.forEach(record => {
      record.examinations?.forEach(exam => {
        timeline.push({
          type: 'School Health Examination',
          date: exam.examinationDate || record.createdAt,
          grade: exam.grade,
          examiner: exam.examiner ? `${exam.examiner.firstName} ${exam.examiner.lastName}` : 'Unknown',
          findings: exam.findings,
          recordId: record._id,
          details: exam
        });
      });
    });

    dentalTreatments.forEach(record => {
      if (record.treatments && Array.isArray(record.treatments)) {
        record.treatments.forEach(treatment => {
          timeline.push({
            type: 'Dental Treatment',
            date: treatment.date || record.createdAt,
            provider: record.attendedBy ? `${record.attendedBy.firstName} ${record.attendedBy.lastName}` : (treatment.dentist || 'Unknown'),
            treatment: treatment.procedure,
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

    healthExaminations.forEach(record => {
      const physicianName = record.exam?.physician?.userId
        ? `${record.exam.physician.userId.firstName} ${record.exam.physician.userId.lastName}`
        : (record.exam?.physician?.name || 'Unknown');

      timeline.push({
        type: 'Health Examination',
        date: record.exam?.date || record.createdAt,
        provider: physicianName,
        findings: record.exam?.findings,
        priority: record.exam?.priority,
        status: record.exam?.status,
        recordId: record._id,
        details: record
      });
    });

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

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    return {
      student: {
        stdId: student.stdId,
        name: `${student.firstName} ${student.middleName || ''} ${student.lastName}`.trim(),
        gradeLevel: student.gradeLevel,
        section: student.section,
        schoolName: student.schoolName,
        isSPED: student.isSPED,
        lrn: student.lrn,
        dateOfBirth: student.dateOfBirth,
        age: student.age,
        sex: student.sex,
        address: student.address
      },
      summary: {
        totalRecords: timeline.length,
        schoolHealthExams: schoolHealthExams.length,
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
        schoolHealthExams,
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

export default new StudentService();
