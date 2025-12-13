import Joi from 'joi';

const walkInPatientSchema = Joi.object({
  firstName: Joi.string().trim().allow('', null),
  lastName: Joi.string().trim().allow('', null),
  middleName: Joi.string().trim().allow('', null),
  birthdate: Joi.date().allow(null),
  age: Joi.number().integer().min(0).allow(null),
  sex: Joi.string().valid('M', 'F', '').allow('', null),
  nickname: Joi.string().trim().allow('', null),
  religion: Joi.string().trim().allow('', null),
  nationality: Joi.string().trim().allow('', null),
  homeAddress: Joi.string().trim().allow('', null),
  occupation: Joi.string().trim().allow('', null),
  dentalInsurance: Joi.string().trim().allow('', null),
  effectiveDate: Joi.date().allow(null),
  parentGuardianName: Joi.string().trim().allow('', null),
  parentOccupation: Joi.string().trim().allow('', null),
  referredBy: Joi.string().trim().allow('', null),
  consultationReason: Joi.string().trim().allow('', null),
  homeNo: Joi.string().trim().allow('', null),
  officeNo: Joi.string().trim().allow('', null),
  faxNo: Joi.string().trim().allow('', null),
  cellMobileNo: Joi.string().trim().allow('', null),
  emailAddress: Joi.string().email().pattern(/ @deped\.gov\.ph$ /).trim().allow('', null)
});

const medicalConditionsSchema = Joi.object({
  highBloodPressure: Joi.boolean(),
  lowBloodPressure: Joi.boolean(),
  epilepsy: Joi.boolean(),
  aidsHIV: Joi.boolean(),
  std: Joi.boolean(),
  stomachTroubles: Joi.boolean(),
  faintingSeizure: Joi.boolean(),
  rapidWeightLoss: Joi.boolean(),
  radiationTherapy: Joi.boolean(),
  jointReplacement: Joi.boolean(),
  heartSurgery: Joi.boolean(),
  heartAttack: Joi.boolean(),
  thyroidProblem: Joi.boolean(),
  heartDisease: Joi.boolean(),
  heartMurmur: Joi.boolean(),
  hepatitis: Joi.boolean(),
  rheumaticFever: Joi.boolean(),
  hayFever: Joi.boolean(),
  respiratoryProblems: Joi.boolean(),
  hepatitisJaundice: Joi.boolean(),
  tuberculosis: Joi.boolean(),
  swollenAnkles: Joi.boolean(),
  kidneyDisease: Joi.boolean(),
  diabetes: Joi.boolean(),
  chestPain: Joi.boolean(),
  stroke: Joi.boolean(),
  cancerTumors: Joi.boolean(),
  anemia: Joi.boolean(),
  angina: Joi.boolean(),
  asthma: Joi.boolean(),
  emphysema: Joi.boolean(),
  bleedingProblems: Joi.boolean(),
  bloodDiseases: Joi.boolean(),
  headInjuries: Joi.boolean(),
  arthritisRheumatism: Joi.boolean(),
  other: Joi.string().trim().allow('', null)
}).allow(null);

const medicalHistorySchema = Joi.object({
  physicianName: Joi.string().trim().allow('', null),
  physicianSpecialty: Joi.string().trim().allow('', null),
  officeAddress: Joi.string().trim().allow('', null),
  officeNumber: Joi.string().trim().allow('', null),
  inGoodHealth: Joi.boolean().allow(null),
  underMedicalTreatment: Joi.boolean().allow(null),
  medicalCondition: Joi.string().trim().allow('', null),
  seriousIllnessOperation: Joi.boolean().allow(null),
  illnessDetails: Joi.string().trim().allow('', null),
  hospitalized: Joi.boolean().allow(null),
  hospitalizationDetails: Joi.string().trim().allow('', null),
  takingMedication: Joi.boolean().allow(null),
  medications: Joi.string().trim().allow('', null),
  tobacco: Joi.boolean().allow(null),
  alcoholCocaine: Joi.boolean().allow(null),
  allergies: Joi.array().items(Joi.string()),
  localAnesthetic: Joi.boolean(),
  penicillin: Joi.boolean(),
  antibiotics: Joi.boolean(),
  sulfa: Joi.boolean(),
  aspirin: Joi.boolean(),
  latex: Joi.boolean(),
  others: Joi.string().trim().allow('', null),
  bleedingTime: Joi.string().trim().allow('', null),
  pregnant: Joi.boolean().allow(null),
  nursing: Joi.boolean().allow(null),
  birthControlPills: Joi.boolean().allow(null),
  bloodType: Joi.string().trim().allow('', null),
  bloodPressure: Joi.string().trim().allow('', null),
  conditions: medicalConditionsSchema
}).allow(null);

const dentalHistorySchema = Joi.object({
  previousDentist: Joi.string().trim().allow('', null),
  lastDentalVisit: Joi.date().allow('', null)
}).allow(null);

export const patientDentalChartValidation = {
  createRecord: {
    body: Joi.object({
      student: Joi.string().trim().allow('', null),
      personnel: Joi.string().trim().allow('', null),
      walkInPatient: walkInPatientSchema.allow(null),
      dentalHistory: dentalHistorySchema,
      medicalHistory: medicalHistorySchema,
      signatureString: Joi.string().allow(''),
      schoolId: Joi.alternatives().try(
        Joi.number().integer(),
        Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value, 10))
      ).allow('', null)
    })
  },
  updateRecord: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      student: Joi.string().trim().allow('', null),
      personnel: Joi.string().trim().allow('', null),
      walkInPatient: walkInPatientSchema.allow(null),
      dentalHistory: dentalHistorySchema,
      medicalHistory: medicalHistorySchema, 
      signatureString: Joi.string().allow(''),
      schoolId: Joi.alternatives().try(
        Joi.number().integer(),
        Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value, 10))
      ).allow('', null)
    })
  },
  getRecordById: {
    params: Joi.object({
      id: Joi.string().required()
    })
  },
  deleteRecord: {
    params: Joi.object({
      id: Joi.string().required()
    })
  },
  getRecordsByPatient: {
    params: Joi.object({
      patientId: Joi.string().required()
    }),
    query: Joi.object({
      patientType: Joi.string().valid('student', 'personnel').required()
    })
  }
};
