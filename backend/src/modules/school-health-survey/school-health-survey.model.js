import { generateId } from '#utils/crypto.js';
import { Schema, model } from 'mongoose';

const genderCountSchema = new Schema({
  male: { type: Number, default: 0, min: 0 },
  female: { type: Number, default: 0, min: 0 }
}, { _id: false });

const enrollmentDetailSchema = new Schema({
  kinder: genderCountSchema,
  grade1: genderCountSchema,
  grade2: genderCountSchema,
  grade3: genderCountSchema,
  grade4: genderCountSchema,
  grade5: genderCountSchema,
  grade6: genderCountSchema,
  sped: genderCountSchema
}, { _id: false });

const juniorHighSchema = new Schema({
  grade7: genderCountSchema,
  grade8: genderCountSchema,
  grade9: genderCountSchema,
  grade10: genderCountSchema,
  sped: genderCountSchema
}, { _id: false });

const seniorHighSchema = new Schema({
  grade11: genderCountSchema,
  grade12: genderCountSchema
}, { _id: false });

const alsSchema = new Schema({
  alsLearners: genderCountSchema
}, { _id: false });

const personnelCountSchema = new Schema({
  teaching: genderCountSchema,
  nonTeaching: genderCountSchema
}, { _id: false });

const dropoutReasonsSchema = new Schema({
  illness: genderCountSchema,
  poverty: genderCountSchema,
  otherReasons: genderCountSchema
}, { _id: false });

const examinedAssessedSchema = new Schema({
  learners: genderCountSchema,
  teachers: genderCountSchema,
  ntp: genderCountSchema
}, { _id: false });

const healthProblemsSchema = new Schema({
  healthProblems: genderCountSchema,
  physicalDeformitiesDefects: [{
    description: { type: String, trim: true },
    count: genderCountSchema
  }]
}, { _id: false });

const treatmentSchema = new Schema({
  treatments: [{
    description: { type: String, trim: true },
    count: genderCountSchema
  }],
  numberDewormed: {
    firstRound: {
      count: genderCountSchema,
      date: { type: Date }
    },
    secondRound: {
      count: genderCountSchema,
      date: { type: Date }
    }
  },
  givenIronSupplement: genderCountSchema,
  referredToOtherFacilities: genderCountSchema
}, { _id: false });

const referralSchema = new Schema({
  physicians: genderCountSchema,
  dentist: genderCountSchema,
  nurse: genderCountSchema,
  guidanceCounselors: genderCountSchema,
  others: {
    count: genderCountSchema,
    specify: { type: String, trim: true }
  }
}, { _id: false });

const signsSymptomSchema = new Schema({
  signsSymptoms: { type: String, required: true, trim: true },
  numberOfCases: { type: Number, default: 0, min: 0 },
  rank: { type: Number, min: 1 }
}, { _id: false });

const commonSignsSymptomsSchema = new Schema({
  learners: [signsSymptomSchema],
  teachingAndNTP: [signsSymptomSchema]
}, { _id: false });

const clinicFacilitiesSchema = new Schema({
  area: { type: Number, min: 0 }, // in square meters
  location: {
    separateBuilding: { type: Boolean, default: false },
    roomWithinBuilding: { type: Boolean, default: false },
    withinClassroom: { type: Boolean, default: false }
  },
  provisions: {
    toiletInClinic: { type: Boolean, default: false },
    potableWaterSupply: { type: Boolean, default: false },
    medicines: { type: Boolean, default: false },
    weighingScale: {
      available: { type: Boolean, default: false },
      specification: { type: String, trim: true }
    },
    heightStadiometer: { type: Boolean, default: false },
    medicinetreatmentCabinet: { type: Boolean, default: false },
    examinationTableBed: { type: Boolean, default: false },
    footStoolReceptacle: { type: Boolean, default: false },
    dentalChair: { type: Boolean, default: false },
    workingTable: { type: Boolean, default: false },
    treatmentRecords: { type: Boolean, default: false },
    clinicTeacherSchoolNurseAssigned: { type: Boolean, default: false },
    stockCabinet: { type: Boolean, default: false }
  }
}, { _id: false });

const toiletFacilitiesSchema = new Schema({
  genderSensitiveType: { type: Boolean, default: false },
  numberOfSeatsUrinal: { type: Number, default: 0, min: 0 },
  menstrualHygieneRoom: { type: Boolean, default: false },
  availabilityOfSanitaryPad: { type: Boolean, default: false }
}, { _id: false });

const waterSupplySchema = new Schema({
  source: { type: String, trim: true },
  certificateOfWaterAnalysis: { type: Boolean, default: false }
}, { _id: false });

const washingFacilitiesSchema = new Schema({
  source: { type: String, trim: true },
  provisionOfHandwashingSoap: { type: Boolean, default: false }
}, { _id: false });

const canteenSchema = new Schema({
  sanitaryPermit: { type: Boolean, default: false },
  healthCertificateOfHelpers: { type: Boolean, default: false },
  complianceToDepEdOrder13_2017: { type: Boolean, default: false }
}, { _id: false });

const schoolFacilitiesSchema = new Schema({
  schoolSiteArea: { type: Number, min: 0 }, // in square meters
  numberOfBuildings: { type: Number, default: 0, min: 0 },
  numberOfClassrooms: { type: Number, default: 0, min: 0 },
  healthFacilities: {
    schoolClinic: clinicFacilitiesSchema,
    schoolToilet: toiletFacilitiesSchema,
    waterSupplyAndDrinkingWater: waterSupplySchema,
    washingFacilities: washingFacilitiesSchema,
    schoolCanteen: canteenSchema
  }
}, { _id: false });

