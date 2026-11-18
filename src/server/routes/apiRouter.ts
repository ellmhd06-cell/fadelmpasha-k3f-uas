import { Router, type Response } from 'express';
import { z } from 'zod';
import { signDemoToken } from '../auth/demoToken.ts';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.ts';
import { broadcastRealtimeEvent } from '../realtime/wsHub.ts';
import {
  clockInEmployee,
  clockOutEmployee,
  createAnnouncementRecord,
  createDepartmentRecord,
  createEmployeeRecord,
  createOfficeLocationRecord,
  createPerformanceReviewRecord,
  generateMonthlyPayroll,
  getDashboardSummary,
  getEmployeeById,
  getEmployeeLeaveBalances,
  getLeaveTypesList,
  getOrganizationMasterData,
  listAnnouncements,
  listAttendanceRecords,
  listAuditLogs,
  listEmployees,
  listLeaveRequests,
  listNotificationsForEmployee,
  listOvertimeRequests,
  listPayrollRecords,
  listPerformanceReviews,
  markNotificationRead,
  publishPayrollPeriod,
  reviewLeaveRequest,
  reviewOvertimeRequest,
  sendAttendanceReminders,
  submitLeaveRequest,
  submitOvertimeRequest,
  updateEmployeeRecord,
} from '../services/hrmService.ts';
import { getOrCreateAuthenticatedProfile, ensureSeeded } from '../services/seedService.ts';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo123';

const demoLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const createEmployeeSchema = z.object({
  employeeCode: z.string().trim().min(2).max(24),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).default(''),
  identityNumber: z.string().trim().max(40).default(''),
  address: z.string().trim().max(240).default(''),
  jobTitle: z.string().trim().min(2).max(100),
  divisionName: z.string().trim().max(100).default(''),
  employmentStatus: z.enum(['active', 'probation', 'inactive']).default('active'),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  role: z.enum(['super_admin', 'hr_admin', 'management', 'supervisor', 'employee']).default('employee'),
  departmentId: z.number().int().positive().nullable().default(null),
  managerId: z.number().int().positive().nullable().default(null),
  shiftId: z.number().int().positive().nullable().default(null),
  officeLocationId: z.number().int().positive().nullable().default(null),
  baseSalary: z.number().int().min(0).default(8000000),
  defaultAllowance: z.number().int().min(0).default(1500000),
});

const updateEmployeeSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  identityNumber: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
  jobTitle: z.string().trim().min(2).max(100).optional(),
  divisionName: z.string().trim().max(100).optional(),
  employmentStatus: z.enum(['active', 'probation', 'inactive']).optional(),
  role: z.enum(['super_admin', 'hr_admin', 'management', 'supervisor', 'employee']).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  managerId: z.number().int().positive().nullable().optional(),
  shiftId: z.number().int().positive().nullable().optional(),
  officeLocationId: z.number().int().positive().nullable().optional(),
  baseSalary: z.number().int().min(0).optional(),
  defaultAllowance: z.number().int().min(0).optional(),
  employmentHistory: z
    .array(
      z.object({
        period: z.string(),
        title: z.string(),
        department: z.string(),
        note: z.string(),
      }),
    )
    .optional(),
  documents: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        category: z.string(),
        uploadedAt: z.string(),
        fileUrl: z.string(),
      }),
    )
    .optional(),
});

const clockSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  clockInPhotoUrl: z.string().max(400000).optional(),
  notes: z.string().trim().max(240).default(''),
});

const overtimeSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.5).max(12),
  reason: z.string().trim().min(5).max(300),
});

const leaveSubmitSchema = z.object({
  leaveTypeId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(5).max(500),
});

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(400).default(''),
});

const payrollPeriodSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

const performanceSchema = z.object({
  employeeId: z.number().int().positive(),
  periodLabel: z.string().trim().min(2).max(40),
  kpiItems: z
    .array(
      z.object({
        title: z.string().trim().min(2),
        weight: z.number().min(1).max(100),
        target: z.string().trim().min(1),
        actual: z.string().trim().min(1),
        score: z.number().min(0).max(100),
      }),
    )
    .min(1),
  supervisorNotes: z.string().trim().max(600).default(''),
});

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(140),
  category: z.enum(['company', 'hr_info', 'policy']).default('company'),
  content: z.string().trim().min(5).max(1500),
  isPinned: z.boolean().default(false),
});

