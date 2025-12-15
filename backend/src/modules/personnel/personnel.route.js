
import { auth } from "#middleware/auth.js";
import * as personnelController from "./personnel.controller.js";
import { createPersonnelSchema, getPersonnelById, updatePersonnelSchema } from "./personnel.validation.js";
import validate from '#middleware/validateRequests.js';

import express from "express";
const router = express.Router();


router.route('/')
  .post(auth('Doctor', 'Admin', 'Nurse'), validate({ body: createPersonnelSchema }), personnelController.createPersonnel)
  .get(auth('Admin', 'Doctor', 'Nurse'), personnelController.fetchAllPersonnel);

router.route('/count')
  .get(auth('Admin', 'Doctor', 'Nurse'), personnelController.getPersonnelCount)

router
  .route('/search')
  .get(auth('Admin', 'Doctor', 'Nurse'), personnelController.searchPersonnel)

router
  .route('/personnel-name')
  .get(auth('Doctor', 'Admin', 'Nurse'), personnelController.getPersonnelByName)

router
  .route('/get-all-personnel-by-user')
  .get(auth('Doctor', 'Admin', 'Nurse'), personnelController.fetchAllPersonnelByUser)

router
  .route('/my-personnel-record')
  .get(auth('Doctor', 'Admin', 'Nurse', 'Teacher'), personnelController.getMyPersonnelRecord)

router.route('/:perId/complete-history')
  .get(auth('Admin', 'Doctor', 'Nurse'), validate({ params: getPersonnelById }), personnelController.getCompletePersonnelHistory);

router.route('/:perId')
  .put(auth('Admin', 'Nurse', 'Doctor'), validate({ body: updatePersonnelSchema }), personnelController.updatePersonnelById)
  .delete(auth('Admin', 'Nurse'), validate({ params: getPersonnelById }), personnelController.deletePersonnelById)
  .get(auth('Admin', 'Doctor', 'Nurse'), validate({ params: getPersonnelById }), personnelController.getPersonnelById)
  .post(auth('Admin', 'Doctor'), validate({ params: getPersonnelById }), personnelController.restorePersonnelById);

export default router;
