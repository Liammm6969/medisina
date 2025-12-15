import { gradeKeys } from "#utils/constants.js";
import mongoose from "mongoose";
import { generateId } from "#utils/crypto.js";
const DailyTreatmentRecordSchema = new mongoose.Schema({
  dtrId: { type: String, unique: true, index: true },
  schoolId: { type: String, trim: true },
  dateOfTreatment: { type: Date, required: true, default: Date.now },

  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel" },

  schoolHealthCard: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolHealthExamCard" },
  personnelHealthCard: { type: mongoose.Schema.Types.ObjectId, ref: "PersonnelHealthCard" },
  chiefComplaint: { type: mongoose.Schema.Types.ObjectId, ref: "ChiefComplaint" },

  patientName: { type: String, required: true, trim: true },
  gradeLevel: { type: String, enum: gradeKeys },

  chiefComplaint: { type: String, default: "", trim: true },
  treatment: { type: String, default: "", trim: true },
  attendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  remarks: { type: String, default: "", trim: true },

  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDeleted: { type: Boolean, default: false, index: true },
}, {
  timestamps: true,
  collection: "daily_treatment_records",
});

DailyTreatmentRecordSchema.index({ personnel: 1, dateOfTreatment: -1 });
DailyTreatmentRecordSchema.index({ schoolId: 1 });
DailyTreatmentRecordSchema.index({ patientName: 1 });
DailyTreatmentRecordSchema.index({ schoolId: 1, dateOfTreatment: -1, isDeleted: 1 });
DailyTreatmentRecordSchema.index({ student: 1, dateOfTreatment: -1 });
DailyTreatmentRecordSchema.index({ personnel: 1, isDeleted: 1 });
DailyTreatmentRecordSchema.index({ student: 1, isDeleted: 1 });
DailyTreatmentRecordSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {

    this.dtrId = generateId('DTR')
    next();
  } catch (err) {
    next(err);
  }
}


);
export default mongoose.model("DailyTreatmentRecord", DailyTreatmentRecordSchema);
