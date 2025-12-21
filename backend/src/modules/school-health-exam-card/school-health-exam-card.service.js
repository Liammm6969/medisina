import SchoolHealthExamination from "./school-health-exam-card.model.js";
import SchoolHealthDSSService from './school-health-exam-card-dss.service.js'
import dailyTreatmentRecordService from "#modules/daily-treatment-record/daily-treatment-record.service.js";
import studentService from "#modules/student/student.service.js";
import { StatusCodes } from "http-status-codes";
import ApiError from "#utils/ApiError.js";
import { NOTIFICATION_STATUS, PRIORITY_LEVELS, TREATMENT_STATUS, NOTIFICATION_TYPES, NOTIFICATION_TITLE } from "#utils/constants.js";
import notificationService from "#modules/notifications/notification.service.js";
import { Engine } from 'json-rules-engine';
import { allRules } from './health-analysis.rules.js';
import { limitedAll } from '#utils/concurrency.js';
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import { uploadFileToCloudinary } from "#utils/cloudinary.js";
class SchoolHealthExaminationService {
  _formatPersonName(person, includeRole = false) {
    if (!person) return 'Unknown';
    const name = `${person.firstName} ${person.lastName}`;
    return includeRole && person.role ? `${name} (${person.role})` : name;
  }

  _formatStudentInfo(student) {
    return student ? {
      stdId: student.stdId,
      name: this._formatPersonName(student),
      schoolName: student.schoolName,
      schoolDistrictDivision: student.schoolDistrictDivision,
      gradeLevel: student.gradeLevel,
      schoolId: student.schoolId,
      isSPED: student.isSPED ? "SPED" : "Regular Student"
    } : null;
  }

  _calculateHealthMetrics(findings) {
    const alerts = findings?.healthAlerts || [];
    return {
      overallHealthStatus: findings?.overallHealthStatus || 'UNKNOWN',
      riskLevel: findings?.riskLevel || 'UNKNOWN',
      alertCount: alerts.length,
      urgentAlerts: alerts.filter(alert => alert.requiresImmediateAttention).length
    };
  }

  _createBaseRecordInfo(record, examination = null) {

    const exam = examination || (record.examinations && record.examinations[0]);
    const findings = exam?.findings;
    const healthMetrics = this._calculateHealthMetrics(findings);
    return {
      recordId: record._id,
      shecId: record.shecId,
      student: this._formatStudentInfo(record.student),
      grade: exam?.grade,
      treatment: exam.treatment,
      complaint: exam.complaint,

      examinationDate: exam?.dateOfExamination,
      examiner: this._formatPersonName(exam?.examiner),
      ...healthMetrics,
      lastModified: record.updatedAt,
      findings
    };
  }

  async _validateStudent(stdId) {
    const student = await studentService.getStudentById(stdId);
    if (!student) {
      throw new ApiError("Student Not Found, Please create a student info first", StatusCodes.NOT_FOUND);
    }
    return student;
  }

  async _findExamRecord(studentId, gradeLevel) {
    const record = await SchoolHealthExamination.findOne({
      student: studentId,
      isDeleted: false,
      'examinations.grade': gradeLevel
    });
    if (!record) {
      throw new ApiError(`No health examination found for grade level ${gradeLevel}`, StatusCodes.NOT_FOUND);
    }
    return record;
  }

  async createExamCard(stdId, healthCardData) {
    const student = await this._validateStudent(stdId);

    const existingCard = await SchoolHealthExamination.findOne({
      student: student._id,
      isDeleted: false
    });

    if (existingCard) {
      const existingGrades = existingCard.examinations.map(exam => exam.grade);
      const newGrades = healthCardData.examinations.map(exam => exam.grade);
      const conflicts = newGrades.filter(grade => existingGrades.includes(grade));

      if (conflicts.length > 0) {
        throw new ApiError(`Health examinations already exist for grade: ${conflicts.join(', ')}`, StatusCodes.CONFLICT);
      }

      existingCard.examinations.push(...healthCardData.examinations);
      existingCard.lastModifiedBy = healthCardData.lastModifiedBy;

      // Generate health assessment for the new examinations
      await existingCard.generateHealthAssessment(SchoolHealthDSSService);

      await existingCard.save();
      return existingCard;
    }

    const card = new SchoolHealthExamination({
      student: student._id,
      examinations: healthCardData.examinations,
      lastModifiedBy: healthCardData.lastModifiedBy
    });

    // Generate health assessment before saving
    await card.generateHealthAssessment(SchoolHealthDSSService);

    const notifications = healthCardData.examinations.map(exam =>
      dailyTreatmentRecordService.createRecord({
        schoolId: student.schoolId || "Not Available",
        schoolName: student.schoolName || "Not Available",
        schoolDistrictDivision: student.schoolDistrictDivision || "Not Available",
        dateOfTreatment: new Date(),
        student: student._id,
        lrn: student.lrn || 'Not Available',
        patientName: this._formatPersonName(student),
        gradeLevel: exam.grade,
        chiefComplaint: exam.complaint,
        treatment: TREATMENT_STATUS.PENDING_REVIEW,
        remarks: exam.remarks || TREATMENT_STATUS.PENDING_REVIEW,
        attendedBy: exam.examiner
      })
    );

    const notificationPromises = healthCardData.examinations.map(exam =>
      notificationService.createNotification({
        recipientId: exam.examiner,
        title: NOTIFICATION_TITLE.SCHOOL_HEALTH_EXAMINATION_CARD,
        message: `New health examination for student ${this._formatPersonName(student)}, ${exam.grade} has been created, waiting for review and approval`,
        type: NOTIFICATION_TYPES.APPROVAL,
        status: NOTIFICATION_STATUS.UNREAD,
        priority: PRIORITY_LEVELS.HIGH,
        isActionRequired: true
      })
    );
    await limitedAll(
      [...notifications, ...notificationPromises].map(promise => () => promise),
      5
    );

    await cache.delPattern(CACHE_KEYS.SCHOOL_HEALTH_EXAM.PATTERN);

    return await card.save();
  }

