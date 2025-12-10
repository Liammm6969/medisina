import { prescriptionClassification } from '#utils/constants.js';
import Joi from 'joi';

const medicationSchema = Joi.object({
  itemNumber: Joi.number().min(1).required().messages({
    'number.min': 'Item number must be at least 1',
    'any.required': 'Item number is required'
  }),
  medicationName: Joi.string().trim().required().messages({
    'string.empty': 'Medication name cannot be empty',
    'any.required': 'Medication name is required'
  }),
  signature: Joi.string().trim().required().messages({
    'string.empty': 'Signature cannot be empty',
    'any.required': 'Signature is required'
  }),
  quantity: Joi.number().min(1).required().messages({
    'number.min': 'Quantity must be at least 1',
    'any.required': 'Quantity is required'
  })
});

export const createPrescriptionSchema = Joi.object({
  patientName: Joi.string().trim().replace(/[`'"]/g, '').allow('').optional(),
  patientAge: Joi.alternatives().try(
    Joi.number().min(0).max(120),
    Joi.string().allow('').valid('')
  ).optional(),
  patientSex: Joi.string().valid('Male', 'Female').allow('').optional(),
  patientAddress: Joi.string().trim().replace(/[`'"]/g, '').allow('').optional(),
  classification: Joi.string().trim().allow('').optional(),
  medications: Joi.array().items(medicationSchema).min(1).required(),
  notes: Joi.string().trim().allow('').optional(),
  attendingExaminer: Joi.string().allow('').optional()
});

export const updatePrescriptionSchema = Joi.object({
  patientName: Joi.string().trim().optional(),
  patientAge: Joi.number().min(0).max(120).optional(),
  patientSex: Joi.string().valid('Male', 'Female', '').optional(),
  patientAddress: Joi.string().trim().allow('').optional(),
  classification: Joi.string().trim().allow('').optional(),
  medications: Joi.array().items(medicationSchema).optional(),
  notes: Joi.string().trim().allow('').optional()
}).min(1);

export const prescriptionIdParamSchema = Joi.object({
  prescriptionId: Joi.string().pattern(/^PRX-\d{8}-[A-Z0-9]{6}$/).required()
});

export const prescriptionFiltersSchema = Joi.object({
  patientName: Joi.string().optional(),
  startDate: Joi.date().max('now').optional().messages({
    'date.max': 'Start date cannot be in the future'
  }),
  endDate: Joi.date().max('now').optional().messages({
    'date.max': 'End date cannot be in the future'
  }),
  prescribedBy: Joi.string().optional(),
  limit: Joi.number().min(1).default(50),
  page: Joi.number().min(1).default(1)
});

