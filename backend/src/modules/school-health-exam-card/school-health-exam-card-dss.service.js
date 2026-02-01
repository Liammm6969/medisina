
import { Engine } from 'json-rules-engine';
import { allRules } from './health-analysis.rules.js';
import { limitedAll } from '#utils/concurrency.js';


class SchoolHealthDSSService {
  constructor() {
    this.skinInfectionConditions = [
      'Redness of Skin',
      'White Spots',
      'Flaky Skin',
      'Impetigo/boil',
      'Hematoma',
      'Bruises/Injuries',
      'Itchiness',
      'Skin Lesions',
      'Acne/Pimple'
    ];

    this.heartLungAbnormal = ['Rales', 'Wheeze', 'Murmur', 'Irregular heart rate'];

    this.bmiMap = {
      normal: ['Normal Weight', 'Normal'],
      wasted: ['Wasted/Underweight', 'Wasted', 'Underweight'],
      severelyWasted: ['Severely Wasted/Underweight', 'Severely Wasted'],
      overweight: ['Overweight'],
      obese: ['Obese']
    };

    this.initializeEngines();
  }

  initializeEngines() {
    this.engines = {
      nutrition: new Engine(),
      visionHearing: new Engine(),
      communicableDisease: new Engine(),
      preventiveCare: new Engine(),
      riskStratification: new Engine()
    };

    try {
      if (allRules.nutritional) {
        allRules.nutritional.forEach(rule => this.engines.nutrition.addRule(rule));
      }
      if (allRules.screening) {
        allRules.screening.forEach(rule => this.engines.visionHearing.addRule(rule));
      }
      if (allRules.physical) {
        allRules.physical.forEach(rule => this.engines.communicableDisease.addRule(rule));
      }
      if (allRules.preventiveCare) {
        allRules.preventiveCare.forEach(rule => this.engines.preventiveCare.addRule(rule));
      }
      if (allRules.riskStratification) {
        allRules.riskStratification.forEach(rule => this.engines.riskStratification.addRule(rule));
      }
    } catch (error) {
      throw error;
    }
  }