const departmentSchema = z.object({
  code: z.string().trim().min(2).max(12),
  name: z.string().trim().min(2).max(100),
  division: z.string().trim().min(2).max(100).default('Operasional Korporat'),
  description: z.string().trim().max(300).default(''),
});

const officeLocationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(250),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(50).max(5000).default(250),
});

function handleRouteError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    if (error.message.startsWith('VALIDATION:')) {
      res.status(400).json({ error: error.message.replace('VALIDATION:', '') });
      return;
    }
    if (error.message.startsWith('FORBIDDEN:')) {
      res.status(403).json({ error: error.message.replace('FORBIDDEN:', '') });
      return;
    }
    if (error.message.startsWith('NOT_FOUND:')) {
      res.status(404).json({ error: error.message.replace('NOT_FOUND:', '') });
      return;
    }
    res.status(500).json({ error: error.message || fallbackMessage });
    return;
  }
  res.status(500).json({ error: fallbackMessage });
}

function buildPermissions(role: string) {
  return {
    canAccessBackoffice: ['super_admin', 'hr_admin', 'management', 'supervisor'].includes(role),
    canManageEmployees: ['super_admin', 'hr_admin', 'management', 'supervisor'].includes(role),
    canManageSettings: ['super_admin', 'hr_admin', 'management'].includes(role),
    canManagePayroll: ['super_admin', 'hr_admin', 'management'].includes(role),
    canApproveLeaves: ['super_admin', 'hr_admin', 'management', 'supervisor'].includes(role),
    canManagePerformance: ['super_admin', 'hr_admin', 'management', 'supervisor'].includes(role),
    canPublishAnnouncements: ['super_admin', 'hr_admin', 'management'].includes(role),
    canViewAllAttendance: ['super_admin', 'hr_admin', 'management'].includes(role),
  };
}

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public Demo Account Directory (lists existing + newly added employees for demo login)
apiRouter.get('/auth/demo-accounts', async (_req, res) => {
  try {
    await ensureSeeded();
    const all = await listEmployees();
    res.json(
      all.map((emp) => ({
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        email: emp.email,
        jobTitle: emp.jobTitle,
        departmentName: emp.departmentName,
        role: emp.role,
        employmentStatus: emp.employmentStatus,
      })),
    );
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat daftar akun demo karyawan.');
  }
});

// Demo Account Login Endpoint (Real PostgreSQL User Sync + Server-Signed Token)
apiRouter.post('/auth/demo-login', async (req, res) => {
  const parsed = demoLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Format email atau kata sandi tidak valid.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  if (parsed.data.password !== DEMO_PASSWORD) {
    res.status(401).json({ error: 'Kata sandi akun demo salah (gunakan: demo123).' });
    return;
  }

  try {
    const uid = `demo-${email}`;
    const { user, employeeId } = await getOrCreateAuthenticatedProfile(uid, email);
    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      res.status(404).json({ error: 'Profil karyawan demo tidak ditemukan.' });
      return;
    }

    const token = signDemoToken({
      uid: user.uid,
      email: user.email,
      name: employee.fullName,
    });

    res.json({
      token,
      session: {
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: employee.fullName,
          photoUrl: employee.avatarUrl,
          role: user.role,
        },
        employee,
        permissions: buildPermissions(user.role),
      },
    });
  } catch (error) {
    handleRouteError(res, error, 'Gagal melakukan autentikasi akun demo.');
  }
});

apiRouter.use(requireAuth);

// Current authenticated user session
apiRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const employee = await getEmployeeById(ctx.employeeId);
    if (!employee) {
      res.status(404).json({ error: 'Profil karyawan tidak ditemukan.' });
      return;
    }

    res.json({
      user: {
        id: ctx.userId,
        uid: ctx.uid,
        email: ctx.email,
        displayName: employee.fullName,
        photoUrl: employee.avatarUrl,
        role: ctx.role,
      },
      employee,
      permissions: buildPermissions(ctx.role),
    });
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat sesi pengguna.');
  }
});

