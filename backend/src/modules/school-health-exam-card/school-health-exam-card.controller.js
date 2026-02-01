import SchoolHealthExaminationService from "./school-health-exam-card.service.js";
import SchoolHealthDSSService from "./school-health-exam-card-dss.service.js";
import studentService from "#modules/student/student.service.js";
import SchoolHealthExamination from "./school-health-exam-card.model.js";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "express-async-handler";
import { extractAuditInfo, getTemplatePath } from "#utils/helpers.js";
import ApiError from "#utils/ApiError.js";
import ExcelJS from 'exceljs';
import fs from 'fs';
import logger from '#logger/logger.js';

export const getUserSchools = asyncHandler(async (req, res) => {
  const userContext = extractAuditInfo(req.user);
  let schoolDetails = [];
  let schoolName = [];
  let schoolId = [];

  if (userContext.associatedSchools !== 'district' && Array.isArray(userContext.associatedSchools)) {
    const schoolIds = userContext.associatedSchools;
    const schoolNames = req.user.schoolName || [];

    schoolDetails = schoolIds.map((id, index) => ({
      id: id,
      name: schoolNames[index] || `School ${id}`
    }));

    // Extract arrays for backward compatibility
    schoolId = schoolIds;
    schoolName = schoolNames;
  }

  return res.status(StatusCodes.OK).json({
    message: "User school access information retrieved successfully",
    data: {
      userId: userContext.personnelId,
      personnelName: userContext.personnelName,
      role: userContext.personnelType,
      schoolId: schoolId,
      schoolName: schoolName,
      schoolDistrictDivision: userContext.schoolDistrictDivision,
      associatedSchools: userContext.associatedSchools,
      schoolDetails: schoolDetails,
      accessType: userContext.personnelType === 'Nurse' ? 'district' : 'school-specific'
    }
  });
});

export const createHealthCard = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);
  const { stdId, examinations } = req.body;

  if (!examinations || !Array.isArray(examinations) || examinations.length === 0) {
    throw new ApiError("At least one examination is required", StatusCodes.BAD_REQUEST);
  }

  const examinationsWithExaminer = examinations.map(exam => ({
    ...exam,
    examiner: auditInfo.personnelId
  }));

  const healthCardData = {
    stdId,
    examinations: examinationsWithExaminer,
    lastModifiedBy: auditInfo.personnelId,
  };

  const healthCard = await SchoolHealthExaminationService.createExamCardWithDSSAssessment(stdId, healthCardData);
  return res.status(StatusCodes.CREATED).json({
    message: "Health examination card created successfully with DSS assessment",
    data: healthCard
  });
});

export const getAllRecordsByAttendingExaminer = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);
  const examiner = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;

  const result = await SchoolHealthExaminationService.getAllRecordsByAttendingExaminer(
    examiner,
    auditInfo.schoolDistrictDivision,
    { page, limit }
  );

  return res.status(StatusCodes.OK).json(result);
});

export const getAllSchoolHealthRecordCount = asyncHandler(async (req, res) => {
  const count = await SchoolHealthExaminationService.getAllSchoolHealthRecordCount();

  return res.status(StatusCodes.OK).json({
    count
  });
});


export const updateGradeExamination = asyncHandler(async (req, res) => {
  const { stdId, grade } = req.params;
  if (!stdId) throw new ApiError("stdId is required", StatusCodes.BAD_REQUEST);
  if (!grade) throw new ApiError("Grade Level is required", StatusCodes.BAD_REQUEST);

  const auditInfo = extractAuditInfo(req.user);

  const updatedCard = await SchoolHealthExaminationService.updateGradeExaminationWithDSSAssessment(
    stdId,
    grade,
    req.body,
    auditInfo.personnelId
  );

  return res.status(StatusCodes.OK).json({
    message: `Grade ${grade} examination updated successfully with DSS assessment`,
    data: updatedCard,
    modifiedBy: req.user.firstName,
  });
});

export const deleteGradeExamination = asyncHandler(async (req, res) => {
  const { stdId, grade } = req.params;
  if (!stdId) throw new ApiError("stdId is required", StatusCodes.BAD_REQUEST);
  if (!grade) throw new ApiError("Grade is required", StatusCodes.BAD_REQUEST);

  const auditInfo = extractAuditInfo(req.user);
  const updatedCard = await SchoolHealthExaminationService.deleteGradeExamination(
    stdId,
    grade,
    auditInfo.personnelId
  );

  return res.status(StatusCodes.OK).json({
    message: `Grade ${grade} examination deleted successfully`,
    data: updatedCard,
    deletedBy: req.user.firstName,
  });
});