  sanitizeFacts(facts) {
    const defaultFacts = {
      bmiForAge: 'Normal',
      heightForAge: 'Normal',
      nutritionalStatusBMI: 'Normal',
      nutritionalStatusHeightForAge: 'Normal',
      heightInCm: 0,
      weightInKg: 0,
      weightStatus: 'Normal',

      vision: 'Normal',
      visionScreening: 'Normal',
      auditoryScreening: 'Normal',

      lice: false,
      boils: false,
      scabies: false,
      skinInfection: false,
      skinScalp: 'Normal',
      heartFindings: 'Normal',
      lungFindings: 'Normal',
      lungsHeart: 'Normal',
      eyesEarsNose: 'Normal',
      mouthThroatNeck: 'Normal',
      abdomen: 'Normal',
      deformities: 'Normal',
      tonsils: 'Normal',

      immunization: '',
      deworming: false,
      dewormingFirstRound: false,
      dewormingSecondRound: false,
      ironSupplementation: false,

      riskLevel: 'Low'
    };

    // Remove undefined values from facts to prevent overwriting defaults
    const cleanedFacts = {};
    Object.keys(facts || {}).forEach(key => {
      if (facts[key] !== undefined) {
        cleanedFacts[key] = facts[key];
      }
    });

    const mergedFacts = { ...defaultFacts, ...cleanedFacts };

    mergedFacts.lice = !!mergedFacts.lice;
    mergedFacts.boils = !!mergedFacts.boils;
    mergedFacts.scabies = !!mergedFacts.scabies;
    mergedFacts.skinInfection = !!mergedFacts.skinInfection;
    mergedFacts.deworming = !!mergedFacts.deworming;
    mergedFacts.dewormingFirstRound = !!mergedFacts.dewormingFirstRound;
    mergedFacts.dewormingSecondRound = !!mergedFacts.dewormingSecondRound;
    mergedFacts.ironSupplementation = !!mergedFacts.ironSupplementation;

    const stringFields = ['bmiForAge', 'heightForAge', 'nutritionalStatusBMI', 'nutritionalStatusHeightForAge', 'weightStatus', 'vision', 'visionScreening', 'auditoryScreening', 'skinScalp', 'heartFindings', 'lungFindings', 'lungsHeart', 'eyesEarsNose', 'mouthThroatNeck', 'abdomen', 'deformities', 'tonsils'];
    stringFields.forEach(field => {
      if (!mergedFacts[field] || (typeof mergedFacts[field] === 'string' && mergedFacts[field].trim() === '')) {
        mergedFacts[field] = defaultFacts[field];
      }
    });

    mergedFacts.heightInCm = typeof mergedFacts.heightInCm === 'number' ? mergedFacts.heightInCm : 0;
    mergedFacts.weightInKg = typeof mergedFacts.weightInKg === 'number' ? mergedFacts.weightInKg : 0;

    if (mergedFacts.lice) {
      mergedFacts.skinScalp = 'Presence of Lice';
    } else if (mergedFacts.boils) {
      mergedFacts.skinScalp = 'Impetigo/boil';
    } else if (mergedFacts.scabies) {
      mergedFacts.skinScalp = 'Itchiness';
    }

    mergedFacts.lungsHeart = (mergedFacts.heartFindings === 'Abnormal' || mergedFacts.lungFindings === 'Abnormal') ? 'Abnormal' : 'Normal';

    mergedFacts.nutritionalStatusBMI = mergedFacts.bmiForAge;
    mergedFacts.nutritionalStatusHeightForAge = mergedFacts.heightForAge;
    mergedFacts.visionScreening = mergedFacts.vision;

    return mergedFacts;
  }

  mapExamToDSSInput(examRecord) {
    if (!examRecord) return {};
    const student = examRecord.student || {};
    const gradeLevel = examRecord.grade;
    const findings = examRecord.findings || examRecord;
    const examiner = examRecord.examiner;
    const rawData = {
      bmiForAge: findings.nutritionalStatusBMI,
      heightForAge: findings.nutritionalStatusHeightForAge,
      heightInCm: findings.heightInCm,
      weightInKg: findings.weightInKg,
      weightStatus: findings.nutritionalStatusBMI,
      vision: findings.visionScreening,
      visionScreening: findings.visionScreening,
      auditoryScreening: findings.auditoryScreening,
      lice: findings.skinScalp === 'Presence of Lice',
      boils: findings.skinScalp === 'Impetigo/boil',
      scabies: findings.skinScalp === 'Itchiness',
      skinInfection: this.skinInfectionConditions.includes(findings.skinScalp || ''),
      skinScalp: findings.skinScalp,
      heartFindings: this.heartLungAbnormal.includes(findings.lungsHeart || '') ? 'Abnormal' : 'Normal',
      lungFindings: this.heartLungAbnormal.includes(findings.lungsHeart || '') ? 'Abnormal' : 'Normal',
      lungsHeart: findings.lungsHeart,
      eyesEarsNose: findings.eyesEarsNose,
      mouthThroatNeck: findings.mouthThroatNeck,
      abdomen: findings.abdomen,
      deformities: findings.deformities,
      tonsils: (findings.mouthThroatNeck === 'Enlarged tonsils') ? 'Enlarged' : 'Normal',
      immunization: findings.immunization?.toLowerCase().includes('incomplete') ? 'Incomplete' : 'Complete',
      deworming: !!(findings.deworming?.firstRound || findings.deworming?.secondRound),
      dewormingFirstRound: !!findings.deworming?.firstRound,
      dewormingSecondRound: !!findings.deworming?.secondRound,
      ironSupplementation: !!findings.ironSupplementation
    };

    const sanitizedData = this.sanitizeFacts(rawData);
    const schoolId = student.schoolId ?? examRecord.schoolId ?? null;
    return {
      id: student.id,
      studentId: student.stdId,
      studentLRN: student.lrn,
      schoolName: student.schoolName,
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      gradeLevel,
      analyzedAt: examRecord.updatedAt || examRecord.createdAt || new Date(),
      examiner: examiner,
      isApproved: examRecord.isApproved,
      approvedBy: examRecord.approvedBy,
      approvedAt: examRecord.approvedAt,
      remarks: examRecord.remarks,
      schoolId: schoolId,
      ...sanitizedData
    };
  }