// Dashboard KPIs
apiRouter.get(
  '/dashboard/summary',
  requireRoles('super_admin', 'hr_admin', 'management', 'supervisor'),
  async (req: AuthRequest, res) => {
    try {
      const ctx = req.authContext!;
      const summary = await getDashboardSummary(ctx.role, ctx.employeeId);
      res.json(summary);
    } catch (error) {
      handleRouteError(res, error, 'Gagal memuat ringkasan dashboard.');
    }
  },
);

// Module E: Organization Master Data
apiRouter.get('/organization/master', async (_req: AuthRequest, res) => {
  try {
    const data = await getOrganizationMasterData();
    res.json(data);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat data organisasi.');
  }
});

apiRouter.post(
  '/organization/departments',
  requireRoles('super_admin', 'hr_admin'),
  async (req: AuthRequest, res) => {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data departemen tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      const created = await createDepartmentRecord(parsed.data, {
        userId: ctx.userId,
        email: ctx.email,
      });
      res.status(201).json(created);
    } catch (error) {
      handleRouteError(res, error, 'Gagal menambah departemen.');
    }
  },
);

apiRouter.post(
  '/organization/locations',
  requireRoles('super_admin', 'hr_admin'),
  async (req: AuthRequest, res) => {
    const parsed = officeLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data lokasi kantor tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      const created = await createOfficeLocationRecord(parsed.data, {
        userId: ctx.userId,
        email: ctx.email,
      });
      res.status(201).json(created);
    } catch (error) {
      handleRouteError(res, error, 'Gagal menambah lokasi kantor.');
    }
  },
);

// Module A: Employees Directory & Management
apiRouter.get('/employees', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const all = await listEmployees();
    if (ctx.role === 'employee') {
      res.json(all.filter((e) => e.id === ctx.employeeId));
      return;
    }
    if (ctx.role === 'supervisor') {
      res.json(all.filter((e) => e.managerId === ctx.employeeId || e.id === ctx.employeeId));
      return;
    }
    res.json(all);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat direktori karyawan.');
  }
});

apiRouter.post(
  '/employees',
  requireRoles('super_admin', 'hr_admin', 'management', 'supervisor'),
  async (req: AuthRequest, res) => {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data karyawan tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      const payload = { ...parsed.data };
      if (ctx.role === 'supervisor') {
        payload.role = 'employee';
        if (!payload.managerId) {
          payload.managerId = ctx.employeeId;
        }
      }
      const created = await createEmployeeRecord(payload, {
        userId: ctx.userId,
        email: ctx.email,
      });
      broadcastRealtimeEvent({
        type: 'employee:updated',
        timestamp: new Date().toISOString(),
        payload: { employeeId: created.id, message: `Karyawan baru ${created.fullName} ditambahkan` },
      });
      res.status(201).json(created);
    } catch (error) {
      handleRouteError(res, error, 'Gagal membuat data karyawan.');
    }
  },
);

apiRouter.patch(
  '/employees/:id',
  requireRoles('super_admin', 'hr_admin', 'management', 'supervisor'),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID karyawan tidak valid.' });
      return;
    }
    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data pembaruan karyawan tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      if (ctx.role === 'supervisor') {
        const target = await getEmployeeById(id);
        if (!target || (target.managerId !== ctx.employeeId && target.id !== ctx.employeeId)) {
          res.status(403).json({ error: 'Supervisor hanya dapat mengubah data anggota timnya.' });
          return;
        }
      }
      const updated = await updateEmployeeRecord(id, parsed.data, {
        userId: ctx.userId,
        email: ctx.email,
        role: ctx.role,
      });
      broadcastRealtimeEvent({
        type: 'employee:updated',
        timestamp: new Date().toISOString(),
        payload: { employeeId: updated.id, message: `Profil ${updated.fullName} diperbarui` },
      });
      res.json(updated);
    } catch (error) {
      handleRouteError(res, error, 'Gagal memperbarui data karyawan.');
    }
  },
);