export const getAllGradeExamination = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);

  const examiner = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId;

  const cards = await SchoolHealthExaminationService.getAllGradeExamination(examiner, auditInfo.schoolDistrictDivision);
  return res.status(StatusCodes.OK).json({
    count: cards.length,
    data: cards,
  });
});



export const getExaminationHistory = asyncHandler(async (req, res) => {

  const { stdId } = req.params;
  const history = await SchoolHealthExaminationService.getExaminationHistory(stdId);
  return res.status(StatusCodes.OK).json({ data: history });
});

export const getCardsByGrade = asyncHandler(async (req, res) => {
  const { grade } = req.params;
  const cards = await SchoolHealthExaminationService.getCardsByGrade(grade);
  return res.status(StatusCodes.OK).json({ count: cards.length, data: cards });
});

export const getCardsBySchool = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;
  const cards = await SchoolHealthExaminationService.getCardsBySchool(schoolId);
  return res.status(StatusCodes.OK).json({ count: cards.length, data: cards });
});

export const getHealthStatistics = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user)
  const userId = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId;
  const stats = await SchoolHealthExaminationService.getHealthStatistics(userId);
  return res.status(StatusCodes.OK).json({ data: stats });
});

export const getNutritionalStatusSummary = asyncHandler(async (req, res) => {
  const summary = await SchoolHealthExaminationService.getNutritionalStatusSummary();
  return res.status(StatusCodes.OK).json({ data: summary });
});

export const analyzeSchoolHealthRecords = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;
  const analysis = await SchoolHealthExaminationService.analyzeSchoolHealthRecords(schoolId);
  return res.status(StatusCodes.OK).json({ data: analysis });
});

export const getDSSSummary = asyncHandler(async (req, res) => {
  const { schoolId = 'all' } = req.query;

  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }



  const { summary, insights } = await SchoolHealthExaminationService.getDSSSummary(userContext, schoolId);

  const records = await SchoolHealthExaminationService._getSchoolRecordsForAnalysis(schoolId, userContext);


  const detailedAnalysis = SchoolHealthExaminationService.analyzeCommonFindings(records);
  const priorityAreas = SchoolHealthExaminationService.identifyPriorityAreas(detailedAnalysis.commonFindings);
  const recommendations = SchoolHealthExaminationService.generateSchoolRecommendations(detailedAnalysis);
  return res.status(StatusCodes.OK).json({
    data: {
      summary,
      insights,
      detailedAnalysis: detailedAnalysis.commonFindings,
      priorityAreas: priorityAreas.slice(0, 10),
      recommendations: recommendations.slice(0, 5),
      riskBreakdown: detailedAnalysis.riskAnalysis,
      gradeDistribution: detailedAnalysis.gradeBreakdown,
      schoolFilter: schoolId,
      userAccess: userContext.associatedSchools,
    }
  });
});

export const getStudentDSSReport = asyncHandler(async (req, res) => {
  const { stdId } = req.params;
  const report = await SchoolHealthExaminationService.getStudentDSSReport(stdId);
  return res.status(StatusCodes.OK).json({ data: report });
});

export const getStudentsRequiringFollowUp = asyncHandler(async (req, res) => {
  const { schoolId = 'all' } = req.query;
  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  const students = await SchoolHealthExaminationService.getStudentsRequiringFollowUp(userContext, schoolId);
  return res.status(StatusCodes.OK).json({ count: students.length, data: students });
});

export const getStudentsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { schoolId = 'all' } = req.query;
  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  const validCategories = ['notDewormed', 'immunizationIncomplete', 'visionIssues', 'hearingIssues', 'pendingApproval'];

  if (!validCategories.includes(category)) {
    throw new ApiError(`Invalid category. Valid categories are: ${validCategories.join(', ')}`, StatusCodes.BAD_REQUEST);
  }

  const students = await SchoolHealthExaminationService.getStudentsByCategory(category, userContext, schoolId);

  return res.status(StatusCodes.OK).json({
    count: students.length,
    category,
    data: students
  });
});

