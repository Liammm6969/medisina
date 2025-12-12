import asyncHandler from 'express-async-handler';
import prescriptionService from './prescription.service.js';
import { StatusCodes } from 'http-status-codes';
import { uploadFileToCloudinary } from '#utils/cloudinary.js';
import { getMedicationsForClassification, validateMedications } from '#modules/prescription/prescriptionRules.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { extractAuditInfo } from '#utils/helpers.js';




export const createPrescription = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.createPrescription(req.body, req.user._id);

  res.status(StatusCodes.CREATED).json({
    message: 'Prescription created successfully',
    data: prescription
  });
});

export const getPrescriptionById = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.getPrescriptionById(req.params.prescriptionId);

  res.status(StatusCodes.OK).json({
    data: prescription
  });
});

export const getAllPrescriptions = asyncHandler(async (req, res) => {
  const query = {
    ...req.query,
    prescribedBy: req.user._id
  }
  const result = await prescriptionService.getAllPrescriptions(query);

  res.status(StatusCodes.OK).json({
    ...result
  });
});
export const getAllPrescriptionsByUser = asyncHandler(async (req, res) => {
  const query = {
    ...req.query,
    attendingExaminer: req.user._id
  }
  const result = await prescriptionService.getAllPrescriptionsByUser(query);

  res.status(StatusCodes.OK).json({
    ...result
  });

})
export const updatePrescription = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.updatePrescription(
    req.params.prescriptionId,
    req.body,
    req.user._id
  );

  res.status(StatusCodes.OK).json({
    message: 'Prescription updated successfully',
    data: prescription
  });
});

export const deletePrescription = asyncHandler(async (req, res) => {
  await prescriptionService.deletePrescription(req.params.prescriptionId, req.user._id);

  res.status(StatusCodes.OK).json({
    message: 'Prescription deleted successfully'
  });
});

export const getPrescriptionStats = asyncHandler(async (req, res) => {
  const stats = await prescriptionService.getPrescriptionStats(req.query);

  res.status(StatusCodes.OK).json({
    data: stats
  });
});


