import mongoose from "mongoose";
import { gender } from "#utils/constants.js";
import { generateId } from '#utils/crypto.js';
const StudentSchema = new mongoose.Schema({
  stdId: { type: String, unique: true, index: true, },
  lrn: { type: Number },
  schoolId: { type: String, required: true, },
  schoolName: { type: String, required: true, },
  schoolDistrictDivision: { type: String, required: true, },
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },
  gender: { type: String, enum: gender, },
  dateOfBirth: { type: Date, default: null },
  birthplace: { type: String, trim: true },
  heightInCm: { type: Number, min: 0, max: 250 },
  weightInKg: { type: Number, min: 0, max: 300 },
  address: { type: String, trim: true },
  telephoneNo: { type: String, trim: true },

  parentGuardian: { type: String, trim: true },
  parentContact: { type: String, trim: true },

  gradeLevel: { type: String, trim: true },
  section: { type: String, trim: true },
  schoolYear: { type: String, trim: true },

  attendingPersonnel: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isSPED: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false, index: true }

}, {
  timestamps: true,
  collection: "students",
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true }
});

// Indexes for better search performance
StudentSchema.index({ firstName: 1, lastName: 1 });
StudentSchema.index({ schoolId: 1 });
StudentSchema.index({ gradeLevel: 1, section: 1, schoolYear: 1 });

// Additional indexes for search optimization
StudentSchema.index({ firstName: 'text', lastName: 'text', middleName: 'text' });
StudentSchema.index({ isDeleted: 1, gradeLevel: 1 });
StudentSchema.index({ isDeleted: 1, firstName: 1 });
StudentSchema.index({ isDeleted: 1, lastName: 1 });
StudentSchema.index({ schoolName: 1, isDeleted: 1 });
StudentSchema.index({ attendingPersonnel: 1, isDeleted: 1 });
StudentSchema.index({ schoolDistrictDivision: 1, isDeleted: 1 });

StudentSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {

      this.stdId = generateId('STD');
    }
    next();
  } catch (error) {
    next(error)
  }
});


StudentSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.middleName ? this.middleName + " " : ""}${this.lastName}`;
});
StudentSchema.statics.isLrnExist = async function (lrn) {
  return !!(await this.findOne({ lrn }));
};
StudentSchema.methods.getCurrentLevel = function () {
  return `${this.gradeLevel}${this.isSPED ? " (SPED)" : ""}`;
};


export default mongoose.model("Student", StudentSchema);