export const exportHighPriorityAlerts = asyncHandler(async (req, res) => {
  const { schoolId = 'all' } = req.query;
  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  const students = await SchoolHealthExaminationService.getStudentsRequiringFollowUp(userContext, schoolId);

  if (!students || students.length === 0) {
    throw new ApiError('No high-priority health alerts found', StatusCodes.NOT_FOUND);
  }

  // Transform data for export
  const alertsData = students.map(student => {
    const allFlags = [
      ...(student.nutrition || []),
      ...(student.visionHearing || []),
      ...(student.communicable || []),
      ...(student.preventiveCare || []),
    ];

    const criticalFlags = allFlags.filter(flag =>
      flag.flag?.includes('Severely') ||
      flag.flag?.includes('Critical') ||
      flag.flag?.includes('Urgent') ||
      flag.flag?.includes('High Risk')
    );

    const moderateFlags = allFlags.filter(flag =>
      flag.flag?.includes('Moderate') ||
      flag.flag?.includes('Medium Risk') ||
      flag.flag?.includes('Abnormal') ||
      flag.flag?.includes('Delayed')
    );

    let primaryFlag = "Health Assessment Required";
    let flagSeverity = "Medium";
    let flagCategory = "GENERAL";

    if (criticalFlags.length > 0) {
      primaryFlag = criticalFlags[0].flag;
      flagSeverity = "Critical";
      flagCategory = criticalFlags[0].flag?.includes('Nutrition') ? 'NUTRITION' :
        criticalFlags[0].flag?.includes('Vision') || criticalFlags[0].flag?.includes('Hearing') ? 'SENSORY' :
          criticalFlags[0].flag?.includes('Infection') || criticalFlags[0].flag?.includes('Disease') ? 'INFECTION' : 'MEDICAL';
    } else if (moderateFlags.length > 0) {
      primaryFlag = moderateFlags[0].flag;
      flagSeverity = "High";
      flagCategory = moderateFlags[0].flag?.includes('Nutrition') ? 'NUTRITION' :
        moderateFlags[0].flag?.includes('Vision') || moderateFlags[0].flag?.includes('Hearing') ? 'SENSORY' :
          moderateFlags[0].flag?.includes('Infection') || moderateFlags[0].flag?.includes('Disease') ? 'INFECTION' : 'MEDICAL';
    } else if (allFlags.length > 0) {
      primaryFlag = allFlags[0].flag;
      flagSeverity = student.riskLevel === "High Risk" ? "Critical" :
        student.riskLevel === "Medium Risk" ? "High" : "Medium";
      flagCategory = 'PREVENTIVE';
    }

    let actionRequired = "Follow-up required";
    if (allFlags.length > 0) {
      const recommendation = allFlags[0].recommendation;
      if (recommendation?.includes('referral') || recommendation?.includes('doctor')) {
        actionRequired = "Medical referral required";
      } else if (recommendation?.includes('screening') || recommendation?.includes('examination')) {
        actionRequired = "Specialized screening needed";
      } else if (recommendation?.includes('nutrition') || recommendation?.includes('feeding')) {
        actionRequired = "Nutritional intervention required";
      } else if (recommendation?.includes('immunization') || recommendation?.includes('vaccination')) {
        actionRequired = "Immunization needed";
      } else {
        actionRequired = recommendation || "Follow-up required";
      }
    }

    return {
      studentId: student.studentId || student.stdId,
      studentName: student.studentName || "Unknown",
      gradeLevel: student.gradeLevel || "Unknown",
      schoolId: student.schoolId || null,
      schoolName: student.schoolName || null,
      healthCondition: primaryFlag,
      category: flagCategory,
      severity: flagSeverity,
      priorityAction: actionRequired,
      riskLevel: student.riskLevel || "Unclassified",
      conditionCount: allFlags.length,
      lastExamDate: student.examDate || student.analyzedAt || "N/A",
      allConditions: allFlags.map(f => f.flag).join('; '),
      allRecommendations: allFlags.map(f => f.recommendation).join('; ')
    };
  });

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('High-Priority Health Alerts');

  // Define columns
  worksheet.columns = [
    { header: 'Student ID', key: 'studentId', width: 15 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Grade Level', key: 'gradeLevel', width: 12 },
    ...(schoolId === 'all' ? [
      { header: 'School ID', key: 'schoolId', width: 15 },
      { header: 'School Name', key: 'schoolName', width: 30 }
    ] : []),
    { header: 'Primary Health Condition', key: 'healthCondition', width: 40 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Risk Level', key: 'riskLevel', width: 15 },
    { header: 'Priority Action Required', key: 'priorityAction', width: 40 },
    { header: 'Condition Count', key: 'conditionCount', width: 15 },
    { header: 'Last Exam Date', key: 'lastExamDate', width: 15 },
    { header: 'All Conditions', key: 'allConditions', width: 50 },
    { header: 'All Recommendations', key: 'allRecommendations', width: 50 }
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 20;

  // Add data rows
  alertsData.forEach(alert => {
    const row = worksheet.addRow(alert);

    // Color code by severity
    let severityColor = 'FFFFFFFF';
    if (alert.severity === 'Critical') {
      severityColor = 'FFFFE0E0';
    } else if (alert.severity === 'High') {
      severityColor = 'FFFFF4E0';
    } else if (alert.severity === 'Medium') {
      severityColor = 'FFE0F4FF';
    }

    row.getCell('severity').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: severityColor }
    };

    // Style the row
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  // Add filters
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length }
  };

  // Set response headers
  const filename = schoolId === 'all'
    ? `High_Priority_Health_Alerts_All_Schools_${new Date().toISOString().split('T')[0]}.xlsx`
    : `High_Priority_Health_Alerts_School_${schoolId}_${new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${filename}`
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
});


// export const approveHealthRecord = asyncHandler(async (req, res) => {
//   const { stdId, grade } = req.params;
//   const { remarks } = req.body;

//   if (!stdId) throw new ApiError("stdId is required", StatusCodes.BAD_REQUEST);
//   if (!grade) throw new ApiError("Grade Level is required", StatusCodes.BAD_REQUEST);

//   const auditInfo = extractAuditInfo(req.user);
//   const approvedRecord = await SchoolHealthExaminationService.approveExamination(
//     stdId,
//     grade,
//     auditInfo.personnelId,
//     remarks
//   );

//   return res.status(StatusCodes.OK).json({
//     message: `Health examination for grade ${grade} approved successfully`,
//     data: approvedRecord,
//     approvedBy: req.user.firstName,
//   });
// });

export const getPendingApprovals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const result = await SchoolHealthExaminationService.getPendingApprovals({
    page: parseInt(page),
    limit: parseInt(limit)
  });

  logger.info(`Fetched ${result.data.pendingRecords.length} pending approvals`, {
    page,
    limit,
    total: result.pagination.total
  });

  return res.status(StatusCodes.OK).json(result);
});

