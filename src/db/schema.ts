import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull().unique(),
  division: text('division').default('Operasional Korporat').notNull(),
  description: text('description').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const officeLocations = pgTable('office_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  address: text('address').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  radiusMeters: integer('radius_meters').default(250).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workShifts = pgTable('work_shifts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(), // HH:mm
  gracePeriodMinutes: integer('grace_period_minutes').default(15).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('').notNull(),
  photoUrl: text('photo_url').default('').notNull(),
  role: text('role').default('employee').notNull(), // super_admin | hr_admin | management | supervisor | employee
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  employeeCode: text('employee_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').default('').notNull(),
  identityNumber: text('identity_number').default('').notNull(),
  address: text('address').default('').notNull(),
  jobTitle: text('job_title').notNull(),
  divisionName: text('division_name').default('').notNull(),
  employmentStatus: text('employment_status').default('active').notNull(), // active | probation | inactive
  joinDate: text('join_date').notNull(), // YYYY-MM-DD
  avatarUrl: text('avatar_url').default('').notNull(),
  gender: text('gender').default('male').notNull(), // male | female
  role: text('role').default('employee').notNull(), // super_admin | hr_admin | management | supervisor | employee
  departmentId: integer('department_id').references(() => departments.id),
  managerId: integer('manager_id'),
  shiftId: integer('shift_id').references(() => workShifts.id),
  officeLocationId: integer('office_location_id').references(() => officeLocations.id),
  baseSalary: integer('base_salary').default(8000000).notNull(),
  defaultAllowance: integer('default_allowance').default(1500000).notNull(),
  employmentHistory: text('employment_history').default('[]').notNull(),
  documentsJson: text('documents_json').default('[]').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    workDate: text('work_date').notNull(), // YYYY-MM-DD
    clockInAt: timestamp('clock_in_at').notNull(),
    clockOutAt: timestamp('clock_out_at'),
    clockInLat: doublePrecision('clock_in_lat'),
    clockInLng: doublePrecision('clock_in_lng'),
    clockOutLat: doublePrecision('clock_out_lat'),
    clockOutLng: doublePrecision('clock_out_lng'),
    clockInDistanceMeters: integer('clock_in_distance_meters'),
    isWithinGeofence: boolean('is_within_geofence').default(true).notNull(),
    status: text('status').default('on_time').notNull(), // on_time | late | early_leave
    workMinutes: integer('work_minutes').default(0).notNull(),
    overtimeMinutes: integer('overtime_minutes').default(0).notNull(),
    earlyLeaveMinutes: integer('early_leave_minutes').default(0).notNull(),
    clockInPhotoUrl: text('clock_in_photo_url').default('').notNull(),
    clockOutPhotoUrl: text('clock_out_photo_url').default('').notNull(),
    clockInReason: text('clock_in_reason').default('').notNull(),
    clockOutReason: text('clock_out_reason').default('').notNull(),
    notes: text('notes').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('attendance_employee_date_idx').on(table.employeeId, table.workDate)],
);

export const overtimeRequests = pgTable('overtime_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id)
    .notNull(),
  workDate: text('work_date').notNull(),
  hours: doublePrecision('hours').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('pending_supervisor').notNull(), // pending_supervisor | pending_hr | approved | rejected
  reviewedByEmployeeId: integer('reviewed_by_employee_id'),
  reviewNote: text('review_note').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leaveTypes = pgTable('leave_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  defaultQuotaDays: integer('default_quota_days').default(12).notNull(),
  isPaid: boolean('is_paid').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leaveBalances = pgTable(
  'leave_balances',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    leaveTypeId: integer('leave_type_id')
      .references(() => leaveTypes.id)
      .notNull(),
    year: integer('year').notNull(),
    allocatedDays: integer('allocated_days').notNull(),
    usedDays: integer('used_days').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('leave_balance_emp_type_year_idx').on(table.employeeId, table.leaveTypeId, table.year),
  ],
);

export const leaveRequests = pgTable('leave_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id)
    .notNull(),
  leaveTypeId: integer('leave_type_id')
    .references(() => leaveTypes.id)
    .notNull(),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date').notNull(), // YYYY-MM-DD
  totalDays: integer('total_days').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('pending_supervisor').notNull(), // pending_supervisor | pending_hr | approved | rejected | cancelled
  supervisorReviewedById: integer('supervisor_reviewed_by_id'),
  supervisorReviewedAt: timestamp('supervisor_reviewed_at'),
  supervisorNote: text('supervisor_note').default('').notNull(),
  reviewedByEmployeeId: integer('reviewed_by_employee_id'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNote: text('review_note').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrollRecords = pgTable(
  'payroll_records',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    periodMonth: text('period_month').notNull(), // YYYY-MM
    baseSalary: integer('base_salary').notNull(),
    allowances: integer('allowances').notNull(),
    overtimePay: integer('overtime_pay').default(0).notNull(),
    deductions: integer('deductions').default(0).notNull(),
    netSalary: integer('net_salary').notNull(),
    attendanceDays: integer('attendance_days').default(0).notNull(),
    lateCount: integer('late_count').default(0).notNull(),
    status: text('status').default('draft').notNull(), // draft | published
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('payroll_employee_period_idx').on(table.employeeId, table.periodMonth)],
);

export const performanceReviews = pgTable('performance_reviews', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id)
    .notNull(),
  reviewerEmployeeId: integer('reviewer_employee_id').notNull(),
  periodLabel: text('period_label').notNull(), // e.g., Q4 2026
  kpiItemsJson: text('kpi_items_json').default('[]').notNull(),
  overallScore: doublePrecision('overall_score').default(0).notNull(),
  ratingLabel: text('rating_label').default('Baik').notNull(),
  supervisorNotes: text('supervisor_notes').default('').notNull(),
  status: text('status').default('finalized').notNull(), // draft | finalized
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').default('company').notNull(), // company | hr_info | policy
  content: text('content').notNull(),
  authorEmployeeId: integer('author_employee_id').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  recipientEmployeeId: integer('recipient_employee_id'), // null = broadcast to all
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').default('info').notNull(), // approval | attendance_reminder | announcement | payroll
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drizzle Relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  shift: one(workShifts, {
    fields: [employees.shiftId],
    references: [workShifts.id],
  }),
  officeLocation: one(officeLocations, {
    fields: [employees.officeLocationId],
    references: [officeLocations.id],
  }),
  attendanceLogs: many(attendanceLogs),
  leaveBalances: many(leaveBalances),
  leaveRequests: many(leaveRequests),
  payrollRecords: many(payrollRecords),
  performanceReviews: many(performanceReviews),
}));

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
  employee: one(employees, {
    fields: [attendanceLogs.employeeId],
    references: [employees.id],
  }),
}));

export const leaveBalancesRelations = relations(leaveBalances, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveBalances.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveBalances.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const payrollRecordsRelations = relations(payrollRecords, ({ one }) => ({
  employee: one(employees, {
    fields: [payrollRecords.employeeId],
    references: [employees.id],
  }),
}));

export const performanceReviewsRelations = relations(performanceReviews, ({ one }) => ({
  employee: one(employees, {
    fields: [performanceReviews.employeeId],
    references: [employees.id],
  }),
}));