// Module B: Attendance & Overtime
apiRouter.get('/attendance', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const rawScope = String(req.query.scope || 'mine');
    const scope = rawScope === 'all' || rawScope === 'team' ? rawScope : 'mine';
    const workDate = typeof req.query.workDate === 'string' && req.query.workDate ? req.query.workDate : undefined;

    const logs = await listAttendanceRecords({
      viewerRole: ctx.role,
      viewerEmployeeId: ctx.employeeId,
      scope,
      workDate,
    });
    res.json(logs);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat log kehadiran.');
  }
});

apiRouter.post('/attendance/clock-in', async (req: AuthRequest, res) => {
  const parsed = clockSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Payload presensi masuk tidak valid.', details: parsed.error.flatten() });
    return;
  }
  try {
    const ctx = req.authContext!;
    const log = await clockInEmployee({
      employeeId: ctx.employeeId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      clockInPhotoUrl: parsed.data.clockInPhotoUrl,
      notes: parsed.data.notes,
    });
    broadcastRealtimeEvent({
      type: 'attendance:recorded',
      timestamp: new Date().toISOString(),
      payload: {
        employeeId: ctx.employeeId,
        status: log.status,
        message: `${log.employeeName} baru saja melakukan presensi masuk`,
      },
    });
    res.status(201).json(log);
  } catch (error) {
    handleRouteError(res, error, 'Gagal mencatat presensi masuk.');
  }
});

apiRouter.post('/attendance/clock-out', async (req: AuthRequest, res) => {
  const parsed = clockSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Payload presensi pulang tidak valid.', details: parsed.error.flatten() });
    return;
  }
  try {
    const ctx = req.authContext!;
    const log = await clockOutEmployee({
      employeeId: ctx.employeeId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      notes: parsed.data.notes,
    });
    broadcastRealtimeEvent({
      type: 'attendance:recorded',
      timestamp: new Date().toISOString(),
      payload: {
        employeeId: ctx.employeeId,
        status: 'clock_out',
        message: `${log.employeeName} baru saja melakukan presensi pulang`,
      },
    });
    res.json(log);
  } catch (error) {
    handleRouteError(res, error, 'Gagal mencatat presensi pulang.');
  }
});

apiRouter.get('/overtime', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const rawScope = String(req.query.scope || 'mine');
    const scope = rawScope === 'all' || rawScope === 'team' ? rawScope : 'mine';
    const rows = await listOvertimeRequests({
      viewerRole: ctx.role,
      viewerEmployeeId: ctx.employeeId,
      scope,
    });
    res.json(rows);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat pengajuan lembur.');
  }
});

apiRouter.post('/overtime', async (req: AuthRequest, res) => {
  const parsed = overtimeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Data pengajuan lembur tidak valid.', details: parsed.error.flatten() });
    return;
  }
  try {
    const ctx = req.authContext!;
    const created = await submitOvertimeRequest({
      employeeId: ctx.employeeId,
      workDate: parsed.data.workDate,
      hours: parsed.data.hours,
      reason: parsed.data.reason,
    });
    broadcastRealtimeEvent({
      type: 'overtime:updated',
      timestamp: new Date().toISOString(),
      payload: {
        employeeId: ctx.employeeId,
        message: `${created.employeeName} mengajukan lembur ${created.hours} jam`,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handleRouteError(res, error, 'Gagal mengirim pengajuan lembur.');
  }
});

apiRouter.patch(
  '/overtime/:id/review',
  requireRoles('super_admin', 'hr_admin', 'management', 'supervisor'),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const parsed = reviewSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: 'Parameter persetujuan lembur tidak valid.' });
      return;
    }
    try {
      const ctx = req.authContext!;
      const updated = await reviewOvertimeRequest({
        id,
        decision: parsed.data.decision,
        reviewNote: parsed.data.reviewNote,
        reviewerEmployeeId: ctx.employeeId,
        reviewerRole: ctx.role,
      });
      broadcastRealtimeEvent({
        type: 'overtime:updated',
        timestamp: new Date().toISOString(),
        payload: {
          employeeId: updated.employeeId,
          message: `Pengajuan lembur ${updated.employeeName} diperbarui`,
        },
      });
      res.json(updated);
    } catch (error) {
      handleRouteError(res, error, 'Gagal memproses persetujuan lembur.');
    }
  },
);

