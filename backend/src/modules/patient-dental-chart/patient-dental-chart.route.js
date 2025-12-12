import express from 'express';
import { auth } from '#middleware/auth.js';
import validate from '#middleware/validateRequests.js';
import * as patientDentalChartController from './patient-dental-chart.controller.js';
import { patientDentalChartValidation } from './patient-dental-chart.validation.js';

const router = express.Router();

router.get('/stats', auth('Doctor', 'Nurse', 'Admin'), patientDentalChartController.getDashboardStats);

router.get('/export', auth('Doctor', 'Nurse', 'Admin'), patientDentalChartController.exportPatientDentalChartToPDF);

router.get('/patient/:patientId', auth('Doctor', 'Nurse', 'Admin'), validate(patientDentalChartValidation.getRecordsByPatient), patientDentalChartController.getRecordsByPatient);

router.get('/', auth('Doctor', 'Nurse', 'Admin'), patientDentalChartController.getAllRecords);

router.get('/:id', auth('Doctor', 'Nurse', 'Admin'), validate(patientDentalChartValidation.getRecordById), patientDentalChartController.getRecordById);

router.post('/', auth('Doctor', 'Nurse', 'Admin'), validate(patientDentalChartValidation.createRecord), patientDentalChartController.createRecord);

router.put('/:id', auth('Doctor', 'Nurse', 'Admin'), validate(patientDentalChartValidation.updateRecord), patientDentalChartController.updateRecord);

router.delete('/:id', auth('Doctor', 'Nurse', 'Admin'), validate(patientDentalChartValidation.deleteRecord), patientDentalChartController.deleteRecord);

export default router;