export const getApprovedRecords = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const result = await SchoolHealthExaminationService.getApprovedRecords({
    page: parseInt(page),
    limit: parseInt(limit)
  });

  logger.info(`Fetched ${result.data.approvedRecords.length} approved records`, {
    page,
    limit,
    total: result.pagination.total
  });

  return res.status(StatusCodes.OK).json(result);
});

export const getPendingExaminationsByGrade = asyncHandler(async (req, res) => {
  const { grade } = req.params;
  const pendingExaminations = await SchoolHealthExaminationService.getPendingExaminationsByGrade(grade);
  return res.status(StatusCodes.OK).json({
    count: pendingExaminations.length,
    data: pendingExaminations,
  });
});

export const getApprovedExaminationsByGrade = asyncHandler(async (req, res) => {
  const { grade } = req.params;
  const approvedExaminations = await SchoolHealthExaminationService.getApprovedExaminationsByGrade(grade);
  return res.status(StatusCodes.OK).json({
    count: approvedExaminations.length,
    data: approvedExaminations,
  });
});

// DSS-Enhanced Controllers
export const generateDSSAssessment = asyncHandler(async (req, res) => {
  const { recordId } = req.params;

  if (!recordId) {
    throw new ApiError("Record ID is required", StatusCodes.BAD_REQUEST);
  }

  const assessment = await SchoolHealthExaminationService.generateDSSAssessmentForRecord(recordId);

  return res.status(StatusCodes.OK).json({
    message: "DSS assessment generated successfully",
    data: assessment
  });
});


