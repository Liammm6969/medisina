
import Joi from 'joi';
import { civilStatus, gender } from "#utils/constants.js";

export const createPersonnelSchema = Joi.object({

  firstName: Joi.string().trim().min(1).max(100).required(),
  middleName: Joi.string().trim().max(100).allow(null, ""),
  lastName: Joi.string().trim().min(1).max(100).required(),

  gender: Joi.string().valid(...gender).optional(),

  age: Joi.number().integer().min(0).max(120).optional(),
  dateOfBirth: Joi.date().max("now").allow(null, "").optional(),

  civilStatus: Joi.string().valid(...civilStatus).optional(),

  position: Joi.string().trim().max(100).allow(null, ""),
  schoolId: Joi.array().items(Joi.string().trim().max(20)).optional().messages({
    "array.base": "School ID must be an array.",
    "string.max": "Each School ID must be at most 20 characters.",
  }),
  schoolName: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "School Name must be an array.",
  }),
  schoolDistrictDivision: Joi.array().items(Joi.string().trim()).allow(null, "").optional(),

  yearsInService: Joi.number().integer().min(0).max(99).allow(null),
  firstYearInService: Joi.number().integer().min(1900).max(new Date().getFullYear()).allow(null),
});

export const updatePersonnelSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100),
  middleName: Joi.string().trim().max(100).allow(null, ""),
  lastName: Joi.string().trim().min(1).max(100),

  gender: Joi.string().valid(...gender).allow(null, "").optional(),

  age: Joi.number().integer().min(0).max(120).optional(),
  dateOfBirth: Joi.date().max("now").allow(null, "").optional(),

  civilStatus: Joi.string().valid(...civilStatus).allow(null, "").optional(),

  position: Joi.string().trim().max(100).allow(null, ""),
  schoolDistrictDivision: Joi.array().items(Joi.string().trim().max(150)).allow(null, "").optional(),
  schoolId: Joi.array().items(Joi.string().trim().max(20)).optional().messages({
    "array.base": "School ID must be an array.",
    "string.max": "Each School ID must be at most 20 characters.",
  }),
  schoolName: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "School Name must be an array.",
  }),
  yearsInService: Joi.number().integer().min(0).max(90).allow(null),
  firstYearInService: Joi.number().integer().min(1900).max(new Date().getFullYear()).allow(null),

  isDeleted: Joi.boolean(),
}).min(1);


export const getPersonnelById = Joi.object({
  perId: Joi.string()
    .pattern(/^PER-\d{8}-[A-F0-9]{6}$/i)
    .required()
    .messages({
      "string.base": "Personnel ID must be a string",
      "string.empty": "Personnel ID cannot be empty",
      "string.pattern.base": "Personnel ID must follow the format PER-YYYYMMDD-XXXXXX (e.g., PER-20250926-77DE21)",
      "any.required": "Personnel ID is required",
    }),
});

export const approveChiefComplaint = {
  params: Joi.object().keys({
    personnelId: Joi.string().required().messages({
      'string.empty': 'Personnel ID is required',
      'any.required': 'Personnel ID is required'
    })
  }),
  body: Joi.object().keys({
    doctorTreatment: Joi.string().allow('').optional(),
    remarks: Joi.string().allow('').optional()
  })
};

