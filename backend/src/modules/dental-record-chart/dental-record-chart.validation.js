import Joi from 'joi';
import { objectId } from '#utils/customValidation.js';

const teethConditionSchema = Joi.object({
  toothNumber: Joi.string().trim().required(),
  condition: Joi.string().valid('Present', 'Decayed', 'Missing', 'Impacted', 'Supernumerary', 'Root Fragment', 'Unerupted').default('Present'),
  secondaryCondition: Joi.string().valid('Present', 'Decayed', 'Missing', 'Impacted', 'Supernumerary', 'Root Fragment', 'Unerupted').default('Present'),
  restoration: Joi.string().trim().allow('', null),
  surgery: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null)
});

const walkInPatientSchema = Joi.object({
  name: Joi.string().trim().required(),
  age: Joi.number().integer().min(0).max(150).allow(null),
  gender: Joi.string().valid('Male', 'Female', 'M', 'F').allow(null),
  date: Joi.date().allow(null)
});

export const dentalRecordChartValidation = {
  createRecord: {
    body: Joi.object({
      student: Joi.string().custom(objectId).allow(null, ''),
      personnel: Joi.string().custom(objectId).allow(null, ''),
      walkInPatient: walkInPatientSchema.allow(null),

      permanentTeeth: Joi.array().items(teethConditionSchema).default([]),
      temporaryTeeth: Joi.array().items(teethConditionSchema).default([]),

      periodontalScreening: Joi.object({
        gingivitis: Joi.boolean().default(false),
        earlyPeriodontitis: Joi.boolean().default(false),
        moderatePeriodontitis: Joi.boolean().default(false),
        advancedPeriodontitis: Joi.boolean().default(false)
      }).allow(null),

      occlusion: Joi.object({
        classMolar: Joi.string().trim().allow('', null),
        overjet: Joi.string().trim().allow('', null),
        overbite: Joi.string().trim().allow('', null),
        midlineDeviation: Joi.string().trim().allow('', null),
        crossbite: Joi.string().trim().allow('', null)
      }).allow(null),

      appliances: Joi.object({
        orthodontic: Joi.string().trim().allow('', null),
        stayplate: Joi.string().trim().allow('', null),
        others: Joi.string().trim().allow('', null)
      }).allow(null),

      tmd: Joi.object({
        clenching: Joi.boolean().default(false),
        clicking: Joi.boolean().default(false),
        trismus: Joi.boolean().default(false),
        muscleSpasm: Joi.boolean().default(false)
      }).allow(null),

      xrayTaken: Joi.object({
        periapical: Joi.string().trim().allow('', null),
        panoramic: Joi.boolean().default(false),
        cephalometric: Joi.boolean().default(false),
        occlusal: Joi.string().trim().allow('', null),
        others: Joi.string().trim().allow('', null)
      }).allow(null),

      remarks: Joi.string().trim().allow('', null),
      dateOfExamination: Joi.date().max('now').allow(null),
      schoolId: Joi.string().trim().allow('', null)
    })
  },

  updateRecord: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      student: Joi.string().custom(objectId).allow(null, ''),
      personnel: Joi.string().custom(objectId).allow(null, ''),
      walkInPatient: walkInPatientSchema.allow(null),

      permanentTeeth: Joi.array().items(teethConditionSchema),
      temporaryTeeth: Joi.array().items(teethConditionSchema),

      periodontalScreening: Joi.object({
        gingivitis: Joi.boolean(),
        earlyPeriodontitis: Joi.boolean(),
        moderatePeriodontitis: Joi.boolean(),
        advancedPeriodontitis: Joi.boolean()
      }).allow(null),

      occlusion: Joi.object({
        classMolar: Joi.string().trim().allow('', null),
        overjet: Joi.string().trim().allow('', null),
        overbite: Joi.string().trim().allow('', null),
        midlineDeviation: Joi.string().trim().allow('', null),
        crossbite: Joi.string().trim().allow('', null)
      }).allow(null),

      appliances: Joi.object({
        orthodontic: Joi.string().trim().allow('', null),
        stayplate: Joi.string().trim().allow('', null),
        others: Joi.string().trim().allow('', null)
      }).allow(null),

      tmd: Joi.object({
        clenching: Joi.boolean(),
        clicking: Joi.boolean(),
        trismus: Joi.boolean(),
        muscleSpasm: Joi.boolean()
      }).allow(null),

      xrayTaken: Joi.object({
        periapical: Joi.string().trim().allow('', null),
        panoramic: Joi.boolean(),
        cephalometric: Joi.boolean(),
        occlusal: Joi.string().trim().allow('', null),
        others: Joi.string().trim().allow('', null)
      }).allow(null),

      remarks: Joi.string().trim().allow('', null),
      dateOfExamination: Joi.date().max('now'),
      schoolId: Joi.string().trim().allow('', null)
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
