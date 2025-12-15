export const personnelRoles = ['Doctor', 'Admin', 'Nurse','Teacher'];
export const gender = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const civilStatus = ["Single", "Married", "Widowed", "Divorced", '']

export const gradeKeys = [
  'Kinder', 'Grade 1', 'Grade 2',
  'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11',
  'Grade 12', 'SPED'
];
export const prescriptionClassification = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
  'D1', 'D2', 'D3',
  'E1', 'E2', 'E3', 'E4', 'E5',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

export const healthExamCodeMapping = {
  nutritionalStatus: {
    a: 'Normal Weight',
    b: 'Wasted/Underweight',
    c: 'Severely Wasted/Underweight',
    d: 'Overweight',
    e: 'Obese',
    f: 'Normal Height',
    g: 'Stunted',
    h: 'Severely Stunted',
    i: 'Tall',
    X: 'Not Examined'
  },
  visionAuditoryScreening: {
    a: 'Passed',
    b: 'Failed',
    X: 'Not Examined'
  },
  skinScalp: {
    a: 'Normal',
    b: 'Presence of Lice',
    c: 'Redness of Skin',
    d: 'White Spots',
    e: 'Flaky Skin',
    f: 'Impetigo/boil',
    g: 'Hematoma',
    h: 'Bruises/Injuries',
    i: 'Itchiness',
    j: 'Skin Lesions',
    k: 'Acne/Pimple',
    X: 'Not Examined'
  },
  eyeEarNose: {
    a: 'Normal',
    b: 'Stye',
    c: 'Eye Redness',
    d: 'Ocular Misalignment',
    e: 'Pale Conjunctiva',
    f: 'Ear discharge',
    g: 'Impacted cerumen',
    h: 'Mucus discharge',
    i: 'Nose Bleeding (Epistaxis)',
    j: 'Eye discharge',
    k: 'Matted Eyelashes',
    X: 'Not Examined'
  },
  mouthThroatNeck: {
    a: 'Normal',
    b: 'Enlarged tonsils',
    c: 'Presence of lesions',
    d: 'Inflamed pharynx',
    e: 'Enlarged lymphnodes',
    X: 'Not Examined'
  },
  lungsHeart: {
    a: 'Normal',
    c: 'Rales',
    d: 'Wheeze',
    e: 'Murmur',
    h: 'Irregular heart rate',
    X: 'Not Examined'
  },
  abdomen: {
    a: 'Normal',
    b: 'Distended',
    c: 'Abdominal Pain',
    d: 'Tenderness',
    e: 'Dysmenorrhea',
    X: 'Not Examined'
  },
  deformities: {
    a: 'Acquired',
    b: 'Congenital (Specify)',
    X: 'Not Examined'
  }
};


export const NOTIFICATION_TYPES = {
  SYSTEM: 'SYSTEM',
  NEW_RECORD: 'NEW_RECORD',
  MEDICATION: 'MEDICATION',
  TREATMENT: 'TREATMENT',
  CHECKUP: 'CHECKUP',
  HEALTH_ALERT: 'HEALTH_ALERT',
  RECORD_UPDATE: 'RECORD_UPDATE',
  RECORD_DELETE: 'RECORD_DELETE',
  APPROVAL: 'APPROVAL',
  APPROVED: 'APPROVED',
  ACTIVITY: 'ACTIVITY'
};


export const NOTIFICATION_STATUS = {
  UNREAD: 'UNREAD',
  READ: 'READ',
  DELETED: 'DELETED',
};

export const PRIORITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

export const TREATMENT_STATUS = {
  PENDING_REVIEW: "Pending doctor’s review",
  APPROVED: "Approved treatment"
};

export const NOTIFICATION_TITLE = {
  CONSULTATION_AND_TREATMENT: "CONSULTATION AND TREATMENT",
  SCHOOL_HEALTH_EXAMINATION_CARD: "SCHOOL HEALTH EXAMINATION CARD",
  PERSONNEL_HEALTH_CARD: "PERSONNEL HEALTH CARD",
  PERSONNEL_BIO_DATA: "PERSONNEL BIO DATA",
  HEALTH_EXAMINATION_RECORD: "HEALTH EXAMINATION RECORD",
  REFERRAL_SLIP: "REFERRAL SLIP",
  RECORD_OF_DAILY_TREATMENT: "RECORD OF DAILY TREATMENT",
  ANNUAL_HEALTH_SERVICES_ACCOMPLISHMENT_REPORT: "ANNUAL HEALTH SERVICES ACCOMPLISHMENT REPORT",
  PRESCRIPTION: "PRESCRIPTION"
}

export const healthAlerts = ['NUTRITIONAL', 'VISION', 'HEARING', 'CARDIAC', 'RESPIRATORY', 'INFECTION', 'GROWTH', 'OTHER']
export const clinicalCategories = ['REFERRAL', 'FOLLOW_UP', 'MEDICATION', 'LIFESTYLE', 'NUTRITION', 'IMMUNIZATION', 'SCREENING']