// Module C: Leave Management (2-stage approval)
apiRouter.get('/leaves/types', async (_req: AuthRequest, res) => {
  try {
    const types = await getLeaveTypesList();
    res.json(types);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat jenis cuti.');
  }
});

apiRouter.get('/leaves/balances', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const balances = await getEmployeeLeaveBalances(ctx.employeeId);
    res.json(balances);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat kuota cuti.');
  }
});

apiRouter.get('/leaves/requests', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const rawScope = String(req.query.scope || 'mine');
    const scope = rawScope === 'all' || rawScope === 'team' ? rawScope : 'mine';
    const requests = await listLeaveRequests({
      viewerRole: ctx.role,
      viewerEmployeeId: ctx.employeeId,
      scope,
    });
    res.json(requests);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat daftar pengajuan cuti.');
  }
});

apiRouter.post('/leaves/requests', async (req: AuthRequest, res) => {
  const parsed = leaveSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Data pengajuan cuti tidak valid.', details: parsed.error.flatten() });
    return;
  }
  try {
    const ctx = req.authContext!;
    const created = await submitLeaveRequest({
      employeeId: ctx.employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason,
    });
    broadcastRealtimeEvent({
      type: 'leave:submitted',
      timestamp: new Date().toISOString(),
      payload: {
        employeeId: ctx.employeeId,
        requestId: created.id,
        status: created.status,
        message: `${created.employeeName} mengajukan ${created.leaveTypeName} (${created.totalDays} hari)`,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handleRouteError(res, error, 'Gagal mengajukan cuti.');
  }
});

apiRouter.patch(
  '/leaves/requests/:id/review',
  requireRoles('super_admin', 'hr_admin', 'management', 'supervisor'),
  async (req: AuthRequest, res) => {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      res.status(400).json({ error: 'ID pengajuan cuti tidak valid.' });
      return;
    }
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data keputusan approval tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      const updated = await reviewLeaveRequest({
        requestId,
        decision: parsed.data.decision,
        reviewNote: parsed.data.reviewNote,
        reviewerEmployeeId: ctx.employeeId,
        reviewerUserId: ctx.userId,
        reviewerEmail: ctx.email,
        reviewerRole: ctx.role,
      });
      broadcastRealtimeEvent({
        type: 'leave:reviewed',
        timestamp: new Date().toISOString(),
        payload: {
          employeeId: updated.employeeId,
          requestId: updated.id,
          status: updated.status,
          message: `Pengajuan ${updated.leaveTypeName} oleh ${updated.employeeName} diperbarui`,
        },
      });
      res.json(updated);
    } catch (error) {
      handleRouteError(res, error, 'Gagal memproses persetujuan cuti.');
    }
  },
);

// Module D: Payroll Management
apiRouter.get('/payroll', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const periodMonth =
      typeof req.query.periodMonth === 'string' && req.query.periodMonth
        ? req.query.periodMonth
        : undefined;
    const records = await listPayrollRecords({
      periodMonth,
      viewerRole: ctx.role,
      viewerEmployeeId: ctx.employeeId,
    });
    res.json(records);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat data payroll.');
  }
});

apiRouter.post(
  '/payroll/generate',
  requireRoles('super_admin', 'hr_admin', 'management'),
  async (req: AuthRequest, res) => {
    const parsed = payrollPeriodSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Format periode harus YYYY-MM.' });
      return;
    }
    try {
      const ctx = req.authContext!;
      const records = await generateMonthlyPayroll(parsed.data.periodMonth, {
        userId: ctx.userId,
        email: ctx.email,
      });
      res.json(records);
    } catch (error) {
      handleRouteError(res, error, 'Gagal memproses kalkulasi payroll.');
    }
  },
);

