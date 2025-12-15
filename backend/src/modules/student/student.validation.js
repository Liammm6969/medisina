import Joi from 'joi';
import { gender, gradeKeys } from "#utils/constants.js";

export const stdIdParam = Joi.object({
  stdId: Joi.string()
    .pattern(/^STD-\d{8}-[A-Z0-9]{6}$/)
    .required()
    .messages({
      "string.base": "Student ID must be a string",
      "string.empty": "Student ID cannot be empty",
      "string.pattern.base": "Student ID must follow the format STD-YYYYMMDD-XXXXXX",
      "any.required": "Student ID is required",
    })
});


export const createStudentSchema = Joi.object({
  lrn: Joi.number()
    .integer()
    .allow(null)
    .positive()
    .messages({
      'number.base': 'LRN must be a number',
      'number.integer': 'LRN must be an integer',
      'number.positive': 'LRN must be a positive number'
    }),
  schoolId: Joi.string().trim().required().messages({
    'string.empty': 'School ID cannot be empty',
    'any.required': 'School ID is required'
  }),
  schoolName: Joi.string().trim().required().messages({
    'string.empty': 'School name cannot be empty',
    'any.required': 'School name is required'
  }),
  schoolDistrictDivision: Joi.string().trim().required().messages({
    'string.empty': 'School district division cannot be empty',
    'any.required': 'School district division is required'
  }),
  firstName: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'First name cannot be empty',
    'string.min': 'First name must be at least 1 character',
    'string.max': 'First name cannot exceed 100 characters',
    'any.required': 'First name is required'
  }),
  middleName: Joi.string().trim().max(100).allow(null, "").messages({
    'string.max': 'Middle name cannot exceed 100 characters'
  }),
  lastName: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Last name cannot be empty',
    'string.min': 'Last name must be at least 1 character',
    'string.max': 'Last name cannot exceed 100 characters',
    'any.required': 'Last name is required'
  }),
  gender: Joi.string().valid(...gender).messages({
    'any.only': `Gender must be one of: ${gender.join(', ')}`
  }),
  dateOfBirth: Joi.alternatives().try(
    Joi.date().less('now').messages({
      'date.less': 'Date of birth must be in the past'
    }),
    Joi.valid(null),
    Joi.string().allow('')
  ),
  heightInCm: Joi.number().min(0).max(250).precision(1).optional().default(0),
  weightInKg: Joi.number().min(0).max(300).precision(1).optional().default(0),
  birthplace: Joi.string().trim().allow(null, ""),

  address: Joi.string().trim().allow(null, ""),
  telephoneNo: Joi.string().trim().allow(null, ""),

  parentGuardian: Joi.string().trim().allow(null, ""),
  parentContact: Joi.string().trim().allow(null, ""),

  gradeLevel: Joi.string().valid(...gradeKeys).trim().messages({
    'any.only': `Grade level must be one of: ${gradeKeys.join(', ')}`
  }),
  section: Joi.string().trim().allow(null, ""),
  schoolYear: Joi.string().trim().allow(null, ""),

  attendingPersonnel: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Attending personnel must be a valid MongoDB ObjectId'
    }),
  isSPED: Joi.boolean().default(false)
});

export const updateStudentSchema = Joi.object({
  lrn: Joi.number()
    .integer()
    .positive()
    .allow(null)
    .messages({
      'number.base': 'LRN must be a number',
      'number.integer': 'LRN must be an integer',
      'number.positive': 'LRN must be a positive number'
    }),
  schoolId: Joi.string().trim().messages({
    'string.empty': 'School ID cannot be empty'
  }),
  schoolName: Joi.string().trim().messages({
    'string.empty': 'School name cannot be empty'
  }),
  schoolDistrictDivision: Joi.string().trim().messages({
    'string.empty': 'School district division cannot be empty'
  }),
  firstName: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'First name cannot be empty',
    'string.min': 'First name must be at least 1 character',
    'string.max': 'First name cannot exceed 100 characters'
  }),
  middleName: Joi.string().trim().max(100).allow(null, "").messages({
    'string.max': 'Middle name cannot exceed 100 characters'
  }),
  lastName: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'Last name cannot be empty',
    'string.min': 'Last name must be at least 1 character',
    'string.max': 'Last name cannot exceed 100 characters'
  }),
  gender: Joi.string().valid(...gender).messages({
    'any.only': `Gender must be one of: ${gender.join(', ')}`
  }),
  dateOfBirth: Joi.alternatives().try(
    Joi.date().less('now').messages({
      'date.less': 'Date of birth must be in the past'
    }),
    Joi.valid(null),
    Joi.string().allow('')
  ),
  heightInCm: Joi.number().min(0).max(250).precision(1).optional().default(0),
  weightInKg: Joi.number().min(0).max(300).precision(1).optional().default(0),
  birthplace: Joi.string().trim().allow(null, ""),

  address: Joi.string().trim().allow(null, ""),
  telephoneNo: Joi.string().trim().allow(null, ""),

  parentGuardian: Joi.string().trim().allow(null, ""),
  parentContact: Joi.string().trim().allow(null, ""),

  gradeLevel: Joi.string().valid(...gradeKeys).trim().messages({
    'any.only': `Grade level must be one of: ${gradeKeys.join(', ')}`
  }),
  section: Joi.string().trim().allow(null, ""),
  schoolYear: Joi.string().trim().allow(null, ""),

  attendingPersonnel: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Attending personnel must be a valid MongoDB ObjectId'
    }),
  isSPED: Joi.boolean()
});

export const getStudentByLRN = Joi.object({
  lrn: Joi.number().required().messages({
    'number.base': 'LRN must be a number',
    'any.required': 'LRN is required'
  })
});
