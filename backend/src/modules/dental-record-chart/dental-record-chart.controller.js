import dentalRecordChartService from './dental-record-chart.service.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from 'express-async-handler';
import { extractAuditInfo } from '#utils/helpers.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const getAllRecords = asyncHandler(async (req, res) => {
  const records = await dentalRecordChartService.getAllRecords();
  return res.status(StatusCodes.OK).json({
    success: true,
    data: records,
    message: 'Dental record charts retrieved successfully'
  });
});

export const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const record = await dentalRecordChartService.getRecordById(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Dental record chart retrieved successfully'
  });
});

export const getRecordsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { patientType } = req.query;

  if (!patientType || !['student', 'personnel'].includes(patientType)) {
    throw new ApiError('Valid patient type (student or personnel) is required', StatusCodes.BAD_REQUEST);
  }

  const records = await dentalRecordChartService.getRecordsByPatient(patientId, patientType);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: records,
    message: 'Patient dental record charts retrieved successfully'
  });
});

export const createRecord = asyncHandler(async (req, res) => {
  const auditInfo = extractAuditInfo(req.user);

  const recordData = {
    ...req.body,
    attendedBy: auditInfo.userId,
    lastModifiedBy: auditInfo.userId
  };

  // Clean up empty references
  if (recordData.student === '' || recordData.student === null) {
    delete recordData.student;
  }
  if (recordData.personnel === '' || recordData.personnel === null) {
    delete recordData.personnel;
  }

  const record = await dentalRecordChartService.createRecord(recordData);

  return res.status(StatusCodes.CREATED).json({
    success: true,
    data: record,
    message: 'Dental record chart created successfully'
  });
});

export const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const auditInfo = extractAuditInfo(req.user);

  const updateData = {
    ...req.body,
    lastModifiedBy: auditInfo.userId
  };

  // Remove empty string fields to prevent MongoDB cast errors
  if (updateData.student === '' || updateData.student === null) {
    delete updateData.student;
  }
  if (updateData.personnel === '' || updateData.personnel === null) {
    delete updateData.personnel;
  }

  const record = await dentalRecordChartService.updateRecord(id, updateData);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: record,
    message: 'Dental record chart updated successfully'
  });
});

export const deleteRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await dentalRecordChartService.deleteRecord(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: 'Dental record chart deleted successfully'
  });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const stats = await dentalRecordChartService.getDashboardStats(filters);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: stats,
    message: 'Dashboard statistics retrieved successfully'
  });
});