const accomplishedBySchema = new Schema({
  name: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  dateOfSurvey: { type: Date, required: true }
}, { _id: false });

const schoolHealthSurveySchema = new Schema({
  shsId: { type: String, },
  region: { type: String, required: true, trim: true },
  division: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },

  schoolName: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  schoolId: { type: String, required: true, trim: true },
  schoolHeadName: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },

  generalInformation: {
    enrollment: {
      elementary: enrollmentDetailSchema,
      juniorHS: juniorHighSchema,
      seniorHS: seniorHighSchema,
      als: alsSchema
    },
    schoolPersonnel: personnelCountSchema,
    dropoutReasons: dropoutReasonsSchema
  },

  healthProfile: {
    numberExaminedAssessed: examinedAssessedSchema,
    foundWith: healthProblemsSchema,
    treatment: treatmentSchema,
    referrals: referralSchema,
    commonSignsSymptoms: commonSignsSymptomsSchema
  },

  schoolFacilities: schoolFacilitiesSchema,

  remarks: { type: String, trim: true },
  accomplishedBy: accomplishedBySchema,

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  approvalRemarks: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  surveyStatus: {
    type: String,
    enum: ['completed', 'submitted', 'approved', 'rejected'],
    default: 'submitted'
  }

}, {
  timestamps: true,
  collection: 'school_health_surveys'
});


schoolHealthSurveySchema.index({ year: 1, schoolId: 1 });
schoolHealthSurveySchema.index({ region: 1, division: 1 });
schoolHealthSurveySchema.index({ schoolName: 1 });
schoolHealthSurveySchema.index({ createdAt: -1 });
schoolHealthSurveySchema.index({ surveyStatus: 1 });
schoolHealthSurveySchema.index({ shs: 1 });
schoolHealthSurveySchema.index({ isActive: 1 });
schoolHealthSurveySchema.index({ surveyStatus: 1, isActive: 1 });
schoolHealthSurveySchema.index({ createdBy: 1, isActive: 1 });


schoolHealthSurveySchema.pre('save', async function (next) {
  if (this.isNew) {
    this.shsId = generateId('SHS');
  }

  if (this.isNew || this.isModified('year') || this.isModified('schoolId')) {
    const existingSurvey = await this.constructor.findOne({
      year: this.year,
      schoolId: this.schoolId,
      isActive: true,
      _id: { $ne: this._id }
    });

    if (existingSurvey) {
      const error = new Error('School Health Survey already exists for this school and year');
      error.status = 400;
      return next(error);
    }
  }
  next();
});
schoolHealthSurveySchema.methods.calculateTotalExamined = function () {
  const examined = this.healthProfile?.numberExaminedAssessed;
  if (!examined) return 0;

  let total = 0;
  Object.keys(examined).forEach(category => {
    if (examined[category]) {
      total += (examined[category].male || 0) + (examined[category].female || 0);
    }
  });
  return total;
};

schoolHealthSurveySchema.methods.calculateHealthProblemsPercentage = function () {
  const totalExamined = this.calculateTotalExamined();
  if (totalExamined === 0) return 0;

  const healthProblems = this.healthProfile?.foundWith?.healthProblems;
  if (!healthProblems) return 0;

  const totalWithProblems = (healthProblems.male || 0) + (healthProblems.female || 0);
  return ((totalWithProblems / totalExamined) * 100).toFixed(2);
};

schoolHealthSurveySchema.methods.markAsCompleted = function () {
  this.surveyStatus = 'completed';
  return this.save();
};

schoolHealthSurveySchema.methods.markAsSubmitted = function () {
  this.surveyStatus = 'submitted';
  return this.save();
};

// Static methods
schoolHealthSurveySchema.statics.findByYear = function (year) {
  return this.find({ year, isActive: true }).sort({ schoolName: 1 });
};

schoolHealthSurveySchema.statics.findByRegionDivision = function (region, division, year = null) {
  const query = { region, division, isActive: true };
  if (year) query.year = year;
  return this.find(query).sort({ schoolName: 1, year: -1 });
};

schoolHealthSurveySchema.statics.findPendingSurveys = function () {
  return this.find({
    surveyStatus: { $in: ['draft', 'completed'] },
    isActive: true
  }).sort({ createdAt: -1 });
};

schoolHealthSurveySchema.statics.getStatsByRegion = function (region, year) {
  return this.aggregate([
    { $match: { region, year, isActive: true } },
    {
      $group: {
        _id: '$division',
        totalSurveys: { $sum: 1 },
        completedSurveys: {
          $sum: { $cond: [{ $eq: ['$surveyStatus', 'completed'] }, 1, 0] }
        },
        submittedSurveys: {
          $sum: { $cond: [{ $eq: ['$surveyStatus', 'submitted'] }, 1, 0] }
        },
        approvedSurveys: {
          $sum: { $cond: [{ $eq: ['$surveyStatus', 'approved'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Enable virtuals in JSON output
schoolHealthSurveySchema.set('toJSON', { virtuals: true });
schoolHealthSurveySchema.set('toObject', { virtuals: true });

const SchoolHealthSurvey = model('SchoolHealthSurvey', schoolHealthSurveySchema);

export default SchoolHealthSurvey;