  async getAllRecordsByAttendingExaminer(examiner, schoolDistrictDivision, options = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const query = { isDeleted: false };
    if (examiner) {
      query['examinations.examiner'] = examiner;
    }

    const [records, totalCount] = await Promise.all([
      SchoolHealthExamination.find(query)
        .populate('student', 'stdId firstName lastName gradeLevel schoolName isSPED schoolId schoolDistrictDivision')
        .populate('examinations.examiner', 'firstName lastName role schoolDistrictDivision')
        .sort({ stdId: -1 })
        .lean(),
      SchoolHealthExamination.countDocuments(query)
    ]);

    const flattenedRecords = [];
    records.forEach(record => {
      record.examinations.forEach(exam => {
        let includeExamination = !examiner;

        if (examiner && exam.examiner) {
          const isExaminerMatch = exam.examiner._id.toString() === examiner.toString();

          const examinerDistricts = Array.isArray(schoolDistrictDivision)
            ? schoolDistrictDivision
            : (schoolDistrictDivision ? [schoolDistrictDivision] : []);
          const studentDistrict = record.student?.schoolDistrictDivision;
          const sharesSameDistrict = studentDistrict && examinerDistricts.includes(studentDistrict);
          includeExamination = isExaminerMatch || sharesSameDistrict;
        }

        if (includeExamination) {
          flattenedRecords.push({
            ...this._createBaseRecordInfo(record, exam),
            isApproved: exam.isApproved,
            approvedAt: exam.approvedAt,
            remarks: exam.remarks,
            attachmentUrl: exam.attachmentUrl,
            attachmentName: exam.attachmentName
          });
        }
      });
    });

    // Apply pagination to flattened records
    const total = flattenedRecords.length;
    const paginatedRecords = flattenedRecords.slice(skip, skip + limit);

    return {
      data: paginatedRecords,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getAllSchoolHealthRecordCount() {
    const cacheKey = CACHE_KEYS.SCHOOL_HEALTH_EXAM.COUNT;

    const cached = await cache.get(cacheKey);
    if (cached !== null) return cached;

    const count = await SchoolHealthExamination.countDocuments({ isDeleted: false });

    await cache.set(cacheKey, count, CACHE_TTL.SHORT);

    return count;
  }

  async updateGradeExamination(stdId, gradeLevel, examinationData, personnelId) {
    const student = await this._validateStudent(stdId);

    const card = await SchoolHealthExamination.findOne({
      student: student._id,
      isDeleted: false
    });

    if (!card) {
      throw new ApiError(`No health examination card found for student`, StatusCodes.NOT_FOUND);
    }

    const examinationIndex = card.examinations.findIndex(exam => exam.grade === gradeLevel);
    if (examinationIndex === -1) {
      throw new ApiError(`No examination found for grade level ${gradeLevel}`, StatusCodes.NOT_FOUND);
    }

    // Update the specific examination
    if (examinationData.findings) {
      card.examinations[examinationIndex].findings = {
        ...card.examinations[examinationIndex].findings,
        ...examinationData.findings
      };
    }

    if (examinationData.remarks !== undefined) {
      card.examinations[examinationIndex].remarks = examinationData.remarks;
    }

    card.lastModifiedBy = personnelId;
    card.updatedAt = new Date();

    await card.generateHealthAssessment(SchoolHealthDSSService);

    await cache.delPattern(CACHE_KEYS.SCHOOL_HEALTH_EXAM.PATTERN);

    return await card.save();
  }

  async deleteGradeExamination(stdId, gradeLevel, personnelId) {
    const student = await this._validateStudent(stdId);

    const card = await SchoolHealthExamination.findOne({
      student: student._id,
      isDeleted: false
    });

    if (!card) {
      throw new ApiError(`Health examination card not found`, StatusCodes.NOT_FOUND);
    }

    const examinationIndex = card.examinations.findIndex(exam => exam.grade === gradeLevel);
    if (examinationIndex === -1) {
      throw new ApiError(`Health examination for grade ${gradeLevel} not found`, StatusCodes.NOT_FOUND);
    }

    card.examinations.splice(examinationIndex, 1);

    if (card.examinations.length === 0) {
      card.isDeleted = true;
    }

    card.lastModifiedBy = personnelId;
    card.updatedAt = new Date();

    await cache.delPattern(CACHE_KEYS.SCHOOL_HEALTH_EXAM.PATTERN);

    return await card.save();
  }

  async getAllGradeExamination(examiner, schoolDistrictDivision) {
    const query = { isDeleted: false };
    if (examiner) {
      query['examinations.examiner'] = examiner;
    }
    const records = await SchoolHealthExamination.find(query)
      .populate('student', 'stdId firstName lastName gradeLevel schoolName schoolId schoolDistrictDivision')
      .populate('examinations.examiner', 'firstName lastName role schoolDistrictDivision')
      .populate('lastModifiedBy', 'firstName lastName role')
      .populate('examinations.approvedBy', 'firstName lastName role')
      .lean();

    const flattenedExaminations = [];
    records.forEach(record => {
      record.examinations.forEach(exam => {

        let includeExamination = !examiner;

        if (examiner && exam.examiner) {
          const isExaminerMatch = exam.examiner._id?.toString() === examiner.toString();
          const examinerDistricts = Array.isArray(exam.examiner.schoolDistrictDivision)
            ? exam.examiner.schoolDistrictDivision
            : (exam.examiner.schoolDistrictDivision ? [exam.examiner.schoolDistrictDivision] : []);
          const studentDistrict = record.student?.schoolDistrictDivision;
          const sharesSameDistrict = studentDistrict && examinerDistricts.includes(studentDistrict);

          includeExamination = isExaminerMatch || sharesSameDistrict;
        }

        if (includeExamination) {
          flattenedExaminations.push({
            ...this._createBaseRecordInfo(record, exam),
            isApproved: exam.isApproved,
            approvedBy: this._formatPersonName(exam.approvedBy),
            approvedAt: exam.approvedAt,
            remarks: exam.remarks,
            lastModifiedBy: this._formatPersonName(record.lastModifiedBy),
            createdAt: record.createdAt
          });
        }
      });
    });

    return flattenedExaminations;
  }


  async getExaminationHistory(stdId) {
    const cacheKey = CACHE_KEYS.SCHOOL_HEALTH_EXAM.HISTORY(stdId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for examination history', error);
    }

    const student = await this._validateStudent(stdId);

    const records = await SchoolHealthExamination.find({
      student: student._id,
      isDeleted: false
    })
      .populate("examinations.examiner", "firstName lastName role")
      .populate("lastModifiedBy", "firstName lastName role")
      .populate("examinations.approvedBy", "firstName lastName role")
      .sort({ createdAt: -1 })
      .lean();

    const allExaminations = [];
    let totalRecords = 0;

    records.forEach(record => {
      record.examinations.forEach(exam => {
        totalRecords++;
        allExaminations.push({
          ...this._createBaseRecordInfo(record, exam),
          isApproved: exam.isApproved,
          approvedBy: this._formatPersonName(exam.approvedBy),
          approvedAt: exam.approvedAt,
          remarks: exam.remarks,
          createdAt: record.createdAt
        });
      });
    });

    allExaminations.sort((a, b) => {
      const gradeComparison = a.grade.localeCompare(b.grade);
      if (gradeComparison !== 0) return gradeComparison;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const result = {
      studentInfo: this._formatStudentInfo(student),
      totalRecords,
      examinations: allExaminations
    };

    try {
      await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for examination history', error);
    }

    return result;
  }

  async _getRecordsWithFilters(baseQuery, populateFields = [], sortBy = { updatedAt: -1 }) {
    return SchoolHealthExamination.find(baseQuery)
      .populate(populateFields)
      .sort(sortBy)
      .lean();
  }

  async getCardsByGrade(gradeLevel) {
    const records = await this._getRecordsWithFilters(
      { grade: gradeLevel, isDeleted: false },
      [
        { path: "student", select: "stdId firstName lastName gradeLevel" },
        { path: "examiner", select: "firstName lastName role" }
      ]
    );

    return {
      gradeLevel,
      totalRecords: records.length,
      examinations: records.map(this._createBaseRecordInfo.bind(this))
    };
  }

  async getCardsBySchool(schoolId) {
    const records = await SchoolHealthExamination.find({ isDeleted: false })
      .populate({
        path: "student",
        match: { schoolId },
        select: "stdId firstName lastName gradeLevel school",
      })
      .populate("examinations.examiner", "firstName lastName role")
      .populate("examinations.approvedBy", "firstName lastName role")
      .lean();

    const filteredRecords = records.filter(result => result.student);

    return {
      schoolId,
      totalRecords: filteredRecords.length,
      examinations: filteredRecords.map(record => ({
        ...this._createBaseRecordInfo(record),
        isApproved: record.examinations?.[0]?.isApproved || false
      }))
    };
  }

  async getHealthStatistics(userId) {
    const records = await SchoolHealthExamination.find({ isDeleted: false, }).lean();

    const examDataArray = [];
    records.forEach(record => {
      if (record.examinations && Array.isArray(record.examinations)) {
        record.examinations.forEach(examination => {
          if (examination.examiner.toString() === userId.toString()) {
            const examRecord = {
              student: record.student,
              grade: examination.grade,
              findings: examination.findings,
              examiner: examination.examiner,
              isApproved: examination.isApproved,
              approvedBy: examination.approvedBy,
              approvedAt: examination.approvedAt,
              remarks: examination.remarks,
              updatedAt: record.updatedAt,
              createdAt: record.createdAt
            };
            examDataArray.push(SchoolHealthDSSService.mapExamToDSSInput(examRecord));
          }
        });
      }
    });

    return SchoolHealthDSSService.generateSchoolSummary(examDataArray);
  }

  async getNutritionalStatusSummary() {
    const cacheKey = CACHE_KEYS.SCHOOL_HEALTH_EXAM.NUTRITION_SUMMARY;

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for nutritional status summary', error);
    }

    const result = await SchoolHealthExamination.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: '$examinations' },
      {
        $group: {
          _id: "$examinations.grade",
          normal: {
            $sum: { $cond: [{ $eq: ["$examinations.findings.nutritionalStatusBMI", "Normal"] }, 1, 0] },
          },
          underweight: {
            $sum: { $cond: [{ $eq: ["$examinations.findings.nutritionalStatusBMI", "Underweight"] }, 1, 0] },
          },
          overweight: {
            $sum: { $cond: [{ $eq: ["$examinations.findings.nutritionalStatusBMI", "Overweight"] }, 1, 0] },
          },
          obese: {
            $sum: { $cond: [{ $eq: ["$examinations.findings.nutritionalStatusBMI", "Obese"] }, 1, 0] },
          },
        },
      },
    ]);

    try {
      await cache.set(cacheKey, result, CACHE_TTL.LONG);
    } catch (error) {
      logger.warn('Cache set failed for nutritional status summary', error);
    }

    return result;
  }

