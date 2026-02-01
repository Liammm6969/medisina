import AnnualAccomplishmentReport from "./annual-accomplishment-report.model.js";
import ApiError from "#utils/ApiError.js";
import { StatusCodes } from "http-status-codes";
import notificationService from "#modules/notifications/notification.service.js";
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from "#utils/constants.js";
import Student from "#modules/student/student.model.js";
import Personnel from "#modules/personnel/personnel.model.js";
import DailyTreatmentRecord from "#modules/daily-treatment-record/daily-treatment-record.model.js";
import SchoolHealthExamCard from "#modules/school-health-exam-card/school-health-exam-card.model.js";
import PersonnelHealthCard from "#modules/personnel-health-card/personnel-health-card.model.js";
import DentalTreatmentRecord from "#modules/dental-treatment-record/dental-treatment-record.model.js";
import DentalRecordChart from "#modules/dental-record-chart/dental-record-chart.model.js";
import ReferralSlip from "#modules/referaal-slip/referral-slip.model.js";

class AnnualAccomplishmentReportService {

  async createReport(data) {
    const report = await AnnualAccomplishmentReport.create(data);

    await notificationService.createNotification({
      recipientId: data.createdBy,
      title: NOTIFICATION_TITLE.ANNUAL_HEALTH_SERVICES_ACCOMPLISHMENT_REPORT,
      message: `Annual Health Services Accomplishment Report for ${data.schoolName} (SY ${data.schoolYear}) has been created`,
      type: NOTIFICATION_TYPES.NEW_RECORD,
      priority: PRIORITY_LEVELS.MEDIUM,
      isActionRequired: false
    });

    return report;
  }

