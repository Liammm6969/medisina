import mongoose from "mongoose";
import { gradeKeys, healthAlerts, clinicalCategories } from "#utils/constants.js";
import { generateId } from '#utils/crypto.js';
const ExaminationFindingsSchema = new mongoose.Schema({
  dateOfExamination: { type: Date, required: true },
  temperatureBP: String,
  heartRatePulseRateRespiratoryRate: String,
  heightInCm: { type: Number, min: 0, max: 250 },
  weightInKg: { type: Number, min: 0, max: 300 },
  nutritionalStatusBMI: { type: String, },
  nutritionalStatusHeightForAge: { type: String, },
  visionScreening: { type: String, },
  auditoryScreening: { type: String, },
  skinScalp: { type: String, },
  eyesEarsNose: { type: String, },
  mouthThroatNeck: { type: String },
  lungsHeart: { type: String, },
  abdomen: { type: String },
  deformities: { type: String },
  deformitiesSpecify: String,
  ironSupplementation: { type: Boolean },
  deworming: {
    firstRound: { type: Boolean },
    firstRoundDate: { type: Date },
    secondRound: { type: Boolean },
    secondRoundDate: { type: Date }
  },
  immunization: String,
  sbfpBeneficiary: { type: Boolean },
  fourPsBeneficiary: { type: Boolean },
  menarche: { type: Boolean },
  othersSpecify: String,

  overallHealthStatus: {
    type: String,
    enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'],
    default: 'GOOD'
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'LOW'
  },
  healthAlerts: [{
    type: {
      type: String,
      enum: healthAlerts
    },
    severity: {
      type: String,
      enum: ['MILD', 'MODERATE', 'SEVERE']
    },
    description: String,
    recommendedAction: String,
    requiresImmediateAttention: { type: Boolean, default: false }
  }],
  clinicalRecommendations: [{
    category: {
      type: String,
      enum: clinicalCategories
    },
    description: String,
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    },
    targetDate: Date,
    assignedTo: {
      type: String,
      enum: ['NURSE', 'DOCTOR', 'TEACHER', 'NUTRITIONIST']
    }
  }],
  flaggedConditions: [{
    condition: String,
    code: String,
    description: String,
    requiresMonitoring: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now }
  }]
}, { _id: false });

