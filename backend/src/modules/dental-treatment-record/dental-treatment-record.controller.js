import dentalTreatmentService from './dental-treatment-record.service.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from 'express-async-handler';
import { extractAuditInfo } from '#utils/helpers.js';

export const getAllRecords = asyncHandler(async (req, res) => {

  const records = await dentalTreatmentService.getAllRecords();

  return res.status(StatusCodes.OK).json({
    success: true,
    data: records,
    message: 'Dental treatment records retrieved successfully'
  });
});

export const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const record = await dentalTreatmentService.getRecordById(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Dental treatment record retrieved successfully'
  });
});

export const createRecord = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);

  const recordData = {
    ...req.body,
    attendedBy: auditInfo.userId,
    lastModifiedBy: auditInfo.userId
  };

  // Clean up empty fields based on patientType
  if (recordData.patientType !== 'student' || recordData.student === '' || recordData.student === null) {
    delete recordData.student;
  }
  if (recordData.patientType !== 'personnel' || recordData.personnel === '' || recordData.personnel === null) {
    delete recordData.personnel;
  }
  if (recordData.patientType !== 'walk-in') {
    delete recordData.walkIn;
  }

  const record = await dentalTreatmentService.createRecord(recordData);

  return res.status(StatusCodes.CREATED).json({
    success: true,
    data: record,
    message: 'Dental treatment record created successfully'
  });
});

export const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const auditInfo = extractAuditInfo(req.user);

  const updateData = {
    ...req.body,
    lastModifiedBy: auditInfo.userId
  };

  // Clean up empty fields based on patientType
  if (updateData.patientType && updateData.patientType !== 'student' || updateData.student === '' || updateData.student === null) {
    delete updateData.student;
  }
  if (updateData.patientType && updateData.patientType !== 'personnel' || updateData.personnel === '' || updateData.personnel === null) {
    delete updateData.personnel;
  }
  if (updateData.patientType && updateData.patientType !== 'walk-in') {
    delete updateData.walkIn;
  }

  const record = await dentalTreatmentService.updateRecord(id, updateData);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Dental treatment record updated successfully'
  });
});

export const deleteRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await dentalTreatmentService.deleteRecord(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: 'Dental treatment record deleted successfully'
  });
});

export const addTreatment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const auditInfo = extractAuditInfo(req.user);

  const treatmentData = {
    ...req.body,
    lastModifiedBy: auditInfo.userId
  };

  const record = await dentalTreatmentService.addTreatment(id, treatmentData);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Treatment added successfully'
  });
});

export const updateTreatment = asyncHandler(async (req, res) => {
  const { id, treatmentId } = req.params;
  const auditInfo = extractAuditInfo(req.user);

  const treatmentData = {
    ...req.body,
    lastModifiedBy: auditInfo.userId
  };

  const record = await dentalTreatmentService.updateTreatment(id, treatmentId, treatmentData);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Treatment updated successfully'
  });
});

export const deleteTreatment = asyncHandler(async (req, res) => {
  const { id, treatmentId } = req.params;
  const record = await dentalTreatmentService.deleteTreatment(id, treatmentId);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Treatment deleted successfully'
  });
});

export const getPatientHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { patientType = 'student' } = req.query;

  const records = await dentalTreatmentService.getPatientHistory(patientId, patientType);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: records,
    message: 'Patient dental history retrieved successfully'
  });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, schoolId } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (schoolId) filters.schoolId = schoolId;

  const stats = await dentalTreatmentService.getDashboardStats(filters);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: stats,
    message: 'Dashboard statistics retrieved successfully'
  });
});

export const exportToPDF = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pdfBuffer = await dentalTreatmentService.exportToPDF(id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=dental-treatment-record-${id}.pdf`);
  res.setHeader('Content-Length', pdfBuffer.length);

  return res.send(pdfBuffer);
});
