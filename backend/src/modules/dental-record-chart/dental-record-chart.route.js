import express from 'express';
import { auth } from '#middleware/auth.js';
import validate from '#middleware/validateRequests.js';
import * as dentalRecordChartController from './dental-record-chart.controller.js';
import { dentalRecordChartValidation } from './dental-record-chart.validation.js';

const router = express.Router();

router.get('/stats', auth('Doctor', 'Nurse', 'Admin'), dentalRecordChartController.getDashboardStats);

router.get('/export', auth('Doctor', 'Nurse', 'Admin'), dentalRecordChartController.exportDentalRecordsToExcel);

router.get('/patient/:patientId', auth('Doctor', 'Nurse', 'Admin'), validate(dentalRecordChartValidation.getRecordsByPatient), dentalRecordChartController.getRecordsByPatient);

router.get('/', auth('Doctor', 'Nurse', 'Admin'), dentalRecordChartController.getAllRecords);

router.get('/:id', auth('Doctor', 'Nurse', 'Admin'), validate(dentalRecordChartValidation.getRecordById), dentalRecordChartController.getRecordById);

router.post('/', auth('Doctor', 'Nurse', 'Admin'), validate(dentalRecordChartValidation.createRecord), dentalRecordChartController.createRecord);

router.put('/:id', auth('Doctor', 'Nurse', 'Admin'), validate(dentalRecordChartValidation.updateRecord), dentalRecordChartController.updateRecord);

router.delete('/:id', auth('Doctor', 'Nurse', 'Admin'), validate(dentalRecordChartValidation.deleteRecord), dentalRecordChartController.deleteRecord);

export default router;
