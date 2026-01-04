import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export function extractAuditInfo(user) {

  if (!user) return {};
  return {
    personnelName: `${user.firstName} ${user.lastName}`,
    personnelType: user.role,
    personnelId: user._id,
    schoolId: user.schoolId || null,
    schoolName: user.schoolName || null,
    schoolDistrictDivision: user.schoolDistrictDivision || null,
    associatedSchools: user.getAssociatedSchools ? user.getAssociatedSchools() : null
  };
}

export function getFileTypeFromMimeType(mimeType) {
  if (!mimeType) return 'other';

  const mimeTypeLower = mimeType.toLowerCase();

  if (mimeTypeLower.startsWith('image/')) {
    return 'image';
  }

  if (mimeTypeLower === 'application/pdf') {
    return 'pdf';
  }

  if (
    mimeTypeLower === 'application/msword' ||
    mimeTypeLower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'word';
  }

  if (
    mimeTypeLower === 'application/vnd.ms-excel' ||
    mimeTypeLower === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'excel';
  }

  return 'other';
}

export const g = (obj, pathStr, d = '') => {
  if (!obj) return d;
  return pathStr.split('.').reduce((acc, p) => (acc && typeof acc === 'object' ? acc[p] : undefined), obj) ?? d;
};


export function getTemplatePath(templateFileName) {
  const possiblePaths = [
    path.join(process.cwd(), 'templates', templateFileName),
    path.join(process.cwd(), '..', 'templates', templateFileName),
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', templateFileName),
    path.join('/var/task', 'templates', templateFileName),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }

  return possiblePaths[0];
}