export const exportDentalRecordsToExcel = asyncHandler(async (req, res) => {
  const { patientId, patientType, startDate, endDate } = req.query;

  let records;
  if (patientId && patientType) {
    if (!['student', 'personnel'].includes(patientType)) {
      throw new ApiError('Valid patient type (student or personnel) is required', StatusCodes.BAD_REQUEST);
    }
    records = await dentalRecordChartService.getRecordsByPatient(patientId, patientType);
  } else {
    records = await dentalRecordChartService.getAllRecords();
  }

  if (startDate || endDate) {
    records = records.filter(record => {
      const examDate = new Date(record.dateOfExamination);
      if (startDate && examDate < new Date(startDate)) return false;
      if (endDate && examDate > new Date(endDate)) return false;
      return true;
    });
  }

  console.log(records);

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSmall = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Helper function to add a new page
  const addRecordPage = async (record) => {
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    const margin = 40;
    let yPos = height - 40;

    // Helper to draw text
    const drawText = (text, x, y, options = {}) => {
      page.drawText(text || '', {
        x,
        y,
        size: options.size || 8,
        font: options.bold ? fontBold : font,
        color: options.color || rgb(0, 0, 0),
        maxWidth: options.maxWidth || width - x - margin
      });
    };

    // Helper to draw rectangle
    const drawRect = (x, y, w, h, options = {}) => {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: rgb(0, 0, 0),
        borderWidth: options.borderWidth || 0.5,
        color: options.fill ? rgb(0.9, 0.9, 0.9) : undefined
      });
    };

    // Helper to draw line
    const drawLine = (x1, y1, x2, y2, options = {}) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: options.thickness || 0.5,
        color: rgb(0, 0, 0)
      });
    };

    // Get patient info
    let patientName = 'Unknown';
    let age = 'N/A';
    let gender = 'N/A';

    if (record.student) {
      patientName = `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim();
      age = record.student.age || 'N/A';
      gender = record.student.sex || 'N/A';
    } else if (record.personnel) {
      patientName = `${record.personnel.firstName || ''} ${record.personnel.lastName || ''}`.trim();
      age = record.personnel.age || 'N/A';
      gender = record.personnel.sex || 'N/A';
    } else if (record.walkInPatient) {
      patientName = record.walkInPatient.name || 'Unknown';
      age = record.walkInPatient.age || 'N/A';
      gender = record.walkInPatient.gender || 'N/A';
    }

    // Header with gray background
    drawText('DENTAL RECORD CHART', width / 2 - 60, yPos - 15, { bold: true, size: 12 });
    yPos -= 35;

    // Patient Information Section
    drawText('INTRAORAL EXAMINATION', margin, yPos, { bold: true, size: 10 });
    yPos -= 20;

    drawText(`Name: ${patientName}`, margin, yPos, { size: 9 });
    drawText(`Age: ${age}`, width - 200, yPos, { size: 9 });
    yPos -= 12;
    drawText(`Gender: M/F ${gender}`, margin, yPos, { size: 9 });
    drawText(`Date: ${record.dateOfExamination ? new Date(record.dateOfExamination).toLocaleDateString() : ''}`, width - 200, yPos, { size: 9 });
    yPos -= 25;

    // Tooth Chart Section - Matching image layout
    drawLine(margin, yPos, width - margin, yPos);
    yPos -= 15;

    const chartStartX = margin + 80;
    const toothSize = 18;
    const toothSpacing = 24;
    const statusBoxHeight = 14;
    const centerX = width / 2;
    const tempChartStartX = chartStartX + 70; // Offset for temporary teeth centering

    // Helper to draw tooth circle with cross pattern
    const drawTooth = (x, y, toothNum, status) => {
      const cx = x + toothSize / 2;
      const cy = y - toothSize / 2;

      // Outer circle
      page.drawCircle({
        x: cx,
        y: cy,
        size: toothSize / 2 - 1,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8
      });

      // Inner cross pattern
      const crossSize = toothSize / 4;
      page.drawLine({
        start: { x: cx - crossSize, y: cy },
        end: { x: cx + crossSize, y: cy },
        thickness: 0.5,
        color: rgb(0, 0, 0)
      });
      page.drawLine({
        start: { x: cx, y: cy - crossSize },
        end: { x: cx, y: cy + crossSize },
        thickness: 0.5,
        color: rgb(0, 0, 0)
      });

      // Tooth number below circle, above boxes
      drawText(toothNum, x + 5, y - toothSize - 4, { size: 6 });

      // Status marker if not present
      if (status && status !== 'P' && status !== 'Present') {
        drawText(status.charAt(0), cx - 2, cy - 2, { size: 6, bold: true });
      }
    };

    const upperPerm = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
    const lowerPerm = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
    const upperTemp = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'];
    const lowerTemp = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'];

    // TOP: STATUS RIGHT label
    drawText('STATUS', margin + 100, yPos + 5, { size: 6 });
    drawText('RIGHT', margin + 100, yPos - 3, { size: 6 });

    // Temporary Teeth Upper - TWO Status boxes per tooth (stacked)
    let xPos = tempChartStartX;
    upperTemp.forEach((toothNum) => {
      const tooth = record.temporaryTeeth?.find(t => t.toothNumber === toothNum);

      // Upper box (secondary condition)
      drawRect(xPos, yPos - statusBoxHeight, toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.secondaryCondition && tooth.secondaryCondition !== 'Present') {
        drawText(tooth.secondaryCondition.substring(0, 2), xPos + 6, yPos - 9, { size: 5 });
      }

      // Lower box (primary condition)
      drawRect(xPos, yPos - (statusBoxHeight * 2), toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.condition && tooth.condition !== 'Present') {
        drawText(tooth.condition.substring(0, 2), xPos + 6, yPos - statusBoxHeight - 9, { size: 5 });
      }

      xPos += toothSpacing;
    });
    drawText('LEFT', xPos + 15, yPos - 5, { size: 6 });
    yPos -= (statusBoxHeight * 2) + 3;


    // Temporary teeth circles (Upper)
    xPos = tempChartStartX;
    upperTemp.forEach((toothNum) => {
      const tooth = record.temporaryTeeth?.find(t => t.toothNumber === toothNum);
      // Show primary condition or secondary if primary is Present
      const status = tooth?.condition && tooth.condition !== 'Present'
        ? tooth.condition
        : tooth?.secondaryCondition || 'Present';
      drawTooth(xPos, yPos, toothNum, status);
      xPos += toothSpacing;
    });
    yPos -= 30;

    // Permanent Teeth Upper - TWO Status boxes per tooth (stacked)
    xPos = chartStartX;
    upperPerm.forEach((toothNum) => {
      const tooth = record.permanentTeeth?.find(t => t.toothNumber === toothNum);

      // Upper box (secondary condition)
      drawRect(xPos, yPos - statusBoxHeight, toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.secondaryCondition && tooth.secondaryCondition !== 'Present') {
        drawText(tooth.secondaryCondition.substring(0, 2), xPos + 6, yPos - 9, { size: 5 });
      }

      // Lower box (primary condition)
      drawRect(xPos, yPos - (statusBoxHeight * 2), toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.condition && tooth.condition !== 'Present') {
        drawText(tooth.condition.substring(0, 2), xPos + 6, yPos - statusBoxHeight - 9, { size: 5 });
      }

      xPos += toothSpacing;
    });
    yPos -= (statusBoxHeight * 2) + 3;

    // PERMANENT TEETH label (left side)
    drawText('PERMANENT', margin + 5, yPos + 15, { size: 6, bold: true });
    drawText('TEETH', margin + 10, yPos + 5, { size: 6, bold: true });

    // Permanent teeth circles (Upper)
    xPos = chartStartX;
    upperPerm.forEach((toothNum) => {
      const tooth = record.permanentTeeth?.find(t => t.toothNumber === toothNum);
      // Show primary condition or secondary if primary is Present
      const status = tooth?.condition && tooth.condition !== 'Present'
        ? tooth.condition
        : tooth?.secondaryCondition || 'Present';
      drawTooth(xPos, yPos, toothNum, status);
      xPos += toothSpacing;
    });
    yPos -= 25;

    // CENTER DIVIDING LINES
    const verticalLineX = chartStartX + (8.3 * toothSpacing) - 12;
    drawLine(verticalLineX, yPos + 100, verticalLineX, yPos - 110, { thickness: 1.5 });
    drawLine(chartStartX - 10, yPos - 5, chartStartX + (16 * toothSpacing) - 10, yPos - 5, { thickness: 1.5 });
    yPos -= 10;

    // Permanent teeth circles (Lower)
    xPos = chartStartX;
    lowerPerm.forEach((toothNum) => {
      const tooth = record.permanentTeeth?.find(t => t.toothNumber === toothNum);
      // Show primary condition or secondary if primary is Present
      const status = tooth?.condition && tooth.condition !== 'Present'
        ? tooth.condition
        : tooth?.secondaryCondition || 'Present';
      drawTooth(xPos, yPos, toothNum, status);
      xPos += toothSpacing;
    });
    yPos -= 25;

    // Permanent Teeth Lower - TWO Status boxes per tooth (stacked)
    xPos = chartStartX;
    lowerPerm.forEach((toothNum) => {
      const tooth = record.permanentTeeth?.find(t => t.toothNumber === toothNum);

      // Upper box (primary condition)
      drawRect(xPos, yPos - statusBoxHeight, toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.condition && tooth.condition !== 'Present') {
        drawText(tooth.condition.substring(0, 2), xPos + 6, yPos - 10, { size: 5 });
      }

      // Lower box (secondary condition)
      drawRect(xPos, yPos - (statusBoxHeight * 2), toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.secondaryCondition && tooth.secondaryCondition !== 'Present') {
        drawText(tooth.secondaryCondition.substring(0, 2), xPos + 6, yPos - statusBoxHeight - 9, { size: 5 });
      }

      xPos += toothSpacing;
    });
    yPos -= (statusBoxHeight * 2) + 5;

    // TEMPORARY TEETH label (lower)
    drawText('TEMPORARY', margin + 5, yPos + 5, { size: 6 });
    drawText('TEETH', margin + 10, yPos - 5, { size: 6 });

    // Temporary teeth circles (Lower)
    xPos = tempChartStartX;
    lowerTemp.forEach((toothNum) => {
      const tooth = record.temporaryTeeth?.find(t => t.toothNumber === toothNum);
      // Show primary condition or secondary if primary is Present
      const status = tooth?.condition && tooth.condition !== 'Present'
        ? tooth.condition
        : tooth?.secondaryCondition || 'Present';
      drawTooth(xPos, yPos, toothNum, status);
      xPos += toothSpacing;
    });
    yPos -= 25;

    // Temporary Teeth Lower - TWO Status boxes per tooth (stacked)
    drawText('STATUS', margin + 100, yPos - 5, { size: 6 });
    drawText('RIGHT', margin + 100, yPos - 13, { size: 6 });
    xPos = tempChartStartX;
    lowerTemp.forEach((toothNum) => {
      const tooth = record.temporaryTeeth?.find(t => t.toothNumber === toothNum);

      // Upper box (primary condition)
      drawRect(xPos, yPos - statusBoxHeight, toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.condition && tooth.condition !== 'Present') {
        drawText(tooth.condition.substring(0, 2), xPos + 6, yPos - 9, { size: 5 });
      }

      // Lower box (secondary condition)
      drawRect(xPos, yPos - (statusBoxHeight * 2), toothSpacing - 2, statusBoxHeight);
      if (tooth && tooth.secondaryCondition && tooth.secondaryCondition !== 'Present') {
        drawText(tooth.secondaryCondition.substring(0, 2), xPos + 6, yPos - statusBoxHeight - 9, { size: 5 });
      }

      xPos += toothSpacing;
    });
    drawText('LEFT', xPos + 15, yPos - 8, { size: 6 });
    yPos -= (statusBoxHeight * 2) + 15;

    // Bottom section with checkboxes layout
    drawLine(margin, yPos, width - margin, yPos);
    yPos -= 15;

    // Legend section
    drawText('Legend: Condition', margin, yPos, { bold: true, size: 7 });
    yPos -= 10;
    drawText('D - Decayed', margin + 5, yPos, { size: 6 });
    drawText('M - Missing', margin + 80, yPos, { size: 6 });
    drawText('MO - Missing Other Causes', margin + 155, yPos, { size: 6 });
    yPos -= 8;
    drawText('Im - Impacted', margin + 5, yPos, { size: 6 });
    drawText('Sp - Supernumerary', margin + 80, yPos, { size: 6 });
    drawText('Rf - Root Fragment', margin + 180, yPos, { size: 6 });
    yPos -= 15;
    drawText('Un - Unerupted', margin + 5, yPos, { size: 6 });
    yPos -= 15;

    const col1X = margin;
    const col2X = margin + 180;
    const col3X = margin + 360;
    let col1Y = yPos;
    let col2Y = yPos;
    let col3Y = yPos;

    drawText('Periodontal Screening:', col1X, col1Y, { bold: true, size: 8 });
    col1Y -= 12;
    drawText(`[ ${record.periodontalScreening?.gingivitis ? 'X' : ' '} ] Gingivitis`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`[ ${record.periodontalScreening?.earlyPeriodontitis ? 'X' : ' '} ] Early Periodontitis`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`[ ${record.periodontalScreening?.moderatePeriodontitis ? 'X' : ' '} ] Moderate Periodontitis`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`[ ${record.periodontalScreening?.advancedPeriodontitis ? 'X' : ' '} ] Advanced Periodontitis`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 15;

    drawText('Occlusion:', col1X, col1Y, { bold: true, size: 8 });
    col1Y -= 12;
    drawText(`Class (Molar): ${record.occlusion?.classMolar || '____'}`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`Overjet: ${record.occlusion?.overjet || '____'}`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`Overbite: ${record.occlusion?.overbite || '____'}`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`Midline Deviation: ${record.occlusion?.midlineDeviation || '____'}`, col1X + 5, col1Y, { size: 7 });
    col1Y -= 10;
    drawText(`Crossbite: ${record.occlusion?.crossbite || '____'}`, col1X + 5, col1Y, { size: 7 });

    drawText('Appliances:', col2X, col2Y, { bold: true, size: 8 });
    col2Y -= 12;
    drawText(`Orthodontic: ${record.appliances?.orthodontic || 'None'}`, col2X + 5, col2Y, { size: 7 });
    col2Y -= 10;
    drawText(`Stayplate: ${record.appliances?.stayplate || 'None'}`, col2X + 5, col2Y, { size: 7 });
    col2Y -= 10;
    drawText(`Others: ${record.appliances?.others || 'None'}`, col2X + 5, col2Y, { size: 7 });
    col2Y -= 15;

    drawText('TMD:', col2X, col2Y, { bold: true, size: 8 });
    col2Y -= 12;
    drawText(`[ ${record.tmd?.clenching ? 'X' : ' '} ] Clenching`, col2X + 5, col2Y, { size: 7 });
    col2Y -= 10;
    drawText(`[ ${record.tmd?.clicking ? 'X' : ' '} ] Clicking`, col2X + 5, col2Y, { size: 7 });
    col2Y -= 10;
    drawText(`[ ${record.tmd?.trismus ? 'X' : ' '} ] Trismus`, col2X + 5, col2Y, { size: 7 });
    col2Y -= 10;
    drawText(`[ ${record.tmd?.muscleSpasm ? 'X' : ' '} ] Muscle Spasm`, col2X + 5, col2Y, { size: 7 });

    drawText('X-ray Taken:', col3X, col3Y, { bold: true, size: 8 });
    col3Y -= 12;
    drawText(`Periapical (Tin No.: ${record.xrayTaken?.periapical || '__'})`, col3X + 5, col3Y, { size: 7 });
    col3Y -= 10;
    drawText(`[ ${record.xrayTaken?.panoramic ? 'X' : ' '} ] Panoramic`, col3X + 5, col3Y, { size: 7 });
    col3Y -= 10;
    drawText(`[ ${record.xrayTaken?.cephalometric ? 'X' : ' '} ] Cephalometric`, col3X + 5, col3Y, { size: 7 });
    col3Y -= 10;
    drawText(`Occlusal: ${record.xrayTaken?.occlusal || '____'}`, col3X + 5, col3Y, { size: 7 });
    col3Y -= 10;
    drawText(`Others: ${record.xrayTaken?.others || '____'}`, col3X + 5, col3Y, { size: 7 });

    yPos = Math.min(col1Y, col2Y, col3Y) - 15;
    if (record.remarks) {
      drawText('Remarks:', margin, yPos, { bold: true, size: 8 });
      yPos -= 12;
      const remarkLines = record.remarks.match(/.{1,85}/g) || [record.remarks];
      remarkLines.forEach(line => {
        drawText(line, margin + 5, yPos, { size: 7 });
        yPos -= 10;
      });
      yPos -= 5;
    }

    drawLine(margin, 60, width - margin, 60);
    const attendedBy = record.attendedBy
      ? `${record.attendedBy.firstName || ''} ${record.attendedBy.lastName || ''}`.trim()
      : 'N/A';
    drawText('Generated: ' + new Date().toLocaleDateString(), margin, 35, { size: 6 });
  };

  for (const record of records) {
    await addRecordPage(record);
  }

  const pdfBytes = await pdfDoc.save();

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = patientId
    ? `Dental_Record_${patientId}_${dateStr}.pdf`
    : `Dental_Records_Export_${dateStr}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', pdfBytes.length);

  res.send(Buffer.from(pdfBytes));
});