  async getReportById(reportId) {
    const report = await AnnualAccomplishmentReport.findOne({ aarId: reportId })
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ])
      .lean();

    if (!report) {
      throw new ApiError("Annual accomplishment report not found", StatusCodes.NOT_FOUND);
    }

    return report;
  }

  async getReportBySchoolAndYear(schoolIdNo, schoolYear) {
    const report = await AnnualAccomplishmentReport.findOne({
      schoolIdNo,
      schoolYear,
      isActive: true
    })
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ])
      .lean();

    if (!report) {
      throw new ApiError("Annual accomplishment report not found for this school and year", StatusCodes.NOT_FOUND);
    }

    return report;
  }

  async updateReport(reportId, updateData) {
    const updatedReport = await AnnualAccomplishmentReport.findOneAndUpdate(
      { aarId: reportId },
      { ...updateData, updatedBy: updateData.updatedBy },
      { new: true, runValidators: true }
    )
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ]);

    if (!updatedReport) {
      throw new ApiError('Annual accomplishment report not found', StatusCodes.NOT_FOUND);
    }

    await notificationService.createNotification({
      recipientId: updateData.updatedBy,
      title: NOTIFICATION_TITLE.ANNUAL_HEALTH_SERVICES_ACCOMPLISHMENT_REPORT,
      message: `Annual Health Services Accomplishment Report for ${updatedReport.schoolName} (SY ${updatedReport.schoolYear}) has been updated`,
      type: NOTIFICATION_TYPES.RECORD_UPDATE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    });

    return updatedReport;
  }

  async deleteReport(reportId, userId) {
    const report = await AnnualAccomplishmentReport.findById(reportId);

    if (!report) {
      throw new ApiError('Annual accomplishment report not found', StatusCodes.NOT_FOUND);
    }

    await AnnualAccomplishmentReport.findByIdAndUpdate(
      reportId,
      {
        isActive: false,
        updatedBy: userId
      }
    );

    await notificationService.createNotification({
      recipientId: userId,
      title: NOTIFICATION_TITLE.ANNUAL_HEALTH_SERVICES_ACCOMPLISHMENT_REPORT,
      message: `Annual Health Services Accomplishment Report for ${report.schoolName} (SY ${report.schoolYear}) has been deleted`,
      type: NOTIFICATION_TYPES.RECORD_DELETE,
      priority: PRIORITY_LEVELS.LOW,
      isActionRequired: false
    });

    return { message: 'Report deleted successfully' };
  }

  async getAllReports(page = 1, limit = 10, filters = {}, userId) {
    const skip = (page - 1) * limit;
    const query = { isActive: true, ...filters };

    const [reports] = await Promise.all([
      AnnualAccomplishmentReport.find({ ...query, createdBy: userId })
        .populate([
          { path: 'createdBy', select: 'firstName lastName role' },
          { path: 'updatedBy', select: 'firstName lastName role' }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      AnnualAccomplishmentReport.countDocuments(query)
    ]);

    return {
      reports,

    };
  }

  async getReportsBySchoolYear(schoolYear) {
    return AnnualAccomplishmentReport.findBySchoolYear(schoolYear)
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ])
      .lean();
  }

  async getReportsByRegionDivision(region, division) {
    return AnnualAccomplishmentReport.findByRegionDivision(region, division)
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ])
      .lean();
  }

  async getReportsBySchoolName(schoolName) {
    const reports = await AnnualAccomplishmentReport.find({
      schoolName: { $regex: schoolName, $options: 'i' },
      isActive: true
    })
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ])
      .sort({ createdAt: -1 })
      .lean();



    return reports;
  }

  async searchReports(query, limit = 20) {
    if (!query) {
      throw new ApiError('Search query is required', StatusCodes.BAD_REQUEST);
    }

    const searchRegex = new RegExp(query, 'i');

    const reports = await AnnualAccomplishmentReport.find({
      isActive: true,
      $or: [
        { schoolName: searchRegex },
        { region: searchRegex },
        { division: searchRegex },
        { schoolYear: searchRegex },
        { schoolIdNo: searchRegex },
        { remarks: searchRegex }
      ]
    })
      .populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ])
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    return reports;
  }

  async getReportsStatistics(userId) {
    const currentYear = new Date().getFullYear();
    const currentSY = `${currentYear}-${currentYear + 1}`;
    const [
      totalReports,
      currentYearReports,
      reportsByRegion,
      reportsByYear,
      recentReports
    ] = await Promise.all([
      AnnualAccomplishmentReport.countDocuments({ isActive: true, createdBy: userId }),

      AnnualAccomplishmentReport.countDocuments({
        schoolYear: currentSY,
        isActive: true,
        createdBy: userId
      }),

      AnnualAccomplishmentReport.aggregate([
        { $match: { isActive: true, createdBy: userId } },
        {
          $group: {
            _id: '$region',
            count: { $sum: 1 },
            totalEnrollment: { $sum: '$totalEnrollment' },
            totalPersonnel: { $sum: '$totalPersonnel' }
          }
        },
        { $sort: { count: -1 } }
      ]),

      AnnualAccomplishmentReport.aggregate([
        { $match: { isActive: true, createdBy: userId } },
        {
          $group: {
            _id: '$schoolYear',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } }
      ]),

      AnnualAccomplishmentReport.find({ isActive: true, createdBy: userId })
        .select('schoolName schoolYear region division createdAt')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    return {
      totalReports,
      currentYearReports,
      reportsByRegion,
      reportsByYear,
      recentReports
    };
  }

  async getHealthServicesAnalytics(filters = {}) {
    const query = { isActive: true, ...filters };

    const analytics = await AnnualAccomplishmentReport.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSchools: { $sum: 1 },
          totalEnrollment: { $sum: '$totalEnrollment' },
          totalPersonnel: { $sum: '$totalPersonnel' },

          // Health Services Totals
          totalAssessed: {
            $sum: {
              $add: [
                '$healthServices.healthAppraisal.assessed.learners',
                '$healthServices.healthAppraisal.assessed.teachers',
                '$healthServices.healthAppraisal.assessed.ntp'
              ]
            }
          },
          totalWithHealthProblems: {
            $sum: {
              $add: [
                '$healthServices.healthAppraisal.withHealthProblems.learners',
                '$healthServices.healthAppraisal.withHealthProblems.teachers',
                '$healthServices.healthAppraisal.withHealthProblems.ntp'
              ]
            }
          },
          totalTreatments: {
            $sum: {
              $add: [
                '$healthServices.treatmentDone.learners',
                '$healthServices.treatmentDone.teachers',
                '$healthServices.treatmentDone.ntp'
              ]
            }
          },
          totalDewormed: {
            $sum: {
              $add: [
                '$healthServices.pupilsDewormed.firstRound',
                '$healthServices.pupilsDewormed.secondRound'
              ]
            }
          },
          totalImmunized: { $sum: '$healthServices.pupilsImmunized.count' },
          totalConsultations: {
            $sum: {
              $add: [
                '$healthServices.consultationAttended.learners',
                '$healthServices.consultationAttended.teachers',
                '$healthServices.consultationAttended.ntp'
              ]
            }
          }
        }
      }
    ]);

    return analytics[0] || {};
  }

  async getDashboardSummary(userId) {
    const currentYear = new Date().getFullYear();
    const currentSY = `${currentYear}-${currentYear + 1}`;

    const [stats, recentReports] = await Promise.all([
      this.getReportsStatistics(userId),
      AnnualAccomplishmentReport.find({
        isActive: true,
        createdBy: userId
      })
        .select('schoolName schoolYear region division createdAt')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()
    ]);

    return {
      ...stats,
      myRecentReports: recentReports
    };
  }


  _getEmptySignsSymptoms() {
    return {
      skinAndScalp: {
        pediculosis: 0,
        rednessOfSkin: 0,
        whiteSpots: 0,
        flakySkin: 0,
        minorInjuries: 0,
        impetigoBoil: 0,
        skinLesions: 0,
        acnePimples: 0,
        itchiness: 0
      },
      eyeAndEars: {
        mattedEyelashes: 0,
        eyeRedness: 0,
        ocularMisalignment: 0,
        eyeDischarge: 0,
        paleConjunctiva: 0,
        hordeolum: 0,
        earDischarge: 0,
        mucusDischarge: 0,
        noseBleeding: 0
      },
      mouthNeckThroat: {
        presenceOfLesions: 0,
        inflamedPharynx: 0,
        enlargedTonsils: 0,
        enlargedLymphnodes: 0
      },
      heartAndLungs: {
        rates: 0,
        murmur: 0,
        irregularHeartRate: 0,
        wheezes: 0
      },
      deformities: {
        acquired: { count: 0, specify: '' },
        congenital: { count: 0, specify: '' }
      },
      nutritionalStatus: {
        normal: 0,
        wasted: 0,
        severelyWasted: 0,
        obese: 0,
        overweight: 0,
        stunted: 0,
        tall: 0
      },
      abdomen: {
        abdominalPain: 0,
        distended: 0,
        tenderness: 0,
        dysmenorrhea: 0
      },
      dentalService: {
        gingivitis: 0,
        periodontalDisease: 0,
        malocclusion: 0,
        supernumeraryTeeth: 0,
        retainedDecidousTeeth: 0,
        decubitalUlcer: 0,
        calculus: 0,
        cleftLipPalate: 0,
        fluorosis: 0,
        others: { count: 0, specify: '' },
        totalDMFT: 0,
        totalDmft: 0
      },
      otherSignsSymptoms: []
    };
  }

  // Statistics methods - own implementation for Annual Accomplishment Report
  async getEnrollmentStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const pipeline = [
      {
        $match: {
          schoolId: schoolId,
          schoolYear: schoolYear,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ];

    const results = await Student.aggregate(pipeline);

    const enrollment = { male: 0, female: 0 };

    results.forEach(result => {
      const gender = result._id?.toLowerCase();
      if (gender === 'male') enrollment.male = result.count;
      else if (gender === 'female') enrollment.female = result.count;
    });

    return {
      schoolId,
      schoolYear,
      enrollment,
      total: enrollment.male + enrollment.female,
      generatedAt: new Date()
    };
  }

  async getPersonnelStatisticsBySchool(schoolId) {
    if (!schoolId) {
      throw new ApiError('School ID is required', StatusCodes.BAD_REQUEST);
    }

    const pipeline = [
      {
        $match: {
          schoolId: { $in: [schoolId] },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            position: '$position',
            gender: '$gender'
          },
          count: { $sum: 1 }
        }
      }
    ];

    const results = await Personnel.aggregate(pipeline);

    const schoolPersonnel = {
      teaching: { male: 0, female: 0 },
      nonTeaching: { male: 0, female: 0 }
    };

    const teachingKeywords = [
      'teacher', 'instructor', 'professor', 'educator', 'faculty',
      'master teacher', 'head teacher', 'principal', 'assistant principal',
      'department head', 'coordinator', 'guidance counselor', 'librarian'
    ];

    results.forEach(result => {
      const position = result._id.position?.toLowerCase() || '';
      const gender = result._id.gender?.toLowerCase();
      const count = result.count;

      const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));

      if (isTeaching) {
        if (gender === 'male') schoolPersonnel.teaching.male += count;
        else if (gender === 'female') schoolPersonnel.teaching.female += count;
      } else {
        if (gender === 'male') schoolPersonnel.nonTeaching.male += count;
        else if (gender === 'female') schoolPersonnel.nonTeaching.female += count;
      }
    });

    return {
      schoolId,
      schoolPersonnel,
      totals: {
        teaching: schoolPersonnel.teaching.male + schoolPersonnel.teaching.female,
        nonTeaching: schoolPersonnel.nonTeaching.male + schoolPersonnel.nonTeaching.female,
        overall: 0
      },
      generatedAt: new Date()
    };
  }

  async getExaminedAssessedStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const studentsPipeline = [
      {
        $match: {
          schoolId: schoolId,
          dateOfTreatment: { $gte: startDate, $lte: endDate },
          student: { $exists: true, $ne: null },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$student'
        }
      },
      {
        $count: 'total'
      }
    ];

    const personnelPipeline = [
      {
        $match: {
          schoolId: schoolId,
          dateOfTreatment: { $gte: startDate, $lte: endDate },
          personnel: { $exists: true, $ne: null },
          isDeleted: false
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
        $unwind: '$personnelInfo'
      },
      {
        $group: {
          _id: {
            personnelId: '$personnel',
            position: '$personnelInfo.position'
          }
        }
      }
    ];

    const [studentsResult, personnelResult] = await Promise.all([
      DailyTreatmentRecord.aggregate(studentsPipeline),
      DailyTreatmentRecord.aggregate(personnelPipeline)
    ]);

    const assessed = {
      learners: studentsResult[0]?.total || 0,
      teachers: 0,
      ntp: 0
    };

    const teachingKeywords = [
      'teacher', 'instructor', 'professor', 'educator', 'faculty',
      'master teacher', 'head teacher', 'principal', 'assistant principal',
      'department head', 'coordinator', 'guidance counselor', 'librarian'
    ];

    personnelResult.forEach(result => {
      const position = result._id.position?.toLowerCase() || '';
      const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));

      if (isTeaching) assessed.teachers++;
      else assessed.ntp++;
    });

    return {
      schoolId,
      schoolYear,
      assessed,
      total: assessed.learners + assessed.teachers + assessed.ntp,
      generatedAt: new Date()
    };
  }

  async getHealthProblemsStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const healthExamCards = await SchoolHealthExamCard.find({ isDeleted: false })
      .populate({
        path: 'student',
        match: { schoolId: schoolId, isDeleted: false }
      })
      .lean();

    const validCards = healthExamCards.filter(card => card.student !== null);

    const withHealthProblems = { learners: 0, teachers: 0, ntp: 0 };
    const normalValues = ['Normal', 'Not Examined', 'X', 'a', '', null, undefined];

    validCards.forEach(card => {
      if (card.examinations && Array.isArray(card.examinations)) {
        card.examinations.forEach(exam => {
          const examDate = exam.findings?.dateOfExamination;
          if (examDate) {
            const examDateObj = new Date(examDate);
            if (examDateObj >= startDate && examDateObj <= endDate) {
              const findings = exam.findings;
              const hasHealthProblem = ['skinScalp', 'eyesEarsNose', 'mouthThroatNeck', 'lungsHeart', 'abdomen', 'deformities']
                .some(field => findings[field] && !normalValues.includes(findings[field]));

              if (hasHealthProblem) {
                withHealthProblems.learners++;
              }
            }
          }
        });
      }
    });

    const personnelHealthCards = await PersonnelHealthCard.find({ isDeleted: false })
      .populate({
        path: 'personnel',
        match: { schoolId: { $in: [schoolId] }, isDeleted: false },
        select: 'position'
      })
      .lean();

    const validPersonnelCards = personnelHealthCards.filter(card => card.personnel !== null);
    const teachingKeywords = ['teacher', 'instructor', 'professor', 'educator', 'faculty', 'master teacher', 'head teacher', 'principal', 'assistant principal', 'department head', 'coordinator', 'guidance counselor', 'librarian'];

    validPersonnelCards.forEach(card => {
      const interviewDate = card.interviewedBy?.interviewDate;
      if (interviewDate) {
        const interviewDateObj = new Date(interviewDate);
        if (interviewDateObj >= startDate && interviewDateObj <= endDate) {
          const presentHealthStatus = card.presentHealthStatus;
          if (presentHealthStatus) {
            const hasHealthProblem = Object.values(presentHealthStatus).some(val => val === true || (typeof val === 'string' && val.trim() !== ''));
            if (hasHealthProblem && card.personnel) {
              const position = card.personnel.position?.toLowerCase() || '';
              const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));

              if (isTeaching) withHealthProblems.teachers++;
              else withHealthProblems.ntp++;
            }
          }
        }
      }
    });

    return {
      schoolId,
      schoolYear,
      withHealthProblems,
      total: withHealthProblems.learners + withHealthProblems.teachers + withHealthProblems.ntp,
      generatedAt: new Date()
    };
  }

  async getTreatmentStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const treatmentRecords = await DailyTreatmentRecord.find({
      schoolId: schoolId,
      dateOfTreatment: { $gte: startDate, $lte: endDate },
      isDeleted: false
    })
      .populate('personnel', 'position')
      .lean();

    const treatments = { learners: 0, teachers: 0, ntp: 0 };
    const teachingKeywords = ['teacher', 'instructor', 'professor', 'educator', 'faculty', 'master teacher', 'head teacher', 'principal', 'assistant principal', 'department head', 'coordinator', 'guidance counselor', 'librarian'];

    treatmentRecords.forEach(record => {
      if (record.student) {
        treatments.learners++;
      } else if (record.personnel) {
        const position = record.personnel.position?.toLowerCase() || '';
        const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));
        if (isTeaching) treatments.teachers++;
        else treatments.ntp++;
      }
    });

    return {
      schoolId,
      schoolYear,
      treatments,
      total: treatments.learners + treatments.teachers + treatments.ntp,
      generatedAt: new Date()
    };
  }

  async getDewormingIronStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const healthExamCards = await SchoolHealthExamCard.find({ isDeleted: false })
      .populate({
        path: 'student',
        match: { schoolId: schoolId, isDeleted: false }
      })
      .lean();

    const validCards = healthExamCards.filter(card => card.student !== null);

    const statistics = {
      deworming: { firstRound: 0, secondRound: 0 },
      ironSupplement: 0,
      immunization: 0
    };

    const dewormingDates = new Map();

    validCards.forEach(card => {
      if (card.examinations && Array.isArray(card.examinations)) {
        card.examinations.forEach(exam => {
          const examDate = exam.findings?.dateOfExamination;
          if (examDate) {
            const examDateObj = new Date(examDate);
            if (examDateObj >= startDate && examDateObj <= endDate) {
              const studentId = card.student._id.toString();
              if (exam.findings?.deworming?.firstRound) {
                if (!dewormingDates.has(studentId)) {
                  dewormingDates.set(studentId, { firstRound: false, secondRound: false });
                }
                dewormingDates.get(studentId).firstRound = true;
              }
              if (exam.findings?.deworming?.secondRound) {
                if (!dewormingDates.has(studentId)) {
                  dewormingDates.set(studentId, { firstRound: false, secondRound: false });
                }
                dewormingDates.get(studentId).secondRound = true;
              }

              if (exam.findings?.ironSupplementation) {
                statistics.ironSupplement++;
              }

              if (exam.findings?.immunization && exam.findings.immunization.trim() !== '') {
                statistics.immunization++;
              }
            }
          }
        });
      }
    });

    dewormingDates.forEach(data => {
      if (data.firstRound) statistics.deworming.firstRound++;
      if (data.secondRound) statistics.deworming.secondRound++;
    });

    return {
      schoolId,
      schoolYear,
      ...statistics,
      generatedAt: new Date()
    };
  }

  async getConsultationStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const consultations = await DailyTreatmentRecord.find({
      schoolId: schoolId,
      dateOfTreatment: { $gte: startDate, $lte: endDate },
      isDeleted: false
    })
      .populate('personnel', 'position')
      .lean();

    const stats = { learners: 0, teachers: 0, ntp: 0 };
    const teachingKeywords = ['teacher', 'instructor', 'professor', 'educator', 'faculty', 'master teacher', 'head teacher', 'principal', 'assistant principal', 'department head', 'coordinator', 'guidance counselor', 'librarian'];

    consultations.forEach(record => {
      if (record.student) {
        stats.learners++;
      } else if (record.personnel) {
        const position = record.personnel.position?.toLowerCase() || '';
        const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));
        if (isTeaching) stats.teachers++;
        else stats.ntp++;
      }
    });

    return {
      schoolId,
      schoolYear,
      consultations: stats,
      total: stats.learners + stats.teachers + stats.ntp,
      generatedAt: new Date()
    };
  }

  async getCommonSignsSymptomsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const healthExamCards = await SchoolHealthExamCard.find({ isDeleted: false })
      .populate({
        path: 'student',
        match: { schoolId: schoolId, isDeleted: false }
      })
      .lean();

    const validCards = healthExamCards.filter(card => card.student !== null);
    const learnersMap = new Map();
    const findingsFields = ['skinScalp', 'eyesEarsNose', 'mouthThroatNeck', 'lungsHeart', 'abdomen', 'deformities'];
    const normalValues = ['Normal', 'Not Examined', 'X', 'a', '', null, undefined];

    validCards.forEach(card => {
      if (card.examinations && Array.isArray(card.examinations)) {
        card.examinations.forEach(exam => {
          const examDate = exam.findings?.dateOfExamination;
          if (examDate) {
            const examDateObj = new Date(examDate);
            if (examDateObj >= startDate && examDateObj <= endDate) {
              const findings = exam.findings;
              findingsFields.forEach(field => {
                const value = findings[field];
                if (value && !normalValues.includes(value)) {
                  const currentCount = learnersMap.get(value) || 0;
                  learnersMap.set(value, currentCount + 1);
                }
              });
              if (exam.complaint && exam.complaint.trim() !== '') {
                const complaint = exam.complaint.trim();
                const currentCount = learnersMap.get(complaint) || 0;
                learnersMap.set(complaint, currentCount + 1);
              }
            }
          }
        });
      }
    });

    const personnelHealthCards = await PersonnelHealthCard.find({ isDeleted: false })
      .populate({
        path: 'personnel',
        match: { schoolId: { $in: [schoolId] }, isDeleted: false }
      })
      .lean();

    const validPersonnelCards = personnelHealthCards.filter(card => card.personnel !== null);
    const personnelMap = new Map();
    const healthStatusSymptoms = {
      cough: 'Cough', dizziness: 'Dizziness', dyspnea: 'Dyspnea (Shortness of Breath)',
      chestBackPain: 'Chest/Back Pain', easyFatigability: 'Easy Fatigability',
      jointExtremityPains: 'Joint/Extremity Pains', blurringOfVision: 'Blurring of Vision',
      vaginalDischargeBleeding: 'Vaginal Discharge/Bleeding', lumps: 'Lumps',
      painfulUrination: 'Painful Urination', poorLossOfHearing: 'Poor/Loss of Hearing',
      syncope: 'Syncope (Fainting)', convulsions: 'Convulsions',
      malaria: 'Malaria', goiter: 'Goiter', anemia: 'Anemia'
    };

    validPersonnelCards.forEach(card => {
      const interviewDate = card.interviewedBy?.interviewDate;
      if (interviewDate) {
        const interviewDateObj = new Date(interviewDate);
        if (interviewDateObj >= startDate && interviewDateObj <= endDate) {
          const presentHealthStatus = card.presentHealthStatus;
          if (presentHealthStatus) {
            Object.keys(healthStatusSymptoms).forEach(key => {
              const value = presentHealthStatus[key];
              if (value === true || (key === 'cough' && value && value.trim() !== '')) {
                const symptomName = healthStatusSymptoms[key];
                const currentCount = personnelMap.get(symptomName) || 0;
                personnelMap.set(symptomName, currentCount + 1);
              }
            });
            if (presentHealthStatus.others && presentHealthStatus.others.trim() !== '') {
              const otherSymptom = presentHealthStatus.others.trim();
              const currentCount = personnelMap.get(otherSymptom) || 0;
              personnelMap.set(otherSymptom, currentCount + 1);
            }
          }
        }
      }
    });

    const sortedLearnersFindings = Array.from(learnersMap.entries())
      .map(([symptom, count]) => ({ signsSymptoms: symptom, numberOfCases: count }))
      .sort((a, b) => b.numberOfCases - a.numberOfCases)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const sortedPersonnelFindings = Array.from(personnelMap.entries())
      .map(([symptom, count]) => ({ signsSymptoms: symptom, numberOfCases: count }))
      .sort((a, b) => b.numberOfCases - a.numberOfCases)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      schoolId,
      schoolYear,
      commonSignsSymptoms: {
        learners: sortedLearnersFindings,
        teachingAndNTP: sortedPersonnelFindings
      },
      generatedAt: new Date()
    };
  }

  async getDentalStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const dentalTreatmentRecords = await DentalTreatmentRecord.find({
      schoolId: schoolId,
      isDeleted: false,
      'treatments.date': { $gte: startDate, $lte: endDate }
    })
      .populate('personnel', 'position')
      .lean();


    const allDentalRecordCharts = await DentalRecordChart.find({
      isDeleted: false,
      dateOfExamination: { $gte: startDate, $lte: endDate }
    })
      .populate('student', 'schoolId')
      .populate('personnel', 'schoolId')
      .lean();

    const dentalRecordCharts = allDentalRecordCharts.filter(chart => {
      if (chart.schoolId === schoolId) return true;

      if (chart.student && chart.student.schoolId === schoolId) return true;

      if (chart.personnel && Array.isArray(chart.personnel.schoolId) &&
        chart.personnel.schoolId.includes(schoolId)) return true;

      return false;
    });

    const stats = { learners: 0, teachers: 0, ntp: 0 };
    const teachingKeywords = [
      'teacher', 'instructor', 'professor', 'educator', 'faculty',
      'master teacher', 'head teacher', 'principal', 'assistant principal',
      'department head', 'coordinator', 'guidance counselor', 'librarian'
    ];

    dentalTreatmentRecords.forEach(record => {
      if (record.student) {
        stats.learners++;
      } else if (record.personnel) {
        const position = record.personnel.position?.toLowerCase() || '';
        const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));
        if (isTeaching) stats.teachers++;
        else stats.ntp++;
      }
    });

    const dentalConditions = {
      gingivitis: 0,
      periodontalDisease: 0,
      malocclusion: 0,
      supernumeraryTeeth: 0,
      retainedDecidousTeeth: 0,
      decubitalUlcer: 0,
      calculus: 0,
      cleftLipPalate: 0,
      fluorosis: 0,
      others: {
        count: 0,
        specify: ''
      },
      totalDMFT: 0,
      totalDmft: 0
    };

    const othersSet = new Set();
    dentalRecordCharts.forEach(chart => {
      // Check periodontal screening for gingivitis (boolean field)
      if (chart.periodontalScreening?.gingivitis === true) {
        dentalConditions.gingivitis++;
      }

      // Check periodontal screening for periodontal disease (boolean fields)
      if (chart.periodontalScreening?.earlyPeriodontitis === true ||
        chart.periodontalScreening?.moderatePeriodontitis === true ||
        chart.periodontalScreening?.advancedPeriodontitis === true) {
        dentalConditions.periodontalDisease++;
      }

      // Check occlusion for malocclusion (string fields with meaningful values)
      if (chart.occlusion) {
        const hasOcclusionIssues = Object.values(chart.occlusion).some(value =>
          value && typeof value === 'string' && value.trim() !== '' &&
          value.toLowerCase() !== 'normal' && value.toLowerCase() !== 'n/a'
        );
        if (hasOcclusionIssues) {
          dentalConditions.malocclusion++;
        }
      }

      let hasSupernumerary = false;
      let hasRetainedDeciduous = false;
      let hasCalculus = false;
      let hasFluorosis = false;

      const allTeeth = [...(chart.permanentTeeth || []), ...(chart.temporaryTeeth || [])];
      allTeeth.forEach(tooth => {
        if (tooth.status === 'Supernumerary') {
          hasSupernumerary = true;
        }

        if (tooth.notes?.toLowerCase().includes('retained') ||
          tooth.condition?.toLowerCase().includes('retained')) {
          hasRetainedDeciduous = true;
        }

        // Check for calculus
        if (tooth.condition?.toLowerCase().includes('calculus') ||
          tooth.notes?.toLowerCase().includes('calculus')) {
          hasCalculus = true;
        }

        // Check for fluorosis
        if (tooth.condition?.toLowerCase().includes('fluorosis') ||
          tooth.notes?.toLowerCase().includes('fluorosis')) {
          hasFluorosis = true;
        }
      });

      // Increment patient counts (not tooth counts)
      if (hasSupernumerary) dentalConditions.supernumeraryTeeth++;
      if (hasRetainedDeciduous) dentalConditions.retainedDecidousTeeth++;
      if (hasCalculus) dentalConditions.calculus++;
      if (hasFluorosis) dentalConditions.fluorosis++;

      // Check remarks for cleft lip/palate and decubital ulcer
      if (chart.remarks) {
        const remarksLower = chart.remarks.toLowerCase();
        if (remarksLower.includes('cleft lip') || remarksLower.includes('cleft palate')) {
          dentalConditions.cleftLipPalate++;
        }
        if (remarksLower.includes('decubital ulcer') || remarksLower.includes('ulcer')) {
          dentalConditions.decubitalUlcer++;
        }

        if (!remarksLower.includes('cleft lip') &&
          !remarksLower.includes('cleft palate') &&
          !remarksLower.includes('decubital ulcer') &&
          !remarksLower.includes('ulcer') &&
          chart.remarks.trim() !== '') {
          othersSet.add(chart.remarks.trim());
        }
      }

      // Calculate DMFT (Decayed, Missing, Filled Teeth) for permanent teeth
      const permanentTeeth = chart.permanentTeeth || [];
      let dmftCount = 0;
      permanentTeeth.forEach(tooth => {
        if (tooth.status === 'Decayed' ||
          tooth.status === 'Missing' ||
          (tooth.restoration && tooth.restoration.trim() !== '') ||
          tooth.condition?.toLowerCase().includes('filled')) {
          dmftCount++;
        }
      });
      dentalConditions.totalDMFT += dmftCount;

      // Calculate dmft (decayed, missing, filled teeth) for temporary teeth
      const temporaryTeeth = chart.temporaryTeeth || [];
      let dmftCountTemp = 0;
      temporaryTeeth.forEach(tooth => {
        if (tooth.status === 'Decayed' ||
          tooth.status === 'Missing' ||
          (tooth.restoration && tooth.restoration.trim() !== '') ||
          tooth.condition?.toLowerCase().includes('filled')) {
          dmftCountTemp++;
        }
      });
      dentalConditions.totalDmft += dmftCountTemp;
    });

    // Set others count and specify
    dentalConditions.others.count = othersSet.size;
    if (othersSet.size > 0) {
      dentalConditions.others.specify = Array.from(othersSet).slice(0, 5).join('; ');
    }
    return {
      schoolId,
      schoolYear,
      dentalServices: stats,
      dentalConditions,
      total: stats.learners + stats.teachers + stats.ntp,
      generatedAt: new Date()
    };
  }

  async getReferralStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError('School ID and school year are required', StatusCodes.BAD_REQUEST);
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const referralSlips = await ReferralSlip.find({
      'referralSlip.date': { $gte: startDate, $lte: endDate },
      isDeleted: false
    }).lean();

    const referralStats = {
      physician: 0,
      dentist: 0,
      guidance: 0,
      otherFacilities: 0,
      rhuDistrictProvincialHospital: 0
    };

    referralSlips.forEach(slip => {
      const referralTo = slip.referralSlip?.to || '';

      if (referralTo === 'Physician/Doctor (MD)' ||
        referralTo.toLowerCase().includes('physician') ||
        referralTo.toLowerCase().includes('doctor') ||
        referralTo.toLowerCase().includes('md')) {
        referralStats.physician++;
      } else if (referralTo === 'Dentist/Dental Clinic' ||
        referralTo.toLowerCase().includes('dentist') ||
        referralTo.toLowerCase().includes('dental')) {
        referralStats.dentist++;
      } else if (referralTo === 'Guidance Counselor/Psychologist' ||
        referralTo.toLowerCase().includes('guidance') ||
        referralTo.toLowerCase().includes('counselor') ||
        referralTo.toLowerCase().includes('psychologist')) {
        referralStats.guidance++;
      } else if (referralTo === 'RHU/District/Provincial Hospital' ||
        referralTo.toLowerCase().includes('rhu') ||
        referralTo.toLowerCase().includes('hospital') ||
        referralTo.toLowerCase().includes('district') ||
        referralTo.toLowerCase().includes('provincial')) {
        referralStats.rhuDistrictProvincialHospital++;
      } else if (referralTo === 'Other' || referralTo.trim() !== '') {
        referralStats.otherFacilities++;
      }
    });
    return {
      schoolId,
      schoolYear,
      referral: referralStats,
      total: Object.values(referralStats).reduce((sum, val) => sum + val, 0),
      generatedAt: new Date()
    };
  }

  async getHealthProfileStatisticsBySchool(schoolId, schoolYear, autoPopulate = false, reportId = null) {
    if (!schoolId) {
      throw new ApiError('School ID is required', StatusCodes.BAD_REQUEST);
    }

    if (!schoolYear) {
      throw new ApiError('School year is required', StatusCodes.BAD_REQUEST);
    }

    // Fetch all statistics in parallel
    const [
      enrollment,
      personnel,
      examinedAssessed,
      commonSignsSymptoms,
      healthProblems,
      treatments,
      dewormingIron,
      consultations,
      dentalServices,
      referrals
    ] = await Promise.all([
      this.getEnrollmentStatisticsBySchool(schoolId, schoolYear),
      this.getPersonnelStatisticsBySchool(schoolId),
      this.getExaminedAssessedStatisticsBySchool(schoolId, schoolYear),
      this.getCommonSignsSymptomsBySchool(schoolId, schoolYear),
      this.getHealthProblemsStatisticsBySchool(schoolId, schoolYear),
      this.getTreatmentStatisticsBySchool(schoolId, schoolYear),
      this.getDewormingIronStatisticsBySchool(schoolId, schoolYear),
      this.getConsultationStatisticsBySchool(schoolId, schoolYear),
      this.getDentalStatisticsBySchool(schoolId, schoolYear),
      this.getReferralStatisticsBySchool(schoolId, schoolYear)
    ]);

    // Use data directly from Annual Report statistics methods (already in correct format)
    const statistics = {
      schoolId,
      schoolYear,
      generalInformation: {
        schoolEnrollment: enrollment.enrollment || { male: 0, female: 0 },
        schoolPersonnel: personnel.schoolPersonnel || {
          teaching: { male: 0, female: 0 },
          nonTeaching: { male: 0, female: 0 }
        }
      },
      healthServices: {
        healthAppraisal: {
          assessed: examinedAssessed.assessed || { learners: 0, teachers: 0, ntp: 0 },
          withHealthProblems: healthProblems.withHealthProblems || { learners: 0, teachers: 0, ntp: 0 },
          visionScreening: {
            learners: 0 // This needs to be calculated from actual vision screening data
          }
        },
        treatmentDone: treatments.treatments || { learners: 0, teachers: 0, ntp: 0 },
        pupilsDewormed: dewormingIron.deworming || { firstRound: 0, secondRound: 0 },
        pupilsGivenIronSupplement: dewormingIron.ironSupplement || 0,
        pupilsImmunized: {
          count: dewormingIron.immunization || 0,
          vaccineSpecified: ''
        },
        consultationAttended: consultations.consultations || { learners: 0, teachers: 0, ntp: 0 },
        dentalServices: dentalServices.dentalServices || { learners: 0, teachers: 0, ntp: 0 },
        dentalConditions: dentalServices.dentalConditions || {
          gingivitis: 0,
          periodontalDisease: 0,
          malocclusion: 0,
          supernumeraryTeeth: 0,
          retainedDecidousTeeth: 0,
          decubitalUlcer: 0,
          calculus: 0,
          cleftLipPalate: 0,
          fluorosis: 0,
          others: { count: 0, specify: '' },
          totalDMFT: 0,
          totalDmft: 0
        },
        referral: referrals.referral || {
          physician: 0,
          dentist: 0,
          guidance: 0,
          otherFacilities: 0,
          rhuDistrictProvincialHospital: 0
        }
      },
      commonSignsSymptoms: {
        learners: commonSignsSymptoms.commonSignsSymptoms?.learners || [],
        teachingAndNTP: commonSignsSymptoms.commonSignsSymptoms?.teachingAndNTP || []
      },
      totals: {
        enrollment: {
          male: enrollment.enrollment?.male || 0,
          female: enrollment.enrollment?.female || 0,
          overall: enrollment.total || 0
        },
        personnel: personnel.totals || { overall: 0 },
        examinedAssessed: {
          learners: examinedAssessed.assessed?.learners || 0,
          teachers: examinedAssessed.assessed?.teachers || 0,
          ntp: examinedAssessed.assessed?.ntp || 0,
          overall: examinedAssessed.total || 0
        },
        healthProblems: {
          learners: healthProblems.withHealthProblems?.learners || 0,
          teachers: healthProblems.withHealthProblems?.teachers || 0,
          ntp: healthProblems.withHealthProblems?.ntp || 0,
          overall: healthProblems.total || 0
        },
        treatments: treatments.total || 0,
        consultations: consultations.total || 0,
        dentalServices: dentalServices.total || 0,
        referrals: referrals.total || 0
      },
      generatedAt: new Date()
    };

    // Auto-populate report if requested
    if (autoPopulate && reportId) {
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new ApiError('Annual accomplishment report not found', StatusCodes.NOT_FOUND);
      }

      const updateData = {
        'generalInformation.schoolEnrollment': statistics.generalInformation.schoolEnrollment,
        'generalInformation.schoolPersonnel': statistics.generalInformation.schoolPersonnel,
        'healthServices.healthAppraisal.assessed': statistics.healthServices.healthAppraisal.assessed,
        'healthServices.healthAppraisal.withHealthProblems': statistics.healthServices.healthAppraisal.withHealthProblems,
        'healthServices.healthAppraisal.visionScreening': statistics.healthServices.healthAppraisal.visionScreening,
        'healthServices.treatmentDone': statistics.healthServices.treatmentDone,
        'healthServices.pupilsDewormed': statistics.healthServices.pupilsDewormed,
        'healthServices.pupilsGivenIronSupplement': statistics.healthServices.pupilsGivenIronSupplement,
        'healthServices.pupilsImmunized': statistics.healthServices.pupilsImmunized,
        'healthServices.consultationAttended': statistics.healthServices.consultationAttended,
        'healthServices.dentalServices': statistics.healthServices.dentalServices,
        'healthServices.dentalConditions': statistics.healthServices.dentalConditions,
        'healthServices.referral': statistics.healthServices.referral,
        lastAutoPopulated: new Date()
      };

      const updatedReport = await AnnualAccomplishmentReport.findOneAndUpdate(
        { aarId: reportId },
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate([
        { path: 'createdBy', select: 'firstName lastName role' },
        { path: 'updatedBy', select: 'firstName lastName role' }
      ]);
      return {
        statistics,
        report: updatedReport,
        autoPopulated: true,
        message: 'Statistics generated and report auto-populated successfully'
      };
    }

    return statistics;
  }
}

export default new AnnualAccomplishmentReportService();