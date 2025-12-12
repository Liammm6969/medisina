# MediSync API Documentation

## Table of Contents

- [Introduction](#introduction)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Authentication](#authentication-endpoints)
  - [Personnel](#personnel)
  - [Personnel Approval](#personnel-approval)
  - [Personnel Health Cards](#personnel-health-cards)
  - [School Health Cards](#school-health-cards)
  - [Chief Complaint](#chief-complaint)
  - [Students](#students)
  - [Notifications](#notifications)
  - [Audit Trail](#audit-trail)
  - [Dental Record Chart](#dental-record-chart)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

For local development:

```
http://localhost:3000/api/v1
```

## Authentication

Most endpoints require authentication. MediSync uses session-based authentication with the following roles:

- **Admin**: Full system access
- **Doctor**: Limited access to medical records and functionality
- **Nurse**: Basic access to record patient data and view specific reports

To authenticate, use the `/auth/login` endpoint to receive a session cookie that must be included in subsequent requests.

## API Endpoints

### Health Check

#### GET /

- **Description**: Basic health check endpoint
- **Authentication**: None
- **Response**: `200 OK` with status code

#### GET /health

- **Description**: Extended health check with additional information
- **Authentication**: None
- **Response**: `200 OK` with status code and message

### Authentication Endpoints

#### POST /auth/register

- **Description**: Register a new user
- **Authentication**: None
- **Request Body**:
  ```json
  {
  	"email": "user@example.com",
  	"password": "securePassword123",
  	"firstName": "John",
  	"lastName": "Doe",
  	"role": "Nurse"
  }
  ```
- **Response**: `201 Created` with user object

#### POST /auth/login

- **Description**: Authenticate a user and create a session
- **Authentication**: None
- **Request Body**:
  ```json
  {
  	"email": "user@example.com",
  	"password": "securePassword123"
  }
  ```
- **Response**: `200 OK` with user object and session cookie

#### POST /auth/forgot-password

- **Description**: Request a password reset
- **Authentication**: None
- **Request Body**:
  ```json
  {
  	"email": "user@example.com"
  }
  ```
- **Response**: `200 OK` with confirmation message

#### POST /auth/reset-password/:token

- **Description**: Reset password using token from email
- **Authentication**: None
- **Parameters**:
  - `token`: Reset token received via email
- **Request Body**:
  ```json
  {
  	"newPassword": "newSecurePassword456"
  }
  ```
- **Response**: `200 OK` with confirmation message

#### DELETE /auth/logout

- **Description**: Log out the current user and destroy session
- **Authentication**: Required
- **Response**: `200 OK` with confirmation message

#### GET /auth/status

- **Description**: Check authentication status
- **Authentication**: Required
- **Response**: `200 OK` with authentication status and user information

#### GET /auth

- **Description**: Get all users
- **Authentication**: Admin only
- **Response**: `200 OK` with list of users

#### PUT /auth

- **Description**: Update a user
- **Authentication**: Admin only
- **Request Body**: Fields to update
- **Response**: `200 OK` with updated user

#### GET /auth/role

- **Description**: Get users by role
- **Authentication**: Admin, Nurse, Doctor
- **Response**: `200 OK` with users of the specified role

#### PUT /auth/toggle-status

- **Description**: Toggle active status for all users
- **Authentication**: Admin only
- **Response**: `200 OK` with count of updated users

### Personnel

#### POST /personnel

- **Description**: Create a new personnel record
- **Authentication**: Doctor, Admin, Nurse
- **Request Body**:
  ```json
  {
  	"firstName": "John",
  	"lastName": "Doe",
  	"email": "john.doe@example.com",
  	"contactNumber": "1234567890",
  	"address": "123 Main St",
  	"dateOfBirth": "1980-01-01",
  	"gender": "Male",
  	"occupation": "Teacher",
  	"department": "Science",
  	"employeeId": "EMP123"
  }
  ```
- **Response**: `201 Created` with created personnel object

#### GET /personnel

- **Description**: Get all personnel records
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with list of personnel

#### GET /personnel/:personnelId

- **Description**: Get a specific personnel record
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel to retrieve
- **Response**: `200 OK` with personnel object

#### PUT /personnel/:personnelId

- **Description**: Update a personnel record
- **Authentication**: Admin
- **Parameters**:
  - `personnelId`: ID of the personnel to update
- **Request Body**: Fields to update
- **Response**: `200 OK` with updated personnel object

#### DELETE /personnel/:personnelId

- **Description**: Delete a personnel record
- **Authentication**: Admin
- **Parameters**:
  - `personnelId`: ID of the personnel to delete
- **Response**: `204 No Content`

#### POST /personnel/:personnelId

- **Description**: Restore a previously deleted personnel record
- **Authentication**: Admin, Doctor
- **Parameters**:
  - `personnelId`: ID of the personnel to restore
- **Response**: `200 OK` with restored personnel object

### Personnel Approval

#### GET /personnel-approval/health-records/pending

- **Description**: Get all pending approval health records
- **Authentication**: Doctor, Admin
- **Response**: `200 OK` with list of pending approvals

#### GET /personnel-approval/health-records/approved

- **Description**: Get all approved health records
- **Authentication**: Doctor, Admin
- **Response**: `200 OK` with list of approved records

#### POST /personnel-approval/health-records/personnel/:personnelId/approve

- **Description**: Approve a personnel health record
- **Authentication**: Doctor, Admin
- **Parameters**:
  - `personnelId`: ID of the personnel whose record to approve
- **Response**: `200 OK` with approved record

#### POST /personnel-approval/health-records/school/:lrn/approve

- **Description**: Approve a school health record
- **Authentication**: Doctor, Admin
- **Parameters**:
  - `lrn`: Learner Reference Number of the student
- **Response**: `200 OK` with approved record

#### POST /personnel-approval/health-records/chief-complaint/:personnelId/approve

- **Description**: Approve a chief complaint record
- **Authentication**: Doctor, Admin
- **Parameters**:
  - `personnelId`: ID of the personnel whose complaint to approve
- **Response**: `200 OK` with approved complaint

### Personnel Health Cards

#### GET /personnel-health-cards

- **Description**: Get all health cards
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with list of health cards

#### GET /personnel-health-cards/search

- **Description**: Search personnel with health cards
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**: Search terms
- **Response**: `200 OK` with matching health cards

#### POST /personnel-health-cards

- **Description**: Create a new health card
- **Authentication**: Admin, Doctor, Nurse
- **Request Body**: Health card details
- **Response**: `201 Created` with created health card

#### GET /personnel-health-cards/age-range

- **Description**: Get health cards by age range
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**:
  - `minAge`: Minimum age
  - `maxAge`: Maximum age
- **Response**: `200 OK` with matching health cards

#### GET /personnel-health-cards/condition/:condition

- **Description**: Get health cards by medical condition
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `condition`: Medical condition name
- **Response**: `200 OK` with matching health cards

#### GET /personnel-health-cards/symptoms

- **Description**: Get health cards by symptoms
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**:
  - `symptoms`: Comma-separated list of symptoms
- **Response**: `200 OK` with matching health cards

#### GET /personnel-health-cards/gender

- **Description**: Get health cards by gender
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**:
  - `gender`: Gender to filter by
- **Response**: `200 OK` with matching health cards

#### GET /personnel-health-cards/recent

- **Description**: Get recently created health cards
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `days`: Number of days to look back
- **Response**: `200 OK` with recent health cards

#### GET /personnel-health-cards/summary

- **Description**: Get health summary report
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with health summary statistics

#### GET /personnel-health-cards/:personnelId

- **Description**: Get health card by personnel ID
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Response**: `200 OK` with health card

#### PATCH /personnel-health-cards/:personnelId

- **Description**: Update health card
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Request Body**: Fields to update
- **Response**: `200 OK` with updated health card

#### DELETE /personnel-health-cards/:personnelId

- **Description**: Delete health card
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Response**: `204 No Content`

#### GET /personnel-health-cards/personnel/:personnelId

- **Description**: Get all health cards for a personnel
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Response**: `200 OK` with health cards

#### GET /personnel-health-cards/personnel/dss-dashboard

- **Description**: Get personnel health DSS dashboard with analytics
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with dashboard data including risk rates and preventive action plan

#### GET /personnel-health-cards/personnel-by-category/:category

- **Description**: Get list of personnel filtered by a specific health category
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `category`: Category name (hypertension, diabetes, cvd, ptb, smoking, needsClearance)
- **Response**: `200 OK` with filtered personnel list
  ```json
  {
  	"count": 10,
  	"category": "hypertension",
  	"data": [
  		{
  			"personnelId": "PER-001",
  			"personnelName": "Jane Doe",
  			"position": "Teacher",
  			"age": 45,
  			"schoolId": "SCH001",
  			"schoolName": "Example School",
  			"riskLevel": "High Risk"
  		}
  	]
  }
  ```

#### GET /personnel-health-cards/personnel/:personnelId/dss

- **Description**: Get decision support system data for a personnel
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Response**: `200 OK` with DSS data

#### GET /personnel-health-cards/personnel/dss-dashboard

- **Description**: Get DSS dashboard data
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with DSS dashboard data

### School Health Cards

#### POST /school-health-cards

- **Description**: Create a school health exam card
- **Authentication**: Admin, Doctor, Nurse
- **Request Body**: Health exam details
- **Response**: `201 Created` with created health exam card

#### GET /school-health-cards

- **Description**: Get all grade examination records
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with list of examination records

#### DELETE /school-health-cards/:lrn

- **Description**: Delete a grade examination record
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `204 No Content`

#### POST /school-health-cards/:lrn

- **Description**: Add a grade entry to an existing student record
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `200 OK` with updated record

#### PUT /school-health-cards/:lrn/:gradeLevel

- **Description**: Update a grade examination record
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
  - `gradeLevel`: Grade level of the record to update
- **Request Body**: Fields to update
- **Response**: `200 OK` with updated record

#### GET /school-health-cards/legend

- **Description**: Get legends for health exam card fields
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with legends

#### GET /school-health-cards/student/:lrn/history

- **Description**: Get examination history for a student
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `200 OK` with examination history

#### GET /school-health-cards/grade/:gradeLevel

- **Description**: Get health exam cards by grade level
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `gradeLevel`: Grade level to filter by
- **Response**: `200 OK` with cards

#### GET /school-health-cards/school/:schoolId

- **Description**: Get health exam cards by school
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `schoolId`: ID of the school
- **Response**: `200 OK` with cards

#### GET /school-health-cards/statistics

- **Description**: Get health statistics
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with statistics

#### GET /school-health-cards/nutritional-summary

- **Description**: Get nutritional status summary
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with summary

#### GET /school-health-cards/student/analyze/:schoolId

- **Description**: Analyze school health records
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `schoolId`: ID of the school
- **Response**: `200 OK` with analysis

#### GET /school-health-cards/dss-summary

- **Description**: Get decision support system summary
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**:
  - `schoolId` (optional): Filter by specific school ID (default: 'all')
- **Response**: `200 OK` with DSS summary

#### GET /school-health-cards/students-by-category/:category

- **Description**: Get list of students filtered by a specific health category
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `category`: Category name (notDewormed, immunizationIncomplete, visionIssues, hearingIssues, pendingApproval)
- **Query Parameters**:
  - `schoolId` (optional): Filter by specific school ID (default: 'all')
- **Response**: `200 OK` with filtered student list
  ```json
  {
  	"count": 15,
  	"category": "visionIssues",
  	"data": [
  		{
  			"stdId": "2024-001",
  			"studentName": "John Doe",
  			"gradeLevel": "Grade 7",
  			"schoolId": "SCH001",
  			"schoolName": "Example Elementary School",
  			"examDate": "2024-11-20",
  			"approvalStatus": "Approved",
  			"riskLevel": "Medium Risk"
  		}
  	]
  }
  ```

#### GET /school-health-cards/student/:lrn/dss

- **Description**: Get student DSS report
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `200 OK` with DSS report

#### GET /school-health-cards/follow-up

- **Description**: Get students requiring follow-up
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with follow-up list

### Chief Complaint

#### POST /chief-complaint

- **Description**: Create a new chief complaint record
- **Authentication**: Admin, Doctor, Nurse
- **Request Body**:
  ```json
  {
  	"personnelId": "123456",
  	"complaint": "Persistent headache",
  	"diagnosis": "Migraine",
  	"treatment": "Prescribed medication, rest",
  	"followUpInstructions": "Return in one week"
  }
  ```
- **Response**: `201 Created` with created complaint

#### GET /chief-complaint

- **Description**: List all chief complaints
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with list of complaints

#### GET /chief-complaint/personnel-name

- **Description**: Get chief complaints by personnel name
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**:
  - `personnelName`: Name of the personnel
- **Response**: `200 OK` with matching complaints

#### GET /chief-complaint/:personnelId

- **Description**: Get chief complaint by personnel ID
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Response**: `200 OK` with complaint

#### PUT /chief-complaint/:personnelId

- **Description**: Update chief complaint
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Request Body**: Fields to update
- **Response**: `200 OK` with updated complaint

#### DELETE /chief-complaint/:personnelId

- **Description**: Delete chief complaint
- **Authentication**: Admin
- **Parameters**:
  - `personnelId`: ID of the personnel
- **Response**: `204 No Content`

### Students

#### GET /students

- **Description**: Get all students
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with list of students

#### POST /students

- **Description**: Create a new student
- **Authentication**: Admin, Doctor, Nurse
- **Request Body**: Student details
- **Response**: `201 Created` with created student

#### GET /students/search

- **Description**: Search students
- **Authentication**: Admin, Doctor, Nurse
- **Query Parameters**: Search terms
- **Response**: `200 OK` with matching students

#### GET /students/grade-level/:gradeLevel

- **Description**: Get students by grade level
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `gradeLevel`: Grade level to filter by
- **Response**: `200 OK` with students

#### GET /students/section/:gradeLevel/:section

- **Description**: Get students by section
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `gradeLevel`: Grade level
  - `section`: Section name
- **Response**: `200 OK` with students

#### GET /students/sped

- **Description**: Get SPED students
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with SPED students

#### GET /students/attending

- **Description**: Get students by attending personnel
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with students

#### GET /students/counts/grade-level

- **Description**: Get student counts by grade level
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with student counts

#### GET /students/count

- **Description**: Get total count of students
- **Authentication**: Admin, Doctor, Nurse
- **Response**: `200 OK` with student count

#### GET /students/:stdId/complete-history

- **Description**: Get complete medical history for a student including all records (school health exams, dental treatments, daily treatments, prescriptions, health examinations, and chief complaints)
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `stdId`: Student ID
- **Response**: `200 OK` with complete history
- **Response Body**:
  ```json
  {
    "message": "Student complete history retrieved successfully",
    "data": {
      "student": {
        "stdId": "STD-001",
        "name": "John Doe",
        "gradeLevel": "Grade 10",
        "section": "A",
        "schoolName": "Sample School",
        "isSPED": false,
        "lrn": "123456789012",
        "dateOfBirth": "2008-01-15",
        "age": 15,
        "sex": "Male",
        "address": "123 Main St"
      },
      "summary": {
        "totalRecords": 25,
        "schoolHealthExams": 5,
        "dentalTreatments": 3,
        "dailyTreatments": 10,
        "prescriptions": 4,
        "healthExaminations": 2,
        "chiefComplaints": 1,
        "lastVisit": "2025-12-01",
        "firstVisit": "2023-06-15"
      },
      "records": {
        "schoolHealthExams": [...],
        "dentalTreatments": [...],
        "dailyTreatments": [...],
        "prescriptions": [...],
        "healthExaminations": [...],
        "chiefComplaints": [...]
      },
      "timeline": [
        {
          "type": "School Health Examination",
          "date": "2025-12-01",
          "grade": "Grade 10",
          "examiner": "Dr. Smith",
          "findings": {...},
          "recordId": "...",
          "details": {...}
        },
        ...
      ]
    }
  }
  ```

#### GET /students/:stdId

- **Description**: Get student by LRN
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `200 OK` with student

#### PUT /students/:lrn

- **Description**: Update a student
- **Authentication**: Admin, Doctor, Nurse
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Request Body**: Fields to update
- **Response**: `200 OK` with updated student

#### DELETE /students/:lrn

- **Description**: Delete a student
- **Authentication**: Admin
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `204 No Content`

#### POST /students/:lrn/restore

- **Description**: Restore a deleted student
- **Authentication**: Admin
- **Parameters**:
  - `lrn`: Learner Reference Number
- **Response**: `200 OK` with restored student

### Notifications

The notification system allows sending targeted messages to users with different delivery methods and priority levels.

#### Notification Types

- `system`: System-wide announcements and maintenance notifications
- `appointment`: Appointment reminders and scheduling notifications
- `medication`: Medication reminders and prescription notifications
- `treatment`: Treatment plan updates and follow-up notifications
- `checkup`: Health checkup reminders and scheduling
- `health_alert`: Urgent health-related alerts and warnings
- `record_update`: Updates to health records and medical information

#### Delivery Methods

- `in_app`: Notifications displayed within the application
- `email`: Email notifications sent to user's email address
- `sms`: SMS/text message notifications
- `push`: Push notifications to mobile devices

#### Priority Levels

- `low`: General information notifications
- `medium`: Important but non-urgent notifications
- `high`: Important notifications requiring attention
- `urgent`: Critical notifications requiring immediate action

#### POST /notifications

- **Description**: Create a new notification
- **Authentication**: Admin only
- **Request Body**:
  ```json
  {
  	"title": "Appointment Reminder",
  	"message": "You have an appointment scheduled for tomorrow",
  	"type": "appointment",
  	"recipientId": "507f1f77bcf86cd799439011",
  	"recipientModel": "Personnel",
  	"senderId": "507f1f77bcf86cd799439012",
  	"senderModel": "Personnel",
  	"priority": "high",
  	"deliveryMethod": "in_app",
  	"isActionRequired": false,
  	"actionLink": "/appointments/123",
  	"expiresAt": "2025-09-20T10:00:00.000Z"
  }
  ```
- **Response**: `201 Created` with created notification

#### GET /notifications

- **Description**: Get all notifications for the authenticated user
- **Authentication**: Required
- **Query Parameters**:
  - `limit`: Number of notifications per page (default: 10)
  - `page`: Page number (default: 1)
  - `sortBy`: Sort field (default: '-createdAt')
  - `status`: Filter by status ('unread', 'read', 'deleted')
- **Response**: `200 OK` with paginated notifications
  ```json
  {
    "results": [...],
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "totalResults": 50
  }
  ```

#### GET /notifications/unread-count

- **Description**: Get count of unread notifications for the authenticated user
- **Authentication**: Required
- **Response**: `200 OK` with count
  ```json
  {
  	"count": 5
  }
  ```

#### GET /notifications/health

- **Description**: Get health-related notifications for doctors
- **Authentication**: Doctor only
- **Response**: `200 OK` with health notifications data
  ```json
  {
    "data": [...]
  }
  ```

#### GET /notifications/:notificationId

- **Description**: Get a specific notification by ID
- **Authentication**: Required (user must own the notification)
- **Parameters**:
  - `notificationId`: ID of the notification
- **Response**: `200 OK` with notification object

#### PATCH /notifications/:notificationId/read

- **Description**: Mark a notification as read
- **Authentication**: Required (user must own the notification)
- **Parameters**:
  - `notificationId`: ID of the notification
- **Response**: `200 OK` with updated notification

#### PATCH /notifications/read-all

- **Description**: Mark all notifications as read for the authenticated user
- **Authentication**: Required
- **Response**: `200 OK` with modification count
  ```json
  {
  	"modifiedCount": 5
  }
  ```

#### DELETE /notifications/:notificationId

- **Description**: Delete a notification
- **Authentication**: Required (user must own the notification)
- **Parameters**:
  - `notificationId`: ID of the notification
- **Response**: `204 No Content`

### Audit Trail

#### GET /audit-trail

- **Description**: Get all audit trail records
- **Authentication**: Admin only
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 50)
- **Response**: `200 OK` with audit trails and total count

#### DELETE /audit-trail

- **Description**: Delete all audit trail records
- **Authentication**: Admin only
- **Response**: `200 OK` with confirmation message

### Dental Record Chart

#### GET /dental-record-chart

- **Description**: Get all dental record charts
- **Authentication**: Doctor, Nurse, Admin
- **Response**: `200 OK` with array of dental records

#### GET /dental-record-chart/:id

- **Description**: Get a specific dental record chart by ID
- **Authentication**: Doctor, Nurse, Admin
- **Parameters**:
  - `id`: Dental record chart ID (drcId or MongoDB \_id)
- **Response**: `200 OK` with dental record object

#### GET /dental-record-chart/patient/:patientId

- **Description**: Get all dental records for a specific patient
- **Authentication**: Doctor, Nurse, Admin
- **Parameters**:
  - `patientId`: Patient ID (student or personnel)
- **Query Parameters**:
  - `patientType`: Required - 'student' or 'personnel'
- **Response**: `200 OK` with array of dental records

#### GET /dental-record-chart/export

- **Description**: Export dental record charts to Excel file
- **Authentication**: Doctor, Nurse, Admin
- **Query Parameters**:
  - `patientId` (optional): Filter by specific patient ID
  - `patientType` (optional): 'student' or 'personnel' (required if patientId provided)
  - `startDate` (optional): Filter records from this date (YYYY-MM-DD)
  - `endDate` (optional): Filter records until this date (YYYY-MM-DD)
- **Response**: `200 OK` with Excel file download
- **Example Usage**:
  ```
  GET /dental-record-chart/export
  GET /dental-record-chart/export?patientId=507f1f77bcf86cd799439011&patientType=student
  GET /dental-record-chart/export?startDate=2025-01-01&endDate=2025-12-31
  ```

#### POST /dental-record-chart

- **Description**: Create a new dental record chart
- **Authentication**: Doctor, Nurse, Admin
- **Request Body**:
  ```json
  {
  	"student": "507f1f77bcf86cd799439011",
  	"permanentTeeth": [
  		{
  			"toothNumber": "11",
  			"status": "Decayed",
  			"condition": "Cavity",
  			"notes": "Requires filling"
  		}
  	],
  	"periodontalScreening": {
  		"gingivitis": false,
  		"earlyPeriodontitis": false
  	},
  	"occlusion": {
  		"classMolar": "Class I",
  		"overjet": "Normal"
  	},
  	"dateOfExamination": "2025-12-12",
  	"remarks": "Regular checkup"
  }
  ```
- **Response**: `201 Created` with dental record object

#### PUT /dental-record-chart/:id

- **Description**: Update an existing dental record chart
- **Authentication**: Doctor, Nurse, Admin
- **Parameters**:
  - `id`: Dental record chart ID
- **Request Body**: Same as POST (partial updates allowed)
- **Response**: `200 OK` with updated dental record object

#### DELETE /dental-record-chart/:id

- **Description**: Delete a dental record chart (soft delete)
- **Authentication**: Doctor, Nurse, Admin
- **Parameters**:
  - `id`: Dental record chart ID
- **Response**: `200 OK` with confirmation message

#### GET /dental-record-chart/stats

- **Description**: Get dashboard statistics for dental records
- **Authentication**: Doctor, Nurse, Admin
- **Query Parameters**:
  - `startDate` (optional): Filter from this date
  - `endDate` (optional): Filter until this date
- **Response**: `200 OK` with statistics object

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of requests. Common status codes:

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters or body
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses follow this format:

```json
{
	"error": "Error message describing what went wrong",
	"timestamp": "Wed, 16 Sep 2025 08:00:00 GMT",
	"stack": "Error stack trace (in development mode)",
	"path": "/api/v1/path-that-caused-error"
}
```

For validation errors:

```json
{
	"field": "fieldName",
	"error": "Validation error message for the field"
}
```

## Rate Limiting

API requests are subject to rate limiting to prevent abuse. Current limits:

- 100 requests per IP address per minute
- Authenticated users have higher limits

Rate limit headers are included in API responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed per window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Time in seconds until the rate limit window resets

Exceeding rate limits will result in `429 Too Many Requests` responses.
