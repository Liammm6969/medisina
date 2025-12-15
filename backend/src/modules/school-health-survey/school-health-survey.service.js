import { StatusCodes } from 'http-status-codes';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import SchoolHealthSurvey from './school-health-survey.model.js';
import Student from '../student/student.model.js';
import Personnel from '../personnel/personnel.model.js';
import DailyTreatmentRecord from '../daily-treatment-record/daily-treatment-record.model.js';
import SchoolHealthExamCard from '../school-health-exam-card/school-health-exam-card.model.js';
import PersonnelHealthCard from '../personnel-health-card/personnel-health-card.model.js';
import ApiError from '#utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SchoolHealthSurveyService {
  async createSchoolHealthSurvey(schoolHealthSurveyBody) {
    const schoolHealthSurvey = await SchoolHealthSurvey.create(schoolHealthSurveyBody);
    return schoolHealthSurvey;
  }

  async querySchoolHealthSurveys(filter, userId) {
    let filters = {}
    if (filter.year) {
      filters.year = filter.year
    }

    if (filter.surveyStatus) {
      filters.surveyStatus = filter.surveyStatus
    }
    const queryFilter = userId ? { ...filters, createdBy: userId } : filters;

    // Execute queries in parallel for better performance
    const [results, totalResults] = await Promise.all([
      SchoolHealthSurvey.find(queryFilter).lean(),
      SchoolHealthSurvey.countDocuments(queryFilter)
    ]);

    return {
      results,
      totalResults
    };
  }

  async getSchoolHealthSurveyById(id) {
    return SchoolHealthSurvey.findById(id).populate('createdBy updatedBy', 'firstName lastName');
  }

  async getSchoolHealthSurveyBySchoolAndYear(schoolId, year) {
    return SchoolHealthSurvey.findOne({ schoolId, year, isActive: true });
  }

  async updateSchoolHealthSurveyById(schoolHealthSurveyId, updateBody) {
    const schoolHealthSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!schoolHealthSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }
    Object.assign(schoolHealthSurvey, updateBody);
    await schoolHealthSurvey.save();
    return schoolHealthSurvey;
  }

  async deleteSchoolHealthSurveyById(schoolHealthSurveyId) {
    const schoolHealthSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!schoolHealthSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }
    schoolHealthSurvey.isActive = false;
    await schoolHealthSurvey.save();
    return schoolHealthSurvey;
  }

  async getSchoolHealthSurveysByYear(year) {
    return SchoolHealthSurvey.findByYear(year).populate('createdBy', 'firstName lastName');
  }

  async getSchoolHealthSurveysByRegionDivision(region, division, year = null) {
    return SchoolHealthSurvey.findByRegionDivision(region, division, year).populate('createdBy', 'firstName lastName');
  }

  async markSurveyAsCompleted(schoolHealthSurveyId) {
    const schoolHealthSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!schoolHealthSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }

    if (schoolHealthSurvey.surveyStatus === 'submitted' || schoolHealthSurvey.surveyStatus === 'approved') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot modify survey status');
    }

    return schoolHealthSurvey.markAsCompleted();
  }

  async markSurveyAsSubmitted(schoolHealthSurveyId) {
    const schoolHealthSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!schoolHealthSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }

    if (schoolHealthSurvey.surveyStatus !== 'completed') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Survey must be completed before submission');
    }

    return schoolHealthSurvey.markAsSubmitted();
  }

  async approveSurvey(schoolHealthSurveyId, doctorId, remarks = '') {
    const schoolHealthSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!schoolHealthSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }

    if (schoolHealthSurvey.surveyStatus !== 'submitted') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Survey must be submitted before approval');
    }

    schoolHealthSurvey.surveyStatus = 'approved';
    schoolHealthSurvey.approvedBy = doctorId;
    schoolHealthSurvey.approvedAt = new Date();
    if (remarks) {
      schoolHealthSurvey.approvalRemarks = remarks;
    }
    await schoolHealthSurvey.save();

    await schoolHealthSurvey.populate('approvedBy', 'firstName lastName role');

    return schoolHealthSurvey;
  }

  async rejectSurvey(schoolHealthSurveyId, doctorId, remarks) {
    const schoolHealthSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!schoolHealthSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }

    if (schoolHealthSurvey.surveyStatus !== 'submitted') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Only submitted surveys can be rejected');
    }

    if (!remarks || remarks.trim() === '') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Rejection remarks are required');
    }

    schoolHealthSurvey.surveyStatus = 'rejected';
    schoolHealthSurvey.approvedBy = doctorId;
    schoolHealthSurvey.approvedAt = new Date();
    schoolHealthSurvey.approvalRemarks = remarks;
    await schoolHealthSurvey.save();

    await schoolHealthSurvey.populate('approvedBy', 'firstName lastName role');

    return schoolHealthSurvey;
  }

  async getSubmittedSurveys(filter = {}) {
    const query = {
      ...filter,
      surveyStatus: 'submitted',
      isActive: true
    };
    return SchoolHealthSurvey.find(query)
      .populate('createdBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getApprovedSurveys(filter = {}) {
    const query = {
      ...filter,
      surveyStatus: 'approved',
      isActive: true
    };
    return SchoolHealthSurvey.find(query)
      .populate('createdBy', 'firstName lastName role')
      .populate('approvedBy', 'firstName lastName role')
      .sort({ approvedAt: -1 })
      .lean();
  }

  async getRejectedSurveys(filter = {}) {
    const query = {
      ...filter,
      surveyStatus: 'rejected',
      isActive: true
    };
    return SchoolHealthSurvey.find(query)
      .populate('createdBy', 'firstName lastName role')
      .populate('approvedBy', 'firstName lastName role')
      .sort({ approvedAt: -1 })
      .lean();
  }

  async getPendingSurveys() {
    return SchoolHealthSurvey.findPendingSurveys().populate('createdBy', 'firstName lastName');
  }

  async getRegionalStatistics(region, year) {
    return SchoolHealthSurvey.getStatsByRegion(region, year);
  }

  async bulkUpdateStatus(surveyIds, status, updatedBy) {
    const validStatuses = ['draft', 'completed', 'submitted', 'approved'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid status');
    }

    const result = await SchoolHealthSurvey.updateMany(
      { _id: { $in: surveyIds }, isActive: true },
      { surveyStatus: status, updatedBy }
    );

    return result;
  }

  async duplicateSurvey(schoolHealthSurveyId, newYear, createdBy) {
    const originalSurvey = await this.getSchoolHealthSurveyById(schoolHealthSurveyId);
    if (!originalSurvey) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
    }

    const existingSurvey = await this.getSchoolHealthSurveyBySchoolAndYear(originalSurvey.schoolId, newYear);
    if (existingSurvey) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Survey already exists for this school and year');
    }

    const surveyData = originalSurvey.toObject();
    delete surveyData._id;
    delete surveyData.createdAt;
    delete surveyData.updatedAt;
    delete surveyData.__v;

    surveyData.year = newYear;
    surveyData.createdBy = createdBy;
    surveyData.surveyStatus = 'draft';
    surveyData.accomplishedBy.dateOfSurvey = new Date();

    const newSurvey = await SchoolHealthSurvey.create(surveyData);
    return newSurvey;
  }

  async exportSurveyData(filter) {
    const surveys = await SchoolHealthSurvey.find({ ...filter, isActive: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ region: 1, division: 1, schoolName: 1 });

    return surveys.map(survey => ({
      region: survey.region,
      division: survey.division,
      year: survey.year,
      schoolName: survey.schoolName,
      district: survey.district,
      schoolId: survey.schoolId,
      schoolHeadName: survey.schoolHeadName,
      contactNumber: survey.contactNumber,
      totalEnrollment: survey.totalEnrollment,
      totalPersonnel: survey.totalPersonnel,
      totalDropouts: survey.totalDropouts,
      totalExamined: survey.calculateTotalExamined(),
      healthProblemsPercentage: survey.calculateHealthProblemsPercentage(),
      surveyStatus: survey.surveyStatus,
      createdAt: survey.createdAt,
      accomplishedBy: survey.accomplishedBy
    }));
  }

  async getEnrollmentSummary(filter) {
    const pipeline = [
      { $match: { ...filter, isActive: true } },
      {
        $group: {
          _id: { region: '$region', division: '$division' },
          totalSchools: { $sum: 1 },
          totalElementaryEnrollment: { $sum: '$totalElementaryEnrollment' },
          totalJuniorHighEnrollment: { $sum: '$totalJuniorHighEnrollment' },
          totalSeniorHighEnrollment: { $sum: '$totalSeniorHighEnrollment' },
          totalALSEnrollment: { $sum: '$totalALSEnrollment' },
          totalEnrollment: { $sum: '$totalEnrollment' },
          totalPersonnel: { $sum: '$totalPersonnel' }
        }
      },
      { $sort: { '_id.region': 1, '_id.division': 1 } }
    ];

    return SchoolHealthSurvey.aggregate(pipeline);
  }

  async getHealthProfileSummary(filter) {
    const surveys = await SchoolHealthSurvey.find({ ...filter, isActive: true });

    let totalExamined = 0;
    let totalWithHealthProblems = 0;
    let totalDewormed = 0;
    let totalGivenIronSupplement = 0;
    let totalReferrals = 0;

    surveys.forEach(survey => {
      totalExamined += survey.calculateTotalExamined();

      const healthProblems = survey.healthProfile?.foundWith?.healthProblems;
      if (healthProblems) {
        totalWithHealthProblems += (healthProblems.male || 0) + (healthProblems.female || 0);
      }

      const treatment = survey.healthProfile?.treatment;
      if (treatment) {
        const dewormed = treatment.numberDewormed;
        if (dewormed) {
          totalDewormed += (dewormed.male || 0) + (dewormed.female || 0);
        }

        const ironSupplement = treatment.givenIronSupplement;
        if (ironSupplement) {
          totalGivenIronSupplement += (ironSupplement.male || 0) + (ironSupplement.female || 0);
        }

        const referred = treatment.referredToOtherFacilities;
        if (referred) {
          totalReferrals += (referred.male || 0) + (referred.female || 0);
        }
      }
    });

    return {
      totalSurveys: surveys.length,
      totalExamined,
      totalWithHealthProblems,
      healthProblemsPercentage: totalExamined > 0 ? ((totalWithHealthProblems / totalExamined) * 100).toFixed(2) : 0,
      totalDewormed,
      totalGivenIronSupplement,
      totalReferrals
    };
  }

  async getFacilitiesSummary(filter) {
    const pipeline = [
      { $match: { ...filter, isActive: true } },
      {
        $group: {
          _id: null,
          totalSchools: { $sum: 1 },
          schoolsWithClinic: {
            $sum: { $cond: [{ $gt: ['$schoolFacilities.healthFacilities.schoolClinic.area', 0] }, 1, 0] }
          },
          schoolsWithGenderSensitiveToilet: {
            $sum: { $cond: ['$schoolFacilities.healthFacilities.schoolToilet.genderSensitiveType', 1, 0] }
          },
          schoolsWithWaterCertificate: {
            $sum: { $cond: ['$schoolFacilities.healthFacilities.waterSupplyAndDrinkingWater.certificateOfWaterAnalysis', 1, 0] }
          },
          schoolsWithCanteenPermit: {
            $sum: { $cond: ['$schoolFacilities.healthFacilities.schoolCanteen.sanitaryPermit', 1, 0] }
          }
        }
      }
    ];

    return SchoolHealthSurvey.aggregate(pipeline);
  }

  async getEnrollmentStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID is required');
    }

    if (!schoolYear) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School year is required');
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
          _id: {
            gradeLevel: '$gradeLevel',
            gender: '$gender',
            isSPED: '$isSPED'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.gradeLevel': 1 }
      }
    ];

    const results = await Student.aggregate(pipeline);

    const enrollment = {
      elementary: {
        kinder: { male: 0, female: 0 },
        grade1: { male: 0, female: 0 },
        grade2: { male: 0, female: 0 },
        grade3: { male: 0, female: 0 },
        grade4: { male: 0, female: 0 },
        grade5: { male: 0, female: 0 },
        grade6: { male: 0, female: 0 },
        sped: { male: 0, female: 0 }
      },
      juniorHS: {
        grade7: { male: 0, female: 0 },
        grade8: { male: 0, female: 0 },
        grade9: { male: 0, female: 0 },
        grade10: { male: 0, female: 0 },
        sped: { male: 0, female: 0 }
      },
      seniorHS: {
        grade11: { male: 0, female: 0 },
        grade12: { male: 0, female: 0 }
      },
      als: {
        alsLearners: { male: 0, female: 0 }
      }
    };

    const gradeLevelMapping = {
      'Kinder': 'kinder',
      'Kindergarten': 'kinder',
      'Grade 1': 'grade1',
      'Grade 2': 'grade2',
      'Grade 3': 'grade3',
      'Grade 4': 'grade4',
      'Grade 5': 'grade5',
      'Grade 6': 'grade6',
      'Grade 7': 'grade7',
      'Grade 8': 'grade8',
      'Grade 9': 'grade9',
      'Grade 10': 'grade10',
      'Grade 11': 'grade11',
      'Grade 12': 'grade12',
      'ALS': 'alsLearners'
    };

    results.forEach(result => {
      const gradeLevel = result._id.gradeLevel;
      const gender = result._id.gender?.toLowerCase();
      const isSPED = result._id.isSPED;
      const count = result.count;

      if (isSPED) {
        if (gradeLevel && (gradeLevel.includes('1') || gradeLevel.includes('2') ||
          gradeLevel.includes('3') || gradeLevel.includes('4') ||
          gradeLevel.includes('5') || gradeLevel.includes('6') ||
          gradeLevel.toLowerCase().includes('kinder'))) {

          if (gender === 'male') enrollment.elementary.sped.male += count;
          else if (gender === 'female') enrollment.elementary.sped.female += count;
        } else if (gradeLevel && (gradeLevel.includes('7') || gradeLevel.includes('8') ||
          gradeLevel.includes('9') || gradeLevel.includes('10'))) {
          if (gender === 'male') enrollment.juniorHS.sped.male += count;
          else if (gender === 'female') enrollment.juniorHS.sped.female += count;
        }
      } else {
        const mappedGrade = gradeLevelMapping[gradeLevel];

        if (mappedGrade && mappedGrade !== 'alsLearners') {
          let category;
          if (['kinder', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'].includes(mappedGrade)) {
            category = 'elementary';
          } else if (['grade7', 'grade8', 'grade9', 'grade10'].includes(mappedGrade)) {
            category = 'juniorHS';
          } else if (['grade11', 'grade12'].includes(mappedGrade)) {
            category = 'seniorHS';
          }

          if (category && enrollment[category][mappedGrade]) {
            if (gender === 'male') {
              enrollment[category][mappedGrade].male += count;
            } else if (gender === 'female') {
              enrollment[category][mappedGrade].female += count;
            }
          }
        } else if (gradeLevel && gradeLevel.toUpperCase().includes('ALS')) {
          if (gender === 'male') enrollment.als.alsLearners.male += count;
          else if (gender === 'female') enrollment.als.alsLearners.female += count;
        }
      }
    });

    const calculateTotal = (obj) => {
      let total = 0;
      Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object' && 'male' in obj[key] && 'female' in obj[key]) {
          total += (obj[key].male || 0) + (obj[key].female || 0);
        }
      });
      return total;
    };

    const totals = {
      elementary: calculateTotal(enrollment.elementary),
      juniorHS: calculateTotal(enrollment.juniorHS),
      seniorHS: calculateTotal(enrollment.seniorHS),
      als: calculateTotal(enrollment.als),
      overall: 0
    };
    totals.overall = totals.elementary + totals.juniorHS + totals.seniorHS + totals.als;
    return {
      schoolId,
      schoolYear,
      enrollment,
      totals,
      generatedAt: new Date()
    };
  }


  async getPersonnelStatisticsBySchool(schoolId) {
    if (!schoolId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID is required');
    }

    // Aggregate personnel by position and gender
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
      },
      {
        $sort: { '_id.position': 1 }
      }
    ];

    const results = await Personnel.aggregate(pipeline);

    // Initialize the personnel structure
    const schoolPersonnel = {
      teaching: { male: 0, female: 0 },
      nonTeaching: { male: 0, female: 0 }
    };

    // Teaching positions keywords
    const teachingKeywords = [
      'teacher', 'instructor', 'professor', 'educator', 'faculty',
      'master teacher', 'head teacher', 'principal', 'assistant principal',
      'department head', 'coordinator', 'guidance counselor', 'librarian'
    ];

    // Populate the personnel structure with actual counts
    results.forEach(result => {
      const position = result._id.position?.toLowerCase() || '';
      const gender = result._id.gender?.toLowerCase();
      const count = result.count;

      // Determine if teaching or non-teaching based on position
      const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));

      if (isTeaching) {
        if (gender === 'male') schoolPersonnel.teaching.male += count;
        else if (gender === 'female') schoolPersonnel.teaching.female += count;
      } else {
        if (gender === 'male') schoolPersonnel.nonTeaching.male += count;
        else if (gender === 'female') schoolPersonnel.nonTeaching.female += count;
      }
    });

    // Calculate totals
    const totals = {
      teaching: (schoolPersonnel.teaching.male || 0) + (schoolPersonnel.teaching.female || 0),
      nonTeaching: (schoolPersonnel.nonTeaching.male || 0) + (schoolPersonnel.nonTeaching.female || 0),
      overall: 0
    };
    totals.overall = totals.teaching + totals.nonTeaching;
    return {
      schoolId,
      schoolPersonnel,
      totals,
      generatedAt: new Date()
    };
  }

  async getExaminedAssessedStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID is required');
    }

    if (!schoolYear) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School year is required');
    }

    // Parse school year to get date range (e.g., "2024-2025" -> June 2024 to May 2025)
    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1); // June 1
    const endDate = new Date(endYear, 4, 31, 23, 59, 59); // May 31

    // Count unique students examined (from daily treatment records)
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
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      {
        $unwind: '$studentInfo'
      },
      {
        $group: {
          _id: {
            studentId: '$student',
            gender: '$studentInfo.gender'
          }
        }
      },
      {
        $group: {
          _id: '$_id.gender',
          count: { $sum: 1 }
        }
      }
    ];

    // Count unique personnel examined (from daily treatment records)
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
            gender: '$personnelInfo.gender',
            position: '$personnelInfo.position'
          }
        }
      }
    ];

    const [studentsResult, personnelResult] = await Promise.all([
      DailyTreatmentRecord.aggregate(studentsPipeline),
      DailyTreatmentRecord.aggregate(personnelPipeline)
    ]);

    // Initialize the structure
    const numberExaminedAssessed = {
      learners: { male: 0, female: 0 },
      teachers: { male: 0, female: 0 },
      ntp: { male: 0, female: 0 }
    };

    // Process students
    studentsResult.forEach(result => {
      const gender = result._id?.toLowerCase();
      const count = result.count;

      if (gender === 'male') numberExaminedAssessed.learners.male = count;
      else if (gender === 'female') numberExaminedAssessed.learners.female = count;
    });

    // Teaching positions keywords
    const teachingKeywords = [
      'teacher', 'instructor', 'professor', 'educator', 'faculty',
      'master teacher', 'head teacher', 'principal', 'assistant principal',
      'department head', 'coordinator', 'guidance counselor', 'librarian'
    ];

    // Process personnel
    const teachingPersonnel = { male: 0, female: 0 };
    const nonTeachingPersonnel = { male: 0, female: 0 };

    personnelResult.forEach(result => {
      const gender = result._id.gender?.toLowerCase();
      const position = result._id.position?.toLowerCase() || '';

      const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));

      if (isTeaching) {
        if (gender === 'male') teachingPersonnel.male++;
        else if (gender === 'female') teachingPersonnel.female++;
      } else {
        if (gender === 'male') nonTeachingPersonnel.male++;
        else if (gender === 'female') nonTeachingPersonnel.female++;
      }
    });

    numberExaminedAssessed.teachers = teachingPersonnel;
    numberExaminedAssessed.ntp = nonTeachingPersonnel;

    // Calculate totals
    const totals = {
      learners: (numberExaminedAssessed.learners.male || 0) + (numberExaminedAssessed.learners.female || 0),
      teachers: (numberExaminedAssessed.teachers.male || 0) + (numberExaminedAssessed.teachers.female || 0),
      ntp: (numberExaminedAssessed.ntp.male || 0) + (numberExaminedAssessed.ntp.female || 0),
      overall: 0
    };
    totals.overall = totals.learners + totals.teachers + totals.ntp;

    return {
      schoolId,
      schoolYear,
      numberExaminedAssessed,
      totals,
      generatedAt: new Date()
    };
  }

  async getCommonSignsSymptomsBySchool(schoolId, schoolYear) {
    if (!schoolId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID is required');
    }

    if (!schoolYear) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School year is required');
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1); // June 1
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const normalValues = ['Normal', 'Not Examined', 'X', 'a', '', null];
    const findingsFields = ['skinScalp', 'eyesEarsNose', 'mouthThroatNeck', 'lungsHeart', 'abdomen', 'deformities'];

    // Aggregation pipeline for student symptoms
    const studentPipeline = [
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      { $match: { 'studentInfo.schoolId': schoolId, 'studentInfo.isDeleted': false } },
      { $unwind: '$examinations' },
      {
        $match: {
          'examinations.findings.dateOfExamination': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          findings: '$examinations.findings',
          complaint: '$examinations.complaint'
        }
      }
    ];

    // Map of present health status fields to readable symptom names
    const healthStatusSymptoms = {
      cough: 'Cough',
      dizziness: 'Dizziness',
      dyspnea: 'Dyspnea (Shortness of Breath)',
      chestBackPain: 'Chest/Back Pain',
      easyFatigability: 'Easy Fatigability',
      jointExtremityPains: 'Joint/Extremity Pains',
      blurringOfVision: 'Blurring of Vision',
      vaginalDischargeBleeding: 'Vaginal Discharge/Bleeding',
      lumps: 'Lumps',
      painfulUrination: 'Painful Urination',
      poorLossOfHearing: 'Poor/Loss of Hearing',
      syncope: 'Syncope (Fainting)',
      convulsions: 'Convulsions',
      malaria: 'Malaria',
      goiter: 'Goiter',
      anemia: 'Anemia'
    };

    // Aggregation pipeline for personnel symptoms
    const personnelPipeline = [
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: 'personnels',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' },
      { $match: { 'personnelInfo.schoolId': { $in: [schoolId] }, 'personnelInfo.isDeleted': false } },
      {
        $match: {
          'interviewedBy.interviewDate': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          presentHealthStatus: 1
        }
      }
    ];

    // Execute both pipelines in parallel
    const [studentResults, personnelResults] = await Promise.all([
      SchoolHealthExamCard.aggregate(studentPipeline),
      PersonnelHealthCard.aggregate(personnelPipeline)
    ]);

    const learnersMap = new Map();
    const personnelMap = new Map();

    // Process student findings
    studentResults.forEach(result => {
      const findings = result.findings;
      if (findings) {
        findingsFields.forEach(field => {
          const value = findings[field];
          if (value && !normalValues.includes(value)) {
            const currentCount = learnersMap.get(value) || 0;
            learnersMap.set(value, currentCount + 1);
          }
        });
      }

      // Process complaint
      if (result.complaint && result.complaint.trim() !== '') {
        const complaint = result.complaint.trim();
        const currentCount = learnersMap.get(complaint) || 0;
        learnersMap.set(complaint, currentCount + 1);
      }
    });

    // Process personnel symptoms
    personnelResults.forEach(result => {
      const presentHealthStatus = result.presentHealthStatus;
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
    });

    const sortedLearnersFindings = Array.from(learnersMap.entries())
      .map(([symptom, count]) => ({
        signsSymptoms: symptom,
        numberOfCases: count
      }))
      .sort((a, b) => b.numberOfCases - a.numberOfCases)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    const sortedPersonnelFindings = Array.from(personnelMap.entries())
      .map(([symptom, count]) => ({
        signsSymptoms: symptom,
        numberOfCases: count
      }))
      .sort((a, b) => b.numberOfCases - a.numberOfCases)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    const commonSignsSymptoms = {
      learners: sortedLearnersFindings,
      teachingAndNTP: sortedPersonnelFindings
    };

    return {
      schoolId,
      schoolYear,
      commonSignsSymptoms,
      generatedAt: new Date()
    };
  }

  async getHealthProblemsStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID and school year are required');
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const normalValues = ['Normal', 'Not Examined', 'X', 'a', '', null];
    const teachingKeywords = ['teacher', 'instructor', 'professor', 'educator', 'faculty', 'master teacher', 'head teacher', 'principal', 'assistant principal', 'department head', 'coordinator', 'guidance counselor', 'librarian'];

    // Aggregation pipeline for student health problems
    const studentPipeline = [
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      { $match: { 'studentInfo.schoolId': schoolId, 'studentInfo.isDeleted': false } },
      { $unwind: '$examinations' },
      {
        $match: {
          'examinations.findings.dateOfExamination': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $addFields: {
          hasHealthProblem: {
            $or: [
              { $and: [{ $ne: ['$examinations.findings.skinScalp', null] }, { $not: { $in: ['$examinations.findings.skinScalp', normalValues] } }] },
              { $and: [{ $ne: ['$examinations.findings.eyesEarsNose', null] }, { $not: { $in: ['$examinations.findings.eyesEarsNose', normalValues] } }] },
              { $and: [{ $ne: ['$examinations.findings.mouthThroatNeck', null] }, { $not: { $in: ['$examinations.findings.mouthThroatNeck', normalValues] } }] },
              { $and: [{ $ne: ['$examinations.findings.lungsHeart', null] }, { $not: { $in: ['$examinations.findings.lungsHeart', normalValues] } }] },
              { $and: [{ $ne: ['$examinations.findings.abdomen', null] }, { $not: { $in: ['$examinations.findings.abdomen', normalValues] } }] },
              { $and: [{ $ne: ['$examinations.findings.deformities', null] }, { $not: { $in: ['$examinations.findings.deformities', normalValues] } }] }
            ]
          }
        }
      },
      { $match: { hasHealthProblem: true } },
      {
        $group: {
          _id: { $toLower: '$studentInfo.gender' },
          count: { $sum: 1 }
        }
      }
    ];

    // Aggregation pipeline for personnel health problems
    const personnelPipeline = [
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: 'personnels',
          localField: 'personnel',
          foreignField: '_id',
          as: 'personnelInfo'
        }
      },
      { $unwind: '$personnelInfo' },
      { $match: { 'personnelInfo.schoolId': { $in: [schoolId] }, 'personnelInfo.isDeleted': false } },
      {
        $match: {
          'interviewedBy.interviewDate': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          personnelInfo: 1,
          hasHealthProblem: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $objectToArray: { $ifNull: ['$presentHealthStatus', {}] } },
                    as: 'item',
                    cond: {
                      $or: [
                        { $eq: ['$$item.v', true] },
                        { $and: [{ $eq: [{ $type: '$$item.v' }, 'string'] }, { $ne: [{ $trim: { input: '$$item.v' } }, ''] }] }
                      ]
                    }
                  }
                }
              },
              0
            ]
          }
        }
      },
      { $match: { hasHealthProblem: true } },
      {
        $project: {
          gender: { $toLower: '$personnelInfo.gender' },
          position: { $toLower: { $ifNull: ['$personnelInfo.position', ''] } }
        }
      }
    ];

    // Execute both pipelines in parallel
    const [studentResults, personnelResults] = await Promise.all([
      SchoolHealthExamCard.aggregate(studentPipeline),
      PersonnelHealthCard.aggregate(personnelPipeline)
    ]);

    const healthProblems = {
      learners: { male: 0, female: 0 },
      teachers: { male: 0, female: 0 },
      ntp: { male: 0, female: 0 }
    };

    // Process student results
    studentResults.forEach(result => {
      if (result._id === 'male') healthProblems.learners.male = result.count;
      else if (result._id === 'female') healthProblems.learners.female = result.count;
    });

    // Process personnel results
    personnelResults.forEach(result => {
      const isTeaching = teachingKeywords.some(keyword => result.position.includes(keyword));
      if (isTeaching) {
        if (result.gender === 'male') healthProblems.teachers.male++;
        else if (result.gender === 'female') healthProblems.teachers.female++;
      } else {
        if (result.gender === 'male') healthProblems.ntp.male++;
        else if (result.gender === 'female') healthProblems.ntp.female++;
      }
    });

    return {
      schoolId,
      schoolYear,
      healthProblems,
      totals: {
        learners: healthProblems.learners.male + healthProblems.learners.female,
        teachers: healthProblems.teachers.male + healthProblems.teachers.female,
        ntp: healthProblems.ntp.male + healthProblems.ntp.female,
        overall: 0
      },
      generatedAt: new Date()
    };
  }

  async getTreatmentStatisticsBySchool(schoolId, schoolYear) {
    if (!schoolId || !schoolYear) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID and school year are required');
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const treatmentRecords = await DailyTreatmentRecord.find({
      schoolId: schoolId,
      dateOfTreatment: { $gte: startDate, $lte: endDate },
      isDeleted: false
    })
      .populate('student', 'gender')
      .populate('personnel', 'gender position')
      .lean();

    const treatments = { learners: 0, teachers: 0, ntp: 0 };
    const teachingKeywords = ['teacher', 'instructor', 'professor', 'educator', 'faculty', 'master teacher', 'head teacher', 'principal', 'assistant principal', 'department head', 'coordinator', 'guidance counselor', 'librarian'];

    treatmentRecords.forEach(record => {
      if (record.student) {
        treatments.learners++;
      } else if (record.personnel) {
        const position = record.personnel.position?.toLowerCase() || '';
        const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));
        if (isTeaching) {
          treatments.teachers++;
        } else {
          treatments.ntp++;
        }
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
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID and school year are required');
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const healthExamCards = await SchoolHealthExamCard.find({ isDeleted: false })
      .populate({
        path: 'student',
        match: { schoolId: schoolId, isDeleted: false },
        select: 'gender'
      })
      .lean();

    const validCards = healthExamCards.filter(card => card.student !== null);

    const statistics = {
      deworming: {
        firstRound: { male: 0, female: 0 },
        secondRound: { male: 0, female: 0 }
      },
      ironSupplement: { male: 0, female: 0 },
      immunization: 0
    };

    const dewormingDates = new Map(); // Track deworming dates per student with gender

    validCards.forEach(card => {
      if (card.examinations && Array.isArray(card.examinations)) {
        card.examinations.forEach(exam => {
          const examDate = exam.findings?.dateOfExamination;
          if (examDate) {
            const examDateObj = new Date(examDate);
            if (examDateObj >= startDate && examDateObj <= endDate) {
              const gender = card.student?.gender?.toLowerCase();

              // Track deworming with gender
              if (exam.findings?.deworming) {
                const studentId = card.student._id.toString();
                if (!dewormingDates.has(studentId)) {
                  dewormingDates.set(studentId, { dates: [], gender: gender });
                }
                dewormingDates.get(studentId).dates.push(examDateObj);
              }

              // Track iron supplementation by gender
              if (exam.findings?.ironSupplementation) {
                if (gender === 'male') statistics.ironSupplement.male++;
                else if (gender === 'female') statistics.ironSupplement.female++;
              }

              // Track immunization (no gender breakdown in form)
              if (exam.findings?.immunization && exam.findings.immunization.trim() !== '') {
                statistics.immunization++;
              }
            }
          }
        });
      }
    });

    // Calculate rounds of deworming by gender
    dewormingDates.forEach(studentData => {
      const sortedDates = studentData.dates.sort((a, b) => a - b);
      const gender = studentData.gender;

      if (sortedDates.length >= 1) {
        if (gender === 'male') statistics.deworming.firstRound.male++;
        else if (gender === 'female') statistics.deworming.firstRound.female++;
      }
      if (sortedDates.length >= 2) {
        if (gender === 'male') statistics.deworming.secondRound.male++;
        else if (gender === 'female') statistics.deworming.secondRound.female++;
      }
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
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID and school year are required');
    }

    const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31, 23, 59, 59);

    const consultations = await DailyTreatmentRecord.find({
      schoolId: schoolId,
      dateOfTreatment: { $gte: startDate, $lte: endDate },
      isDeleted: false
    })
      .populate('student', 'gender')
      .populate('personnel', 'gender position')
      .lean();

    const stats = { learners: 0, teachers: 0, ntp: 0 };
    const teachingKeywords = ['teacher', 'instructor', 'professor', 'educator', 'faculty', 'master teacher', 'head teacher', 'principal', 'assistant principal', 'department head', 'coordinator', 'guidance counselor', 'librarian'];

    consultations.forEach(record => {
      if (record.student) {
        stats.learners++;
      } else if (record.personnel) {
        const position = record.personnel.position?.toLowerCase() || '';
        const isTeaching = teachingKeywords.some(keyword => position.includes(keyword));
        if (isTeaching) {
          stats.teachers++;
        } else {
          stats.ntp++;
        }
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

  async getHealthProfileStatisticsBySchool(schoolId, schoolYear, autoPopulate = false, surveyId = null) {
    if (!schoolId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School ID is required');
    }

    if (!schoolYear) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'School year is required');
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
      consultations
    ] = await Promise.all([
      this.getEnrollmentStatisticsBySchool(schoolId, schoolYear),
      this.getPersonnelStatisticsBySchool(schoolId),
      this.getExaminedAssessedStatisticsBySchool(schoolId, schoolYear),
      this.getCommonSignsSymptomsBySchool(schoolId, schoolYear),
      this.getHealthProblemsStatisticsBySchool(schoolId, schoolYear),
      this.getTreatmentStatisticsBySchool(schoolId, schoolYear),
      this.getDewormingIronStatisticsBySchool(schoolId, schoolYear),
      this.getConsultationStatisticsBySchool(schoolId, schoolYear)
    ]);

    const statistics = {
      schoolId,
      schoolYear,
      generalInformation: {
        enrollment: enrollment.enrollment,
        schoolPersonnel: personnel.schoolPersonnel
      },
      healthProfile: {
        numberExaminedAssessed: examinedAssessed.numberExaminedAssessed,
        healthProblems: healthProblems.healthProblems,
        treatments: treatments.treatments,
        deworming: dewormingIron.deworming,
        ironSupplement: dewormingIron.ironSupplement,
        immunization: dewormingIron.immunization,
        consultations: consultations.consultations,
        commonSignsSymptoms: commonSignsSymptoms.commonSignsSymptoms
      },
      totals: {
        enrollment: enrollment.totals,
        personnel: personnel.totals,
        examinedAssessed: examinedAssessed.totals,
        healthProblems: healthProblems.totals,
        treatments: treatments.total,
        consultations: consultations.total
      },
      generatedAt: new Date()
    };

    if (autoPopulate && surveyId) {
      const survey = await this.getSchoolHealthSurveyById(surveyId);
      if (!survey) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'School Health Survey not found');
      }

      // Calculate totals
      const totalElementaryEnrollment = statistics.totals.enrollment.elementary;
      const totalJuniorHighEnrollment = statistics.totals.enrollment.juniorHS;
      const totalSeniorHighEnrollment = statistics.totals.enrollment.seniorHS;
      const totalALSEnrollment = statistics.totals.enrollment.als;
      const totalEnrollment = statistics.totals.enrollment.overall;
      const totalPersonnel = statistics.totals.personnel.overall;

      // Prepare update data with enhanced health profile
      const updateData = {
        'generalInformation.enrollment.elementary': statistics.generalInformation.enrollment.elementary,
        'generalInformation.enrollment.juniorHS': statistics.generalInformation.enrollment.juniorHS,
        'generalInformation.enrollment.seniorHS': statistics.generalInformation.enrollment.seniorHS,
        'generalInformation.enrollment.als': statistics.generalInformation.enrollment.als,
        totalElementaryEnrollment,
        totalJuniorHighEnrollment,
        totalSeniorHighEnrollment,
        totalALSEnrollment,
        totalEnrollment,
        'generalInformation.schoolPersonnel': statistics.generalInformation.schoolPersonnel,
        totalPersonnel,
        'healthProfile.numberExaminedAssessed': statistics.healthProfile.numberExaminedAssessed,
        'healthProfile.foundWith.healthProblems.learners': statistics.healthProfile.healthProblems.learners,
        'healthProfile.foundWith.healthProblems.teachers': statistics.healthProfile.healthProblems.teachers,
        'healthProfile.foundWith.healthProblems.ntp': statistics.healthProfile.healthProblems.ntp,
        'healthProfile.treatment.numberDewormed.firstRound.count': statistics.healthProfile.deworming.firstRound,
        'healthProfile.treatment.numberDewormed.secondRound.count': statistics.healthProfile.deworming.secondRound,
        'healthProfile.treatment.givenIronSupplement': statistics.healthProfile.ironSupplement,
        'healthProfile.commonSignsSymptoms.learners': statistics.healthProfile.commonSignsSymptoms.learners,
        'healthProfile.commonSignsSymptoms.teachingAndNTP': statistics.healthProfile.commonSignsSymptoms.teachingAndNTP,
        lastAutoPopulated: new Date()
      };
      // Update the survey
      const updatedSurvey = await SchoolHealthSurvey.findByIdAndUpdate(
        surveyId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('createdBy updatedBy approvedBy', 'firstName lastName role');
      return {
        statistics,
        survey: updatedSurvey,
        autoPopulated: true,
        message: 'Statistics generated and survey auto-populated successfully'
      };
    }

    return statistics;
  }


  async getConsolidatedStatisticsByDivisionGradeMonth({ gradeFrom, gradeTo, month, year }) {
    if (!gradeFrom) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Grade level (gradeFrom) is required');
    }
    if (!month || month < 1 || month > 12) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid month (1-12) is required');
    }
    if (!year) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Year is required');
    }

    const gradeOrder = [
      'Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
      'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
    ];

    const fromIndex = gradeOrder.indexOf(gradeFrom);

    if (fromIndex === -1) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid grade level for gradeFrom');
    }

    let toIndex;
    let selectedGrades;

    if (!gradeTo) {
      toIndex = fromIndex;
      selectedGrades = [gradeFrom];
    } else {
      toIndex = gradeOrder.indexOf(gradeTo);

      if (toIndex === -1) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid grade level for gradeTo');
      }

      if (fromIndex > toIndex) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'gradeFrom must be less than or equal to gradeTo');
      }

      selectedGrades = gradeOrder.slice(fromIndex, toIndex + 1);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const healthExamCards = await SchoolHealthExamCard.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $match: {
          'student.gradeLevel': { $in: selectedGrades },
          'student.isDeleted': false
        }
      }
    ]);

    const uniqueDistricts = new Set();
    healthExamCards.forEach(card => {
      if (card.student?.schoolDistrictDivision) {
        uniqueDistricts.add(card.student.schoolDistrictDivision);
      }
    });


    const filteredHealthExamCards = healthExamCards;

    const healthConditionsByDistrict = {};

    const healthConditions = {
      'Male': 0,
      'Female': 0,
      'Examined': 0,
      'With Defect': 0,
      'Treated': 0,
      'Referred': 0,
      'Health Talk': 0,
      'VS (Normal)': 0,
      'VS (Abn)': 0,
      'HT (Normal)': 0,
      'HT (Abn)': 0,
      'Pediculosis': 0,
      'Rashes': 0,
      'White Spots': 0,
      'Flaky Skin': 0,
      'Impetigo/Boil': 0,
      'Hematoma': 0,
      'Bruises/Injuries': 0,
      'Itchiness': 0,
      'Skin Lesion': 0,
      'Acne/Pimple': 0,
      'Capillary Refill>3 sec': 0,
      'Stye': 0,
      'Eye Redness': 0,
      'Ocular M/A': 0,
      'Pale Conjunctiva': 0,
      'Matted Eyelashes': 0,
      'Eye Discharges': 0,
      'Ear Discharges': 0,
      'Impacted Cerumen': 0,
      'Mucus Discharge': 0,
      'Epistaxis': 0,
      'Mouth/Neck Lesions': 0,
      'Inflammed Pharynx': 0,
      'Tonsillitis': 0,
      'Enlarged Lymphnods': 0,
      'Rales': 0,
      'Wheezes': 0,
      'Murmur': 0,
      'Irregular Heart Rate': 0,
      'Colds': 0,
      'Cough': 0,
      'Physical Deformity': 0,
      'Distended Abdomen': 0,
      'Abdominal Pain': 0,
      'Tenderness': 0,
      'Dysmenorrhea': 0,
      'Hygiene Related': 0,
      'Tooth Decay': 0,
      'Speech Defect': 0,
      'Scabies': 0
    };


    filteredHealthExamCards.forEach(card => {
      if (!card.student) return;

      const district = card.student.schoolDistrictDivision || 'Unknown';

      if (!healthConditionsByDistrict[district]) {
        healthConditionsByDistrict[district] = JSON.parse(JSON.stringify(healthConditions));
        healthConditionsByDistrict[district]['Total Students'] = 0;
        healthConditionsByDistrict[district]['_studentIds'] = new Set();
      }

      const districtData = healthConditionsByDistrict[district];
      // Track unique students per district
      const studentId = card.student._id?.toString() || card.student.stdId;
      if (!districtData['_studentIds'].has(studentId)) {
        districtData['_studentIds'].add(studentId);
        districtData['Total Students']++;

        const gender = card.student.gender;
        if (gender === 'Male') districtData['Male']++;
        else if (gender === 'Female') districtData['Female']++;
      }

      card.examinations?.forEach(exam => {
        if (!exam.findings) return;

        const findings = exam.findings;
        districtData['Examined']++;

        // Track if any defect is found
        let hasDefect = false;

        // Vital Signs (VS) - check temperature, BP, heart rate, etc.
        const vitals = findings.temperatureBP || '';
        const heartRate = findings.heartRatePulseRateRespiratoryRate || '';
        if (vitals.toLowerCase().includes('normal') || heartRate.toLowerCase().includes('normal')) {
          districtData['VS (Normal)']++;
        } else if (vitals || heartRate) {
          districtData['VS (Abn)']++;
          hasDefect = true;
        }

        // Height (HT) - check nutritional status for height
        if (findings.nutritionalStatusHeightForAge) {
          if (findings.nutritionalStatusHeightForAge === 'Normal Height') {
            districtData['HT (Normal)']++;
          } else if (['Stunted', 'Severely Stunted', 'Tall'].includes(findings.nutritionalStatusHeightForAge)) {
            districtData['HT (Abn)']++;
            hasDefect = true;
          }
        }

        // Skin/Scalp conditions - detailed mapping
        if (findings.skinScalp && findings.skinScalp !== 'Normal') {
          hasDefect = true;
          const skinCondition = findings.skinScalp;

          if (skinCondition === 'Presence of Lice') districtData['Pediculosis']++;
          else if (skinCondition === 'Rashes') districtData['Rashes']++;
          else if (skinCondition === 'White Spots') districtData['White Spots']++;
          else if (skinCondition === 'Flaky Skin') districtData['Flaky Skin']++;
          else if (skinCondition === 'Impetigo/Boil') districtData['Impetigo/Boil']++;
          else if (skinCondition === 'Hematoma') districtData['Hematoma']++;
          else if (skinCondition === 'Bruises/Injuries') districtData['Bruises/Injuries']++;
          else if (skinCondition === 'Itchiness') {
            districtData['Itchiness']++;
            districtData['Scabies']++;
          }
          else if (skinCondition === 'Skin Lesions') districtData['Skin Lesion']++;
          else if (skinCondition === 'Acne/Pimple') districtData['Acne/Pimple']++;
        }

        // Eyes/Ears/Nose conditions - detailed mapping
        if (findings.eyesEarsNose && findings.eyesEarsNose !== 'Normal') {
          hasDefect = true;
          const eyeEarNoseCondition = findings.eyesEarsNose;

          if (eyeEarNoseCondition === 'Capillary Refill > 3 sec') districtData['Capillary Refill>3 sec']++;
          else if (eyeEarNoseCondition === 'Stye') districtData['Stye']++;
          else if (eyeEarNoseCondition === 'Eye Redness') districtData['Eye Redness']++;
          else if (eyeEarNoseCondition === 'Ocular Misalignment') districtData['Ocular M/A']++;
          else if (eyeEarNoseCondition === 'Pale Conjunctiva') districtData['Pale Conjunctiva']++;
          else if (eyeEarNoseCondition === 'Matted Eyelashes') districtData['Matted Eyelashes']++;
          else if (eyeEarNoseCondition === 'Eye discharge') districtData['Eye Discharges']++;
          else if (eyeEarNoseCondition === 'Ear discharge') districtData['Ear Discharges']++;
          else if (eyeEarNoseCondition === 'Impacted cerumen') districtData['Impacted Cerumen']++;
          else if (eyeEarNoseCondition === 'Mucus Discharge') districtData['Mucus Discharge']++;
          else if (eyeEarNoseCondition === 'Epistaxis') districtData['Epistaxis']++;
        }

        // Mouth/Throat/Neck conditions - detailed mapping
        if (findings.mouthThroatNeck && findings.mouthThroatNeck !== 'Normal') {
          hasDefect = true;
          const mouthCondition = findings.mouthThroatNeck;

          if (mouthCondition === 'Mouth/Neck Lesions') districtData['Mouth/Neck Lesions']++;
          else if (mouthCondition === 'Inflamed pharynx') districtData['Inflammed Pharynx']++;
          else if (mouthCondition === 'Enlarged tonsils') districtData['Tonsillitis']++;
          else if (mouthCondition === 'Enlarged Lymphnods') districtData['Enlarged Lymphnods']++;
        }

        // Lungs/Heart conditions - detailed mapping
        if (findings.lungsHeart && findings.lungsHeart !== 'Normal') {
          hasDefect = true;
          const lungHeartCondition = findings.lungsHeart;

          if (lungHeartCondition === 'Rales') districtData['Rales']++;
          else if (lungHeartCondition === 'Wheeze') districtData['Wheezes']++;
          else if (lungHeartCondition === 'Murmur') districtData['Murmur']++;
          else if (lungHeartCondition === 'Irregular heart rate') districtData['Irregular Heart Rate']++;
        }

        if (findings.abdomen && findings.abdomen !== 'Normal') {
          hasDefect = true;
          const abdomenCondition = findings.abdomen;

          if (abdomenCondition === 'Distended') districtData['Distended Abdomen']++;
          else if (abdomenCondition === 'Abdominal Pain') districtData['Abdominal Pain']++;
          else if (abdomenCondition === 'Tenderness') districtData['Tenderness']++;
        }

        if (findings.deformities && findings.deformities !== 'Normal') {
          hasDefect = true;
          districtData['Physical Deformity']++;

          if (findings.deformitiesSpecify) {
            const deformitySpec = findings.deformitiesSpecify.toLowerCase();
            if (deformitySpec.includes('speech')) districtData['Speech Defect']++;
          }
        }

        if (exam.complaint) {
          const complaint = exam.complaint.toLowerCase();

          if (complaint.includes('cold')) districtData['Colds']++;
          if (complaint.includes('cough')) districtData['Cough']++;
          if (complaint.includes('dysmenorrhea')) districtData['Dysmenorrhea']++;
          if (complaint.includes('tooth') || complaint.includes('dental')) districtData['Tooth Decay']++;
        }

        if (hasDefect) districtData['With Defect']++;
      });
    });

    const grandTotals = JSON.parse(JSON.stringify(healthConditions));
    grandTotals['Total Students'] = 0;

    Object.values(healthConditionsByDistrict).forEach(districtData => {
      Object.keys(healthConditions).forEach(condition => {
        grandTotals[condition] += districtData[condition];
      });
      grandTotals['Total Students'] += districtData['Total Students'];

      districtData['Total'] = districtData['Male'] + districtData['Female'];

      delete districtData['_studentIds'];
    });

    grandTotals['Total'] = grandTotals['Male'] + grandTotals['Female'];



    return {
      gradeRange: {
        from: gradeFrom,
        to: gradeTo || gradeFrom,
        grades: selectedGrades,
        isSingleGrade: !gradeTo || gradeFrom === gradeTo
      },
      period: {
        month,
        year,
        monthName: new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }),
        startDate,
        endDate
      },
      byDistrict: healthConditionsByDistrict,
      grandTotals,
      recordCounts: {
        healthExamCards: filteredHealthExamCards.length,
        districts: Object.keys(healthConditionsByDistrict).length
      }
    };
  }

  async exportConsolidatedReportToExcel({ gradeFrom, gradeTo, month, year, preparedBy }) {
    const data = await this.getConsolidatedStatisticsByDivisionGradeMonth({
      gradeFrom,
      gradeTo,
      month,
      year
    });

    const templatePath = path.join(__dirname, '../../../templates/Consolidated Report.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Template worksheet not found');
    }

    const rowMapping = {
      'Male': 7,
      'Female': 8,
      'Total': 9,

      'Examined': 11,
      'With Defect': 12,
      'Treated': 13,
      'Referred': 14,
      'Health Talk': 15,

      'VS (Normal)': 17,
      'VS (Abn)': 18,
      'HT (Normal)': 19,
      'HT (Abn)': 20,

      'Pediculosis': 22,
      'Rashes': 23,
      'White Spots': 24,
      'Flaky Skin': 25,
      'Impetigo/Boil': 26,
      'Hematoma': 27,
      'Bruises/Injuries': 28,
      'Itchiness': 29,
      'Skin Lesion': 30,
      'Acne/Pimple': 31,
      'Capillary Refill>3 sec': 32,
      'Stye': 33,
      'Eye Redness': 34,
      'Ocular M/A': 35,
      'Pale Conjunctiva': 36,
      'Matted Eyelashes': 37,
      'Eye Discharges': 38,
      'Ear Discharges': 39,
      'Impacted Cerumen': 40,
      'Mucus Discharge': 41,
      'Epistaxis': 42,
      'Mouth/Neck Lesions': 43,
      'Inflammed Pharynx': 44,
      'Tonsillitis': 45,
      'Enlarged Lymphnods': 46,
      'Rales': 47,
      'Wheezes': 48,
      'Murmur': 49,
      'Irregular Heart Rate': 50,
      'Colds': 51,
      'Cough': 52,
      'Physical Deformity': 53,
      'Distended Abdomen': 54,
      'Abdominal Pain': 55,
      'Tenderness': 56,
      'Dysmenorrhea': 57,
      'Hygiene Related': 58,
      'Tooth Decay': 59,
      'Speech Defect': 60,
      'Scabies': 61
    };


    const aliasMap = {
      'Inflammed Pharynx': 'URTI',
      'Rales': 'LRTI',
      'Murmur': 'Abn Heart Findings',
      'Irregular Heart Rate': 'Abn Heart Findings',
      'Acne/Pimple': 'Skin Allergies',
      'Ear Discharges': 'Ear Discharge'
    };

    const districtColumnMap = {
      'Ambaguio': 2,
      'Aritao East': 3,
      'Aritao West': 4,
      'A.Castaneda': 5,
      'Alfonso Castaneda': 5,
      'A. Castaneda': 5,
      'Bagabag I': 6,
      'Bagabag II': 7,
      'Bambang I': 8,
      'Bam I': 8,
      'Bambang II': 9,
      'Bam II': 9,
      'Bayombong I': 10,
      'Bay I': 10,
      'Bayombong II': 11,
      'Bay II': 11,
      'Diadi': 12,
      'Dupax del Norte I': 13,
      'Dup Norte I': 13,
      'Dupax del Norte II': 14,
      'Dup Norte II': 14,
      'Dupax del Sur': 15,
      'Dup Sur': 15,
      'Eastern Kayapa': 16,
      'East Kayapa': 16,
      'Western Kayapa': 17,
      'West Kayapa': 17,
      'Kasibu East': 18,
      'Kasibu West': 19,
      'Quezon': 20,
      'Que zon': 20,
      'Solano I': 21,
      'Solano II': 22,
      'Sta. Fe': 23,
      'Sta Fe': 23,
      'Villaverde': 24,
      'Villa verde': 24
    };

    const districts = Object.keys(data.byDistrict);

    districts.forEach((district) => {
      const columnIndex = districtColumnMap[district];
      if (!columnIndex) {
        console.warn(`District "${district}" not found in column mapping, skipping...`);
        return;
      }

      const col = this.getColumnLetter(columnIndex);
      const districtData = data.byDistrict[district];

      worksheet.getCell(`${col}3`).value = district;

      Object.keys(rowMapping).forEach((condition) => {
        const row = rowMapping[condition];
        const alias = aliasMap[condition];
        const value = districtData[condition] ?? districtData[alias] ?? 0;
        worksheet.getCell(`${col}${row}`).value = value;
      });
    });

    const grandCol = this.getColumnLetter(25);

    const gradeLabel = data.gradeRange.isSingleGrade
      ? gradeFrom.toUpperCase()
      : `${gradeFrom.toUpperCase()} TO ${gradeTo.toUpperCase()}`;

    worksheet.getCell(`${grandCol}3`).value = gradeLabel;

    worksheet.getCell(`${grandCol}2`).value = data.period.monthName.toUpperCase();

    Object.keys(rowMapping).forEach((condition) => {
      const row = rowMapping[condition];
      const alias = aliasMap[condition];
      const value = data.grandTotals[condition] ?? data.grandTotals[alias] ?? 0;
      worksheet.getCell(`${grandCol}${row}`).value = value;
    });

    const titleCell = worksheet.getCell('A1');
    if (titleCell.value) {
      titleCell.value = `Consolidated Statistical Report FY ${year}`;
    }
    worksheet.getCell('C65').value = preparedBy.firstName + preparedBy.lastName
    worksheet.getCell('C66').value = preparedBy.role
    const buffer = await workbook.xlsx.writeBuffer();

    const gradeFilename = data.gradeRange.isSingleGrade
      ? gradeFrom.replace(/\s+/g, '_')
      : `${gradeFrom.replace(/\s+/g, '_')}_to_${gradeTo.replace(/\s+/g, '_')}`;

    return {
      buffer,
      filename: `Consolidated_Report_${data.period.monthName}_${year}_${gradeFilename}.xlsx`,
      data
    };
  }


  getColumnLetter(columnNumber) {
    let letter = '';
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return letter;
  }
}
export default new SchoolHealthSurveyService();