  async analyzeSchoolHealthRecords(schoolId) {
    const records = await SchoolHealthExamination.find({ isDeleted: false })
      .populate({
        path: "student",
        match: { schoolId },
        select: "stdId firstName lastName gradeLevel school",
      })
      .populate("examinations.examiner", "firstName lastName role")
      .lean();

    const filteredRecords = records.filter(result => result.student);

    const flattenedExaminations = [];
    filteredRecords.forEach(record => {
      if (record.examinations && Array.isArray(record.examinations)) {
        record.examinations.forEach(exam => {
          flattenedExaminations.push({
            ...record,
            examination: exam,
            findings: exam.findings,
            grade: exam.grade,
            examiner: exam.examiner,
            isApproved: exam.isApproved
          });
        });
      }
    });

    return {
      schoolId,
      totalRecords: flattenedExaminations.length,
      analysisDate: new Date(),
      records: flattenedExaminations.map(record => ({
        ...this._createBaseRecordInfo(record, record.examination),
        nutritionalStatus: record.findings?.nutritionalStatusBMI,
        visionScreening: record.findings?.visionScreening,
        auditoryScreening: record.findings?.auditoryScreening,
        isApproved: record.isApproved
      })),
      summary: this._generateHealthSummary(flattenedExaminations)
    };
  }

  _generateHealthSummary(examinations) {
    return {
      highRiskCount: examinations.filter(e => e.findings?.riskLevel === 'HIGH').length,
      mediumRiskCount: examinations.filter(e => e.findings?.riskLevel === 'MEDIUM').length,
      lowRiskCount: examinations.filter(e => e.findings?.riskLevel === 'LOW').length,
      pendingApprovalCount: examinations.filter(e => !e.isApproved).length,
      urgentAlertsCount: examinations.reduce((sum, e) =>
        sum + (e.findings?.healthAlerts?.filter(alert => alert.requiresImmediateAttention).length || 0), 0
      )
    };
  }

  async getDSSSummary(userContext, schoolId = 'all') {
    const records = await this._getSchoolRecordsForAnalysis(schoolId, userContext);
    const examDataArray = [];
    records.forEach(record => {
      if (record.examinations && Array.isArray(record.examinations)) {
        record.examinations.forEach(examination => {
          const examRecord = {
            student: record.student,
            grade: examination.grade,
            findings: examination.findings,
            examiner: examination.examiner,
            isApproved: examination.isApproved,
            approvedBy: examination.approvedBy,
            approvedAt: examination.approvedAt,
            remarks: examination.remarks,
            updatedAt: record.updatedAt,
            createdAt: record.createdAt
          };
          examDataArray.push(SchoolHealthDSSService.mapExamToDSSInput(examRecord));
        });
      }
    });
    const summary = await SchoolHealthDSSService.generateSchoolSummary(examDataArray);
    const insights = await SchoolHealthDSSService.generatePredictiveInsights(examDataArray);

    return {
      summary,
      insights
    };
  }

  async getStudentDSSReport(stdId) {
    const student = await studentService.getStudentById(stdId);
    if (!student) throw new ApiError("Student not found", StatusCodes.NOT_FOUND);

    const records = await SchoolHealthExamination.find({
      student: student._id,
      isDeleted: false
    }).lean();

    return SchoolHealthDSSService.analyzeSchoolHealthRecords(records);
  }

