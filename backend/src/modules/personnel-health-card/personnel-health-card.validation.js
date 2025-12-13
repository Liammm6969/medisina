import Joi from 'joi';
import { checkAge, objectId } from '#utils/customValidation.js';
import { gender } from '#utils/constants.js';


export const phcIdSchema = Joi.object({
  phcId: Joi.string().pattern(/^PHC-\d{8}-[A-Fa-f0-9]{6}$/)
    .required()
    .messages({
      "string.base": "PHC ID must be a string",
      "string.empty": "PHC ID cannot be empty",
      "string.pattern.base": "PHC ID must follow the format PHC-YYYYMMDD-XXXXXX",
      "any.required": "PHC ID is required",
    }),
});
export const dayRangeSchema = Joi.object({
  days: Joi.number().integer().min(1).max(31)
});

export const genderSchema = Joi.object({
  gender: Joi.string().valid(...gender).trim().insensitive()
});

// Reusable sub-schemas
const familyHistoryJoi = Joi.object({
  hypertension: Joi.boolean().optional(),
  cardiovascularDisease: Joi.boolean().optional(),
  diabetesMellitus: Joi.boolean().optional(),
  kidneyDisease: Joi.boolean().optional(),
  cancer: Joi.boolean().optional(),
  asthma: Joi.boolean().optional(),
  allergy: Joi.boolean().optional(),
  relationships: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  otherRemarks: Joi.string().allow('', null).optional()
});

const pastMedicalHistoryJoi = Joi.object({
  hypertension: Joi.boolean().optional(),
  asthma: Joi.boolean().optional(),
  diabetesMellitus: Joi.boolean().optional(),
  cardiovascularDisease: Joi.boolean().optional(),
  allergy: Joi.string().allow('', null).optional(),
  tuberculosis: Joi.boolean().optional(),
  surgicalOperations: Joi.string().allow('', null).optional(),
  yellowDiscoloration: Joi.boolean().optional(),
  lastHospitalization: Joi.string().allow('', null).optional(),
  others: Joi.string().allow('', null).optional()
});

const testResultItemJoi = Joi.object({
  lastTakenDate: Joi.date().min(1900).allow('', null).optional(),
  result: Joi.string().allow('', null).optional(),
  resultDate: Joi.date().max('now').allow('', null).optional().messages({
    'date.max': 'Result date cannot be in the future'
  })
}).custom((value, helpers) => {
  if (value.lastTakenDate && value.resultDate) {
    if (value.resultDate < value.lastTakenDate) {
      return helpers.error('custom.resultDateBeforeLastTaken');
    }
  }
  return value;
}).messages({
  'custom.resultDateBeforeLastTaken': 'Result date cannot be before last taken date'
});

const testResultsJoi = Joi.object({
  cxrSputum: testResultItemJoi.optional(),
  ecg: testResultItemJoi.optional(),
  urinalysis: testResultItemJoi.optional(),
  drugTesting: testResultItemJoi.optional(),
  neuropsychiatricExam: testResultItemJoi.optional(),
  bloodTyping: testResultItemJoi.optional(),
  others: testResultItemJoi.keys({
    name: Joi.string().allow('', null).optional()
  }).optional()
});

const socialHistoryJoi = Joi.object({
  smoking: Joi.object({
    status: Joi.boolean().default(false),
    ageStarted: Joi.when('status', {
      is: true,
      then: Joi.number().min(1).max(80).default(0).optional(),
      otherwise: Joi.number().min(0).max(80).default(0).optional()
    }),
    sticksPerDay: Joi.when('status', {
      is: true,
      then: Joi.number().min(1).max(100).default(0).optional(),
      otherwise: Joi.number().min(0).max(100).default(0).optional()
    })
  }).optional(),
  alcohol: Joi.object({
    status: Joi.boolean().default(false),
    frequency: Joi.when('status', {
      is: true,
      then: Joi.string().required(),
      otherwise: Joi.string().allow('', null).optional()
    })
  }).optional(),
  foodPreference: Joi.string().allow('', null).optional()
}).optional();