const SchoolHealthExamCardSchema = new mongoose.Schema({
  shecId: { type: String, unique: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  examinations: [{
    grade: { type: String, enum: gradeKeys, required: true },
    findings: { type: ExaminationFindingsSchema },
    examiner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isApproved: { type: Boolean, default: false },
    approvedAt: Date,
    remarks: String,
    complaint: String,
    treatment: { type: String },
    attachmentUrl: { type: String },
    attachmentName: { type: String },
    attachmentType: { type: String },
    attachmentSize: { type: Number },
    attachmentMimeType: { type: String },
    cloudinaryPublicId: { type: String }
  }],

  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDeleted: { type: Boolean, default: false, index: true },

}, {
  timestamps: true,
  collection: "school_health_exam_cards"
});

SchoolHealthExamCardSchema.index({ "examinations.grade": 1 });
SchoolHealthExamCardSchema.index({ updatedAt: -1 });
SchoolHealthExamCardSchema.index({ student: 1, isDeleted: 1 });
SchoolHealthExamCardSchema.index({ "examinations.isApproved": 1, isDeleted: 1 });
SchoolHealthExamCardSchema.index({ student: 1 });
SchoolHealthExamCardSchema.index({ "examinations.findings.dateOfExamination": 1 });

SchoolHealthExamCardSchema.pre("save", async function (next) {
  if (this.isNew) {
    this.shecId = generateId('SHEC')
  }


  next();
});



SchoolHealthExamCardSchema.methods.getLatestExamination = function () {
  if (!this.examinations.length) return null;
  return this.examinations.reduce((latest, exam) =>
    !latest || new Date(exam.findings.dateOfExamination) > new Date(latest.findings.dateOfExamination)
      ? exam
      : latest
    , null);
};

SchoolHealthExamCardSchema.methods.getAllExaminationsWithDates = function () {
  return this.examinations
    .filter(exam => exam.findings?.dateOfExamination)
    .sort((a, b) => new Date(a.findings.dateOfExamination) - new Date(b.findings.dateOfExamination));
};

SchoolHealthExamCardSchema.methods.generateHealthAssessment = async function (dssService) {
  const latestExam = this.getLatestExamination();
  if (!latestExam) return this.getDefaultHealthAssessment();

  const findings = latestExam.findings;

  if (!dssService) {
    console.warn('DSS Service not provided, using basic assessment');
    return this.generateBasicHealthAssessment(findings);
  }

  try {
    const dssInput = dssService.mapExamToDSSInput(findings);
    const dssReport = dssService.generateStudentReport(dssInput);

    const mappedResult = this.mapDSSReportToSchema(dssReport, findings);

    findings.overallHealthStatus = mappedResult.overallHealthStatus;
    findings.riskLevel = mappedResult.riskLevel;
    findings.healthAlerts = mappedResult.healthAlerts;
    findings.clinicalRecommendations = mappedResult.clinicalRecommendations;
    findings.flaggedConditions = mappedResult.flaggedConditions;

    return {
      overallHealthStatus: mappedResult.overallHealthStatus,
      riskLevel: mappedResult.riskLevel,
      alertCount: mappedResult.healthAlerts?.length || 0,
      recommendationCount: mappedResult.clinicalRecommendations?.length || 0,
      requiresImmediateAttention: mappedResult.healthAlerts?.some(alert => alert.requiresImmediateAttention) || false,
      dssReport
    };

  } catch (error) {
    console.error('DSS Service error:', error);
    return this.generateBasicHealthAssessment(findings);
  }
};
SchoolHealthExamCardSchema.methods.mapDSSReportToSchema = function (dssReport, findings = null) {
  const alerts = [];
  const recommendations = [];
  const flaggedConditions = [];

  if (dssReport.nutrition && dssReport.nutrition.length > 0) {
    dssReport.nutrition.forEach(item => {
      alerts.push({
        type: 'NUTRITIONAL',
        severity: this.getDSSItemSeverity(item.flag),
        description: item.flag,
        recommendedAction: item.recommendation,
        requiresImmediateAttention: item.flag.includes('Severely') || item.flag.includes('Risk')
      });

      recommendations.push({
        category: 'NUTRITION',
        description: item.recommendation,
        priority: this.getDSSItemPriority(item.flag),
        targetDate: this.calculateTargetDate(item.flag),
        assignedTo: this.getAssigneeForRecommendation(item.recommendation)
      });

      if (item.flag.includes('Risk') || item.flag.includes('Delay')) {
        flaggedConditions.push({
          condition: item.flag,
          code: (findings && findings.nutritionalStatusBMI) || 'N/A',
          description: item.recommendation,
          requiresMonitoring: true
        });
      }
    });
  }

  // Map vision/hearing findings
  if (dssReport.visionHearing && dssReport.visionHearing.length > 0) {
    dssReport.visionHearing.forEach(item => {
      alerts.push({
        type: item.flag.includes('Vision') ? 'VISION' : 'HEARING',
        severity: 'MODERATE',
        description: item.flag,
        recommendedAction: item.recommendation,
        requiresImmediateAttention: false
      });

      recommendations.push({
        category: 'REFERRAL',
        description: item.recommendation,
        priority: 'HIGH',
        targetDate: this.calculateTargetDate(item.flag),
        assignedTo: 'DOCTOR'
      });
    });
  }

  // Map communicable disease findings
  if (dssReport.communicable && dssReport.communicable.length > 0) {
    dssReport.communicable.forEach(item => {
      alerts.push({
        type: 'INFECTION',
        severity: item.flag.includes('Cardiac') || item.flag.includes('Respiratory') ? 'SEVERE' : 'MODERATE',
        description: item.flag,
        recommendedAction: item.recommendation,
        requiresImmediateAttention: item.flag.includes('Cardiac') || item.flag.includes('Respiratory')
      });

      recommendations.push({
        category: item.flag.includes('Cardiac') || item.flag.includes('Respiratory') ? 'REFERRAL' : 'MEDICATION',
        description: item.recommendation,
        priority: item.flag.includes('Cardiac') || item.flag.includes('Respiratory') ? 'URGENT' : 'MEDIUM',
        targetDate: this.calculateTargetDate(item.flag),
        assignedTo: item.flag.includes('referral') ? 'DOCTOR' : 'NURSE'
      });
    });
  }

  // Map preventive care findings
  if (dssReport.preventiveCare && dssReport.preventiveCare.length > 0) {
    dssReport.preventiveCare.forEach(item => {
      alerts.push({
        type: 'OTHER',
        severity: 'MILD',
        description: item.flag,
        recommendedAction: item.recommendation,
        requiresImmediateAttention: false
      });

      recommendations.push({
        category: item.flag.includes('Immunization') ? 'IMMUNIZATION' : 'LIFESTYLE',
        description: item.recommendation,
        priority: 'MEDIUM',
        targetDate: this.calculateTargetDate(item.flag),
        assignedTo: 'NURSE'
      });
    });
  }

  // Determine overall health status based on risk level
  const overallHealthStatus = this.mapRiskLevelToHealthStatus(dssReport.riskLevel);

  return {
    overallHealthStatus,
    riskLevel: this.mapDSSRiskLevel(dssReport.riskLevel),
    healthAlerts: alerts,
    clinicalRecommendations: recommendations,
    flaggedConditions: flaggedConditions
  };
};

SchoolHealthExamCardSchema.methods.getDSSItemSeverity = function (flag) {
  if (flag.includes('Severely') || flag.includes('Abnormal') || flag.includes('Failed')) return 'SEVERE';
  if (flag.includes('Risk') || flag.includes('Problem') || flag.includes('Disease')) return 'MODERATE';
  return 'MILD';
};

SchoolHealthExamCardSchema.methods.getDSSItemPriority = function (flag) {
  if (flag.includes('Severely') || flag.includes('Cardiac') || flag.includes('Respiratory')) return 'URGENT';
  if (flag.includes('Risk') || flag.includes('Problem') || flag.includes('Failed')) return 'HIGH';
  return 'MEDIUM';
};

SchoolHealthExamCardSchema.methods.calculateTargetDate = function (flag) {
  const now = new Date();
  if (flag.includes('Severely') || flag.includes('Cardiac') || flag.includes('Respiratory')) {
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
  }
  if (flag.includes('Risk') || flag.includes('Problem') || flag.includes('Failed')) {
    return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
  }
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
};

SchoolHealthExamCardSchema.methods.getAssigneeForRecommendation = function (recommendation) {
  if (recommendation.toLowerCase().includes('refer') || recommendation.toLowerCase().includes('doctor')) return 'DOCTOR';
  if (recommendation.toLowerCase().includes('nutrition')) return 'NUTRITIONIST';
  return 'NURSE';
};

SchoolHealthExamCardSchema.methods.mapRiskLevelToHealthStatus = function (riskLevel) {
  const riskMap = {
    'High Risk': 'POOR',
    'Medium Risk': 'FAIR',
    'Low Risk': 'GOOD',
    'Unclassified': 'FAIR'
  };
  return riskMap[riskLevel] || 'GOOD';
};

SchoolHealthExamCardSchema.methods.mapDSSRiskLevel = function (dssRiskLevel) {
  const riskMap = {
    'High Risk': 'HIGH',
    'Medium Risk': 'MEDIUM',
    'Low Risk': 'LOW',
    'Unclassified': 'MEDIUM'
  };
  return riskMap[dssRiskLevel] || 'LOW';
};
SchoolHealthExamCardSchema.methods.getCurrentFindings = function () {
  const latestExam = this.getLatestExamination();
  return latestExam ? latestExam.findings : null;
};
SchoolHealthExamCardSchema.methods.generateBasicHealthAssessment = function () {
  const findings = this.getCurrentFindings();
  if (!findings) return this.getDefaultHealthAssessment();

  let overallRisk = 'LOW';
  const healthAlerts = [];
  const recommendations = [];

  if (findings.nutritionalStatusBMI === 'Severely Wasted/Underweight' ||
    findings.nutritionalStatusBMI === 'Severely wasted' ||
    findings.nutritionalStatusHeightForAge === 'Severely Stunted') {
    overallRisk = 'URGENT';
    healthAlerts.push({
      type: 'NUTRITIONAL',
      severity: 'SEVERE',
      description: 'Severe malnutrition detected',
      recommendedAction: 'Immediate medical referral required',
      requiresImmediateAttention: true
    });
  }

  if (findings.lungsHeart === 'Irregular heart rate' ||
    findings.lungsHeart === 'Murmur') {
    overallRisk = 'URGENT';
    healthAlerts.push({
      type: 'CARDIAC',
      severity: 'SEVERE',
      description: 'Cardiac abnormality detected',
      recommendedAction: 'Emergency cardiac evaluation',
      requiresImmediateAttention: true
    });
  }

  findings.overallHealthStatus = this.calculateOverallHealthStatus(overallRisk, healthAlerts);
  findings.riskLevel = overallRisk;
  findings.healthAlerts = healthAlerts;
  findings.clinicalRecommendations = recommendations;
  findings.flaggedConditions = [];

  return {
    overallHealthStatus: findings.overallHealthStatus,
    riskLevel: overallRisk,
    alertCount: healthAlerts.length,
    recommendationCount: recommendations.length,
    requiresImmediateAttention: healthAlerts.some(a => a.requiresImmediateAttention)
  };
};


SchoolHealthExamCardSchema.methods.getDefaultHealthAssessment = function () {
  const exam = this.getLatestExamination();
  if (!exam) {
    return { overallHealthStatus: 'GOOD', riskLevel: 'LOW', alertCount: 0, recommendationCount: 0, requiresImmediateAttention: false };
  }

  exam.findings.overallHealthStatus = 'GOOD';
  exam.findings.riskLevel = 'LOW';
  exam.findings.healthAlerts = [];
  exam.findings.clinicalRecommendations = [];
  exam.findings.flaggedConditions = [];

  return {
    overallHealthStatus: 'GOOD',
    riskLevel: 'LOW',
    alertCount: 0,
    recommendationCount: 0,
    requiresImmediateAttention: false
  };
};



SchoolHealthExamCardSchema.methods.calculateOverallHealthStatus = function (riskLevel, healthAlerts) {
  const criticalAlerts = healthAlerts.filter(alert => alert.severity === 'SEVERE').length;
  const moderateAlerts = healthAlerts.filter(alert => alert.severity === 'MODERATE').length;

  if (riskLevel === 'URGENT' || criticalAlerts > 0) return 'CRITICAL';
  if (riskLevel === 'HIGH' || criticalAlerts > 1) return 'POOR';
  if (riskLevel === 'MEDIUM' || moderateAlerts > 2) return 'FAIR';
  if (moderateAlerts > 0) return 'GOOD';
  return 'EXCELLENT';
};

SchoolHealthExamCardSchema.methods.getHealthSummary = function () {
  const exam = this.getLatestExamination();
  if (!exam) return null;

  const f = exam.findings;

  return {
    studentId: this.student,
    grade: exam.grade,
    examinationDate: f.dateOfExamination,
    overallStatus: f.overallHealthStatus || 'GOOD',
    riskLevel: f.riskLevel || 'LOW',
    alertCount: f.healthAlerts?.length || 0,
    urgentAlerts: f.healthAlerts?.filter(a => a.requiresImmediateAttention).length || 0,
    pendingRecommendations: f.clinicalRecommendations?.filter(r => r.priority === 'URGENT' || r.priority === 'HIGH').length || 0,
    flaggedConditionsCount: f.flaggedConditions?.length || 0
  };
};
SchoolHealthExamCardSchema.methods.getPriorityActions = function () {
  const findings = this.getCurrentFindings();
  if (!findings) return { immediateActions: [], priorityRecommendations: [] };

  const urgentRecommendations = findings.clinicalRecommendations?.filter(rec =>
    rec.priority === 'URGENT' || rec.priority === 'HIGH'
  ) || [];

  const immediateAlerts = findings.healthAlerts?.filter(alert =>
    alert.requiresImmediateAttention
  ) || [];

  return {
    immediateActions: immediateAlerts.map(alert => ({
      type: 'ALERT',
      description: alert.description,
      action: alert.recommendedAction,
      category: alert.type
    })),
    priorityRecommendations: urgentRecommendations.map(rec => ({
      type: 'RECOMMENDATION',
      description: rec.description,
      priority: rec.priority,
      assignedTo: rec.assignedTo,
      targetDate: rec.targetDate,
      category: rec.category
    }))
  };
};

const SchoolHealthExamCardModel = mongoose.model("SchoolHealthExamCard", SchoolHealthExamCardSchema);
export default SchoolHealthExamCardModel;
