import mongoose from "mongoose";
import { civilStatus, gender } from "#utils/constants.js";
import { generateId } from "#utils/crypto.js";
const PersonnelSchema = new mongoose.Schema({
  perId: { type: String, unique: true, index: true, },
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },
  gender: { type: String, enum: gender },
  age: { type: Number, default: 0 },
  dateOfBirth: { type: String, },
  civilStatus: { type: String, enum: civilStatus },
  position: { type: String, trim: true },
  schoolId: [{ type: String, trim: true }],
  schoolName: [{ type: String, trim: true }],
  schoolDistrictDivision: [{ type: String, trim: true }],
  yearsInService: { type: Number, min: 0 },
  firstYearInService: { type: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  collection: "personnels",
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true }
});

// Indexes for better search performance
PersonnelSchema.index({ firstName: 1, lastName: 1 });
PersonnelSchema.index({ firstName: 'text', lastName: 'text', middleName: 'text' });
PersonnelSchema.index({ isDeleted: 1, firstName: 1 });
PersonnelSchema.index({ isDeleted: 1, lastName: 1 });
PersonnelSchema.index({ position: 1, isDeleted: 1 });
PersonnelSchema.index({ department: 1, isDeleted: 1 });
PersonnelSchema.index({ createdBy: 1, isDeleted: 1 });
PersonnelSchema.index({ schoolDistrictDivision: 1, isDeleted: 1 });

PersonnelSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {

    this.perId = generateId('PER')
    next();
  } catch (err) {
    next(err);
  }
});

PersonnelSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.middleName ? this.middleName + " " : ""}${this.lastName}`;
});
PersonnelSchema.statics.isDuplicateName = async function ({ firstName, lastName }) {
  const personnel = await this.findOne({
    firstName: new RegExp(`^${firstName}$`, "i"),
    lastName: new RegExp(`^${lastName}$`, "i")
  }).lean();

  return !!personnel;
};
PersonnelSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId
  await this.save();
  return true;
};

PersonnelSchema.methods.restoreDeleted = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
  return true;
};
PersonnelSchema.methods.toPersonnelJSON = function () {
  return {
    _id: this._id,
    perId: this.perId,
    firstName: this.firstName,
    middleName: this.middleName,
    lastName: this.lastName,
    fullName: this.fullName,
    gender: this.gender,
    age: this.age,
    dateOfBirth: this.dateOfBirth,
    civilStatus: this.civilStatus,
    position: this.position,
    schoolDistrictDivision: this.schoolDistrictDivision,
    yearsInService: this.yearsInService,
    firstYearInService: this.firstYearInService,
    isDeleted: this.isDeleted,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
}
const PersonnelModel = mongoose.model("Personnel", PersonnelSchema);
export default PersonnelModel;