export const getBulkDSSAssessments = asyncHandler(async (req, res) => {
  const filters = req.query;
  const { quick } = req.query;

  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  const assessments = await SchoolHealthExaminationService.getBulkDSSAssessments(filters, userContext);

  if (quick === 'true') {
    let schoolFilter = {};
    if (userContext && userContext.associatedSchools !== 'district' && Array.isArray(userContext.associatedSchools)) {
      const Student = require('#modules/student/student.model.js').default;
      const associatedStudents = await Student.find({
        schoolId: { $in: userContext.associatedSchools }
      }).select('_id').lean();

      schoolFilter = { student: { $in: associatedStudents.map(s => s._id) } };
    }

    const records = await SchoolHealthExamination.find({
      isDeleted: false,
      ...filters,
      ...schoolFilter
    }).lean();

    const quickSummaries = records.map(record =>
      SchoolHealthExaminationService.getHealthSummary(record)
    );

    return res.status(StatusCodes.OK).json({
      message: "Quick DSS assessments retrieved successfully",
      count: quickSummaries.length,
      data: quickSummaries,
      userAccess: userContext.associatedSchools
    });
  }

  return res.status(StatusCodes.OK).json({
    message: "Bulk DSS assessments retrieved successfully",
    count: assessments.length,
    data: assessments,
    userAccess: userContext.associatedSchools
  });
});

// Common Findings Analysis Controllers
export const getSchoolCommonFindings = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;
  const filters = req.query; // startDate, endDate, etc.

  if (!schoolId) {
    throw new ApiError("School ID is required", StatusCodes.BAD_REQUEST);
  }

  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  if (userContext.associatedSchools !== 'district' &&
    Array.isArray(userContext.associatedSchools) &&
    !userContext.associatedSchools.includes(schoolId)) {
    throw new ApiError("Access denied: You don't have permission to view this school's data", StatusCodes.FORBIDDEN);
  }

  const commonFindings = await SchoolHealthExaminationService.getSchoolCommonFindings(schoolId, filters, userContext);

  // Enhanced: Add specific condition recommendations using unused function
  const enhancedPriorityAreas = commonFindings.priorityAreas?.map(area => ({
    ...area,
    specificRecommendation: SchoolHealthExaminationService.getConditionSpecificRecommendation(area)
  })) || [];

  return res.status(StatusCodes.OK).json({
    message: "School common findings analysis retrieved successfully",
    data: {
      ...commonFindings,
      priorityAreas: enhancedPriorityAreas,
      totalPriorityConditions: enhancedPriorityAreas.length,
      urgentConditions: enhancedPriorityAreas.filter(area => area.severity === 'HIGH').length,
      actionableRecommendations: enhancedPriorityAreas.filter(area => area.specificRecommendation).length
    }
  });
});

export const getSchoolHealthComparison = asyncHandler(async (req, res) => {
  const { schoolIds } = req.body;
  const filters = req.query;

  if (!Array.isArray(schoolIds) || schoolIds.length === 0) {
    throw new ApiError("School IDs array is required", StatusCodes.BAD_REQUEST);
  }

  if (schoolIds.length > 10) {
    throw new ApiError("Cannot compare more than 10 schools at once", StatusCodes.BAD_REQUEST);
  }

  const comparison = await SchoolHealthExaminationService.getSchoolHealthComparison(schoolIds, filters);

  const detailedInsights = SchoolHealthExaminationService.generateComparativeInsights(comparison.schools);

  const bestPerformingMetrics = {
    lowestRiskPercentage: comparison.schools.reduce((best, current) =>
      (current.riskAnalysis?.high?.percentage || 100) < (best.riskAnalysis?.high?.percentage || 100) ? current : best
    ),
    mostProactivePreventiveCare: comparison.schools.reduce((best, current) => {
      const currentVaccination = current.commonFindings?.preventiveCare?.incompleteImmunization?.percentage || 100;
      const bestVaccination = best.commonFindings?.preventiveCare?.incompleteImmunization?.percentage || 100;
      return currentVaccination < bestVaccination ? current : best;
    })
  };

  return res.status(StatusCodes.OK).json({
    message: "School health comparison analysis completed",
    data: {
      ...comparison,
      insights: detailedInsights,
      benchmarks: {
        bestPerformingRisk: bestPerformingMetrics.lowestRiskPercentage.schoolId,
        bestPreventiveCare: bestPerformingMetrics.mostProactivePreventiveCare.schoolId,
        averageHighRiskPercentage: Math.round(
          comparison.schools.reduce((sum, school) => sum + (school.riskAnalysis?.high?.percentage || 0), 0) / comparison.schools.length
        )
      }
    }
  });
});