  async getStudentsRequiringFollowUp(userContext = null, schoolId = 'all') {
    try {
      const records = await this._getSchoolRecordsForAnalysis(schoolId, userContext);
      if (!records || records.length === 0) {
        return [];
      }

      const validRecords = records.filter(record => record.student);

      if (validRecords.length === 0) {
        return [];
      }

      const analysis = await SchoolHealthDSSService.analyzeSchoolHealthRecords(validRecords);
      if (!analysis || !analysis.reports || !Array.isArray(analysis.reports)) {
        return [];
      }
      return analysis.reports.filter(r => r && r.riskLevel && r.riskLevel !== "Low Risk");
    } catch (error) {
      console.error('Error in getStudentsRequiringFollowUp:', error);
      throw new ApiError('Failed to retrieve students requiring follow-up', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getStudentsByCategory(category, userContext = null, schoolId = 'all') {
    try {
      const records = await this._getSchoolRecordsForAnalysis(schoolId, userContext);

      if (!records || records.length === 0) {
        return [];
      }

      const validRecords = records.filter(record => record.student);

      if (validRecords.length === 0) {
        return [];
      }

      const analysis = await SchoolHealthDSSService.analyzeSchoolHealthRecords(validRecords);
      if (!analysis || !analysis.reports || !Array.isArray(analysis.reports)) {
        return [];
      }

      // Debug logging for vision/hearing categories
      if (category === 'visionIssues' || category === 'hearingIssues') {
        const sampleReports = analysis.reports.slice(0, 3);
        sampleReports.forEach((report, idx) => {

        });
      }

      // Filter students based on category
      let filteredStudents = [];

      switch (category) {
        case 'notDewormed':
          filteredStudents = analysis.reports.filter(report => {
            if (!report || !Array.isArray(report.preventiveCare)) return false;
            return report.preventiveCare.some(item =>
              item.flag && (
                item.flag.toLowerCase().includes('deworming') ||
                item.flag.toLowerCase().includes('deworm')
              )
            );
          });
          break;

        case 'immunizationIncomplete':
          filteredStudents = analysis.reports.filter(report => {
            if (!report || !Array.isArray(report.preventiveCare)) return false;
            return report.preventiveCare.some(item =>
              item.flag && (
                item.flag.toLowerCase().includes('immunization') ||
                item.flag.toLowerCase().includes('vaccination') ||
                item.flag.toLowerCase().includes('vaccine')
              )
            );
          });
          break;

        case 'visionIssues':
          filteredStudents = analysis.reports.filter(report => {
            if (!report || !Array.isArray(report.visionHearing)) return false;
            return report.visionHearing.some(item =>
              item.flag && (
                item.flag.toLowerCase().includes('vision') ||
                item.flag.toLowerCase().includes('eye') ||
                item.flag.toLowerCase().includes('visual')
              )
            );
          });
          break;

        case 'hearingIssues':
          filteredStudents = analysis.reports.filter(report => {
            if (!report || !Array.isArray(report.visionHearing)) return false;
            return report.visionHearing.some(item =>
              item.flag && (
                item.flag.toLowerCase().includes('hearing') ||
                item.flag.toLowerCase().includes('auditory')
              )
            );
          });
          break;

        case 'pendingApproval':
          filteredStudents = analysis.reports.filter(report => {
            return report && report.isApproved === false;
          });
          break;

        default:
          return [];
      }

      return filteredStudents.map(report => ({
        stdId: report.studentId,
        studentName: report.studentName,
        gradeLevel: report.gradeLevel,
        schoolId: report.schoolId,
        schoolName: report.schoolName,
        examDate: report.analyzedAt,
        approvalStatus: report.isApproved ? 'Approved' : 'Pending',
        riskLevel: report.riskLevel,
      }));

    } catch (error) {
      console.error('Error in getStudentsByCategory:', error);
      throw new ApiError('Failed to retrieve students by category', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }


  async approveHealthRecord(stdId, gradeLevel, doctorId, treatment, remarks, file, fileMetadata = {}) {
    const student = await this._validateStudent(stdId);
    let attachmentData = {};
    if (file) {
      try {
        const baseName = `student_${student.firstName}_${Date.now()}`.replace(/\s+/g, "_");
        const uploaded = await uploadFileToCloudinary(file, student.stdId, baseName);

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

      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        throw new ApiError('Failed to upload file attachment', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }

    const updateFields = {
      'examinations.$.isApproved': true,
      'examinations.$.approvedBy': doctorId,
      'examinations.$.approvedAt': new Date(),
      'examinations.$.treatment': treatment || '',
      'examinations.$.remarks': remarks || '',
      lastModifiedBy: doctorId,
      updatedAt: new Date()
    };

    if (Object.keys(attachmentData).length > 0) {
      Object.keys(attachmentData).forEach(key => {
        updateFields[`examinations.$.${key}`] = attachmentData[key];
      });
    }

    const card = await SchoolHealthExamination.findOneAndUpdate(
      {
        student: student._id,
        isDeleted: false,
        'examinations.grade': gradeLevel,
        'examinations.isApproved': false
      },
      { $set: updateFields },
      { new: true }
    );

    if (!card) {
      throw new ApiError(`Health examination not found or already approved for grade level ${gradeLevel}`, StatusCodes.NOT_FOUND);
    }

    const examination = card.examinations.find(exam => exam.grade === gradeLevel);

    await this._updateDailyTreatmentRecord(student._id, treatment, remarks);

    if (examination.examiner) {
      const studentName = this._formatPersonName(student);
      const gradeLabel = gradeLevel ? ` (Grade ${gradeLevel})` : '';
      await notificationService.createNotification({
        recipientId: examination.examiner,
        title: NOTIFICATION_TITLE.SCHOOL_HEALTH_EXAMINATION_CARD,
        message: `${studentName}${gradeLabel} health record has been approved by the doctor.`,
        type: NOTIFICATION_TYPES.APPROVED,
        status: NOTIFICATION_STATUS.UNREAD,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.SCHOOL_HEALTH_EXAM.PATTERN);

    return await card.save();
  }
  async _updateDailyTreatmentRecord(studentId, treatment, remarks) {
    try {
      // Find the most recent daily treatment record for this student
      const DailyTreatmentRecord = (await import('../daily-treatment-record/daily-treatment-record.model.js')).default;
      const dailyTreatment = await DailyTreatmentRecord.findOne({
        student: studentId,
        isDeleted: false
      }).sort({ createdAt: -1 });

      if (dailyTreatment) {
        dailyTreatment.treatment = treatment || '';
        dailyTreatment.remarks = remarks || '';
        await dailyTreatment.save();
        logger.info(`Updated daily treatment record for student ${studentId}`);
      } else {
        logger.warn(`No daily treatment record found for student ${studentId}`);
      }
    } catch (error) {
      logger.warn('Failed to update daily treatment record:', error.message);
    }
  }

  async _getApprovalRecords(isApproved, additionalFields = []) {
    const populateFields = [
      { path: 'student', select: 'stdId firstName lastName gradeLevel schoolName schoolDistrictDivision isSPED' },
      { path: 'examinations.examiner', select: 'firstName lastName role' }
    ].concat(additionalFields);

    const records = await SchoolHealthExamination.find({ isDeleted: false })
      .populate(populateFields)
      .sort(isApproved ? { updatedAt: -1 } : { createdAt: -1 })
      .lean();

    const filteredExaminations = [];
    records.forEach(record => {
      record.examinations.forEach(exam => {
        if (exam.isApproved === isApproved) {
          filteredExaminations.push({
            record,
            examination: exam
          });
        }
      });
    });
    return filteredExaminations;
  }

  async getPendingApprovals(options = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const examinations = await this._getApprovalRecords(false);
    const total = examinations.length;

    const paginatedExaminations = examinations.slice(skip, skip + limit);

    const pendingRecords = paginatedExaminations.map(({ record, examination }) => ({
      ...this._createBaseRecordInfo(record, examination),
      student: {
        ...this._formatStudentInfo(record.student),
        section: record.student?.section,
        isSPED: record.student?.isSPED
      },
      treatment: examination.treatment,
      complaint: examination.complaint,
      remarks: examination.remarks,
      submittedAt: record.createdAt,
      isApproved: examination.isApproved,
      daysWaiting: Math.floor((new Date() - new Date(record.createdAt)) / (1000 * 60 * 60 * 24))
    }));

    logger.info(`Fetched pending approvals`, {
      page,
      limit,
      total,
      returned: pendingRecords.length
    });

    return {
      data: {
        pendingRecords
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getApprovedRecords(options = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const examinations = await this._getApprovalRecords(true, [
      { path: 'examinations.approvedBy', select: 'firstName lastName role' }
    ]);

    const total = examinations.length;
    const paginatedExaminations = examinations.slice(skip, skip + limit);

    const approvedRecords = paginatedExaminations.map(({ record, examination }) => ({
      ...this._createBaseRecordInfo(record, examination),
      approvedBy: this._formatPersonName(examination.approvedBy),
      treatment: examination.treatment,
      remarks: examination.remarks,
      complaint: examination.complaint,
      approvedAt: examination.approvedAt,
      attachmentUrl: examination.attachmentUrl,
      attachmentName: examination.attachmentName,
      attachmentType: examination.attachmentType
    }));

    logger.info(`Fetched approved records`, {
      page,
      limit,
      total,
      returned: approvedRecords.length
    });

    return {
      data: {
        totalApproved: total,
        approvedRecords
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getPendingExaminationsByGrade(gradeLevel) {
    return SchoolHealthExamination.find({
      grade: gradeLevel,
      isApproved: false,
      isDeleted: false
    })
      .populate([
        { path: "student", select: "stdId firstName lastName gradeLevel" },
        { path: "examiner", select: "firstName role" }
      ])
      .sort({ createdAt: -1 })
      .lean();
  }

  async getApprovedExaminationsByGrade(gradeLevel) {
    return SchoolHealthExamination.find({
      grade: gradeLevel,
      isApproved: true,
      isDeleted: false
    })
      .populate([
        { path: "student", select: "stdId firstName lastName gradeLevel" },
        { path: "examiner", select: "firstName role" },
        { path: "approvedBy", select: "firstName role" }
      ])
      .sort({ updatedAt: -1 })
      .lean();
  }

  async generateDSSAssessmentForRecord(recordId) {
    try {
      const record = await SchoolHealthExamination.findById(recordId)
        .populate('student', 'firstName lastName  dateOfBirth gender stdId')
        .populate('examinations.examiner', 'firstName lastName role');

      if (!record) {
        throw new ApiError("Health examination record not found", StatusCodes.NOT_FOUND);
      }

      // Process each examination
      if (record.examinations && Array.isArray(record.examinations)) {
        for (const exam of record.examinations) {
          // Create examRecord with proper findings structure for DSS
          const examRecord = {
            student: record.student,
            grade: exam.grade,
            findings: exam.findings || {},
            examiner: exam.examiner,
            isApproved: exam.isApproved,
            approvedBy: exam.approvedBy,
            approvedAt: exam.approvedAt,
            remarks: exam.remarks,
            updatedAt: record.updatedAt,
            createdAt: record.createdAt
          };

          // Perform DSS assessment
          const dssInput = SchoolHealthDSSService.mapExamToDSSInput(examRecord);
          const dssReport = await SchoolHealthDSSService.generateStudentReport(dssInput);
          const mappedResult = SchoolHealthDSSService.mapDSSReportToSchema(dssReport, examRecord);

          // Update examination findings
          exam.findings = exam.findings || {};
          exam.findings.overallHealthStatus = mappedResult.overallHealthStatus;
          exam.findings.riskLevel = mappedResult.riskLevel;
          exam.findings.healthAlerts = mappedResult.healthAlerts;
          exam.findings.clinicalRecommendations = mappedResult.clinicalRecommendations;
          exam.findings.flaggedConditions = mappedResult.flaggedConditions;
        }

        await record.save();
      }

      return {
        recordId: record._id,
        shecId: record.shecId,
        student: record.student,
        examinationsProcessed: record.examinations?.length || 0,
        assessment: {
          message: 'DSS assessment completed for all examinations'
        }
      };
    } catch (error) {
      logger.error("Error generating DSS assessment:", error);
      throw new ApiError("Failed to generate DSS assessment", StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async createExamCardWithDSSAssessment(stdId, healthCardData) {
    const card = await this.createExamCard(stdId, healthCardData);

    const dssResults = [];
    try {
      for (const examination of card.examinations) {
        const assessment = await this.generateDSSAssessmentForExamination(card._id, examination.grade);
        dssResults.push({
          grade: examination.grade,
          status: assessment?.status || 'COMPLETED',
          message: assessment?.message || 'DSS assessment completed'
        });
      }

      const updatedCard = await SchoolHealthExamination.findById(card._id)
        .populate('student', 'stdId firstName lastName')
        .populate('examinations.examiner', 'firstName lastName');

      return {
        ...updatedCard.toObject(),
        dssResults,
        message: dssResults.some(r => r.status === 'PENDING_DATA')
          ? 'Card created. Some examinations need more data for DSS assessment.'
          : 'Card created with DSS assessments for all examinations'
      };
    } catch (error) {
      console.warn('DSS Assessment failed for new card, returning card without assessment:', error.message);
      return {
        ...card.toObject(),
        dssResults,
        message: 'Card created but DSS assessment encountered errors'
      };
    }
  }

  async updateGradeExaminationWithDSSAssessment(stdId, gradeLevel, examinationData, personnelId) {
    const updatedRecord = await this.updateGradeExamination(stdId, gradeLevel, examinationData, personnelId);

    try {
      const assessment = await this.generateDSSAssessmentForExamination(updatedRecord._id, gradeLevel);
      return {
        ...updatedRecord.toObject(),
        dssAssessment: assessment
      };
    } catch (error) {
      console.warn('DSS Assessment failed for updated record, returning record without assessment:', error.message);
      return updatedRecord;
    }
  }

  async generateDSSAssessmentForExamination(recordId, grade) {
    try {
      const record = await SchoolHealthExamination.findById(recordId)
        .populate('student', 'firstName lastName dateOfBirth gender stdId lrn');

      if (!record) {
        throw new ApiError("Health examination record not found", StatusCodes.NOT_FOUND);
      }

      const examination = record.examinations.find(exam => exam.grade === grade);
      if (!examination) {
        throw new ApiError(`Examination for grade ${grade} not found`, StatusCodes.NOT_FOUND);
      }

      // Check if examination has meaningful findings data for DSS assessment
      const findings = examination.findings || {};
      const hasMinimalData = findings.nutritionalStatusBMI ||
        findings.visionScreening ||
        findings.auditoryScreening ||
        findings.heightInCm ||
        findings.weightInKg ||
        findings.skinScalp ||
        findings.lungsHeart ||
        findings.eyesEarsNose ||
        findings.abdomen ||
        findings.deformities;

      if (!hasMinimalData || Object.keys(findings).length === 0) {
        return {
          recordId: record._id,
          shecId: record.shecId,
          grade: examination.grade,
          student: record.student,
          assessment: null,
          message: 'Insufficient examination data for DSS assessment. Please complete the health examination first.',
          status: 'PENDING_DATA'
        };
      }

      // Create a temporary record structure for DSS input
      const examRecord = {
        student: record.student,
        grade: examination.grade,
        examiner: examination.examiner,
        findings: examination.findings,
        updatedAt: record.updatedAt,
        createdAt: record.createdAt
      };

      // Perform DSS assessment
      const dssInput = SchoolHealthDSSService.mapExamToDSSInput(examRecord);
      const dssReport = await SchoolHealthDSSService.generateStudentReport(dssInput);

      // Map DSS results to schema format using service method
      const mappedResult = SchoolHealthDSSService.mapDSSReportToSchema(dssReport, examRecord);

      // Update the specific examination's findings with DSS results
      examination.findings.overallHealthStatus = mappedResult.overallHealthStatus;
      examination.findings.riskLevel = mappedResult.riskLevel;
      examination.findings.healthAlerts = mappedResult.healthAlerts;
      examination.findings.clinicalRecommendations = mappedResult.clinicalRecommendations;
      examination.findings.flaggedConditions = mappedResult.flaggedConditions;

      await record.save();

      return {
        recordId: record._id,
        shecId: record.shecId,
        grade: examination.grade,
        student: record.student,
        assessment: {
          overallHealthStatus: mappedResult.overallHealthStatus,
          riskLevel: mappedResult.riskLevel,
          alertCount: mappedResult.healthAlerts?.length || 0,
          recommendationCount: mappedResult.clinicalRecommendations?.length || 0,
          requiresImmediateAttention: mappedResult.healthAlerts?.some(alert => alert.requiresImmediateAttention) || false,
          dssReport: dssReport
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('DSS Assessment generation failed:', error);
      throw new ApiError('Failed to generate DSS assessment', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Helper methods for controller
  getPriorityActionsFromExamination(examination) {
    const recommendations = examination.findings?.clinicalRecommendations?.filter(rec =>
      rec.priority === 'URGENT' || rec.priority === 'HIGH'
    ) || [];

    const alerts = examination.findings?.healthAlerts?.filter(alert =>
      alert.requiresImmediateAttention
    ) || [];

    return {
      immediateActions: alerts.map(alert => ({
        type: 'ALERT',
        description: alert.description,
        action: alert.recommendedAction,
        category: alert.type
      })),
      priorityRecommendations: recommendations.map(rec => ({
        type: 'RECOMMENDATION',
        description: rec.description,
        priority: rec.priority,
        assignedTo: rec.assignedTo,
        targetDate: rec.targetDate,
        category: rec.category
      }))
    };
  }

  getHealthSummaryFromExamination(examination) {
    const healthMetrics = this._calculateHealthMetrics(examination.findings);
    return {
      grade: examination.grade,
      examinationDate: examination.findings?.dateOfExamination,
      overallStatus: healthMetrics.overallHealthStatus,
      riskLevel: healthMetrics.riskLevel,
      alertCount: healthMetrics.alertCount,
      urgentAlerts: healthMetrics.urgentAlerts,
      pendingRecommendations: examination.findings?.clinicalRecommendations?.filter(rec => rec.priority === 'URGENT' || rec.priority === 'HIGH').length || 0,
      flaggedConditionsCount: examination.findings?.flaggedConditions?.length || 0
    };
  }


  getHealthSummary(examination) {
    const healthMetrics = this._calculateHealthMetrics(examination.findings);
    return {
      grade: examination.grade,
      examinationDate: examination.dateOfExamination,
      overallStatus: healthMetrics.overallHealthStatus,
      riskLevel: healthMetrics.riskLevel,
      alertCount: healthMetrics.alertCount,
      urgentAlerts: healthMetrics.urgentAlerts,
      pendingRecommendations: examination.findings?.clinicalRecommendations?.filter(rec => rec.priority === 'URGENT' || rec.priority === 'HIGH').length || 0,
      flaggedConditionsCount: examination.findings?.flaggedConditions?.length || 0
    };
  }

  getPriorityActions(examination) {
    const recommendations = examination.findings?.clinicalRecommendations?.filter(rec =>
      rec.priority === 'URGENT' || rec.priority === 'HIGH'
    ) || [];

    const alerts = examination.findings?.healthAlerts?.filter(alert =>
      alert.requiresImmediateAttention
    ) || [];

    return {
      immediateActions: alerts.map(alert => ({
        type: 'ALERT',
        description: alert.description,
        action: alert.recommendedAction,
        category: alert.type
      })),
      priorityRecommendations: recommendations.map(rec => ({
        type: 'RECOMMENDATION',
        description: rec.description,
        priority: rec.priority,
        assignedTo: rec.assignedTo,
        targetDate: rec.targetDate,
        category: rec.category
      }))
    };
  }

  async getBulkDSSAssessments(filters = {}, userContext = null) {
    const query = { isDeleted: false, ...filters };
    const records = await SchoolHealthExamination.find(query)
      .populate({
        path: 'student',
        select: 'stdId firstName lastName gradeLevel schoolId',
        match: userContext ? (userContext.associatedSchools === 'district' ? {} : { schoolId: { $in: userContext.associatedSchools || [] } }) : {}
      })
      .populate('examinations.examiner', 'firstName lastName role')
      .sort({ updatedAt: -1 })
      .lean();

    const assessments = [];

    records
      .filter(record => record.student)
      .forEach(record => {
        if (record.examinations && Array.isArray(record.examinations)) {
          record.examinations.forEach(exam => {
            assessments.push({
              ...this._createBaseRecordInfo(record, exam),
              grade: exam.grade,
              examinationDate: exam.dateOfExamination,
              totalRecommendations: exam.findings?.clinicalRecommendations?.length || 0,
              urgentRecommendations: exam.findings?.clinicalRecommendations?.filter(rec => rec.priority === 'URGENT').length || 0,
              severeAlerts: exam.findings?.healthAlerts?.filter(alert => alert.severity === 'SEVERE').length || 0,
              isApproved: exam.isApproved,
              needsAttention: (exam.findings?.healthAlerts?.filter(alert => alert.requiresImmediateAttention).length || 0) > 0
            });
          });
        }
      });

    return assessments;
  }

  async _getSchoolRecordsForAnalysis(schoolId, userContext = null) {
    if (!userContext) {
      if (schoolId === 'all') {
        return SchoolHealthExamination.find({ isDeleted: false })
          .populate({
            path: "student",
            select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
          })
          .lean();
      }

      return SchoolHealthExamination.find({ isDeleted: false })
        .populate({
          path: "student",
          match: { schoolId },
          select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
        })
        .lean()
        .then(results => results.filter(result => result.student));
    }

    const associatedSchools = userContext.associatedSchools;

    if (associatedSchools === 'district') {
      if (schoolId === 'all') {
        return SchoolHealthExamination.find({ isDeleted: false })
          .populate({
            path: "student",
            select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
          })
          .lean();
      }

      return SchoolHealthExamination.find({ isDeleted: false })
        .populate({
          path: "student",
          match: { schoolId },
          select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
        })
        .lean()
        .then(results => results.filter(result => result.student));
    }

    // Handle users with array of associated schools (single or multiple)
    if (Array.isArray(associatedSchools) && associatedSchools.length > 0) {
      if (schoolId === 'all') {
        return SchoolHealthExamination.find({ isDeleted: false })
          .populate({
            path: "student",
            match: { schoolId: { $in: associatedSchools } },
            select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
          })
          .lean()
          .then(results => results.filter(result => result.student));
      }

      if (!associatedSchools.includes(schoolId)) {
        return [];
      }

      return SchoolHealthExamination.find({ isDeleted: false })
        .populate({
          path: "student",
          match: { schoolId },
          select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
        })
        .lean()
        .then(results => results.filter(result => result.student));
    }

    if (userContext.schoolId && Array.isArray(userContext.schoolId) && userContext.schoolId.length > 0) {
      const userSchoolIds = userContext.schoolId;

      if (schoolId === 'all') {
        return SchoolHealthExamination.find({ isDeleted: false })
          .populate({
            path: "student",
            match: { schoolId: { $in: userSchoolIds } },
            select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
          })
          .lean()
          .then(results => results.filter(result => result.student));
      }

      if (userSchoolIds.includes(schoolId)) {
        return SchoolHealthExamination.find({ isDeleted: false })
          .populate({
            path: "student",
            match: { schoolId },
            select: "stdId lrn schoolName firstName lastName gradeLevel schoolId",
          })
          .lean()
          .then(results => results.filter(result => result.student));
      }
    }

    console.warn('No school access found for user:', {
      associatedSchools,
      schoolId: userContext.schoolId,
      requestedSchoolId: schoolId
    });

    return [];
  }

  async getSchoolCommonFindings(schoolId, filters = {}, userContext = null) {
    try {
      const schoolRecords = await this._getSchoolRecordsForAnalysis(schoolId, userContext);

      if (!schoolRecords || schoolRecords.length === 0) {
        return {
          schoolId,
          totalRecords: 0,
          commonFindings: {
            nutritional: {},
            screening: {},
            physical: {},
            preventiveCare: {
              incompleteImmunization: { percentage: 0 },
              notDewormed: { percentage: 0 },
              noIronSupplementation: { percentage: 0 }
            }
          },
          riskAnalysis: {
            high: { count: 0, percentage: 0 },
            medium: { count: 0, percentage: 0 },
            low: { count: 0, percentage: 0 }
          },
          gradeBreakdown: {},
          priorityAreas: [],
          recommendations: [],
          trends: {},
          message: 'No health records found for this school'
        };
      }

      const findingsAnalysis = this.analyzeCommonFindings(schoolRecords, filters);

      const recommendations = this.generateSchoolRecommendations(findingsAnalysis);

      return {
        schoolId,
        totalRecords: schoolRecords.length,
        analysisDate: new Date(),
        commonFindings: findingsAnalysis.commonFindings,
        riskAnalysis: findingsAnalysis.riskAnalysis,
        gradeBreakdown: findingsAnalysis.gradeBreakdown,
        priorityAreas: findingsAnalysis.priorityAreas,
        recommendations: recommendations,
        trends: findingsAnalysis.trends
      };

    } catch (error) {
      console.error('Error analyzing school common findings:', error);
      throw new ApiError('Failed to analyze school common findings', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async analyzeCommonFindings(records, filters = {}) {
    const analysis = {
      commonFindings: {
        preventiveCare: {
          incompleteImmunization: { percentage: 0 },
          notDewormed: { percentage: 0 },
          noIronSupplementation: { percentage: 0 }
        }
      },
      riskAnalysis: {
        high: { count: 0, conditions: [], percentage: 0 },
        medium: { count: 0, conditions: [], percentage: 0 },
        low: { count: 0, conditions: [], percentage: 0 }
      },
      gradeBreakdown: {},
      priorityAreas: [],
      trends: {}
    };

    if (!records || records.length === 0) {
      return analysis;
    }

    // Flatten examinations from all records
    const flattenedRecords = [];
    records.forEach(record => {
      if (record.examinations && Array.isArray(record.examinations)) {
        record.examinations.forEach(examination => {
          flattenedRecords.push({
            findings: examination.findings,
            grade: examination.grade,
            student: record.student,
            updatedAt: record.updatedAt,
            createdAt: record.createdAt
          });
        });
      }
    });

    // Apply date filters
    let filteredRecords = flattenedRecords;
    if (filters.startDate || filters.endDate) {
      filteredRecords = flattenedRecords.filter(record => {
        const examDate = new Date(record.findings?.dateOfExamination);
        const start = filters.startDate ? new Date(filters.startDate) : new Date(0);
        const end = filters.endDate ? new Date(filters.endDate) : new Date();
        return examDate >= start && examDate <= end;
      });
    }

    const totalRecords = filteredRecords.length;
    if (totalRecords === 0) return analysis;

    const findingsCounters = {
      nutritionalIssues: {
        underweight: 0,
        severelyUnderweight: 0,
        overweight: 0,
        obese: 0,
        stunted: 0,
        severelyStunted: 0
      },
      screeningFailures: {
        vision: 0,
        hearing: 0
      },
      physicalConditions: {
        skinInfections: 0,
        lice: 0,
        eyeProblems: 0,
        earProblems: 0,
        respiratoryIssues: 0,
        cardiacIssues: 0,
        abdominalIssues: 0,
        deformities: 0
      },
      preventiveCare: {
        incompleteImmunization: 0,
        notDewormed: 0,
        noIronSupplementation: 0
      },
      riskDistribution: {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0
      }
    };

    const engines = {
      nutritional: new Engine(),
      screening: new Engine(),
      physical: new Engine(),
      preventiveCare: new Engine(),
      riskLevel: new Engine()
    };

    allRules.nutritional.forEach(rule => engines.nutritional.addRule(rule));
    allRules.screening.forEach(rule => engines.screening.addRule(rule));
    allRules.physical.forEach(rule => engines.physical.addRule(rule));
    allRules.preventiveCare.forEach(rule => engines.preventiveCare.addRule(rule));
    allRules.riskLevel.forEach(rule => engines.riskLevel.addRule(rule));

    const incrementCounter = (counterPath) => {
      const keys = counterPath.split('.');
      let obj = findingsCounters;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]]++;
    };

    for (const record of filteredRecords) {
      const findings = record.findings || {};
      const grade = record.grade;

      if (!analysis.gradeBreakdown[grade]) {
        analysis.gradeBreakdown[grade] = {
          total: 0,
          issues: {},
          riskLevels: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 }
        };
      }
      analysis.gradeBreakdown[grade].total++;

      const facts = {
        // All nutritional facts
        bmiForAge: findings.nutritionalStatusBMI || 'Normal',
        heightForAge: findings.nutritionalStatusHeightForAge || 'Normal',
        nutritionalStatusBMI: findings.nutritionalStatusBMI || 'Normal',
        nutritionalStatusHeightForAge: findings.nutritionalStatusHeightForAge || 'Normal',
        heightInCm: findings.heightInCm || 0,
        weightInKg: findings.weightInKg || 0,
        weightStatus: findings.nutritionalStatusBMI || 'Normal',

        // All screening facts
        vision: findings.visionScreening || 'Normal',
        visionScreening: findings.visionScreening || 'Normal',
        auditoryScreening: findings.auditoryScreening || 'Normal',

        // All physical examination facts
        lice: findings.skinScalp === 'Presence of Lice' || false,
        boils: findings.skinScalp === 'Impetigo/boil' || false,
        scabies: findings.skinScalp === 'Itchiness' || false,
        skinInfection: ['Redness of Skin', 'White Spots', 'Flaky Skin', 'Impetigo/boil', 'Hematoma', 'Bruises/Injuries', 'Itchiness', 'Skin Lesions', 'Acne/Pimple'].includes(findings.skinScalp || '') || false,
        skinScalp: findings.skinScalp || 'Normal',
        heartFindings: ['Rales', 'Wheeze', 'Murmur', 'Irregular heart rate'].includes(findings.lungsHeart || '') ? 'Abnormal' : 'Normal',
        lungFindings: ['Rales', 'Wheeze', 'Murmur', 'Irregular heart rate'].includes(findings.lungsHeart || '') ? 'Abnormal' : 'Normal',
        lungsHeart: findings.lungsHeart || 'Normal',
        eyesEarsNose: findings.eyesEarsNose || 'Normal',
        mouthThroatNeck: findings.mouthThroatNeck || 'Normal',
        abdomen: findings.abdomen || 'Normal',
        deformities: findings.deformities || 'Normal',
        tonsils: findings.mouthThroatNeck === 'Enlarged tonsils' ? 'Enlarged' : 'Normal',

        // All preventive care facts
        immunization: findings.immunization?.toLowerCase().includes('complete') ? 'Complete' : '',
        deworming: !!findings.deworming,
        ironSupplementation: !!findings.ironSupplementation,

        // Risk stratification facts
        riskLevel: findings.riskLevel || 'Low'
      };

      try {
        const nutritionalResults = await engines.nutritional.run(facts);
        nutritionalResults.events.forEach(event => {
          incrementCounter(event.params.counter);
        });
      } catch (error) {
        console.error('Error running nutritional rules:', error);
      }

      try {
        const screeningResults = await engines.screening.run(facts);
        screeningResults.events.forEach(event => {
          incrementCounter(event.params.counter);
        });
      } catch (error) {
        console.error('Error running screening rules:', error);
      }

      try {
        const physicalResults = await engines.physical.run(facts);
        physicalResults.events.forEach(event => {
          incrementCounter(event.params.counter);
        });
      } catch (error) {
        console.error('Error running physical rules:', error);
      }

      try {
        const preventiveResults = await engines.preventiveCare.run(facts);
        preventiveResults.events.forEach(event => {
          incrementCounter(event.params.counter);
        });
      } catch (error) {
        console.error('Error running preventive care rules:', error);
      }

      try {
        const riskResults = await engines.riskLevel.run(facts);
        riskResults.events.forEach(event => {
          const level = event.params.level;
          findingsCounters.riskDistribution[level]++;
          analysis.gradeBreakdown[grade].riskLevels[level]++;
        });
      } catch (error) {
        console.error('Error running risk level rules:', error);
        const riskLevel = findings.riskLevel || 'UNKNOWN';
        findingsCounters.riskDistribution[riskLevel]++;
        analysis.gradeBreakdown[grade].riskLevels[riskLevel]++;
      }
    }

    analysis.commonFindings = this.calculateFindingsPercentages(findingsCounters, totalRecords);

    analysis.priorityAreas = this.identifyPriorityAreas(analysis.commonFindings);

    // Risk analysis
    analysis.riskAnalysis = {
      high: {
        count: findingsCounters.riskDistribution.HIGH,
        percentage: Math.round((findingsCounters.riskDistribution.HIGH / totalRecords) * 100)
      },
      medium: {
        count: findingsCounters.riskDistribution.MEDIUM,
        percentage: Math.round((findingsCounters.riskDistribution.MEDIUM / totalRecords) * 100)
      },
      low: {
        count: findingsCounters.riskDistribution.LOW,
        percentage: Math.round((findingsCounters.riskDistribution.LOW / totalRecords) * 100)
      }
    };

    return analysis;
  }

  // Optimized calculation methods
  calculateFindingsPercentages(counters, total) {
    // Guard clause: handle invalid inputs
    if (!counters || typeof counters !== 'object' || !total || total === 0) {
      return {
        nutritional: {},
        screening: {},
        physical: {},
        preventiveCare: {}
      };
    }

    const calculatePercent = (count) => Math.round((count / total) * 100);

    const categories = ['nutritional', 'screening', 'physical', 'preventiveCare'];
    const result = {};

    categories.forEach(category => {
      result[category] = {};
      const categoryCounters = counters[`${category}Issues`] || counters[category];

      if (categoryCounters && typeof categoryCounters === 'object') {
        Object.entries(categoryCounters).forEach(([condition, count]) => {
          result[category][condition] = {
            count: count || 0,
            percentage: calculatePercent(count || 0)
          };
        });
      }
    });

    return result;
  }

  identifyPriorityAreas(commonFindings) {
    const priorityThreshold = 10;
    const priorities = [];

    // Guard clause: handle null, undefined, or empty commonFindings
    if (!commonFindings || typeof commonFindings !== 'object') {
      return priorities;
    }

    Object.entries(commonFindings).forEach(([category, findings]) => {
      // Guard clause: ensure findings is an object
      if (!findings || typeof findings !== 'object') {
        return;
      }

      Object.entries(findings).forEach(([condition, data]) => {
        // Guard clause: ensure data has required properties
        if (data && typeof data === 'object' && typeof data.percentage === 'number' && data.percentage >= priorityThreshold) {
          priorities.push({
            category,
            condition,
            count: data.count || 0,
            percentage: data.percentage,
            severity: data.percentage >= 25 ? 'HIGH' : data.percentage >= 15 ? 'MEDIUM' : 'LOW'
          });
        }
      });
    });

    return priorities.sort((a, b) => b.percentage - a.percentage);
  }

  mapDSSReportToSchema(dssReport, record) {
    const { alerts, recommendations, flaggedConditions } = this._processDSSItems(dssReport);

    return {
      overallHealthStatus: this.determineOverallHealthStatus(dssReport.riskLevel, alerts),
      riskLevel: this.mapDSSRiskLevel(dssReport.riskLevel),
      healthAlerts: alerts,
      clinicalRecommendations: recommendations,
      flaggedConditions
    };
  }

  _processDSSItems(dssReport) {
    const alerts = [];
    const recommendations = [];
    const flaggedConditions = [];

    const categories = ['nutrition', 'visionHearing', 'communicable', 'preventiveCare'];

    categories.forEach(category => {
      if (dssReport[category]) {
        dssReport[category].forEach(item => {
          this._addDSSItem(item, category, alerts, recommendations, flaggedConditions);
        });
      }
    });

    return { alerts, recommendations, flaggedConditions };
  }

  _addDSSItem(item, category, alerts, recommendations, flaggedConditions) {
    const severity = this.getDSSItemSeverity(item.flag);
    const priority = this.getDSSItemPriority(item.flag);

    alerts.push({
      type: this._getDSSAlertType(category, item.flag),
      severity,
      description: item.flag,
      recommendedAction: item.recommendation,
      requiresImmediateAttention: severity === 'SEVERE'
    });

    recommendations.push({
      category: this._getDSSRecommendationCategory(item),
      description: item.recommendation,
      priority,
      targetDate: this.calculateTargetDate(item.flag),
      assignedTo: this.getAssigneeForRecommendation(item.recommendation)
    });

    if (item.flag.includes('Risk') || item.flag.includes('Delay')) {
      flaggedConditions.push({
        condition: item.flag,
        code: 'DSS_GENERATED',
        description: item.recommendation,
        requiresMonitoring: true
      });
    }
  }

  _getDSSAlertType(category, flag) {
    const typeMap = {
      nutrition: 'NUTRITIONAL',
      visionHearing: flag.includes('Vision') ? 'VISION' : 'HEARING',
      communicable: 'INFECTION',
      preventiveCare: 'OTHER'
    };
    return typeMap[category] || 'OTHER';
  }

  _getDSSRecommendationCategory(item) {
    const recommendation = item.recommendation.toLowerCase();
    if (recommendation.includes('referral')) return 'REFERRAL';
    if (recommendation.includes('immunization')) return 'IMMUNIZATION';
    if (recommendation.includes('deworming')) return 'MEDICATION';
    if (recommendation.includes('nutrition')) return 'NUTRITION';
    return 'FOLLOW_UP';
  }

  getDSSItemSeverity(flag) {
    if (flag.includes('Severely') || flag.includes('Critical') || flag.includes('High Risk')) return 'SEVERE';
    if (flag.includes('Risk') || flag.includes('Problem') || flag.includes('Delay')) return 'MODERATE';
    return 'MILD';
  }

  getDSSItemPriority(flag) {
    if (flag.includes('Severely') || flag.includes('Critical')) return 'URGENT';
    if (flag.includes('Risk') || flag.includes('Problem')) return 'HIGH';
    return 'MEDIUM';
  }

  calculateTargetDate(flag) {
    const now = new Date();
    const daysToAdd = flag.includes('Severely') ? 7 : flag.includes('Risk') ? 14 : 30;
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  getAssigneeForRecommendation(recommendation) {
    const rec = recommendation.toLowerCase();
    if (rec.includes('ophthalmologist') || rec.includes('ent') || rec.includes('referral')) return 'DOCTOR';
    if (rec.includes('parent') || rec.includes('family')) return 'PARENT';
    if (rec.includes('nutrition') || rec.includes('feeding')) return 'NUTRITIONIST';
    return 'NURSE';
  }

  determineOverallHealthStatus(riskLevel, alerts) {
    const severeAlerts = alerts.filter(alert => alert.severity === 'SEVERE').length;
    const moderateAlerts = alerts.filter(alert => alert.severity === 'MODERATE').length;

    if (riskLevel === 'High Risk' || severeAlerts > 0) return 'POOR';
    if (riskLevel === 'Medium Risk' || moderateAlerts > 2) return 'FAIR';
    if (moderateAlerts > 0) return 'GOOD';
    return 'EXCELLENT';
  }

  mapDSSRiskLevel(dssRiskLevel) {
    const riskMap = {
      'High Risk': 'HIGH',
      'Medium Risk': 'MEDIUM',
      'Low Risk': 'LOW',
      'Unclassified': 'MEDIUM'
    };
    return riskMap[dssRiskLevel] || 'LOW';
  }

  generateSchoolRecommendations(analysis) {
    const recommendations = [];
    const { commonFindings = {}, priorityAreas = [], riskAnalysis = {} } = analysis || {};

    if (riskAnalysis.high?.percentage > 5) {
      recommendations.push({
        priority: 'URGENT',
        category: 'HEALTH_INTERVENTION',
        title: 'High-Risk Student Management',
        description: `${riskAnalysis.high.percentage}% of students are high-risk. Immediate medical attention required.`,
        actions: ['Schedule immediate medical consultations', 'Develop individual health management plans', 'Notify parents/guardians', 'Coordinate with healthcare providers']
      });
    }

    priorityAreas.filter(area => area.percentage >= 15)
      .forEach(area => {
        const recommendation = this.getConditionSpecificRecommendation(area);
        if (recommendation) recommendations.push(recommendation);
      });

    this._addPreventiveCareRecommendations(commonFindings.preventiveCare, recommendations);

    return recommendations;
  }

  _addPreventiveCareRecommendations(preventiveCare = {}, recommendations) {
    const preventivePrograms = [
      { key: 'incompleteImmunization', threshold: 20, category: 'VACCINATION_PROGRAM', title: 'Immunization Campaign' },
      { key: 'notDewormed', threshold: 15, category: 'DEWORMING_PROGRAM', title: 'Mass Deworming Campaign' }
    ];

    preventivePrograms.forEach(program => {
      const data = preventiveCare[program.key];
      if (data?.percentage > program.threshold) {
        recommendations.push({
          priority: program.threshold > 15 ? 'HIGH' : 'MEDIUM',
          category: program.category,
          title: program.title,
          description: `${data.percentage}% of students need attention in ${program.title.toLowerCase()}.`,
          actions: this._getActionsByCategory(program.category)
        });
      }
    });
  }

  _getActionsByCategory(category) {
    const actionMap = {
      'VACCINATION_PROGRAM': ['Coordinate with Department of Health', 'Send immunization reminders', 'Update records'],
      'DEWORMING_PROGRAM': ['Schedule school-wide program', 'Educate about parasitic infections', 'Coordinate with health centers']
    };
    return actionMap[category] || [];
  }

  getConditionSpecificRecommendation(area) {
    const recommendationMap = {
      underweight: { priority: 'HIGH', category: 'NUTRITION_PROGRAM', title: 'Malnutrition Intervention' },
      visionProblems: { priority: 'HIGH', category: 'VISION_PROGRAM', title: 'Vision Screening and Correction' },
      lice: { priority: 'MEDIUM', category: 'HYGIENE_PROGRAM', title: 'Head Lice Management' }
    };

    const template = recommendationMap[area.condition];
    return template ? {
      ...template,
      description: `${area.percentage}% of students affected by ${area.condition}. Intervention required.`,
      actions: this._getActionsByCategory(template.category)
    } : null;
  }

  async getSchoolHealthComparison(schoolIds, filters = {}) {
    try {
      const comparisons = await limitedAll(
        schoolIds.map(schoolId => async () => ({
          schoolId,
          ...(await this.getSchoolCommonFindings(schoolId, filters))
        })),
        3
      );

      return {
        schools: comparisons,
        comparative: this.generateComparativeInsights(comparisons),
        analysisDate: new Date()
      };
    } catch (error) {
      console.error('Error in school health comparison:', error);
      throw new ApiError('Failed to generate school health comparison', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  generateComparativeInsights(schoolComparisons) {
    return {
      summary: `Comparative analysis of ${schoolComparisons.length} schools`,
      keyFindings: [],
      recommendations: []
    };
  }

  async getPreventiveProgramsStats(userId) {
    const cacheKey = CACHE_KEYS.SCHOOL_HEALTH_EXAM.PREVENTIVE_STATS(userId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for preventive programs stats', error);
    }

    const records = await SchoolHealthExamination.find({ isDeleted: false }).lean();

    let totalExaminations = 0;
    let dewormingCount = 0;
    let ironSupplementationCount = 0;
    let immunizationCount = 0;

    records.forEach(record => {
      if (record.examinations && Array.isArray(record.examinations)) {
        record.examinations.forEach(exam => {

          const findings = exam.findings;
          if (findings) {
            const examinerId = exam.examiner && exam.examiner._id ? String(exam.examiner._id) : String(exam.examiner);
            if (!userId || examinerId === String(userId)) {
              totalExaminations++;
              if (findings.deworming === true) dewormingCount++;
              if (findings.ironSupplementation === true) ironSupplementationCount++;
              if (findings.immunization && findings.immunization !== '') immunizationCount++;
            }
          }
        });

      }
    });

    const calculateCoverage = (count) => totalExaminations > 0 ? Math.round((count / totalExaminations) * 100) : 0;

    const result = {
      dewormingCoverage: calculateCoverage(dewormingCount),
      ironSupplementationCoverage: calculateCoverage(ironSupplementationCount),
      immunizationCoverage: calculateCoverage(immunizationCount),
      totalStudents: totalExaminations
    };

    try {
      await cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    } catch (error) {
      logger.warn('Cache set failed for preventive programs stats', error);
    }

    return result;
  }

  async getRecentScreenings(limit = 10, userId) {
    const cacheKey = CACHE_KEYS.SCHOOL_HEALTH_EXAM.RECENT_SCREENINGS(limit, userId);

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      logger.warn('Cache get failed for recent screenings', error);
    }

    const records = await SchoolHealthExamination.find({ isDeleted: false })
      .populate('student', 'firstName lastName stdId')
      .lean();

    const examinations = [];
    records.forEach(record => {
      if (record.examinations && Array.isArray(record.examinations)) {
        record.examinations.forEach(exam => {
          if (exam.findings?.dateOfExamination && (!userId || exam.examiner === userId)) {
            examinations.push({
              student: record.student,
              findings: exam.findings,
              date: exam.findings.dateOfExamination
            });
          }
        });
      }
    });

    examinations.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentExams = examinations.slice(0, limit);

    const result = recentExams.map(exam => {
      const { findings, student } = exam;
      const visionResult = this._getScreeningResult(findings.visionScreening, 'vision');
      const hearingResult = this._getScreeningResult(findings.auditoryScreening, 'hearing');

      return {
        STDID: student?.stdId || 'N/A',
        Name: this._formatPersonName(student) || 'Unknown',
        Screening: 'Vision & Hearing',
        Result: visionResult !== 'Passed' ? visionResult : hearingResult,
        date: findings.dateOfExamination
      };
    });

    try {
      await cache.set(cacheKey, result, CACHE_TTL.SHORT);
    } catch (error) {
      logger.warn('Cache set failed for recent screenings', error);
    }

    return result;
  }

  _getScreeningResult(screening, type) {
    if (!screening) return 'Not tested';
    if (screening === 'Passed') return 'Passed';
    return type === 'vision' && screening === 'Failed' ? 'Needs glasses' : 'Failed';
  }

  async getDSSAlertsBreakdown(userId) {
    const examCards = await SchoolHealthExamination.find({
      isDeleted: false
    }).lean();

    const breakdown = { normal: 0, needsMonitoring: 0, escalate: 0 };

    examCards.forEach(card => {
      if (card.examinations && Array.isArray(card.examinations)) {
        card.examinations.forEach(examination => {
          const findings = examination.findings;
          if (!findings || !findings.riskLevel) return;
          if (!userId || examination.examiner === userId) {

            const { riskLevel, healthAlerts = [] } = findings;
            const hasUrgentAlerts = healthAlerts.some(alert =>
              alert.requiresImmediateAttention || alert.severity === 'SEVERE'
            );

            if (hasUrgentAlerts || ['HIGH', 'URGENT'].includes(riskLevel)) {
              breakdown.escalate++;
            } else if (riskLevel === 'MEDIUM' || healthAlerts.length > 0) {
              breakdown.needsMonitoring++;
            } else {
              breakdown.normal++;
            }
          }

        });
      }
    });

    return { ...breakdown, total: Object.values(breakdown).reduce((sum, count) => sum + count, 0) };
  }
}

export default new SchoolHealthExaminationService();