  async generateStudentReport(studentExamData) {
    const [nutrition, visionHearing, communicable, preventiveCare, riskLevel] = await limitedAll([
      () => this.analyzeNutrition(studentExamData),
      () => this.analyzeVisionHearing(studentExamData),
      () => this.analyzeCommunicable(studentExamData),
      () => this.analyzePreventiveCare(studentExamData),
      () => this.stratifyRisk(studentExamData)
    ], 3);
    return {
      studentId: studentExamData.studentId,
      studentLRN: studentExamData.studentLRN,
      schoolId: studentExamData.schoolId,
      schoolName: studentExamData.schoolName,
      studentName: studentExamData.studentName,
      gradeLevel: studentExamData.gradeLevel,
      analyzedAt: studentExamData.analyzedAt,
      nutrition,
      visionHearing,
      communicable,
      preventiveCare,
      riskLevel,
      isApproved: studentExamData.isApproved,
      remarks: studentExamData.remarks,
      dewormingFirstRound: studentExamData.dewormingFirstRound,
      dewormingSecondRound: studentExamData.dewormingSecondRound
    };
  }

  async analyzeSchoolHealthRecords(records) {
    const recordArray = Array.isArray(records) ? records : [records];
    const examDataArray = [];

    recordArray.forEach(record => {
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
          examDataArray.push(this.mapExamToDSSInput(examRecord));
        });
      } else {
        examDataArray.push(this.mapExamToDSSInput(record));
      }
    });

    const reports = await limitedAll(
      examDataArray.map(data => () => this.generateStudentReport(data)),
      5
    );
    const summary = await this.generateSchoolSummary(examDataArray);
    const insights = await this.generatePredictiveInsights(examDataArray);
    return { reports, summary, insights };
  }

  async analyzeNutrition(data) {
    try {
      const sanitizedFacts = this.sanitizeFacts(data || {});
      const results = await this.engines.nutrition.run(sanitizedFacts);
      return results.events.map(event => ({
        flag: event.params.flag,
        recommendation: event.params.recommendation
      }));
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error running nutrition rules:`, error.message);
      throw error;
    }
  }

  async analyzeVisionHearing(data) {
    try {
      const sanitizedFacts = this.sanitizeFacts(data || {});

      const results = await this.engines.visionHearing.run(sanitizedFacts);
      const flags = results.events.map(event => ({
        flag: event.params.flag,
        recommendation: event.params.recommendation
      }));
      return flags;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error running vision/hearing rules:`, error.message);
      throw error;
    }
  }

  async analyzeCommunicable(data) {
    try {
      const sanitizedFacts = this.sanitizeFacts(data || {});
      const results = await this.engines.communicableDisease.run(sanitizedFacts);
      const uniqueResults = [];
      const seenFlags = new Set();

      for (const event of results.events) {
        if (!seenFlags.has(event.params.flag)) {
          seenFlags.add(event.params.flag);
          uniqueResults.push({
            flag: event.params.flag,
            recommendation: event.params.recommendation
          });
        }
      }

      return uniqueResults;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error running physical rules:`, error.message);
      console.error('mouthThroatNeck in data:', data?.mouthThroatNeck);
      throw error;
    }
  }
  async analyzePreventiveCare(data) {
    try {
      const sanitizedFacts = this.sanitizeFacts(data || {});
      const results = await this.engines.preventiveCare.run(sanitizedFacts);
      return results.events.map(event => ({
        flag: event.params.flag,
        recommendation: event.params.recommendation
      }));
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error running preventive care rules:`, error.message);
      throw error;
    }
  }

  async stratifyRisk(data) {
    try {
      const sanitizedFacts = this.sanitizeFacts(data || {});
      const results = await this.engines.riskStratification.run(sanitizedFacts);

      const sortedEvents = results.events.sort((a, b) => a.params.priority - b.params.priority);

      return sortedEvents.length > 0 ? sortedEvents[0].params.riskLevel : 'Unclassified';
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error running risk stratification rules:`, error.message);
      return 'Unclassified';
    }
  }

  async generateSchoolSummary(examDataArray) {
    const summary = {
      total: examDataArray.length,
      bmiCategories: { normal: 0, wasted: 0, severelyWasted: 0, overweight: 0, obese: 0, unknown: 0 },
      visionIssues: 0,
      hearingIssues: 0,
      notDewormed: 0,
      notDewormedFirstRound: 0,
      notDewormedSecondRound: 0,
      immunizationIncomplete: 0,
      pendingApproval: 0,
      approved: 0,
      sicknessCounts: {
        lice: 0,
        boils: 0,
        scabies: 0,
        skinInfection: 0,
        trauma: 0,
        enlargedTonsils: 0,
        heartAbnormal: 0,
        lungAbnormal: 0,
        paleConjunctiva: 0,
        enlargedLymphnodes: 0,
        abdominalIssues: 0,
        dysmenorrhea: 0
      },
      riskDistribution: {
        'High Risk': 0,
        'Medium Risk': 0,
        'Low Risk': 0,
        'Unclassified': 0
      }
    };

    if (summary.total === 0) return summary;

    const riskPromises = examDataArray.map(data =>
      data ? this.stratifyRisk(data) : Promise.resolve('Unclassified')
    );
    const riskLevels = await Promise.all(riskPromises);

    examDataArray.forEach((data, index) => {
      if (!data) return;

      let matched = false;
      for (const [key, values] of Object.entries(this.bmiMap)) {
        if (values.includes(data.bmiForAge)) {
          summary.bmiCategories[key]++;
          matched = true;
          break;
        }
      }
      if (!matched) summary.bmiCategories.unknown++;

      if (data.vision === 'Failed') summary.visionIssues++;
      if (data.auditoryScreening === 'Failed') summary.hearingIssues++;
      if (!data.deworming) summary.notDewormed++;
      if (!data.dewormingFirstRound) summary.notDewormedFirstRound++;
      if (!data.dewormingSecondRound) summary.notDewormedSecondRound++;
      if (!data.immunization || data.immunization === 'Incomplete') summary.immunizationIncomplete++;

      if (data.isApproved === true) {
        summary.approved++;
      } else if (data.isApproved === false) {
        summary.pendingApproval++;
      } else {
        summary.pendingApproval++;
      }

      if (data.lice) summary.sicknessCounts.lice++;
      if (data.boils) summary.sicknessCounts.boils++;
      if (data.scabies) summary.sicknessCounts.scabies++;
      if (data.skinInfection) summary.sicknessCounts.skinInfection++;
      if (['Hematoma', 'Bruises/Injuries'].includes(data.skinScalp)) summary.sicknessCounts.trauma++;
      if (data.tonsils === 'Enlarged') summary.sicknessCounts.enlargedTonsils++;
      if (data.heartFindings === 'Abnormal') summary.sicknessCounts.heartAbnormal++;
      if (data.lungFindings === 'Abnormal') summary.sicknessCounts.lungAbnormal++;
      if (data.eyesEarsNose === 'Pale Conjunctiva') summary.sicknessCounts.paleConjunctiva++;
      if (data.mouthThroatNeck === 'Enlarged lymphnodes') summary.sicknessCounts.enlargedLymphnodes++;
      if (['Distended', 'Abdominal Pain', 'Tenderness'].includes(data.abdomen)) summary.sicknessCounts.abdominalIssues++;
      if (data.abdomen === 'Dysmenorrhea') summary.sicknessCounts.dysmenorrhea++;

      const risk = riskLevels[index];
      summary.riskDistribution[risk]++;
    });

    summary.bmiCategoryPercent = Object.fromEntries(
      Object.entries(summary.bmiCategories).map(([key, value]) =>
        [key, Math.round((value / summary.total) * 100)]
      )
    );
    summary.visionIssuesPercent = Math.round((summary.visionIssues / summary.total) * 100);
    summary.hearingIssuesPercent = Math.round((summary.hearingIssues / summary.total) * 100);
    summary.notDewormedPercent = Math.round((summary.notDewormed / summary.total) * 100);
    summary.notDewormedFirstRoundPercent = Math.round((summary.notDewormedFirstRound / summary.total) * 100);
    summary.notDewormedSecondRoundPercent = Math.round((summary.notDewormedSecondRound / summary.total) * 100);
    summary.immunizationIncompletePercent = Math.round((summary.immunizationIncomplete / summary.total) * 100);
    summary.pendingApprovalPercent = Math.round((summary.pendingApproval / summary.total) * 100);
    summary.approvedPercent = Math.round((summary.approved / summary.total) * 100);

    summary.riskDistributionPercent = Object.fromEntries(
      Object.entries(summary.riskDistribution).map(([key, value]) =>
        [key, Math.round((value / summary.total) * 100)]
      )
    );

    return summary;
  }

  async generatePredictiveInsights(examDataArray) {
    const summary = await this.generateSchoolSummary(examDataArray);
    const insights = [];

    if (!summary || summary.total === 0 || !summary.bmiCategoryPercent) {
      return insights;
    }

    const undernourishedPercent = (summary.bmiCategoryPercent.severelyWasted || 0) + (summary.bmiCategoryPercent.wasted || 0);
    if (undernourishedPercent > 20) {
      insights.push(`${undernourishedPercent}% of students at risk of malnutrition → prioritize feeding program.`);
    }

    const overnourishedPercent = (summary.bmiCategoryPercent.overweight || 0) + (summary.bmiCategoryPercent.obese || 0);
    if (overnourishedPercent > 15) {
      insights.push(`${overnourishedPercent}% of students are overweight/obese → implement nutrition education and physical activity programs.`);
    }

    if ((summary.visionIssuesPercent || 0) > 10) {
      insights.push(`${summary.visionIssuesPercent}% of students with vision issues → prioritize eye screening and eyeglass provision.`);
    }

    if ((summary.hearingIssuesPercent || 0) > 5) {
      insights.push(`${summary.hearingIssuesPercent}% of students with hearing issues → prioritize ENT screening.`);
    }

    if ((summary.notDewormedPercent || 0) > 10) {
      insights.push(`${summary.notDewormedPercent}% of students not dewormed → schedule mass deworming campaign.`);
    }

    if ((summary.immunizationIncompletePercent || 0) > 10) {
      insights.push(`${summary.immunizationIncompletePercent}% of students with incomplete immunization → conduct vaccination drive.`);
    }

    if (summary.riskDistributionPercent && (summary.riskDistributionPercent['High Risk'] || 0) > 10) {
      insights.push(`${summary.riskDistributionPercent['High Risk']}% of students are high-risk → immediate medical attention required.`);
    }

    if ((summary.pendingApprovalPercent || 0) > 30) {
      insights.push(`${summary.pendingApprovalPercent}% of examinations pending approval → expedite medical review process.`);
    }

    return insights;
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

}
export default new SchoolHealthDSSService();
