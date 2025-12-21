export const CACHE_KEYS = {
  USER: {
    ALL: 'user:all',
    BY_ID: (id) => `user:id:${id}`,
    BY_EMAIL: (email) => `user:email:${email}`,
    BY_ROLE: (role) => `user:role:${role}`,
    COUNT: 'user:count',
    PENDING: 'user:pending',
    APPROVED: 'user:approved',
    PATTERN: 'user:*'
  },
  DAILY_TREATMENT: {
    ALL: (filters) => `dtr:all:${JSON.stringify(filters)}`,
    BY_ID: (id) => `dtr:id:${id}`,
    STATS: 'dtr:stats',
    DASHBOARD: (filters) => `dtr:dashboard:${JSON.stringify(filters)}`,
    RECENT: (limit, userId) => `dtr:recent:${limit}:${userId}`,
    DAILY_COUNT: 'dtr:dailycount',
    TRENDS: (filters) => `dtr:trends:${JSON.stringify(filters)}`,
    TOP_TREATMENTS: (filters) => `dtr:toptx:${JSON.stringify(filters)}`,
    TIME_SERIES: (filters) => `dtr:timeseries:${JSON.stringify(filters)}`,
    PATTERN: 'dtr:*'
  },
  STUDENT: {
    ALL: 'student:all',
    BY_PERSONNEL: (id) => `student:personnel:${id}`,
    BY_ID: (id) => `student:id:${id}`,
    BY_LRN: (lrn) => `student:lrn:${lrn}`,
    BY_GRADE: (grade) => `student:grade:${grade}`,
    BY_SECTION: (grade, section) => `student:section:${grade}:${section}`,
    SPED: 'student:sped',
    COUNT: 'student:count',
    GRADE_COUNT: 'student:gradecount',
    SEARCH: (query) => `student:search:${query}`,
    PATTERN: 'student:*'
  },
  PERSONNEL: {
    ALL: (userId) => `personnel:all:${userId}`,
    BY_USER: (userId) => `personnel:user:${userId}`,
    BY_ID: (id) => `personnel:id:${id}`,
    BY_NAME: (name) => `personnel:name:${name}`,
    COUNT: 'personnel:count',
    HEALTH_PENDING: 'personnel:health:pending',
    HEALTH_APPROVED: 'personnel:health:approved',
    PATTERN: 'personnel:*'
  },
  CHIEF_COMPLAINT: {
    ALL: (userId) => `complaint:all:${userId}`,
    BY_ID: (id) => `complaint:id:${id}`,
    BY_PERSONNEL: (name) => `complaint:personnel:${name}`,
    PENDING: 'complaint:pending',
    APPROVED: 'complaint:approved',
    TRENDS: (filters) => `complaint:trends:${JSON.stringify(filters)}`,
    TOP: (filters) => `complaint:top:${JSON.stringify(filters)}`,
    TIME_SERIES: (filters) => `complaint:timeseries:${JSON.stringify(filters)}`,
    ANALYTICS: (filters) => `complaint:analytics:${JSON.stringify(filters)}`,
    COMPARISON: (filters) => `complaint:comparison:${JSON.stringify(filters)}`,
    PATTERN: 'complaint:*'
  },
  HEALTH_EXAM: {
    ALL: (filters) => `healthexam:all:${JSON.stringify(filters)}`,
    BY_USER: (userId, filters) => `healthexam:user:${userId}:${JSON.stringify(filters)}`,
    BY_ID: (id) => `healthexam:id:${id}`,
    BY_MONGO_ID: (id) => `healthexam:mongo:${id}`,
    PATTERN: 'healthexam:*'
  },
  NOTIFICATION: {
    MY: (userId) => `notif:my:${userId}`,
    ALL: 'notif:all',
    BY_ID: (id) => `notif:id:${id}`,
    UNREAD_COUNT: (userId) => `notif:unread:${userId}`,
    DOCTOR_ACTIVITY: (filters) => `notif:doctor:${JSON.stringify(filters)}`,
    PATTERN: 'notif:*'
  },
  PERSONNEL_HEALTH_CARD: {
    ALL: (userId) => `phc:all:${userId}`,
    BY_ID: (id) => `phc:id:${id}`,
    BY_PERSONNEL: (perId) => `phc:personnel:${perId}`,
    BY_CONDITION: (condition) => `phc:condition:${condition}`,
    BY_AGE_RANGE: (min, max) => `phc:age:${min}-${max}`,
    BY_SYMPTOMS: (symptoms) => `phc:symptoms:${JSON.stringify(symptoms)}`,
    BY_GENDER: (gender) => `phc:gender:${gender}`,
    RECENT: (days, userId) => `phc:recent:${days}:${userId}`,
    COUNT: 'phc:count',
    PENDING: 'phc:pending',
    APPROVED: 'phc:approved',
    SEARCH: (query) => `phc:search:${query}`,
    SUMMARY: 'phc:summary',
    PATTERN: 'phc:*'
  },
  SCHOOL_HEALTH_EXAM: {
    ALL: (examiner) => `shec:all:${examiner}`,
    BY_ID: (id) => `shec:id:${id}`,
    BY_STUDENT: (stdId) => `shec:student:${stdId}`,
    BY_GRADE: (grade) => `shec:grade:${grade}`,
    BY_SCHOOL: (schoolId) => `shec:school:${schoolId}`,
    HISTORY: (stdId) => `shec:history:${stdId}`,
    COUNT: 'shec:count',
    PENDING: 'shec:pending',
    APPROVED: 'shec:approved',
    STATS: 'shec:stats',
    NUTRITION_SUMMARY: 'shec:nutrition',
    DSS_ALERTS: (userId) => `shec:dss:alerts:${userId}`,
    RECENT_SCREENINGS: (limit, userId) => `shec:screenings:${limit}:${userId}`,
    PREVENTIVE_STATS: (userId) => `shec:preventive:${userId}`,
    PATTERN: 'shec:*'
  },
  SCHOOL_HEALTH_SURVEY: {
    ALL: (filter) => `shs:all:${JSON.stringify(filter)}`,
    BY_ID: (id) => `shs:id:${id}`,
    BY_SCHOOL_YEAR: (schoolId, year) => `shs:school:${schoolId}:${year}`,
    BY_YEAR: (year) => `shs:year:${year}`,
    BY_REGION: (region, division, year) => `shs:region:${region}:${division}:${year}`,
    SUBMITTED: (filter) => `shs:submitted:${JSON.stringify(filter)}`,
    APPROVED: (filter) => `shs:approved:${JSON.stringify(filter)}`,
    REJECTED: (filter) => `shs:rejected:${JSON.stringify(filter)}`,
    PENDING: 'shs:pending',
    ENROLLMENT: (schoolId, year) => `shs:enrollment:${schoolId}:${year}`,
    PERSONNEL_STATS: (schoolId) => `shs:personnel:${schoolId}`,
    PATTERN: 'shs:*'
  },
  REFERRAL_SLIP: {
    ALL: (filters) => `ref:all:${JSON.stringify(filters)}`,
    BY_ID: (id) => `ref:id:${id}`,
    BY_USER: (userId, filters) => `ref:user:${userId}:${JSON.stringify(filters)}`,
    BY_AGENCY: (agency, userId) => `ref:agency:${agency}:${userId}`,
    BY_REFERRER: (name, userId) => `ref:referrer:${name}:${userId}`,
    COUNT: (userId) => `ref:count:${userId}`,
    PENDING: (userId) => `ref:pending:${userId}`,
    COMPLETED: (userId) => `ref:completed:${userId}`,
    SEARCH: (query, userId) => `ref:search:${query}:${userId}`,
    DATE_RANGE: (start, end, userId) => `ref:range:${start}:${end}:${userId}`,
    STATS_DIVISION: (division, year) => `ref:stats:div:${division}:${year}`,
    STATS_REGION: (region, year) => `ref:stats:reg:${region}:${year}`,
    PATTERN: 'ref:*'
  },
  ANNUAL_REPORT: {
    ALL: (filters, userId) => `aar:all:${JSON.stringify(filters)}:${userId}`,
    BY_ID: (id) => `aar:id:${id}`,
    BY_SCHOOL_YEAR: (schoolId, year) => `aar:school:${schoolId}:${year}`,
    BY_YEAR: (year) => `aar:year:${year}`,
    BY_REGION: (region, division) => `aar:region:${region}:${division}`,
    BY_NAME: (name) => `aar:name:${name}`,
    SEARCH: (query) => `aar:search:${query}`,
    STATS: 'aar:stats',
    ANALYTICS: (filters) => `aar:analytics:${JSON.stringify(filters)}`,
    DASHBOARD: (userId) => `aar:dashboard:${userId}`,
    PATTERN: 'aar:*'
  },
  PRESCRIPTION: {
    ALL: (filters) => `prx:all:${JSON.stringify(filters)}`,
    BY_ID: (id) => `prx:id:${id}`,
    BY_PATIENT: (type, id) => `prx:patient:${type}:${id}`,
    BY_PRESCRIBER: (userId) => `prx:prescriber:${userId}`,
    STATS: (filters) => `prx:stats:${JSON.stringify(filters)}`,
    PATTERN: 'prx:*'
  },
  DENTAL_TREATMENT: {
    ALL: () => 'dental:all',
    BY_ID: (id) => `dental:id:${id}`,
    BY_PATIENT: (patientId, patientType) => `dental:patient:${patientType}:${patientId}`,
    STATS: (filters) => `dental:stats:${JSON.stringify(filters)}`,
    PATTERN: 'dental:*'
  }
};

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 900,
  HOUR: 3600,
  DAY: 86400
};
