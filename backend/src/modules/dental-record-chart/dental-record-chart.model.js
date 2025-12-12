import mongoose from "mongoose";
import { generateId } from "#utils/crypto.js";

const TeethConditionSchema = new mongoose.Schema({
  toothNumber: { type: String, required: true },

  condition: {
    type: String,
    enum: ['Present', 'Decayed', 'Missing', 'Impacted', 'Supernumerary', 'Root Fragment', 'Unerupted', 'Missing Other Causes'],
    default: 'Present'
  },
  secondaryCondition: {
    type: String,
    enum: ['Present', 'Decayed', 'Missing', 'Impacted', 'Supernumerary', 'Root Fragment', 'Unerupted', 'Missing Other Causes'],
    default: 'Present'
  },
  restoration: { type: String, trim: true },
  surgery: { type: String, trim: true },
  notes: { type: String, trim: true }
}, { _id: false });

const DentalRecordChartSchema = new mongoose.Schema({
  drcId: { type: String, unique: true, index: true },

  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel" },

  walkInPatient: {
    name: { type: String, trim: true },
    age: { type: Number },
    gender: { type: String, enum: ['Male', 'Female', 'M', 'F'] },
    date: { type: Date }
  },

  permanentTeeth: [TeethConditionSchema],
  temporaryTeeth: [TeethConditionSchema],

  periodontalScreening: {
    gingivitis: { type: Boolean, default: false },
    earlyPeriodontitis: { type: Boolean, default: false },
    moderatePeriodontitis: { type: Boolean, default: false },
    advancedPeriodontitis: { type: Boolean, default: false }
  },

  occlusion: {
    classMolar: { type: String, trim: true },
    overjet: { type: String, trim: true },
    overbite: { type: String, trim: true },
    midlineDeviation: { type: String, trim: true },
    crossbite: { type: String, trim: true }
  },

  appliances: {
    orthodontic: { type: String, trim: true },
    stayplate: { type: String, trim: true },
    others: { type: String, trim: true }
  },

  tmd: {
    clenching: { type: Boolean, default: false },
    clicking: { type: Boolean, default: false },
    trismus: { type: Boolean, default: false },
    muscleSpasm: { type: Boolean, default: false }
  },

  xrayTaken: {
    periapical: { type: String, trim: true },
    panoramic: { type: Boolean, default: false },
    cephalometric: { type: Boolean, default: false },
    occlusal: { type: String, trim: true },
    others: { type: String, trim: true }
  },

  remarks: { type: String, trim: true },
  dateOfExamination: { type: Date, default: Date.now },

  schoolId: { type: String, trim: true },
  attendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDeleted: { type: Boolean, default: false, index: true },
}, {
  timestamps: true,
  collection: "dental_record_charts",
});

DentalRecordChartSchema.index({ student: 1 });
DentalRecordChartSchema.index({ personnel: 1 });
DentalRecordChartSchema.index({ 'walkInPatient.name': 1 });
DentalRecordChartSchema.index({ schoolId: 1 });
DentalRecordChartSchema.index({ dateOfExamination: -1 });

// Pre-save hook to generate ID
DentalRecordChartSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    this.drcId = generateId('DRC');
    next();
  } catch (err) {
    next(err);
  }
});

// Validation: At least one patient type must be provided
DentalRecordChartSchema.pre('validate', function (next) {
  if (!this.student && !this.personnel && !this.walkInPatient?.name) {
    return next(new Error('Either student, personnel, or walk-in patient information is required'));
  }
  next();
});

export default mongoose.model("DentalRecordChart", DentalRecordChartSchema);
