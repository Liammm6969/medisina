import Joi from "joi";
import { password, } from "#utils/customValidation.js";
import { personnelRoles, gender, civilStatus } from "#utils/constants.js";



const register = Joi.object({
  firstName: Joi.string().trim().min(3).max(25).required().messages({
    "string.base": "First name must be a string.",
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 3 characters.",
    "string.max": "First name must be at most 25 characters.",
    "any.required": "First name is required.",
  }),
  middleName: Joi.string().trim().max(10).allow("").optional().messages({
    "string.base": "Middle name must be a string.",
    "string.max": "Middle name must be at most 10 characters.",
  }),
  lastName: Joi.string().trim().min(3).max(25).required().messages({
    "string.base": "Last name must be a string.",
    "string.empty": "Last name is required.",
    "string.min": "Last name must be at least 3 characters.",
    "string.max": "Last name must be at most 25 characters.",
    "any.required": "Last name is required.",
  }),
  email: Joi.string().email().trim().required().pattern(/@deped\.gov\.ph$/).messages({
    "string.base": "Email must be a string.",
    "string.email": "Email must be a valid email address.",
    "string.empty": "Email is required.",
    "string.pattern.base": "Email must be a valid @deped.gov.ph address.",
    "any.required": "Email is required.",
  }),
  role: Joi.string().valid(...personnelRoles).trim().optional().messages({
    "string.base": "Role must be a string.",
    "any.only": `Role must be one of: ${personnelRoles.join(', ')}`,
    "string.empty": "Role is required.",
    "any.required": "Role is required.",
  }),
  password: Joi.string().required().custom(password).messages({
    "string.base": "Password must be a string.",
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),

  schoolId: Joi.array().items(Joi.string().trim().max(20)).optional().messages({
    "array.base": "School ID must be an array.",
    "string.max": "Each School ID must be at most 20 characters.",
  }),
  schoolName: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "School Name must be an array.",
  }),
  schoolDistrictDivision: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "School District Division must be an array.",
  }),

  gender: Joi.string()
    .valid(...gender)
    .optional()
    .messages({
      "string.base": "Gender must be a string.",
      "any.only": `Gender must be one of: ${gender.join(', ')}`,
    }),
  age: Joi.number().integer().min(18).max(80).optional().messages({
    "number.base": "Age must be a number.",
    "number.integer": "Age must be an integer.",
    "number.min": "Age must be at least 18.",
    "number.max": "Age must be at most 80.",
  }),
  dateOfBirth: Joi.string()
    .pattern(/^([0-2][0-9]|(3)[0-1])\/(0[1-9]|1[0-2])\/\d{4}$/)
    .optional()
    .messages({
      "string.base": "Date of birth must be a string.",
      "string.pattern.base": "Date of birth must be in the format dd/mm/yyyy.",
    }),
  civilStatus: Joi.string()
    .valid(...civilStatus)
    .optional()
    .messages({
      "string.base": "Civil status must be a string.",
      "any.only": `Civil status must be one of: ${civilStatus.join(', ')}`,
    }),
  position: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.base": "Position must be a string.",
    "string.max": "Position must be at most 100 characters.",
  }),
  yearsInService: Joi.number().integer().min(0).max(50).optional().messages({
    "number.base": "Years in service must be a number.",
    "number.integer": "Years in service must be an integer.",
    "number.min": "Years in service cannot be negative.",
    "number.max": "Years in service must be at most 50.",
  }),
  firstYearInService: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional().messages({
    "number.base": "First year in service must be a number.",
    "number.integer": "First year in service must be an integer.",
    "number.min": "First year in service must be after 1900.",
    "number.max": `First year in service cannot be after ${new Date().getFullYear()}.`,
  }),
})

const login = Joi.object({
  email: Joi.string().email().trim().required().messages({
    "string.base": "Email must be a string.",
    "string.email": "Email must be a valid email address.",
    "string.empty": "Email is required.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().trim().required(),
  rememberMe: Joi.boolean().optional(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().trim().required().messages({
    "string.base": "Email must be a string.",
    "string.email": "Email must be a valid email address.",
    "string.empty": "Email is required.",
    "any.required": "Email is required.",
  }),
});

const resetPassword = Joi.object({
  token: Joi.string().required().length(64).messages({
    "string.base": "Token must be a string.",
    "string.empty": "Reset token is required.",
    "string.length": "Invalid token format.",
    "any.required": "Reset token is required.",
  }),
  password: Joi.string().required().custom(password).messages({
    "string.base": "Password must be a string.",
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
});

const updateUser = Joi.object({
  email: Joi.string().trim().email().pattern(/@deped\.gov\.ph$/).optional().strip(),
  firstName: Joi.string().trim().min(3).max(25).optional(),
  middleName: Joi.string().trim().max(10).allow("").optional(),
  lastName: Joi.string().trim().min(3).max(25).optional(),
  role: Joi.string().valid(...personnelRoles).optional(),
  schoolId: Joi.array().items(Joi.string().trim().max(20)).optional(),
  schoolDistrictDivision: Joi.array().items(Joi.string().trim()).optional(),
  status: Joi.string().valid('Approved', 'Rejected', 'Pending').optional(),
  schoolName: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "School Name must be an array.",
  }),
  // Personnel fields that can be updated
  gender: Joi.string().valid(...gender).optional(),
  age: Joi.number().integer().min(18).max(80).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  civilStatus: Joi.string().valid(...civilStatus).optional(),
  yearsInService: Joi.number().integer().min(0).max(50).optional(),
  firstYearInService: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional(),
});

export { register, login, forgotPassword, resetPassword, updateUser };
