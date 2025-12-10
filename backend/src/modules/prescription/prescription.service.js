import Prescription from './prescription.model.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import notificationService from '../notifications/notification.service.js';
import { NOTIFICATION_TYPES, PRIORITY_LEVELS, NOTIFICATION_TITLE } from '#utils/constants.js';
// import cache from '#utils/cache.js';
// import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import Student from '../student/student.model.js';
import SchoolHealthExamCard from '../school-health-exam-card/school-health-exam-card.model.js';
import Personnel from '../personnel/personnel.model.js';
import PersonnelHealthCard from '../personnel-health-card/personnel-health-card.model.js';

class PrescriptionService {

  async createPrescription(prescriptionData, userId) {
    const hardcodedDoctorInfo = {
      doctorName: 'RYAN CHRISTOPHER A. BUCCAT',
      doctorTitle: 'MD, MMPHA',
      doctorSpecialty: 'General Practitioner',
      clinicAddress: 'Bonifacio Street, Brgy District IV, Bayombong, Nueva Vizcaya',
      licenseNumber: '#0169767'
    };

    const prescription = await Prescription.create({
      ...prescriptionData,
      ...hardcodedDoctorInfo,
      prescribedBy: userId
    });

    await prescription.populate([
      { path: 'prescribedBy', select: 'firstName lastName role' }
    ]);

    // Send notification to prescriber
    try {
      await notificationService.createNotification({
        recipientId: userId,
        title: NOTIFICATION_TITLE.PRESCRIPTION || 'PRESCRIPTION',
        message: `New prescription created for ${prescriptionData.patientName}`,
        type: NOTIFICATION_TYPES.RECORD_CREATED,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    } catch (error) {
      logger.warn('Failed to send prescription creation notification:', error);
    }

    //     await cache.delPattern('prescriptions:*');
    return prescription;
  }

  async getPrescriptionById(prescriptionId) {
    const cacheKey = `prescriptions:${prescriptionId}`;

    //     try {
    //       const cached = await cache.get(cacheKey);
    //       if (cached) return cached;
    // } catch (error) {
    //   logger.warn('Cache get failed', error);
    // }

    const prescription = await Prescription.findOne({ prescriptionId, isDeleted: false })
      .populate('prescribedBy', 'firstName lastName role')
      .populate('attendingExaminer', 'firstName lastName role')
      .lean();

    if (!prescription) {
      throw new ApiError('Prescription not found', StatusCodes.NOT_FOUND);
    }

    //     await cache.set(cacheKey, prescription, CACHE_TTL.MEDIUM);
    return prescription;
  }
  async getAllPrescriptionsByUser(filters = {}) {
    const { patientName, startDate, endDate, attendingExaminer, limit = 50, page = 1 } = filters;
    const query = { isDeleted: false };

    if (attendingExaminer) query.attendingExaminer = attendingExaminer;

    if (patientName) {
      const cleanName = patientName.replace(/[`'".,]/g, '').trim();
      const nameWords = cleanName.split(/\s+/).filter(word => word.length > 0);

      const regexPattern = nameWords.map(word => `(?=.*${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
      query.patientName = { $regex: regexPattern, $options: 'i' };
    }

    if (startDate || endDate) {
      query.prescribedDate = {};
      if (startDate) query.prescribedDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.prescribedDate.$lte = end;
      }
    }

    const skip = (page - 1) * limit;

    const [prescriptions, total] = await Promise.all([
      Prescription.find(query)
        .populate('attendingExaminer', 'firstName lastName role')
        .sort({ prescribedDate: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Prescription.countDocuments(query)
    ]);

    return {
      data: prescriptions,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    };
  }
  async getAllPrescriptions(filters = {}) {
    const { patientName, startDate, endDate, prescribedBy, limit = 50, page = 1 } = filters;

    const query = { isDeleted: false };

    if (prescribedBy) query.prescribedBy = prescribedBy;

    if (patientName) {
      const cleanName = patientName.replace(/[`'".,]/g, '').trim();
      const nameWords = cleanName.split(/\s+/).filter(word => word.length > 0);

      const regexPattern = nameWords.map(word => `(?=.*${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
      query.patientName = { $regex: regexPattern, $options: 'i' };
    }

    if (startDate || endDate) {
      query.prescribedDate = {};
      if (startDate) query.prescribedDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.prescribedDate.$lte = end;
      }
    }

    const skip = (page - 1) * limit;

    const [prescriptions, total] = await Promise.all([
      Prescription.find(query)
        .populate('prescribedBy', 'firstName lastName role')
        .sort({ prescribedDate: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Prescription.countDocuments(query)
    ]);

    return {
      data: prescriptions,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    };
  }

  async updatePrescription(prescriptionId, updateData, userId) {
    const prescription = await Prescription.findOne({ prescriptionId, isDeleted: false });

    if (!prescription) {
      throw new ApiError('Prescription not found', StatusCodes.NOT_FOUND);
    }

    const { doctorName, doctorTitle, doctorSpecialty, clinicAddress, licenseNumber, ...allowedUpdates } = updateData;

    Object.assign(prescription, allowedUpdates);
    await prescription.save();

    await prescription.populate([
      { path: 'prescribedBy', select: 'firstName lastName role' }
    ]);

    // Send notification for prescription update
    try {
      await notificationService.createNotification({
        recipientId: userId,
        title: NOTIFICATION_TITLE.PRESCRIPTION || 'PRESCRIPTION',
        message: `Prescription updated for ${prescription.patientName}`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    } catch (error) {
      logger.warn('Failed to send prescription update notification:', error);
    }

    //     await cache.delPattern('prescriptions:*');
    return prescription;
  }

  async deletePrescription(prescriptionId, userId) {
    const prescription = await Prescription.findOne({ prescriptionId, isDeleted: false });

    if (!prescription) {
      throw new ApiError('Prescription not found', StatusCodes.NOT_FOUND);
    }

    prescription.isDeleted = true;
    prescription.deletedAt = new Date();
    prescription.deletedBy = userId;
    await prescription.save();

    // Send notification for prescription deletion
    try {
      await notificationService.createNotification({
        recipientId: userId,
        title: NOTIFICATION_TITLE.PRESCRIPTION || 'PRESCRIPTION',
        message: `Prescription deleted for ${prescription.patientName}`,
        type: NOTIFICATION_TYPES.RECORD_DELETE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    } catch (error) {
      logger.warn('Failed to send prescription deletion notification:', error);
    }

    //     await cache.delPattern('prescriptions:*');
    return { message: 'Prescription deleted successfully' };
  }

  async getPrescriptionStats(filters = {}) {
    const { startDate, endDate } = filters;

    const matchQuery = { isDeleted: false };

    if (startDate || endDate) {
      matchQuery.prescribedDate = {};
      if (startDate) matchQuery.prescribedDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.prescribedDate.$lte = end;
      }
    }

    const total = await Prescription.countDocuments(matchQuery);

    return {
      total
    };
  }

  async generatePrescriptionFromHealthAlert(studentId) {
    const student = await Student.findOne({ stdId: studentId, isDeleted: false })
      .populate('attendingPersonnel', 'firstName lastName')
      .lean();

    if (!student) {
      throw new ApiError('Student not found', StatusCodes.NOT_FOUND);
    }

    const healthCard = await SchoolHealthExamCard.findOne({
      student: student._id,
      isDeleted: false
    }).lean();

    if (!healthCard || !healthCard.examinations || healthCard.examinations.length === 0) {
      throw new ApiError('No health examination records found for this student', StatusCodes.NOT_FOUND);
    }

    const latestExam = healthCard.examinations.reduce((latest, exam) => {
      if (!latest || new Date(exam.findings?.dateOfExamination) > new Date(latest.findings?.dateOfExamination)) {
        return exam;
      }
      return latest;
    }, null);

    if (!latestExam || !latestExam.findings) {
      throw new ApiError('No examination findings available', StatusCodes.NOT_FOUND);
    }

    const findings = latestExam.findings;
    const healthAlerts = findings.healthAlerts || [];
    const clinicalRecommendations = findings.clinicalRecommendations || [];

    const classification = this.determineClassification(healthAlerts, findings);
    const medications = this.generateMedicationsFromAlerts(healthAlerts, clinicalRecommendations);
    const notes = this.generateNotesFromAlerts(healthAlerts, clinicalRecommendations, findings);

    const age = student.dateOfBirth
      ? Math.floor((new Date() - new Date(student.dateOfBirth)) / 31557600000)
      : null;

    return {
      patientName: student.fullName || `${student.firstName} ${student.lastName}`,
      patientAge: age,
      patientSex: student.gender,
      patientAddress: student.address || '',
      classification: classification,
      medications: medications,
      notes: notes,
      prescribedDate: new Date(),
      studentId: student.stdId,
      studentObjectId: student._id,
      healthExamDate: findings.dateOfExamination,
      riskLevel: findings.riskLevel,
      overallHealthStatus: findings.overallHealthStatus,
      attendingExaminer: latestExam.examiner
    };
  }

  determineClassification(healthAlerts, findings) {
    const nutritionAlerts = healthAlerts.filter(alert => alert.type === 'NUTRITIONAL');
    const visionAlerts = healthAlerts.filter(alert => alert.type === 'VISION');
    const hearingAlerts = healthAlerts.filter(alert => alert.type === 'HEARING');
    const infectionAlerts = healthAlerts.filter(alert => alert.type === 'INFECTION');
    const cardiacAlerts = healthAlerts.filter(alert => alert.type === 'CARDIAC');

    if (cardiacAlerts.length > 0 || infectionAlerts.some(a => a.severity === 'SEVERE')) {
      return 'Medical Emergency - Immediate Referral Required';
    }
    if (infectionAlerts.length > 0) {
      return 'Communicable Disease Treatment';
    }
    if (nutritionAlerts.some(a => a.severity === 'SEVERE')) {
      return 'Severe Malnutrition - Nutritional Intervention';
    }
    if (nutritionAlerts.length > 0) {
      return 'Nutritional Support and Monitoring';
    }
    if (visionAlerts.length > 0 || hearingAlerts.length > 0) {
      return 'Vision/Hearing Support';
    }
    if (!findings.deworming) {
      return 'Preventive Care - Deworming';
    }

    return 'General Health Maintenance';
  }

  generateMedicationsFromAlerts(healthAlerts, clinicalRecommendations) {
    const medications = [];
    let itemNumber = 1;

    const medicationRecommendations = clinicalRecommendations.filter(
      rec => rec.category === 'MEDICATION' || rec.description?.toLowerCase().includes('medication')
    );

    healthAlerts.forEach(alert => {
      if (alert.type === 'NUTRITIONAL' && alert.severity === 'SEVERE') {
        medications.push({
          itemNumber: itemNumber++,
          medicationName: 'Multivitamins with Iron',
          signature: 'Take 1 capsule once daily after meals',
          quantity: '30 capsules'
        });
      }

      if (alert.type === 'INFECTION') {
        if (alert.description?.toLowerCase().includes('skin')) {
          medications.push({
            itemNumber: itemNumber++,
            medicationName: 'Antibiotic Ointment',
            signature: 'Apply to affected area twice daily',
            quantity: '1 tube (15g)'
          });
        }
      }
    });

    if (medications.length === 0) {
      medications.push({
        itemNumber: 1,
        medicationName: 'As per clinical assessment',
        signature: 'To be determined during consultation',
        quantity: 'TBD'
      });
    }

    return medications;
  }

  generateNotesFromAlerts(healthAlerts, clinicalRecommendations, findings) {
    const notes = [];

    notes.push('HEALTH ASSESSMENT SUMMARY:');
    notes.push(`Risk Level: ${findings.riskLevel || 'Unclassified'}`);
    notes.push(`Overall Status: ${findings.overallHealthStatus || 'N/A'}`);
    notes.push('');

    if (healthAlerts.length > 0) {
      notes.push('IDENTIFIED HEALTH CONCERNS:');
      healthAlerts.forEach((alert, index) => {
        notes.push(`${index + 1}. ${alert.description} (${alert.severity})`);
        if (alert.recommendedAction) {
          notes.push(`   Action: ${alert.recommendedAction}`);
        }
      });
      notes.push('');
    }

    const urgentRecommendations = clinicalRecommendations.filter(
      rec => rec.priority === 'URGENT' || rec.priority === 'HIGH'
    );

    if (urgentRecommendations.length > 0) {
      notes.push('PRIORITY RECOMMENDATIONS:');
      urgentRecommendations.forEach((rec, index) => {
        notes.push(`${index + 1}. ${rec.description} (${rec.priority})`);
      });
      notes.push('');
    }

    if (!findings.deworming) {
      notes.push('⚠ Student requires deworming');
    }
    if (findings.immunization && findings.immunization.toLowerCase().includes('incomplete')) {
      notes.push('⚠ Incomplete immunization - update required');
    }

    return notes.join('\n');
  }

  async generatePrescriptionFromPersonnelHealth(personnelId) {
    const personnel = await Personnel.findOne({ perId: personnelId, isDeleted: false }).lean();

    if (!personnel) {
      throw new ApiError('Personnel not found', StatusCodes.NOT_FOUND);
    }

    const healthCard = await PersonnelHealthCard.findOne({
      personnel: personnel._id
    }).lean();


    if (!healthCard) {
      throw new ApiError('No health card found for this personnel', StatusCodes.NOT_FOUND);
    } const riskFactors = [];
    const medications = [];
    let itemNumber = 1;

    if (healthCard.pastMedicalHistory) {
      if (healthCard.pastMedicalHistory.hypertension) {
        riskFactors.push('Hypertension');
        medications.push({
          itemNumber: itemNumber++,
          medicationName: 'Amlodipine 5mg',
          signature: 'Take 1 tablet once daily',
          quantity: '30 tablets'
        });
      }
      if (healthCard.pastMedicalHistory.diabetesMellitus) {
        riskFactors.push('Diabetes Mellitus');
        medications.push({
          itemNumber: itemNumber++,
          medicationName: 'Metformin 500mg',
          signature: 'Take 1 tablet twice daily after meals',
          quantity: '60 tablets'
        });
      }
      if (healthCard.pastMedicalHistory.asthma) {
        riskFactors.push('Asthma');
      }
      if (healthCard.pastMedicalHistory.cardiovascularDisease) {
        riskFactors.push('Cardiovascular Disease');
      }
    }

    // Check smoking status
    if (healthCard.socialHistory?.smoking?.status && healthCard.socialHistory.smoking.sticksPerDay > 10) {
      riskFactors.push(`Heavy Smoker (${healthCard.socialHistory.smoking.sticksPerDay} sticks/day)`);
    }

    // Determine classification
    let classification = 'General Health Maintenance';
    if (riskFactors.length > 2) {
      classification = 'Multiple Chronic Conditions Management';
    } else if (riskFactors.some(r => r.includes('Cardiovascular') || r.includes('Hypertension'))) {
      classification = 'Cardiovascular Risk Management';
    } else if (riskFactors.some(r => r.includes('Diabetes'))) {
      classification = 'Diabetes Management';
    }

    // Default medication if none added
    if (medications.length === 0) {
      medications.push({
        itemNumber: 1,
        medicationName: 'As per clinical assessment',
        signature: 'To be determined during consultation',
        quantity: 'TBD'
      });
    }

    const notes = [
      'PERSONNEL HEALTH ASSESSMENT SUMMARY:',
      `Risk Factors Identified: ${riskFactors.length > 0 ? riskFactors.join(', ') : 'None'}`,
      '',
      'RECOMMENDATIONS:',
      '• Regular monitoring of vital signs',
      '• Lifestyle modification counseling',
      '• Follow-up consultation as needed'
    ];

    if (healthCard.socialHistory?.smoking?.status) {
      notes.push('• Smoking cessation program recommended');
    }

    const age = personnel.dateOfBirth
      ? Math.floor((new Date() - new Date(personnel.dateOfBirth)) / 31557600000)
      : null;

    return {
      patientName: `${personnel.firstName} ${personnel.middleName || ''} ${personnel.lastName}`.trim(),
      patientAge: age,
      patientSex: personnel.gender,
      patientAddress: personnel.address || '',
      classification: classification,
      medications: medications,
      notes: notes.join('\n'),
      prescribedDate: new Date(),
      personnelId: personnel.personnelId,
      personnelObjectId: personnel._id,
      riskFactors: riskFactors
    };
  }
}

export default new PrescriptionService();