export const getSchoolHealthTrends = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;
  const { period = '6months' } = req.query;

  if (!schoolId) {
    throw new ApiError("School ID is required", StatusCodes.BAD_REQUEST);
  }

  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  if (userContext.associatedSchools !== 'district' &&
    Array.isArray(userContext.associatedSchools) &&
    !userContext.associatedSchools.includes(schoolId)) {
    throw new ApiError("Access denied: You don't have permission to view this school's data", StatusCodes.FORBIDDEN);
  }

  const now = new Date();
  let startDate;

  switch (period) {
    case '3months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '1year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  }

  const filters = { startDate, endDate: now };
  const trends = await SchoolHealthExaminationService.getSchoolCommonFindings(schoolId, filters, userContext);

  return res.status(StatusCodes.OK).json({
    message: "School health trends analysis completed",
    period,
    dateRange: { startDate, endDate: now },
    data: trends
  });
});

export const getSchoolHealthActionPlan = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;

  if (!schoolId) {
    throw new ApiError("School ID is required", StatusCodes.BAD_REQUEST);
  }

  const userContext = extractAuditInfo(req.user);

  if (userContext.personnelType === 'Doctor') {
    userContext.associatedSchools = 'district';
  }

  if (userContext.associatedSchools !== 'district' &&
    Array.isArray(userContext.associatedSchools) &&
    !userContext.associatedSchools.includes(schoolId)) {
    throw new ApiError("Access denied: You don't have permission to view this school's data", StatusCodes.FORBIDDEN);
  }

  const commonFindings = await SchoolHealthExaminationService.getSchoolCommonFindings(schoolId, {}, userContext);

  // Handle case when no records are found
  if (!commonFindings || commonFindings.totalRecords === 0) {
    return res.status(StatusCodes.OK).json({
      message: "No health records found for this school",
      data: {
        schoolId,
        totalStudents: 0,
        message: "No health records available to generate action plan",
        priorityActions: [],
        immediateActions: [],
        scheduledActions: [],
        resourcesNeeded: {
          medical: false,
          nutritional: false,
          hygiene: false,
          vaccination: false
        },
        timeline: {
          immediate: 0,
          withinMonth: 0,
          ongoing: 0
        }
      }
    });
  }

  // Safely access properties with fallbacks
  const priorityAreas = commonFindings.priorityAreas || [];
  const recommendations = commonFindings.recommendations || [];
  const preventiveCare = commonFindings.commonFindings?.preventiveCare || {};
  const incompleteImmunization = preventiveCare.incompleteImmunization || { percentage: 0 };

  // Focus on actionable recommendations
  const actionPlan = {
    schoolId,
    analysisDate: commonFindings.analysisDate,
    totalStudents: commonFindings.totalRecords,
    priorityActions: priorityAreas.slice(0, 5), // Top 5 priorities
    immediateActions: recommendations.filter(rec => rec.priority === 'URGENT'),
    scheduledActions: recommendations.filter(rec => rec.priority !== 'URGENT'),
    resourcesNeeded: {
      medical: priorityAreas.filter(area =>
        ['visionProblems', 'hearingProblems', 'cardiacIssues'].includes(area.condition)
      ).length > 0,
      nutritional: priorityAreas.filter(area =>
        ['underweight', 'severelyUnderweight', 'stunted'].includes(area.condition)
      ).length > 0,
      hygiene: priorityAreas.filter(area =>
        ['lice', 'skinInfections'].includes(area.condition)
      ).length > 0,
      vaccination: incompleteImmunization.percentage > 20
    },
    timeline: {
      immediate: recommendations.filter(rec => rec.priority === 'URGENT').length,
      withinMonth: recommendations.filter(rec => rec.priority === 'HIGH').length,
      ongoing: recommendations.filter(rec => rec.priority === 'MEDIUM').length
    }
  };

  return res.status(StatusCodes.OK).json({
    message: "School health action plan generated successfully",
    data: actionPlan
  });
});

