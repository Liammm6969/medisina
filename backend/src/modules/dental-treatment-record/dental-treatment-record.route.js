import express from 'express';
import { auth } from '#middleware/auth.js';
import validate from '#middleware/validateRequests.js';
import * as dentalTreatmentController from './dental-treatment-record.controller.js';
import { dentalTreatmentValidation } from './dental-treatment-record.validation.js';

const router = express.Router();

router.get('/stats', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), dentalTreatmentController.getDashboardStats);

router.get('/patient/:patientId/history', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), dentalTreatmentController.getPatientHistory);

router.get('/', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), dentalTreatmentController.getAllRecords);

router.get('/:id', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), dentalTreatmentController.getRecordById);

router.post('/', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), validate(dentalTreatmentValidation.createRecord), dentalTreatmentController.createRecord);

router.put('/:id', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), validate(dentalTreatmentValidation.updateRecord), dentalTreatmentController.updateRecord);

router.delete('/:id', auth('Dentist', 'Doctor', 'Admin'), dentalTreatmentController.deleteRecord);

router.post('/:id/treatments', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), validate(dentalTreatmentValidation.addTreatment), dentalTreatmentController.addTreatment);

router.put('/:id/treatments/:treatmentId', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), validate(dentalTreatmentValidation.updateTreatment), dentalTreatmentController.updateTreatment);

router.delete('/:id/treatments/:treatmentId', auth('Dentist', 'Doctor', 'Admin'), dentalTreatmentController.deleteTreatment);

router.get('/:id/export-pdf', auth('Dentist', 'Doctor', 'Nurse', 'Admin'), dentalTreatmentController.exportToPDF);

export default router;
