import patientDentalChartService from './patient-dental-chart.service.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from 'express-async-handler';
import { extractAuditInfo } from '#utils/helpers.js';
import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const getAllRecords = asyncHandler(async (req, res) => {
  const records = await patientDentalChartService.getAllRecords();

  return res.status(StatusCodes.OK).json({
    success: true,
    data: records,
    message: 'Patient dental charts retrieved successfully'
  });
});

export const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const record = await patientDentalChartService.getRecordById(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Patient dental chart retrieved successfully'
  });
});

export const getRecordsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { patientType } = req.query;

  if (!patientType || !['student', 'personnel'].includes(patientType)) {
    throw new ApiError('Valid patient type (student or personnel) is required', StatusCodes.BAD_REQUEST);
  }

  const records = await patientDentalChartService.getRecordsByPatient(patientId, patientType);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: records,
    message: 'Patient dental charts retrieved successfully'
  });
});

export const createRecord = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);

  const recordData = {
    ...req.body,
    attendedBy: auditInfo.personnelId,
    lastModifiedBy: auditInfo.personnelId
  };

  // Clean up empty references
  if (recordData.student === '' || recordData.student === null) {
    delete recordData.student;
  }
  if (recordData.personnel === '' || recordData.personnel === null) {
    delete recordData.personnel;
  }

  const record = await patientDentalChartService.createRecord(recordData);

  return res.status(StatusCodes.CREATED).json({
    success: true,
    data: record,
    message: 'Patient dental chart created successfully'
  });
});

export const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const auditInfo = extractAuditInfo(req.user);

  const updateData = {
    ...req.body,
    lastModifiedBy: auditInfo.personnelId
  };

  // Remove empty string fields
  if (updateData.student === '' || updateData.student === null) {
    delete updateData.student;
  }
  if (updateData.personnel === '' || updateData.personnel === null) {
    delete updateData.personnel;
  }

  const record = await patientDentalChartService.updateRecord(id, updateData);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Patient dental chart updated successfully'
  });
});

export const deleteRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await patientDentalChartService.deleteRecord(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: 'Patient dental chart deleted successfully'
  });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const stats = await patientDentalChartService.getDashboardStats(filters);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: stats,
    message: 'Dashboard statistics retrieved successfully'
  });
});

