import DentalTreatmentRecord from './dental-treatment-record.model.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
import logger from '#logger/logger.js';
import notificationService from '#modules/notifications/notification.service.js';
import { NOTIFICATION_TITLE, NOTIFICATION_TYPES, PRIORITY_LEVELS } from '#utils/constants.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

class DentalTreatmentService {

  async getAllRecords() {
    const cacheKey = CACHE_KEYS.DENTAL_TREATMENT.ALL();

    try {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        logger.info(`Cache hit: ${cacheKey}`);
        return cachedData;
      }
    } catch (error) {
      logger.warn('Cache read error, proceeding with DB query:', error);
    }

    const records = await DentalTreatmentRecord.find({ isDeleted: false })
      .populate([
        { path: 'student', select: 'firstName lastName stdId schoolName gradeLevel' },
        { path: 'personnel', select: 'firstName lastName perId position' },
        { path: 'attendedBy', select: 'firstName lastName role' },
        { path: 'lastModifiedBy', select: 'firstName lastName role' }
      ])
      .sort({ updatedAt: -1 })
      .lean();

    await cache.set(cacheKey, records, CACHE_TTL.MEDIUM);
    return records;
  }

  async getRecordById(id) {
    const record = await DentalTreatmentRecord.findOne({
      $or: [{ _id: id }, { dtrId: id }],
      isDeleted: false
    })
      .populate([
        { path: 'student', select: 'firstName lastName stdId schoolName gradeLevel' },
        { path: 'personnel', select: 'firstName lastName perId position' },
        { path: 'attendedBy', select: 'firstName lastName role' },
        { path: 'lastModifiedBy', select: 'firstName lastName role' }
      ]);

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }
    return record;
  }

  async createRecord(recordData) {
    const { patientType, student, personnel, walkIn } = recordData;

    if (patientType === 'student' && !student) {
      throw new ApiError('Student reference is required for student patient type', StatusCodes.BAD_REQUEST);
    }
    if (patientType === 'personnel' && !personnel) {
      throw new ApiError('Personnel reference is required for personnel patient type', StatusCodes.BAD_REQUEST);
    }
    if (patientType === 'walk-in' && (!walkIn || !walkIn.name || !walkIn.age || !walkIn.gender)) {
      throw new ApiError('Walk-in patient details (name, age, gender) are required', StatusCodes.BAD_REQUEST);
    }

    const record = await DentalTreatmentRecord.create(recordData);

    if (recordData.attendedBy) {
      let patientName;
      if (patientType === 'walk-in') {
        patientName = walkIn.name;
      } else {
        patientName = recordData.student
          ? `Student ID: ${recordData.student}`
          : `Personnel ID: ${recordData.personnel}`;
      }

      await notificationService.createNotification({
        recipientId: recordData.attendedBy,
        title: NOTIFICATION_TITLE.DENTAL_TREATMENT_RECORD || 'Dental Treatment Record',
        message: `Dental Treatment Record for ${patientName} has been created`,
        type: NOTIFICATION_TYPES.NEW_RECORD,
        priority: PRIORITY_LEVELS.MEDIUM,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.DENTAL_TREATMENT.PATTERN);
    return record;
  }

  async updateRecord(id, updateData) {
    const record = await DentalTreatmentRecord.findOneAndUpdate(
      { $or: [{ _id: id }, { dtrId: id }], isDeleted: false },
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate([
      { path: 'student', select: 'firstName lastName stdId' },
      { path: 'personnel', select: 'firstName lastName perId' },
      { path: 'attendedBy', select: 'firstName lastName role' }
    ]);

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }

    if (record.attendedBy) {
      const patientName = record.student
        ? `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim()
        : record.personnel
          ? `${record.personnel.firstName || ''} ${record.personnel.lastName || ''}`.trim()
          : 'Patient';

      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.DENTAL_TREATMENT_RECORD || 'Dental Treatment Record',
        message: `Dental Treatment Record for ${patientName} has been updated`,
        type: NOTIFICATION_TYPES.RECORD_UPDATE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.DENTAL_TREATMENT.PATTERN);
    return record;
  }

  async deleteRecord(id) {
    const record = await DentalTreatmentRecord.findOneAndUpdate(
      { $or: [{ _id: id }, { dtrId: id }] },
      { isDeleted: true },
      { new: true }
    );

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }

    if (record.attendedBy) {
      const patientInfo = record.student
        ? `Student ID: ${record.student}`
        : `Personnel ID: ${record.personnel}`;

      await notificationService.createNotification({
        recipientId: record.attendedBy,
        title: NOTIFICATION_TITLE.DENTAL_TREATMENT_RECORD || 'Dental Treatment Record',
        message: `Dental Treatment Record for ${patientInfo} has been deleted`,
        type: NOTIFICATION_TYPES.RECORD_DELETE,
        priority: PRIORITY_LEVELS.LOW,
        isActionRequired: false
      });
    }

    await cache.delPattern(CACHE_KEYS.DENTAL_TREATMENT.PATTERN);
    return true;
  }

  async addTreatment(id, treatmentData) {
    const record = await DentalTreatmentRecord.findOneAndUpdate(
      { $or: [{ _id: id }, { dtrId: id }], isDeleted: false },
      {
        $push: { treatments: treatmentData },
        $set: { lastModifiedBy: treatmentData.lastModifiedBy }
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'student', select: 'firstName lastName stdId' },
      { path: 'personnel', select: 'firstName lastName perId' },
      { path: 'attendedBy', select: 'firstName lastName role' }
    ]);

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }

    await cache.delPattern(CACHE_KEYS.DENTAL_TREATMENT.PATTERN);
    return record;
  }

  async updateTreatment(recordId, treatmentId, treatmentData) {
    const record = await DentalTreatmentRecord.findOne({
      $or: [{ _id: recordId }, { dtrId: recordId }],
      isDeleted: false
    });

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }

    const treatment = record.treatments.id(treatmentId);
    if (!treatment) {
      throw new ApiError('Treatment entry not found', StatusCodes.NOT_FOUND);
    }

    Object.assign(treatment, treatmentData);
    if (treatmentData.lastModifiedBy) {
      record.lastModifiedBy = treatmentData.lastModifiedBy;
    }

    await record.save();
    await cache.delPattern(CACHE_KEYS.DENTAL_TREATMENT.PATTERN);

    return record;
  }

  async deleteTreatment(recordId, treatmentId) {
    const record = await DentalTreatmentRecord.findOne({
      $or: [{ _id: recordId }, { dtrId: recordId }],
      isDeleted: false
    });

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }

    record.treatments.pull(treatmentId);
    await record.save();
    await cache.delPattern(CACHE_KEYS.DENTAL_TREATMENT.PATTERN);

    return record;
  }

  async getPatientHistory(patientId, patientType = 'student') {
    const query = { isDeleted: false };
    query[patientType] = patientId;

    const records = await DentalTreatmentRecord.find(query)
      .populate([
        { path: 'student', select: 'firstName lastName stdId' },
        { path: 'personnel', select: 'firstName lastName perId' },
        { path: 'attendedBy', select: 'firstName lastName role' }
      ])
      .sort({ updatedAt: -1 })
      .lean();

    return records;
  }

  async getDashboardStats(filters = {}) {
    const { startDate, endDate, schoolId } = filters;

    const matchQuery = { isDeleted: false };

    if (schoolId) {
      matchQuery.schoolId = schoolId;
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const dateRange = {
      start: startDate ? new Date(startDate) : startOfToday,
      end: endDate ? new Date(endDate) : endOfToday
    };

    const totalRecords = await DentalTreatmentRecord.countDocuments(matchQuery);

    const recordsInRange = await DentalTreatmentRecord.countDocuments({
      ...matchQuery,
      'treatments.date': {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    });

    const totalBalance = await DentalTreatmentRecord.aggregate([
      { $match: matchQuery },
      { $unwind: '$treatments' },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$treatments.balance' },
          totalCharged: { $sum: '$treatments.amountCharged' },
          totalPaid: { $sum: '$treatments.amountPaid' }
        }
      }
    ]);

    const commonProcedures = await DentalTreatmentRecord.aggregate([
      { $match: matchQuery },
      { $unwind: '$treatments' },
      {
        $group: {
          _id: '$treatments.procedure',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    return {
      totalRecords,
      recordsInRange,
      financials: totalBalance[0] || { totalBalance: 0, totalCharged: 0, totalPaid: 0 },
      commonProcedures: commonProcedures.map(p => ({ procedure: p._id, count: p.count })),
      dateRange
    };
  }

  async exportToPDF(id) {
    const record = await DentalTreatmentRecord.findOne({
      $or: [{ _id: id }, { dtrId: id }],
      isDeleted: false
    })
      .populate([
        { path: 'student', select: 'firstName lastName stdId schoolName gradeLevel age sex' },
        { path: 'personnel', select: 'firstName lastName perId position age sex' },
        { path: 'attendedBy', select: 'firstName lastName role' },
        { path: 'lastModifiedBy', select: 'firstName lastName role' }
      ]);

    if (!record) {
      throw new ApiError('Dental treatment record not found', StatusCodes.NOT_FOUND);
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    const margin = 40;
    let yPos = height - 40;

    // Helper functions
    const drawText = (text, x, y, options = {}) => {
      page.drawText(text || '', {
        x,
        y,
        size: options.size || 10,
        font: options.bold ? fontBold : font,
        color: options.color || rgb(0, 0, 0),
        maxWidth: options.maxWidth || width - x - margin
      });
    };

    const drawLine = (x1, y1, x2, y2) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
      });
    };

    const drawRect = (x, y, w, h) => {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
      });
    };

    // Get patient information
    let patientName = 'Unknown';
    let age = 'N/A';
    let gender = 'N/A';

    if (record.patientType === 'student' && record.student) {
      patientName = `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim();
      age = record.student.age || 'N/A';
      gender = record.student.sex || 'N/A';
    } else if (record.patientType === 'personnel' && record.personnel) {
      patientName = `${record.personnel.firstName || ''} ${record.personnel.lastName || ''}`.trim();
      age = record.personnel.age || 'N/A';
      gender = record.personnel.sex || 'N/A';
    } else if (record.patientType === 'walk-in' && record.walkIn) {
      patientName = record.walkIn.name || 'Unknown';
      age = record.walkIn.age?.toString() || 'N/A';
      gender = record.walkIn.gender || 'N/A';
    }

    // Title - Centered with blue background effect
    const titleText = 'TREATMENT RECORD';
    const titleWidth = fontBold.widthOfTextAtSize(titleText, 14);
    const titleX = (width - titleWidth) / 2;

    drawRect(titleX - 10, yPos - 22, titleWidth + 20, 25);
    drawText(titleText, titleX, yPos - 15, { bold: true, size: 14 });
    yPos -= 40;

    // Patient Information
    drawText(`Name: ${patientName}`, margin, yPos, { size: 10 });
    drawText(`Age: ${age}`, width - 200, yPos, { size: 10 });
    yPos -= 15;
    drawText(`Gender: ${gender}`, margin, yPos, { size: 10 });
    yPos -= 30;

    // Table Header
    const tableTop = yPos;
    const colWidths = {
      date: 65,
      toothNo: 50,
      procedure: 130,
      dentist: 80,
      charged: 60,
      paid: 60,
      balance: 60,
      nextAppt: 65
    };

    let xPos = margin;

    // Draw header background
    drawRect(margin, yPos - 18, width - 2 * margin, 18);

    // Header labels
    drawText('Date', xPos + 5, yPos - 12, { bold: true, size: 8 });
    xPos += colWidths.date;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Tooth', xPos + 5, yPos - 12, { bold: true, size: 8 });
    drawText('No./s', xPos + 5, yPos - 18, { bold: true, size: 8 });
    xPos += colWidths.toothNo;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Procedure', xPos + 5, yPos - 12, { bold: true, size: 8 });
    xPos += colWidths.procedure;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Dentist/s', xPos + 5, yPos - 12, { bold: true, size: 8 });
    xPos += colWidths.dentist;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Amount', xPos + 5, yPos - 12, { bold: true, size: 8 });
    drawText('charged', xPos + 5, yPos - 18, { bold: true, size: 8 });
    xPos += colWidths.charged;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Amount', xPos + 5, yPos - 12, { bold: true, size: 8 });
    drawText('Paid', xPos + 5, yPos - 18, { bold: true, size: 8 });
    xPos += colWidths.paid;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Balance', xPos + 5, yPos - 12, { bold: true, size: 8 });
    xPos += colWidths.balance;
    drawLine(xPos, yPos, xPos, yPos - 18);

    drawText('Next', xPos + 5, yPos - 12, { bold: true, size: 8 });
    drawText('Appt.', xPos + 5, yPos - 18, { bold: true, size: 8 });

    // Draw horizontal lines for header
    drawLine(margin, yPos, width - margin, yPos);
    drawLine(margin, yPos - 18, width - margin, yPos - 18);

    yPos -= 18;

    // Treatment rows
    const rowHeight = 20;
    const treatments = record.treatments || [];

    for (let i = 0; i < treatments.length; i++) {
      const treatment = treatments[i];

      // Check if we need a new page
      if (yPos - rowHeight < margin + 20) {
        const newPage = pdfDoc.addPage([612, 792]);
        yPos = height - 40;
      }

      xPos = margin;

      // Date
      const dateStr = treatment.date ? new Date(treatment.date).toLocaleDateString() : '';
      drawText(dateStr, xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.date;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Tooth No
      drawText(treatment.toothNo || '', xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.toothNo;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Procedure
      const procedureText = treatment.procedure || '';
      const maxProcedureWidth = colWidths.procedure - 10;
      const procedureSize = 8;
      let displayProcedure = procedureText;

      if (font.widthOfTextAtSize(procedureText, procedureSize) > maxProcedureWidth) {
        // Truncate if too long
        let truncated = procedureText;
        while (font.widthOfTextAtSize(truncated + '...', procedureSize) > maxProcedureWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        displayProcedure = truncated + '...';
      }
      drawText(displayProcedure, xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.procedure;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Dentist
      const dentistText = treatment.dentist || '';
      const maxDentistWidth = colWidths.dentist - 10;
      let displayDentist = dentistText;

      if (font.widthOfTextAtSize(dentistText, procedureSize) > maxDentistWidth) {
        let truncated = dentistText;
        while (font.widthOfTextAtSize(truncated + '...', procedureSize) > maxDentistWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        displayDentist = truncated + '...';
      }
      drawText(displayDentist, xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.dentist;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Amount Charged
      const charged = treatment.amountCharged || 0;
      drawText(charged.toFixed(2), xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.charged;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Amount Paid
      const paid = treatment.amountPaid || 0;
      drawText(paid.toFixed(2), xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.paid;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Balance
      const balance = treatment.balance || 0;
      drawText(balance.toFixed(2), xPos + 5, yPos - 12, { size: 8 });
      xPos += colWidths.balance;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Next Appointment
      const nextApptStr = treatment.nextAppointment ? new Date(treatment.nextAppointment).toLocaleDateString() : '';
      drawText(nextApptStr, xPos + 5, yPos - 12, { size: 8 });

      // Draw row lines
      drawLine(margin, yPos, width - margin, yPos);
      drawLine(margin, yPos - rowHeight, width - margin, yPos - rowHeight);

      // Vertical lines on sides
      drawLine(margin, yPos, margin, yPos - rowHeight);
      drawLine(width - margin, yPos, width - margin, yPos - rowHeight);

      yPos -= rowHeight;
    }

    // Add empty rows to match the template (total visible rows should be around 25-30)
    const totalRows = 30;
    const emptyRowsNeeded = totalRows - treatments.length;

    for (let i = 0; i < emptyRowsNeeded && yPos - rowHeight > margin + 20; i++) {
      xPos = margin;

      // Draw vertical lines for empty rows
      xPos += colWidths.date;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);
      xPos += colWidths.toothNo;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);
      xPos += colWidths.procedure;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);
      xPos += colWidths.dentist;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);
      xPos += colWidths.charged;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);
      xPos += colWidths.paid;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);
      xPos += colWidths.balance;
      drawLine(xPos, yPos, xPos, yPos - rowHeight);

      // Draw horizontal line
      drawLine(margin, yPos - rowHeight, width - margin, yPos - rowHeight);

      // Vertical lines on sides
      drawLine(margin, yPos, margin, yPos - rowHeight);
      drawLine(width - margin, yPos, width - margin, yPos - rowHeight);

      yPos -= rowHeight;
    }

    // Footer reference
    yPos = margin;
    drawText('mcml/10', width - margin - 40, yPos, { size: 8 });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

export default new DentalTreatmentService();
