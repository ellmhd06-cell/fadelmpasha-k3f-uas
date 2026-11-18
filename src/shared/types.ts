export type UserRole = 'super_admin' | 'hr_admin' | 'management' | 'supervisor' | 'employee';

export type EmploymentStatus = 'active' | 'probation' | 'inactive';

export type AttendanceStatus = 'on_time' | 'late' | 'early_leave';

export type LeaveStatus =
  | 'pending_supervisor'
  | 'pending_hr'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface EmploymentHistoryItem {
  period: string;
  title: string;
  department: string;
  note: string;
}

export interface EmployeeDocumentItem {
  id: string;
  title: string;
  category: string;
  uploadedAt: string;
  fileUrl: string;
}

export interface DepartmentRecord {
  id: number;
  code: string;
  name: string;
  division: string;
  description: string;
}

export interface OfficeLocationRecord {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface WorkShiftRecord {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
}

export interface EmployeeRecord {
  id: number;
  userId: number | null;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  identityNumber: string;
  address: string;
  jobTitle: string;
  divisionName: string;
  employmentStatus: EmploymentStatus;
  joinDate: string;
  avatarUrl: string;
  role: UserRole;
  departmentId: number | null;
  departmentName: string | null;
  managerId: number | null;
  managerName: string | null;
  shiftId: number | null;
  shiftName: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  officeLocationId: number | null;
  officeLocationName: string | null;
  officeLat: number | null;
  officeLng: number | null;
  officeRadiusMeters: number | null;
  baseSalary: number;
  defaultAllowance: number;
  employmentHistory: EmploymentHistoryItem[];
  documents: EmployeeDocumentItem[];
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  employeeAvatarUrl: string;
  departmentName: string | null;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockInDistanceMeters: number | null;
  isWithinGeofence: boolean;
  status: AttendanceStatus;
  workMinutes: number;
  overtimeMinutes: number;
  earlyLeaveMinutes: number;
  clockInPhotoUrl: string;
  notes: string;
}

export interface OvertimeRequestRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  workDate: string;
  hours: number;
  reason: string;
  status: 'pending_supervisor' | 'pending_hr' | 'approved' | 'rejected';
  reviewNote: string;
  createdAt: string;
}

export interface LeaveTypeRecord {
  id: number;
  code: string;
  name: string;
  defaultQuotaDays: number;
  isPaid: boolean;
}

export interface LeaveBalanceRecord {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface LeaveRequestRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  employeeAvatarUrl: string;
  departmentName: string | null;
  managerId: number | null;
  leaveTypeId: number;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  supervisorReviewerName: string | null;
  supervisorReviewedAt: string | null;
  supervisorNote: string;
  reviewedByEmployeeId: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
}

export interface PayrollRecordItem {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string;
  periodMonth: string;
  baseSalary: number;
  allowances: number;
  overtimePay: number;
  deductions: number;
  netSalary: number;
  attendanceDays: number;
  lateCount: number;
  status: 'draft' | 'published';
  publishedAt: string | null;
}

export interface PerformanceKpiItem {
  title: string;
  weight: number;
  target: string;
  actual: string;
  score: number; // 0-100
}

export interface PerformanceReviewRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string;
  reviewerEmployeeId: number;
  reviewerName: string;
  periodLabel: string;
  kpiItems: PerformanceKpiItem[];
  overallScore: number;
  ratingLabel: string;
  supervisorNotes: string;
  status: 'draft' | 'finalized';
  createdAt: string;
}

export interface AnnouncementRecord {
  id: number;
  title: string;
  category: 'company' | 'hr_info' | 'policy';
  content: string;
  authorName: string;
  isPinned: boolean;
  createdAt: string;
}

export interface NotificationRecord {
  id: number;
  recipientEmployeeId: number | null;
  title: string;
  message: string;
  category: 'approval' | 'attendance_reminder' | 'announcement' | 'payroll' | 'info';
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogRecord {
  id: number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalActiveEmployees: number;
  presentTodayCount: number;
  lateTodayCount: number;
  onLeaveTodayCount: number;
  pendingApprovalsCount: number;
  publishedPayrollTotal: number;
  workDate: string;
}

export interface AuthSessionResponse {
  user: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
    photoUrl: string;
    role: UserRole;
  };
  employee: EmployeeRecord;
  permissions: {
    canAccessBackoffice: boolean;
    canManageEmployees: boolean;
    canManageSettings: boolean;
    canManagePayroll: boolean;
    canApproveLeaves: boolean;
    canManagePerformance: boolean;
    canPublishAnnouncements: boolean;
    canViewAllAttendance: boolean;
  };
}

export type RealtimeEventType =
  | 'attendance:recorded'
  | 'overtime:updated'
  | 'leave:submitted'
  | 'leave:reviewed'
  | 'employee:updated'
  | 'payroll:published'
  | 'performance:updated'
  | 'announcement:published';

export interface RealtimeEvent {
  type: RealtimeEventType;
  timestamp: string;
  payload: {
    employeeId?: number;
    requestId?: number;
    status?: string;
    message?: string;
  };
}
