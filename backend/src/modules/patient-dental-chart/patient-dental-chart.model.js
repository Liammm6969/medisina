import mongoose from 'mongoose';
import { generateId } from '#utils/crypto.js';

const PatientDentalChartSchema = new mongoose.Schema(
  {
    pdcId: {
      type: String,
      unique: true,
      index: true
    },
    // Patient Information - references
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null
    },
    personnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personnel',
      default: null
    },
    // Walk-in patient information
    walkInPatient: {
      firstName: String,
      lastName: String,
      middleName: String,
      birthdate: Date,
      age: Number,
      sex: { type: String, enum: ['M', 'F', ''] },
      nickname: String,
      religion: String,
      nationality: String,
      homeAddress: String,
      occupation: String,
      dentalInsurance: String,
      effectiveDate: Date,
      parentGuardianName: String,
      parentOccupation: String,
      referredBy: String,
      consultationReason: String,
      homeNo: String,
      officeNo: String,
      faxNo: String,
      cellMobileNo: String,
      emailAddress: String
    },
    // Dental History
    dentalHistory: {
      previousDentist: String,
      lastDentalVisit: Date
    },
    // Medical History
    medicalHistory: {
      physicianName: String,
      physicianSpecialty: String,
      officeAddress: String,
      officeNumber: String,
      inGoodHealth: Boolean,
      underMedicalTreatment: Boolean,
      medicalCondition: String,
      seriousIllnessOperation: Boolean,
      illnessDetails: String,
      hospitalized: Boolean,
      hospitalizationDetails: String,
      takingMedication: Boolean,
      medications: String,
      tobacco: Boolean,
      alcoholCocaine: Boolean,
      allergies: [String],
      localAnesthetic: Boolean,
      penicillin: Boolean,
      antibiotics: Boolean,
      sulfa: Boolean,
      aspirin: Boolean,
      latex: Boolean,
      others: String,
      bleedingTime: String,
      pregnant: Boolean,
      nursing: Boolean,
      birthControlPills: Boolean,
      bloodType: String,
      bloodPressure: String,
      // Medical conditions checklist
      conditions: {
        highBloodPressure: Boolean,
        lowBloodPressure: Boolean,
        epilepsy: Boolean,
        aidsHIV: Boolean,
        std: Boolean,
        stomachTroubles: Boolean,
        faintingSeizure: Boolean,
        rapidWeightLoss: Boolean,
        radiationTherapy: Boolean,
        jointReplacement: Boolean,
        heartSurgery: Boolean,
        heartAttack: Boolean,
        thyroidProblem: Boolean,
        heartDisease: Boolean,
        heartMurmur: Boolean,
        hepatitis: Boolean,
        rheumaticFever: Boolean,
        hayFever: Boolean,
        respiratoryProblems: Boolean,
        hepatitisJaundice: Boolean,
        tuberculosis: Boolean,
        swollenAnkles: Boolean,
        kidneyDisease: Boolean,
        diabetes: Boolean,
        chestPain: Boolean,
        stroke: Boolean,
        cancerTumors: Boolean,
        anemia: Boolean,
        angina: Boolean,
        asthma: Boolean,
        emphysema: Boolean,
        bleedingProblems: Boolean,
        bloodDiseases: Boolean,
        headInjuries: Boolean,
        arthritisRheumatism: Boolean,
        other: String
      }
    },
    signatureString: { type: String },
    schoolId: Number,
    attendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

PatientDentalChartSchema.pre('save', async function (next) {
  if (!this.pdcId) {
    this.pdcId = await generateId('PDC');
  }
  next();
});

PatientDentalChartSchema.index({ student: 1, isDeleted: 1 });
PatientDentalChartSchema.index({ personnel: 1, isDeleted: 1 });
PatientDentalChartSchema.index({ createdAt: -1 });

const PatientDentalChart = mongoose.model('PatientDentalChart', PatientDentalChartSchema);

export default PatientDentalChart;