export const getPreventiveProgramsStats = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user)
  const userId = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId;
  const stats = await SchoolHealthExaminationService.getPreventiveProgramsStats(userId);

  return res.status(StatusCodes.OK).json({
    message: "Preventive programs statistics retrieved successfully",
    data: stats
  });
});

export const getRecentScreenings = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const auditInfo = extractAuditInfo(req.user)
  const userId = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId;
  const screenings = await SchoolHealthExaminationService.getRecentScreenings(parseInt(limit), userId);

  return res.status(StatusCodes.OK).json({
    message: "Recent screenings retrieved successfully",
    data: screenings
  });
});


export const getDSSAlertsBreakdown = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user)
  const userId = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId;
  const breakdown = await SchoolHealthExaminationService.getDSSAlertsBreakdown(userId);

  return res.status(StatusCodes.OK).json({
    message: "DSS alerts breakdown retrieved successfully",
    data: breakdown
  });
});

export const generatePrescriptionFromRecord = asyncHandler(async (req, res) => {
  const { recordId } = req.params;
  const prescriptionService = (await import('#modules/prescription/prescription.service.js')).default;

  const prescription = await prescriptionService.autoGeneratePrescriptionFromSchoolHealth(
    recordId,
    req.user._id
  );

  return res.status(StatusCodes.CREATED).json({
    message: "Prescription auto-generated successfully from health record",
    data: prescription
  });
});
export const exportHealthRecord = asyncHandler(async (req, res) => {
  const { shecId } = req.query;

  if (!shecId) {
    throw new ApiError("Health Examination Card ID is required", StatusCodes.BAD_REQUEST);
  }

  const healthCard = await SchoolHealthExamination.findOne({ shecId })
    .populate('student')
    .populate('examinations.examiner', 'firstName lastName')
    .lean();

  if (!healthCard) {
    throw new ApiError("No health examination records found for this student", StatusCodes.NOT_FOUND);
  }

  const student = healthCard.student;

  if (!student) {
    throw new ApiError("Student information not found", StatusCodes.NOT_FOUND);
  }

  const workbook = new ExcelJS.Workbook();

  const templatePath = getTemplatePath('SCHOOL HEALTH EXAMINATION CARD.xlsx');

  if (!fs.existsSync(templatePath)) {
    logger.error(`Template file not found at path: ${templatePath}`);
    logger.error(`Current working directory: ${process.cwd()}`);
    logger.error(`Directory contents: ${fs.existsSync(process.cwd() + '/templates') ? fs.readdirSync(process.cwd() + '/templates').join(', ') : 'templates directory not found'}`);
    throw new ApiError(`Template file not found: ${templatePath}`, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  try {
    await workbook.xlsx.readFile(templatePath);
  } catch (error) {
    logger.error(`Failed to load school health examination card template: ${error.message}`, { error, templatePath });
    throw new ApiError(`Failed to load school health examination card template: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  const sheet = workbook.getWorksheet(1);

  sheet.getCell('B8').value = ` ${student.lastName || ''} ${student.firstName || ''} ${student.middleName || ''}`;
  sheet.getCell('Q8').value = ` ${student.schoolId || ''}`;

  sheet.getCell('B10').value = `${student.lrn || ''}`;
  sheet.getCell('C11').value = `${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : ''}`;
  sheet.getCell('Q11').value = `2`;

  sheet.getCell('Q13').value = ` ${student.division || 'Nueva Vizcaya'}`;
  sheet.getCell('C11').value = ` ${student.birthPlace || ''}`;
  sheet.getCell('Q14').value = ` ${student.telephoneNo || ""}`;
  sheet.getCell('C15').value = ` ${student.address || ''}`;

  // Grade level to column mapping (based on the template structure)
  const gradeColumnMap = {
    'Kinder': 'J',
    'Grade 1': 'K',
    'Grade 2': 'L',
    'Grade 3': 'M',
    'Grade 4': 'N',
    'Grade 5': 'O',
    'Grade 6': 'P',
    'Grade 7': 'Q',
    'Grade 8': 'R',
    'Grade 9': 'S',
    'Grade 10': 'T',
    'Grade 11': 'U',
    'Grade 12': 'V'
  };

  // Starting row for data entry
  const dataStartRow = 19;

  // Process each examination
  healthCard.examinations.forEach((exam) => {
    const column = gradeColumnMap[exam.grade];
    if (!column || !exam.findings) return;

    const findings = exam.findings;

    if (findings.dateOfExamination) {
      sheet.getCell(`${column}${dataStartRow}`).value = new Date(findings.dateOfExamination).toLocaleDateString();
    }

    if (findings.temperatureBP) {
      sheet.getCell(`${column}${dataStartRow + 1}`).value = findings.temperatureBP;
    }

    if (findings.heartRatePulseRateRespiratoryRate) {
      sheet.getCell(`${column}${dataStartRow + 2}`).value = findings.heartRatePulseRateRespiratoryRate;
    }

    if (findings.heightInCm) {
      sheet.getCell(`${column}${dataStartRow + 3}`).value = findings.heightInCm;
    }

    if (findings.weightInKg) {
      sheet.getCell(`${column}${dataStartRow + 4}`).value = findings.weightInKg;
    }

    if (findings.nutritionalStatusBMI) {
      sheet.getCell(`${column}${dataStartRow + 5}`).value = findings.nutritionalStatusBMI;
    }

    if (findings.nutritionalStatusHeightForAge) {
      sheet.getCell(`${column}${dataStartRow + 6}`).value = findings.nutritionalStatusHeightForAge;
    }

    if (findings.visionScreening) {
      sheet.getCell(`${column}${dataStartRow + 7}`).value = findings.visionScreening;
    }

    if (findings.auditoryScreening) {
      sheet.getCell(`${column}${dataStartRow + 8}`).value = findings.auditoryScreening;
    }

    if (findings.skinScalp) {
      sheet.getCell(`${column}${dataStartRow + 9}`).value = findings.skinScalp;
    }

    if (findings.eyesEarsNose) {
      sheet.getCell(`${column}${dataStartRow + 10}`).value = findings.eyesEarsNose;
    }

    if (findings.mouthThroatNeck) {
      sheet.getCell(`${column}${dataStartRow + 11}`).value = findings.mouthThroatNeck;
    }

    if (findings.lungsHeart) {
      sheet.getCell(`${column}${dataStartRow + 12}`).value = findings.lungsHeart;
    }

    if (findings.abdomen) {
      sheet.getCell(`${column}${dataStartRow + 13}`).value = findings.abdomen;
    }

    if (findings.deformities) {
      const deformitiesValue = findings.deformities + (findings.deformitiesSpecify ? ` (${findings.deformitiesSpecify})` : '');
      sheet.getCell(`${column}${dataStartRow + 14}`).value = deformitiesValue;
    }

    if (findings.ironSupplementation !== undefined) {
      sheet.getCell(`${column}${dataStartRow + 15}`).value = findings.ironSupplementation ? 'Yes' : 'No';
    }

    if (findings.deworming !== undefined) {
      sheet.getCell(`${column}${dataStartRow + 16}`).value = findings.deworming ? 'Yes' : 'No';
    }

    if (findings.immunization) {
      sheet.getCell(`${column}${dataStartRow + 17}`).value = findings.immunization;
    }

    if (findings.sbfpBeneficiary !== undefined) {
      sheet.getCell(`${column}${dataStartRow + 18}`).value = findings.sbfpBeneficiary ? 'Yes' : 'No';
    }

    if (findings.fourPsBeneficiary !== undefined) {
      sheet.getCell(`${column}${dataStartRow + 19}`).value = findings.fourPsBeneficiary ? 'Yes' : 'No';
    }

    if (findings.menarche !== undefined) {
      sheet.getCell(`${column}${dataStartRow + 20}`).value = findings.menarche ? 'Yes' : 'No';
    }

    if (findings.othersSpecify) {
      sheet.getCell(`${column}${dataStartRow + 21}`).value = findings.othersSpecify;
    }

    if (exam.examiner) {
      const examinerName = `${exam.examiner.firstName || ''} ${exam.examiner.lastName || ''}`.trim();
      sheet.getCell(`${column}${dataStartRow + 22}`).value = examinerName;
    }
  });

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Health_Examination_Card_${student.stdId || student.lrn}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  await workbook.xlsx.write(res);
  res.end();
});