export const exportPrescriptionPdf = asyncHandler(async (req, res) => {
  const { prescriptionId } = req.params;

  const prescription = await prescriptionService.getPrescriptionById(prescriptionId);
  const PRESCRIPTION_WIDTH = 306;

  let calculatedHeight = 250;
  const medicationCount = prescription?.medications?.length || 0;
  const notesLines = prescription?.notes ? prescription.notes.split('\n').filter(line => line.trim() !== '').length : 0;

  calculatedHeight += medicationCount * 36;

  if (notesLines > 0) {
    calculatedHeight += (notesLines * 11) + 30;
  }

  const PRESCRIPTION_HEIGHT = Math.max(396, calculatedHeight);

  if (!prescription) {
    return res.status(404).json({ message: "Prescription not found" });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PRESCRIPTION_WIDTH, PRESCRIPTION_HEIGHT]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 20;
  let yPosition = height - margin - 15;

  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - 2 * margin,
    height: height - 2 * margin,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  const doctorName = prescription.doctorName || 'RYAN CHRISTOPHER A. BUCCAT MD, MMPHA';
  const doctorSpecialty = prescription.doctorSpecialty || 'General Practitioner';
  const clinicAddress = prescription.clinicAddress || 'Bonifacio Street, Brgy District IV, Bayombong, Nueva Vizcaya';

  page.drawText(doctorName, {
    x: width / 2 - font.widthOfTextAtSize(doctorName, 11) / 2,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 14;

  page.drawText(doctorSpecialty, {
    x: width / 2 - font.widthOfTextAtSize(doctorSpecialty, 9) / 2,
    y: yPosition,
    size: 9,
    font: font,
    color: rgb(0, 0, 0),
  });
  yPosition -= 11;

  page.drawText(clinicAddress, {
    x: width / 2 - font.widthOfTextAtSize(clinicAddress, 7) / 2,
    y: yPosition,
    size: 7,
    font: font,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawLine({
    start: { x: margin + 8, y: yPosition },
    end: { x: width - margin - 8, y: yPosition },
    thickness: 0.75,
    color: rgb(0, 0, 0),
  });
  yPosition -= 12;

  const tableStartY = yPosition;
  const col1X = margin + 12;
  const col2X = col1X + 80;
  const col3X = col2X + 58;
  const col4X = col3X + 50;
  const rowHeight = 16;

  const tableRows = [
    { y: tableStartY, height: rowHeight },
    { y: tableStartY - rowHeight, height: rowHeight }
  ];

  for (let i = 0; i <= 2; i++) {
    const y = tableStartY - (i * rowHeight);
    page.drawLine({
      start: { x: margin + 8, y },
      end: { x: width - margin - 8, y },
      thickness: 0.75,
      color: rgb(0, 0, 0),
    });
  }

  const verticalLines = [margin + 8, col2X - 40, col3X - 3, col4X - 3, width - margin - 8];
  verticalLines.forEach(x => {
    page.drawLine({
      start: { x, y: tableStartY },
      end: { x, y: tableStartY - 2 * rowHeight },
      thickness: 0.75,
      color: rgb(0, 0, 0),
    });
  });

  page.drawText('NAME', { x: col1X, y: tableStartY - 11, size: 8, font: fontBold });
  page.drawText(prescription.patientName || '', { x: col2X - 40, y: tableStartY - 11, size: 8, font });
  page.drawText('DATE', { x: col3X, y: tableStartY - 11, size: 8, font: fontBold });
  const prescribedDate = new Date(prescription.prescribedDate).toLocaleDateString();
  page.drawText(prescribedDate, { x: col4X, y: tableStartY - 11, size: 8, font });

  page.drawText('AGE/SEX', { x: col1X, y: tableStartY - rowHeight - 11, size: 8, font: fontBold });
  const ageSex = `${prescription.patientAge || ''}${prescription.patientSex ? '/' + prescription.patientSex : ''}`;
  page.drawText(ageSex, { x: col2X - 40, y: tableStartY - rowHeight - 11, size: 8, font });
  page.drawText('ADDRESS', { x: col3X, y: tableStartY - rowHeight - 11, size: 8, font: fontBold });
  page.drawText(prescription.patientAddress || '', { x: col4X, y: tableStartY - rowHeight - 11, size: 8, font });

  yPosition = tableStartY - 2 * rowHeight - 15;

  if (prescription.classification) {
    page.drawText(prescription.classification, {
      x: col1X,
      y: yPosition,
      size: 8,
      font: font,
    });
    yPosition -= 14;
  }

  if (prescription.medications && prescription.medications.length > 0) {
    prescription.medications.forEach((med, index) => {
      page.drawText(`${med.itemNumber || index + 1}. ${med.medicationName}`, {
        x: col1X + 8,
        y: yPosition,
        size: 8,
        font: font,
      });
      yPosition -= 11;

      page.drawText(`Sig: ${med.signature || ''}`, {
        x: col1X + 18,
        y: yPosition,
        size: 8,
        font: font,
      });
      yPosition -= 11;

      page.drawText(`Qty: ${med.quantity || ''}`, {
        x: col1X + 18,
        y: yPosition,
        size: 8,
        font: font,
      });
      yPosition -= 14;
    });
  }

  if (prescription.notes) {
    yPosition -= 5;
    page.drawLine({
      start: { x: margin + 8, y: yPosition },
      end: { x: width - margin - 8, y: yPosition },
      thickness: 0.4,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 11;

    page.drawText('Notes:', {
      x: col1X,
      y: yPosition,
      size: 8,
      font: fontBold,
    });
    yPosition -= 11;

    const notesArray = prescription.notes.split('\n').filter(line => line.trim() !== '');
    notesArray.forEach(note => {
      page.drawText(`• ${note}`, {
        x: col1X + 5,
        y: yPosition,
        size: 8,
        font: font,
      });
      yPosition -= 11;
    });
  }

  const footerY = margin + 55;
  const signatureX = width - margin - 135;

  const doctorSignName = prescription.doctorName || 'Ryan christopher A. Buccat MD, MPHA';
  const licenseNumber = prescription.licenseNumber || '0169767';

  page.drawText(doctorSignName, {
    x: signatureX,
    y: footerY,
    size: 8,
    font: fontBold,
  });

  page.drawText(`Lic.# ${licenseNumber}`, {
    x: signatureX,
    y: footerY - 11,
    size: 7,
    font: font,
  });

  const pdfBytes = await pdfDoc.save();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Prescription_${prescription.patientName || prescription.prescriptionId}.pdf`
  );
  res.send(Buffer.from(pdfBytes));
});

export const getMedicationRecommendations = asyncHandler(async (req, res) => {
  const { classification } = req.query;

  if (!classification) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Classification is required'
    });
  }

  const medications = await getMedicationsForClassification(classification);

  res.status(StatusCodes.OK).json({
    message: 'Medication recommendations retrieved successfully',
    data: {
      classification,
      medications,
      count: medications.length
    }
  });
});

export const validatePrescriptionMedications = asyncHandler(async (req, res) => {
  const { classification, medications } = req.body;

  if (!classification) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Classification is required'
    });
  }

  const validation = await validateMedications(classification, medications);

  res.status(StatusCodes.OK).json({
    message: 'Medication validation completed',
    data: validation
  });
});

export const generatePrescriptionFromHealthAlert = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const prescriptionData = await prescriptionService.generatePrescriptionFromHealthAlert(studentId);

  res.status(StatusCodes.OK).json({
    message: 'Prescription data generated successfully',
    data: prescriptionData
  });
});

export const generatePrescriptionFromPersonnelHealth = asyncHandler(async (req, res) => {
  const { personnelId } = req.params;

  const prescriptionData = await prescriptionService.generatePrescriptionFromPersonnelHealth(personnelId);

  res.status(StatusCodes.OK).json({
    message: 'Prescription data generated successfully from personnel health',
    data: prescriptionData
  });
});