const obGynHistoryJoi = Joi.object({
  menarche: Joi.string().allow('', null).optional(),
  cycle: Joi.string().allow('', null).optional(),
  duration: Joi.string().allow('', null).optional(),
  parity: Joi.object({
    F: Joi.number().integer().min(0).default(0),
    P: Joi.number().integer().min(0).default(0),
    A: Joi.number().integer().min(0).default(0),
    L: Joi.number().integer().min(0).default(0)
  }).optional(),
  papsmearDone: Joi.object({
    status: Joi.boolean().default(false),
    when: Joi.string().allow('', null).optional()
  }).optional(),
  selfBreastExamDone: Joi.boolean().default(false),
  massNoted: Joi.object({
    status: Joi.boolean().default(false),
    location: Joi.string().allow('', null).optional()
  }).optional()
}).allow(null).optional();

const maleExamJoi = Joi.object({
  digitalRectalExamDone: Joi.boolean().default(false),
  examDate: Joi.date().max('now').allow('', null).optional(),
  result: Joi.string().allow('', null).optional()
}).allow(null).optional();

const presentHealthStatusJoi = Joi.object({
  cough: Joi.string().allow('', null).optional(),
  dizziness: Joi.boolean().default(false),
  dyspnea: Joi.boolean().default(false),
  chestBackPain: Joi.boolean().default(false),
  easyFatigability: Joi.boolean().default(false),
  jointExtremityPains: Joi.boolean().default(false),
  blurringOfVision: Joi.boolean().default(false),
  wearingEyeglasses: Joi.boolean().default(false),
  vaginalDischargeBleeding: Joi.boolean().default(false),
  lumps: Joi.boolean().default(false),
  painfulUrination: Joi.boolean().default(false),
  poorLossOfHearing: Joi.boolean().default(false),
  syncope: Joi.boolean().default(false),
  convulsions: Joi.boolean().default(false),
  malaria: Joi.boolean().default(false),
  goiter: Joi.boolean().default(false),
  anemia: Joi.boolean().default(false),
  dentalStatus: Joi.string().allow('', null).optional(),
  others: Joi.string().allow('', null).optional(),
  presentMedications: Joi.string().allow('', null).optional()
});

const interviewedByJoi = Joi.object({
  user: Joi.string().required(),
  interviewDate: Joi.date().max('now').allow('', null).default(() => new Date()).optional()
});

export const healthCardSchema = Joi.object({
  perId: Joi.string().pattern(/^PER-\d{8}-[A-Fa-f0-9]{6}$/)
    .allow(null)
    .optional()
    .messages({
      "string.base": "PER ID must be a string",
      "string.empty": "PER ID cannot be empty",
      "string.pattern.base": "PER ID must follow the format PER-YYYYMMDD-XXXXXX",
    }),
  familyHistory: familyHistoryJoi.optional(),
  pastMedicalHistory: pastMedicalHistoryJoi.optional(),
  testResults: testResultsJoi.optional(),
  socialHistory: socialHistoryJoi.optional(),

  obGynHistory: obGynHistoryJoi.optional(),

  maleExamination: maleExamJoi.optional(),

  presentHealthStatus: presentHealthStatusJoi.optional()
});


export const ageRangeSchema = Joi.object({
  minAge: Joi.number().integer().min(0).max(120).required(),
  maxAge: Joi.number().integer().min(0).max(120).required()
}).custom(checkAge);

export const symptomsSchema = Joi.object({
  symptoms: Joi.string().pattern(/^[a-zA-Z]+(,[a-zA-Z]+)*$/).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(10)
});

export const conditionParamSchema = Joi.object({
  condition: Joi.string().required()
});
export const idParam = Joi.object({
  id: Joi.string().custom(objectId).required()
});