export const exportPatientDentalChartToPDF = asyncHandler(async (req, res) => {
  const { patientId } = req.query;

  if (!patientId) {
    throw new ApiError('Patient ID is required', StatusCodes.BAD_REQUEST);
  }

  // Get the most recent dental chart for this patient
  const { patientType } = req.query;
  if (!patientType || !['student', 'personnel'].includes(patientType)) {
    throw new ApiError('Valid patient type (student or personnel) is required', StatusCodes.BAD_REQUEST);
  }

  const records = await patientDentalChartService.getRecordsByPatient(patientId, patientType);
  if (!records || records.length === 0) {
    throw new ApiError('No dental chart found for this patient', StatusCodes.NOT_FOUND);
  }

  // Get the most recent record
  const record = records[0];
  if (!record) {
    throw new ApiError('Patient dental chart not found', StatusCodes.NOT_FOUND);
  }

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size (8.5" x 11")

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Helper function to draw text
  const drawText = (text, x, y, options = {}) => {
    page.drawText(text || '', {
      x,
      y: height - y,
      size: options.size || 9,
      font: options.bold ? fontBold : font,
      color: rgb(0, 0, 0),
      ...options
    });
  };

  // Helper function to draw line
  const drawLine = (x1, y1, x2, y2) => {
    page.drawLine({
      start: { x: x1, y: height - y1 },
      end: { x: x2, y: height - y2 },
      thickness: 0.5,
      color: rgb(0, 0, 0)
    });
  };

  // Helper function to draw checkbox
  const drawCheckbox = (x, y, checked = false) => {
    // Draw box
    page.drawRectangle({
      x,
      y: height - y - 8,
      width: 8,
      height: 8,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5
    });
    // Draw checkmark if checked
    if (checked) {
      page.drawText('X', {
        x: x + 1.5,
        y: height - y - 7,
        size: 6,
        font: font,
        color: rgb(0, 0, 0)
      });
    }
  };

  // Get patient information
  let patientName = { first: '', middle: '', last: '' };
  let birthdate = '';
  let age = '';
  let sex = '';
  let nickname = '';
  let religion = '';
  let nationality = '';
  let homeAddress = '';
  let occupation = '';
  let dentalInsurance = '';
  let effectiveDate = '';
  let homeNo = '';
  let officeNo = '';
  let faxNo = '';
  let cellMobileNo = '';
  let emailAddress = '';
  let parentGuardianName = '';
  let parentOccupation = '';
  let referredBy = '';
  let consultationReason = '';

  if (record.student) {
    patientName.first = record.student.firstName || '';
    patientName.middle = record.student.middleName || '';
    patientName.last = record.student.lastName || '';
    birthdate = record.student.birthdate ? new Date(record.student.birthdate).toLocaleDateString() : '';
    age = record.student.age?.toString() || '';
    sex = record.student.sex || '';
    homeAddress = record.student.address || '';
    cellMobileNo = record.student.contactNo || '';
  } else if (record.personnel) {
    patientName.first = record.personnel.firstName || '';
    patientName.middle = record.personnel.middleName || '';
    patientName.last = record.personnel.lastName || '';
    birthdate = record.personnel.birthdate ? new Date(record.personnel.birthdate).toLocaleDateString() : '';
    age = record.personnel.age?.toString() || '';
    sex = record.personnel.sex || '';
    homeAddress = record.personnel.address || '';
    cellMobileNo = record.personnel.contactNo || '';
  } else if (record.walkInPatient) {
    const wp = record.walkInPatient;
    patientName.first = wp.firstName || '';
    patientName.middle = wp.middleName || '';
    patientName.last = wp.lastName || '';
    birthdate = wp.birthdate ? new Date(wp.birthdate).toLocaleDateString() : '';
    age = wp.age?.toString() || '';
    sex = wp.sex || '';
    nickname = wp.nickname || '';
    religion = wp.religion || '';
    nationality = wp.nationality || '';
    homeAddress = wp.homeAddress || '';
    occupation = wp.occupation || '';
    dentalInsurance = wp.dentalInsurance || '';
    effectiveDate = wp.effectiveDate ? new Date(wp.effectiveDate).toLocaleDateString() : '';
    homeNo = wp.homeNo || '';
    officeNo = wp.officeNo || '';
    faxNo = wp.faxNo || '';
    cellMobileNo = wp.cellMobileNo || '';
    emailAddress = wp.emailAddress || '';
    parentGuardianName = wp.parentGuardianName || '';
    parentOccupation = wp.parentOccupation || '';
    referredBy = wp.referredBy || '';
    consultationReason = wp.consultationReason || '';
  }

  let yPos = 40;

  // Header
  drawText('PHILIPPINE DENTAL ASSOCIATION', 180, yPos, { bold: true, size: 14 });
  yPos += 15;
  drawText('DENTAL CHART', 250, yPos, { bold: true, size: 12, color: rgb(0, 0.4, 0.8) });
  yPos += 25;

  // PATIENT INFORMATION RECORD
  drawText('PATIENT INFORMATION RECORD', 50, yPos, { bold: true, size: 10 });
  yPos += 18;

  // Name with underlines
  drawText('Name:', 50, yPos, { size: 8 });
  drawLine(50, yPos + 10, 570, yPos + 10);
  drawText(patientName.last, 90, yPos + 3, { size: 9 });
  drawText('Last', 90, yPos + 18, { size: 6 });
  drawText(patientName.first, 240, yPos + 3, { size: 9 });
  drawText('First', 240, yPos + 18, { size: 6 });
  drawText(patientName.middle, 390, yPos + 3, { size: 9 });
  drawText('Middle', 390, yPos + 18, { size: 6 });
  yPos += 28;

  // Birthdate, Religion, Sex, Nickname
  drawText(`Birthdate(mm/dd/yy): `, 50, yPos, { size: 8 });
  drawText(birthdate, 135, yPos, { size: 8 });
  drawText(`Age: `, 210, yPos, { size: 8 });
  drawText(age, 228, yPos, { size: 8 });
  drawText(`Sex: ${sex}`, 260, yPos, { size: 8 });
  drawText(`Nickname: ${nickname}`, 310, yPos, { size: 8 });
  yPos += 12;

  drawText(`Religion: `, 50, yPos, { size: 8 });
  drawText(religion, 90, yPos, { size: 8 });
  drawText(`Nationality: `, 210, yPos, { size: 8 });
  drawText(nationality, 265, yPos, { size: 8 });
  yPos += 12;

  // Home Address and Home No
  drawText(`Home Address: `, 50, yPos, { size: 8 });
  drawText(homeAddress, 120, yPos, { size: 8 });
  drawText(`Home No.: `, 350, yPos, { size: 8 });
  drawText(homeNo, 395, yPos, { size: 8 });
  yPos += 12;

  // Occupation and Office No
  drawText(`Occupation: `, 50, yPos, { size: 8 });
  drawText(occupation, 105, yPos, { size: 8 });
  drawText(`Office No.: `, 350, yPos, { size: 8 });
  drawText(officeNo, 395, yPos, { size: 8 });
  yPos += 12;

  // Dental Insurance and Fax No
  drawText(`Dental Insurance: `, 50, yPos, { size: 8 });
  drawText(dentalInsurance, 130, yPos, { size: 8 });
  drawText(`Fax No.: `, 350, yPos, { size: 8 });
  drawText(faxNo, 385, yPos, { size: 8 });
  yPos += 12;

  // Effective Date and Cell/Mobile No
  drawText(`Effective Date: `, 50, yPos, { size: 8 });
  drawText(effectiveDate, 115, yPos, { size: 8 });
  drawText(`Cell/Mobile No.: `, 350, yPos, { size: 8 });
  drawText(cellMobileNo, 425, yPos, { size: 8 });
  yPos += 12;

  // For minors and Email
  drawText(`For minors:`, 50, yPos, { size: 7 });
  drawText(`Email Add: `, 350, yPos, { size: 8 });
  drawText(emailAddress, 395, yPos, { size: 8 });
  yPos += 12;

  drawText(`Parent/ Guardian's Name: `, 50, yPos, { size: 8 });
  drawText(parentGuardianName, 160, yPos, { size: 8 });
  yPos += 12;

  drawText(`Occupation: `, 50, yPos, { size: 8 });
  drawText(parentOccupation, 105, yPos, { size: 8 });
  yPos += 12;

  drawText(`Whom may we thank for referring you? `, 50, yPos, { size: 8 });
  drawText(referredBy, 210, yPos, { size: 8 });
  yPos += 12;

  drawText(`What is your reason for dental consultation? `, 50, yPos, { size: 8 });
  drawText(consultationReason, 235, yPos, { size: 8 });
  yPos += 20;

  // DENTAL HISTORY
  drawText('DENTAL HISTORY', 50, yPos, { bold: true, size: 10 });
  yPos += 15;

  drawText(`Previous Dentist: Dr. `, 50, yPos, { size: 8 });
  drawText(record.dentalHistory?.previousDentist || '', 135, yPos, { size: 8 });
  yPos += 12;

  const lastVisit = record.dentalHistory?.lastDentalVisit
    ? new Date(record.dentalHistory.lastDentalVisit).toLocaleDateString()
    : '';
  drawText(`Last Dental Visit: `, 50, yPos, { size: 8 });
  drawText(lastVisit, 130, yPos, { size: 8 });
  yPos += 20;

  // MEDICAL HISTORY
  drawText('MEDICAL HISTORY', 50, yPos, { bold: true, size: 10 });
  yPos += 15;

  const mh = record.medicalHistory || {};

  drawText(`Name of Physician: Dr. `, 50, yPos, { size: 8 });
  drawText(mh.physicianName || '', 150, yPos, { size: 8 });
  drawText(`Specialty, if applicable: `, 320, yPos, { size: 8 });
  drawText(mh.physicianSpecialty || '', 430, yPos, { size: 8 });
  yPos += 12;

  drawText(`Office Address: `, 50, yPos, { size: 8 });
  drawText(mh.officeAddress || '', 115, yPos, { size: 8 });
  drawText(`Office Number: `, 320, yPos, { size: 8 });
  drawText(mh.officeNumber || '', 395, yPos, { size: 8 });
  yPos += 15;

  // Medical History Questions
  const questions = [
    { q: '1. Are you in good health?', value: mh.inGoodHealth },
    {
      q: '2. Are you under medical treatment now?', value: mh.underMedicalTreatment,
      detail: mh.medicalCondition ? `If so, what is the condition being treated? ${mh.medicalCondition}` : null
    },
    {
      q: '3. Have you ever had serious illness or surgical operation?', value: mh.seriousIllnessOperation,
      detail: mh.illnessDetails ? `If so, what illness or operation? ${mh.illnessDetails}` : null
    },
    {
      q: '4. Have you been hospitalized?', value: mh.hospitalized,
      detail: mh.hospitalizationDetails ? `If so, when and why? ${mh.hospitalizationDetails}` : null
    },
    {
      q: '5. Are you taking any prescription/non-prescription medication?', value: mh.takingMedication,
      detail: mh.medications ? `If so, please specify: ${mh.medications}` : null
    },
    { q: '6. Do you use tobacco products?', value: mh.tobacco },
    { q: '7. Do you use alcohol, cocaine or other dangerous drugs?', value: mh.alcoholCocaine }
  ];

  questions.forEach(item => {
    drawText(item.q, 50, yPos, { size: 7 });
    drawText('Yes', 480, yPos, { size: 7 });
    drawCheckbox(498, yPos, item.value === true);
    drawText('No', 520, yPos, { size: 7 });
    drawCheckbox(535, yPos, item.value === false);
    yPos += 10;

    if (item.detail) {
      drawText(item.detail, 70, yPos, { size: 6 });
      yPos += 9;
    }
  });

  yPos += 3;

  // Allergies
  drawText('8. Are you allergic to any of the following:', 50, yPos, { size: 7 });
  yPos += 10;

  const allergies = [
    { label: 'Local Anesthetic (ex. Lidocaine)', value: mh.localAnesthetic, x: 70 },
    { label: 'Penicillin, Antibiotics', value: mh.penicillin || mh.antibiotics, x: 280 },
    { label: 'Sulfa drugs', value: mh.sulfa, x: 70 },
    { label: 'Aspirin', value: mh.aspirin, x: 280 },
    { label: 'Latex', value: mh.latex, x: 440 },
    { label: `Others`, value: mh.others ? true : false, x: 70 }
  ];

  allergies.forEach((allergy, index) => {
    if (index === 2 || index === 4) yPos += 10;
    drawCheckbox(allergy.x, yPos, allergy.value);
    drawText(allergy.label, allergy.x + 12, yPos, { size: 7 });
    if (index === 5 && mh.others) {
      drawText(`: ${mh.others}`, allergy.x + 50, yPos, { size: 7 });
    }
  });

  yPos += 15;

  // Bleeding Time
  drawText(`9. Bleeding Time: `, 50, yPos, { size: 7 });
  drawText(mh.bleedingTime || '', 120, yPos, { size: 7 });
  yPos += 10;

  // For women only
  drawText('10. For women only:', 50, yPos, { size: 7 });
  yPos += 10;

  drawText('Are you pregnant?', 70, yPos, { size: 7 });
  drawText('Yes', 480, yPos, { size: 7 });
  drawCheckbox(498, yPos, mh.pregnant === true);
  drawText('No', 520, yPos, { size: 7 });
  drawCheckbox(535, yPos, mh.pregnant === false);
  yPos += 10;

  drawText('Are you nursing?', 70, yPos, { size: 7 });
  drawText('Yes', 480, yPos, { size: 7 });
  drawCheckbox(498, yPos, mh.nursing === true);
  drawText('No', 520, yPos, { size: 7 });
  drawCheckbox(535, yPos, mh.nursing === false);
  yPos += 10;

  drawText('Are you taking birth control pills?', 70, yPos, { size: 7 });
  drawText('Yes', 480, yPos, { size: 7 });
  drawCheckbox(498, yPos, mh.birthControlPills === true);
  drawText('No', 520, yPos, { size: 7 });
  drawCheckbox(535, yPos, mh.birthControlPills === false);
  yPos += 12;

  // Blood Type and Pressure
  drawText(`11. Blood Type: `, 50, yPos, { size: 7 });
  drawText(mh.bloodType || '', 110, yPos, { size: 7 });
  yPos += 10;
  drawText(`12. Blood Pressure: `, 50, yPos, { size: 7 });
  drawText(mh.bloodPressure || '', 125, yPos, { size: 7 });
  yPos += 12;

  // Medical Conditions Checklist
  drawText('13. Do you have or have you had any of the following? Check which apply', 50, yPos, { size: 7 });
  yPos += 12;

  const conditions = [
    { label: 'High Blood Pressure', value: mh.conditions?.highBloodPressure, col: 1 },
    { label: 'Heart Disease', value: mh.conditions?.heartDisease, col: 2 },
    { label: 'Cancer / Tumors', value: mh.conditions?.cancerTumors, col: 3 },
    { label: 'Low Blood Pressure', value: mh.conditions?.lowBloodPressure, col: 1 },
    { label: 'Heart Murmur', value: mh.conditions?.heartMurmur, col: 2 },
    { label: 'Anemia', value: mh.conditions?.anemia, col: 3 },
    { label: 'Epilepsy / Convulsions', value: mh.conditions?.epilepsy, col: 1 },
    { label: 'Hepatitis / Liver Disease', value: mh.conditions?.hepatitis, col: 2 },
    { label: 'Angina', value: mh.conditions?.angina, col: 3 },
    { label: 'AIDS or HIV', value: mh.conditions?.aidsHIV, col: 1 },
    { label: 'Rheumatic Fever', value: mh.conditions?.rheumaticFever, col: 2 },
    { label: 'Asthma', value: mh.conditions?.asthma, col: 3 },
    { label: 'Sexually Transmitted disease', value: mh.conditions?.std, col: 1 },
    { label: 'Hay Fever / Allergies', value: mh.conditions?.hayFever, col: 2 },
    { label: 'Emphysema', value: mh.conditions?.emphysema, col: 3 },
    { label: 'Stomach Troubles', value: mh.conditions?.stomachTroubles, col: 1 },
    { label: 'Respiratory Problems', value: mh.conditions?.respiratoryProblems, col: 2 },
    { label: 'Bleeding Problems', value: mh.conditions?.bleedingProblems, col: 3 },
    { label: 'Fainting Seizure', value: mh.conditions?.faintingSeizure, col: 1 },
    { label: 'Hepatitis / Jaundice', value: mh.conditions?.hepatitisJaundice, col: 2 },
    { label: 'Blood Diseases', value: mh.conditions?.bloodDiseases, col: 3 },
    { label: 'Rapid Weight Loss', value: mh.conditions?.rapidWeightLoss, col: 1 },
    { label: 'Tuberculosis', value: mh.conditions?.tuberculosis, col: 2 },
    { label: 'Head Injuries', value: mh.conditions?.headInjuries, col: 3 },
    { label: 'Radiation Therapy', value: mh.conditions?.radiationTherapy, col: 1 },
    { label: 'Swollen ankles', value: mh.conditions?.swollenAnkles, col: 2 },
    { label: 'Arthritis / Rheumatism', value: mh.conditions?.arthritisRheumatism, col: 3 },
    { label: 'Joint Replacement / implant', value: mh.conditions?.jointReplacement, col: 1 },
    { label: 'Kidney disease', value: mh.conditions?.kidneyDisease, col: 2 },
    { label: 'Other', value: mh.conditions?.other, col: 3 },
    { label: 'Heart Surgery', value: mh.conditions?.heartSurgery, col: 1 },
    { label: 'Diabetes', value: mh.conditions?.diabetes, col: 2 },
    { label: '', value: false, col: 3 },
    { label: 'Heart Attack', value: mh.conditions?.heartAttack, col: 1 },
    { label: 'Chest pain', value: mh.conditions?.chestPain, col: 2 },
    { label: '', value: false, col: 3 },
    { label: 'Thyroid Problem', value: mh.conditions?.thyroidProblem, col: 1 },
    { label: 'Stroke', value: mh.conditions?.stroke, col: 2 },
    { label: '', value: false, col: 3 }
  ];

  let currentRow = yPos;
  let rowCount = 0;
  const colPositions = { 1: 50, 2: 220, 3: 390 };

  conditions.forEach(condition => {
    if (condition.label) {
      const xPos = colPositions[condition.col];
      drawCheckbox(xPos, currentRow, condition.value);
      drawText(condition.label, xPos + 12, currentRow, { size: 6 });
    }

    if (condition.col === 3) {
      currentRow += 9;
      rowCount++;
    }
  });

  yPos = currentRow + 12;

  // Signature line
  drawText('Signature', 480, yPos, { size: 7 });
  drawLine(480, yPos + 3, 560, yPos + 3);

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  // Set response headers
  const dateStr = new Date().toISOString().split('T')[0];
  const patientFullName = `${patientName.first}_${patientName.last}`.replace(/\s+/g, '_');
  const fileName = `Dental_Chart_${patientFullName}_${dateStr}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', pdfBytes.length);

  res.send(Buffer.from(pdfBytes));
});
