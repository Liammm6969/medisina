import StudentService from './student.service.js';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from 'express-async-handler';
import { extractAuditInfo } from '#utils/helpers.js';
import StudentModel from './student.model.js';

export const createStudent = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user)

  const student = await StudentService.createStudent({
    ...req.body,
    attendingPersonnel: auditInfo.personnelId
  });

  return res.status(StatusCodes.CREATED).json({
    message: 'Student created successfully',
    data: student
  });
});

export const getStudentById = asyncHandler(async (req, res) => {
  const { stdId } = req.params;
  const student = await StudentService.getStudentById(stdId);

  return res.status(StatusCodes.OK).json({
    data: student
  });
});

export const getAllStudentsByAttendingPersonnel = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);
  const { page = 1, limit = 100 } = req.query;
  const result = await StudentService.getAllStudentsByAttendingPersonnel(
    auditInfo.associatedSchools,
    {
      page: parseInt(page),
      limit: parseInt(limit)
    }
  );



  return res.status(StatusCodes.OK).json({
    data: result.students,
    pagination: result.pagination
  });
});
export const getAllStudents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const result = await StudentService.getAllStudents({
    page: parseInt(page),
    limit: parseInt(limit)
  });



  return res.status(StatusCodes.OK).json({
    data: result.students,
    pagination: result.pagination
  });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const { stdId } = req.params;
  const updateData = req.body;
  const student = await StudentService.updateStudentById(stdId, updateData);

  return res.status(StatusCodes.OK).json({
    message: 'Student updated successfully',
    data: student
  });
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const { stdId } = req.params;
  const result = await StudentService.softDeleteStudent(stdId);

  return res.status(StatusCodes.OK).json({
    message: result.message,
    deletedAt: result.deletedAt
  });
});

export const restoreStudent = asyncHandler(async (req, res) => {
  const { stdId } = req.params;
  const result = await StudentService.restoreStudent(stdId);

  return res.status(StatusCodes.OK).json({
    message: result.message,
    data: result.student
  });
});

export const searchStudents = asyncHandler(async (req, res) => {
  const { query, limit = 50, page = 1 } = req.query;
  const auditInfo = extractAuditInfo(req.user)
  const user = auditInfo.personnelType === 'Doctor' ? null : auditInfo.personnelId
  const result = await StudentService.searchStudents(query, {
    limit: parseInt(limit),
    page: parseInt(page),
    user
  });

  return res.status(StatusCodes.OK).json({
    data: result.students,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }
  });
});

export const getStudentsByGradeLevel = asyncHandler(async (req, res) => {
  const { gradeLevel } = req.params;
  const students = await StudentService.getStudentsByGradeLevel(gradeLevel);

  return res.status(StatusCodes.OK).json({
    data: students
  });
});

export const getStudentsBySection = asyncHandler(async (req, res) => {
  const { gradeLevel, section } = req.params;
  const students = await StudentService.getStudentsBySection(gradeLevel, section);

  return res.status(StatusCodes.OK).json({
    data: students
  });
});

export const getSPEDStudents = asyncHandler(async (req, res) => {
  const students = await StudentService.getSPEDStudents();

  return res.status(StatusCodes.OK).json({
    data: students
  });
});

export const getStudentsByAttendingPersonnel = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user)
  const students = await StudentService.getStudentsByAttendingPersonnel(auditInfo.personnelId);

  return res.status(StatusCodes.OK).json({
    data: students
  });
});

export const getStudentsByGradeLevelCount = asyncHandler(async (req, res) => {
  const counts = await StudentService.countStudentsByGradeLevel();

  return res.status(StatusCodes.OK).json({
    data: counts
  });
});
export const getStudentCount = asyncHandler(async (req, res) => {
  const counts = await StudentService.getStudentCount();

  return res.status(StatusCodes.OK).json({
    data: counts
  });
});

export const getCompleteStudentHistory = asyncHandler(async (req, res) => {
  const { stdId } = req.params;
  const history = await StudentService.getCompleteStudentHistory(stdId);

  return res.status(StatusCodes.OK).json({
    message: 'Student complete history retrieved successfully',
    data: history
  });
});