apiRouter.post(
  '/payroll/publish',
  requireRoles('super_admin', 'hr_admin', 'management'),
  async (req: AuthRequest, res) => {
    const parsed = payrollPeriodSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Format periode harus YYYY-MM.' });
      return;
    }
    try {
      const ctx = req.authContext!;
      await publishPayrollPeriod(parsed.data.periodMonth, {
        userId: ctx.userId,
        email: ctx.email,
      });
      broadcastRealtimeEvent({
        type: 'payroll:published',
        timestamp: new Date().toISOString(),
        payload: { message: `Slip gaji periode ${parsed.data.periodMonth} telah diterbitkan` },
      });
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, error, 'Gagal menerbitkan slip gaji.');
    }
  },
);

// Module F: Performance Management (KPI & Evaluations)
apiRouter.get('/performance', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const reviews = await listPerformanceReviews({
      viewerRole: ctx.role,
      viewerEmployeeId: ctx.employeeId,
    });
    res.json(reviews);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat data penilaian kinerja.');
  }
});

apiRouter.post(
  '/performance',
  requireRoles('super_admin', 'hr_admin', 'management', 'supervisor'),
  async (req: AuthRequest, res) => {
    const parsed = performanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data penilaian KPI tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      const created = await createPerformanceReviewRecord(parsed.data, {
        userId: ctx.userId,
        email: ctx.email,
        employeeId: ctx.employeeId,
      });
      broadcastRealtimeEvent({
        type: 'performance:updated',
        timestamp: new Date().toISOString(),
        payload: {
          employeeId: created.employeeId,
          message: `Evaluasi KPI ${created.periodLabel} untuk ${created.employeeName} telah diterbitkan`,
        },
      });
      res.status(201).json(created);
    } catch (error) {
      handleRouteError(res, error, 'Gagal menyimpan penilaian kinerja.');
    }
  },
);

// Module G: Announcements & Notifications
apiRouter.get('/announcements', async (_req: AuthRequest, res) => {
  try {
    const list = await listAnnouncements();
    res.json(list);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat pengumuman.');
  }
});

apiRouter.post(
  '/announcements',
  requireRoles('super_admin', 'hr_admin', 'management'),
  async (req: AuthRequest, res) => {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data pengumuman tidak valid.', details: parsed.error.flatten() });
      return;
    }
    try {
      const ctx = req.authContext!;
      const created = await createAnnouncementRecord(parsed.data, {
        userId: ctx.userId,
        email: ctx.email,
        employeeId: ctx.employeeId,
      });
      broadcastRealtimeEvent({
        type: 'announcement:published',
        timestamp: new Date().toISOString(),
        payload: { message: `Pengumuman baru: ${created.title}` },
      });
      res.status(201).json(created);
    } catch (error) {
      handleRouteError(res, error, 'Gagal menerbitkan pengumuman.');
    }
  },
);

apiRouter.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const ctx = req.authContext!;
    const list = await listNotificationsForEmployee(ctx.employeeId);
    res.json(list);
  } catch (error) {
    handleRouteError(res, error, 'Gagal memuat notifikasi.');
  }
});

apiRouter.patch('/notifications/:id/read', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'ID notifikasi tidak valid.' });
    return;
  }
  await markNotificationRead(id);
  res.json({ ok: true });
});

apiRouter.post(
  '/notifications/remind-attendance',
  requireRoles('super_admin', 'hr_admin'),
  async (req: AuthRequest, res) => {
    try {
      const ctx = req.authContext!;
      const countSent = await sendAttendanceReminders({
        userId: ctx.userId,
        email: ctx.email,
      });
      broadcastRealtimeEvent({
        type: 'announcement:published',
        timestamp: new Date().toISOString(),
        payload: { message: 'Pengingat presensi dikirimkan ke karyawan yang belum clock-in' },
      });
      res.json({ sentCount: countSent });
    } catch (error) {
      handleRouteError(res, error, 'Gagal mengirim pengingat presensi.');
    }
  },
);

// Audit logs
apiRouter.get(
  '/audit-logs',
  requireRoles('super_admin', 'hr_admin', 'management'),
  async (_req: AuthRequest, res) => {
    try {
      const logs = await listAuditLogs();
      res.json(logs);
    } catch (error) {
      handleRouteError(res, error, 'Gagal memuat log audit.');
    }
  },
);
