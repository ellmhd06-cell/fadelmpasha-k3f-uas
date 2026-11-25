import { and, desc, eq, inArray, or, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  announcements,
  attendanceLogs,
  auditLogs,
  departments,
  employees,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  notifications,
  officeLocations,
  overtimeRequests,
  payrollRecords,
  performanceReviews,
  users,
  workShifts,
} from '../../db/schema.ts';
import type {
  AnnouncementRecord,
  AttendanceRecord,
  AuditLogRecord,
  DashboardSummary,
  EmployeeDocumentItem,
  EmployeeRecord,
  EmploymentHistoryItem,
  EmploymentStatus,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveStatus,
  NotificationRecord,
  OvertimeRequestRecord,
  PayrollRecordItem,
  PerformanceKpiItem,
  PerformanceReviewRecord,
  UserRole,
} from '../../shared/types.ts';
import {
  detectGenderFromName,
  doesAvatarMatchGender,
  isBuiltInAvatarUrl,
  pickGenderAvatarUrl,
  type EmployeeGender,
} from '../../shared/genderAvatars.ts';
import {
  getJakartaDateString,
  getJakartaMonthString,
} from './seedService.ts';

function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getJakartaMinutesOfDay(date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const [h, m] = formatted.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function calculateDaysInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff + 1;
}

export async function recordAuditLog(params: {
  actorUserId: number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
    });
  } catch (error) {
    console.error('Audit log insert failed:', error);
  }
}

export async function createNotification(params: {
  recipientEmployeeId: number | null;
  title: string;
  message: string;
  category: 'approval' | 'attendance_reminder' | 'announcement' | 'payroll' | 'info';
}) {
  try {
    await db.insert(notifications).values({
      recipientEmployeeId: params.recipientEmployeeId,
      title: params.title,
      message: params.message,
      category: params.category,
      isRead: false,
    });
  } catch (error) {
    console.error('Notification insert failed:', error);
  }
}

export async function getEmployeeById(employeeId: number): Promise<EmployeeRecord | null> {
  const list = await listEmployees();
  return list.find((e) => e.id === employeeId) ?? null;
}

export async function listEmployees(): Promise<EmployeeRecord[]> {
  try {
    const [empRows, deptRows, shiftRows, officeRows] = await Promise.all([
      db.select().from(employees).orderBy(employees.employeeCode),
      db.select().from(departments),
      db.select().from(workShifts),
      db.select().from(officeLocations),
    ]);

    const deptMap = new Map(deptRows.map((d) => [d.id, d]));
    const shiftMap = new Map(shiftRows.map((s) => [s.id, s]));
    const officeMap = new Map(officeRows.map((o) => [o.id, o]));
    const empNameMap = new Map(empRows.map((e) => [e.id, e.fullName]));

    return empRows.map((emp) => {
      const dept = emp.departmentId ? deptMap.get(emp.departmentId) : undefined;
      const shift = emp.shiftId ? shiftMap.get(emp.shiftId) : undefined;
      const office = emp.officeLocationId ? officeMap.get(emp.officeLocationId) : undefined;
      return {
        id: emp.id,
        userId: emp.userId,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        email: emp.email,
        phone: emp.phone,
        identityNumber: emp.identityNumber,
        address: emp.address,
        jobTitle: emp.jobTitle,
        divisionName: emp.divisionName || dept?.division || '',
        employmentStatus: emp.employmentStatus as EmploymentStatus,
        joinDate: emp.joinDate,
        avatarUrl: emp.avatarUrl,
        gender: (emp.gender === 'female' ? 'female' : 'male') as EmployeeGender,
        role: emp.role as UserRole,
        departmentId: emp.departmentId,
        departmentName: dept?.name ?? null,
        managerId: emp.managerId,
        managerName: emp.managerId ? (empNameMap.get(emp.managerId) ?? null) : null,
        shiftId: emp.shiftId,
        shiftName: shift?.name ?? null,
        shiftStartTime: shift?.startTime ?? null,
        shiftEndTime: shift?.endTime ?? null,
        officeLocationId: emp.officeLocationId,
        officeLocationName: office?.name ?? null,
        officeLat: office?.latitude ?? null,
        officeLng: office?.longitude ?? null,
        officeRadiusMeters: office?.radiusMeters ?? null,
        baseSalary: emp.baseSalary,
        defaultAllowance: emp.defaultAllowance,
        employmentHistory: safeParseJson<EmploymentHistoryItem[]>(emp.employmentHistory, []),
        documents: safeParseJson<EmployeeDocumentItem[]>(emp.documentsJson, []),
      };
    });
  } catch (error) {
    console.error('Failed to list employees:', error);
    throw new Error('Gagal memuat daftar karyawan dari database.', { cause: error });
  }
}

export async function createEmployeeRecord(
  input: {
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
    gender?: EmployeeGender;
    role: UserRole;
    departmentId: number | null;
    managerId: number | null;
    shiftId: number | null;
    officeLocationId: number | null;
    baseSalary: number;
    defaultAllowance: number;
  },
  actor: { userId: number; email: string },
): Promise<EmployeeRecord> {
  try {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(employees)
      .where(sql`lower(${employees.email}) = ${normalizedEmail}`);
    if (existing.length > 0) {
      throw new Error('VALIDATION:Email karyawan sudah terdaftar di sistem.');
    }

    const resolvedGender: EmployeeGender = input.gender ?? detectGenderFromName(input.fullName);
    const resolvedAvatarUrl = pickGenderAvatarUrl(
      resolvedGender,
      input.employeeCode.trim() || normalizedEmail,
    );

    const initialHistory: EmploymentHistoryItem[] = [
      {
        period: `${input.joinDate.slice(0, 4)} – Sekarang`,
        title: input.jobTitle,
        department: input.divisionName || 'Perusahaan',
        note: 'Penempatan awal karyawan.',
      },
    ];

    const [created] = await db
      .insert(employees)
      .values({
        employeeCode: input.employeeCode.trim(),
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        phone: input.phone,
        identityNumber: input.identityNumber,
        address: input.address,
        jobTitle: input.jobTitle,
        divisionName: input.divisionName,
        employmentStatus: input.employmentStatus,
        joinDate: input.joinDate,
        avatarUrl: resolvedAvatarUrl,
        gender: resolvedGender,
        role: input.role,
        departmentId: input.departmentId,
        managerId: input.managerId,
        shiftId: input.shiftId,
        officeLocationId: input.officeLocationId,
        baseSalary: input.baseSalary,
        defaultAllowance: input.defaultAllowance,
        employmentHistory: JSON.stringify(initialHistory),
        documentsJson: '[]',
      })
      .returning();

    const leaveTypeList = await db.select().from(leaveTypes);
    const currentYear = Number(getJakartaDateString().slice(0, 4));
    if (leaveTypeList.length > 0) {
      await db
        .insert(leaveBalances)
        .values(
          leaveTypeList.map((lt) => ({
            employeeId: created.id,
            leaveTypeId: lt.id,
            year: currentYear,
            allocatedDays: lt.defaultQuotaDays,
            usedDays: 0,
          })),
        )
        .onConflictDoNothing();
    }

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'CREATE_EMPLOYEE',
      entityType: 'employee',
      entityId: String(created.id),
      summary: `Menambahkan karyawan baru ${created.fullName} (${created.employeeCode}) sebagai ${created.role}`,
    });

    const record = await getEmployeeById(created.id);
    if (!record) throw new Error('Karyawan berhasil dibuat namun gagal dimuat.');
    return record;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      throw error;
    }
    console.error('Failed to create employee:', error);
    throw new Error('Gagal menyimpan data karyawan baru.', { cause: error });
  }
}

export async function updateEmployeeRecord(
  id: number,
  input: Partial<{
    fullName: string;
    phone: string;
    identityNumber: string;
    address: string;
    jobTitle: string;
    divisionName: string;
    employmentStatus: EmploymentStatus;
    gender: EmployeeGender;
    role: UserRole;
    departmentId: number | null;
    managerId: number | null;
    shiftId: number | null;
    officeLocationId: number | null;
    baseSalary: number;
    defaultAllowance: number;
    employmentHistory: EmploymentHistoryItem[];
    documents: EmployeeDocumentItem[];
  }>,
  actor: { userId: number; email: string; role: UserRole },
): Promise<EmployeeRecord> {
  try {
    if (input.role && !['super_admin', 'hr_admin', 'management'].includes(actor.role)) {
      throw new Error('FORBIDDEN:Hanya HR Admin atau Manajemen yang dapat mengubah peran pengguna.');
    }

    const [existingEmp] = await db.select().from(employees).where(eq(employees.id, id));
    if (!existingEmp) {
      throw new Error('NOT_FOUND:Data karyawan tidak ditemukan.');
    }

    const { employmentHistory, documents, ...rest } = input;
    const patchPayload: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (employmentHistory !== undefined) {
      patchPayload.employmentHistory = JSON.stringify(employmentHistory);
    }
    if (documents !== undefined) {
      patchPayload.documentsJson = JSON.stringify(documents);
    }

    const nextGender: EmployeeGender =
      input.gender ??
      (existingEmp.gender === 'female' ? 'female' : 'male');

    if (
      !existingEmp.avatarUrl ||
      (isBuiltInAvatarUrl(existingEmp.avatarUrl) &&
        !doesAvatarMatchGender(existingEmp.avatarUrl, nextGender))
    ) {
      patchPayload.avatarUrl = pickGenderAvatarUrl(
        nextGender,
        existingEmp.employeeCode || existingEmp.email,
      );
    }

    const [updated] = await db
      .update(employees)
      .set(patchPayload)
      .where(eq(employees.id, id))
      .returning();

    if (!updated) {
      throw new Error('NOT_FOUND:Data karyawan tidak ditemukan.');
    }

    if (updated.userId) {
      const userPatch: { role?: string; photoUrl?: string; displayName?: string } = {};
      if (input.role) userPatch.role = input.role;
      if (typeof patchPayload.avatarUrl === 'string') userPatch.photoUrl = patchPayload.avatarUrl;
      if (input.fullName) userPatch.displayName = updated.fullName;
      if (Object.keys(userPatch).length > 0) {
        await db.update(users).set(userPatch).where(eq(users.id, updated.userId));
      }
    }

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'employee',
      entityId: String(id),
      summary: `Memperbarui data karyawan ${updated.fullName} (${updated.employeeCode})`,
    });

    const record = await getEmployeeById(id);
    if (!record) throw new Error('Data karyawan tidak ditemukan.');
    return record;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('FORBIDDEN:') || error.message.startsWith('NOT_FOUND:'))
    ) {
      throw error;
    }
    console.error('Failed to update employee:', error);
    throw new Error('Gagal memperbarui data karyawan.', { cause: error });
  }
}

export async function updateOwnProfileName(params: {
  userId: number;
  employeeId: number;
  actorEmail: string;
  fullName: string;
}): Promise<EmployeeRecord> {
  try {
    const trimmedName = params.fullName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      throw new Error('VALIDATION:Nama lengkap harus antara 2 hingga 120 karakter.');
    }

    const [existingEmp] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, params.employeeId));
    if (!existingEmp) {
      throw new Error('NOT_FOUND:Profil karyawan Anda tidak ditemukan.');
    }

    const detectedGender = detectGenderFromName(trimmedName);
    const shouldUpdateAvatar =
      !existingEmp.avatarUrl ||
      (isBuiltInAvatarUrl(existingEmp.avatarUrl) &&
        !doesAvatarMatchGender(existingEmp.avatarUrl, detectedGender));
    const nextAvatarUrl = shouldUpdateAvatar
      ? pickGenderAvatarUrl(detectedGender, existingEmp.employeeCode || existingEmp.email)
      : existingEmp.avatarUrl;

    const [updatedEmp] = await db
      .update(employees)
      .set({
        fullName: trimmedName,
        gender: shouldUpdateAvatar ? detectedGender : existingEmp.gender,
        avatarUrl: nextAvatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, params.employeeId))
      .returning();

    if (!updatedEmp) {
      throw new Error('NOT_FOUND:Profil karyawan Anda tidak ditemukan.');
    }

    await db
      .update(users)
      .set({ displayName: trimmedName, photoUrl: nextAvatarUrl })
      .where(eq(users.id, params.userId));

    await recordAuditLog({
      actorUserId: params.userId,
      actorEmail: params.actorEmail,
      action: 'UPDATE_OWN_NAME',
      entityType: 'employee',
      entityId: String(params.employeeId),
      summary: `Pengguna memperbarui nama akunnya sendiri menjadi "${trimmedName}"`,
    });

    const record = await getEmployeeById(params.employeeId);
    if (!record) {
      throw new Error('NOT_FOUND:Profil karyawan tidak ditemukan setelah diperbarui.');
    }
    return record;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('VALIDATION:') || error.message.startsWith('NOT_FOUND:'))
    ) {
      throw error;
    }
    console.error('Failed to update own profile name:', error);
    throw new Error('Gagal memperbarui nama akun.', { cause: error });
  }
}

export async function getDashboardSummary(
  viewerRole: UserRole,
  viewerEmployeeId: number,
): Promise<DashboardSummary> {
  try {
    const today = getJakartaDateString();
    const currentMonth = getJakartaMonthString();
    const allEmps = await db.select().from(employees);

    const scopedEmployees =
      viewerRole === 'supervisor'
        ? allEmps.filter((e) => e.managerId === viewerEmployeeId || e.id === viewerEmployeeId)
        : allEmps;

    const scopedIds = scopedEmployees.map((e) => e.id);
    const activeCount = scopedEmployees.filter((e) => e.employmentStatus !== 'inactive').length;

    if (scopedIds.length === 0) {
      return {
        totalActiveEmployees: 0,
        presentTodayCount: 0,
        lateTodayCount: 0,
        onLeaveTodayCount: 0,
        pendingApprovalsCount: 0,
        publishedPayrollTotal: 0,
        workDate: today,
      };
    }

    const todayLogs = await db
      .select()
      .from(attendanceLogs)
      .where(and(eq(attendanceLogs.workDate, today), inArray(attendanceLogs.employeeId, scopedIds)));

    const presentTodayCount = todayLogs.length;
    const lateTodayCount = todayLogs.filter((l) => l.status === 'late').length;

    const leaveRows = await db
      .select()
      .from(leaveRequests)
      .where(inArray(leaveRequests.employeeId, scopedIds));

    const onLeaveTodayCount = leaveRows.filter(
      (lr) => lr.status === 'approved' && lr.startDate <= today && lr.endDate >= today,
    ).length;

    const pendingApprovalsCount = leaveRows.filter(
      (lr) => lr.status === 'pending_supervisor' || lr.status === 'pending_hr' || lr.status === 'pending',
    ).length;

    const payrollRows = await db
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.periodMonth, currentMonth));
    const publishedPayrollTotal = payrollRows.reduce((acc, r) => acc + r.netSalary, 0);

    return {
      totalActiveEmployees: activeCount,
      presentTodayCount,
      lateTodayCount,
      onLeaveTodayCount,
      pendingApprovalsCount,
      publishedPayrollTotal,
      workDate: today,
    };
  } catch (error) {
    console.error('Failed to compute dashboard summary:', error);
    throw new Error('Gagal memuat ringkasan dashboard.', { cause: error });
  }
}

export async function listAttendanceRecords(params: {
  viewerRole: UserRole;
  viewerEmployeeId: number;
  scope: 'mine' | 'team' | 'all';
  workDate?: string;
}): Promise<AttendanceRecord[]> {
  try {
    const allEmployees = await listEmployees();
    const empMap = new Map(allEmployees.map((e) => [e.id, e]));

    let targetIds: number[];
    if (params.scope === 'mine' || params.viewerRole === 'employee') {
      targetIds = [params.viewerEmployeeId];
    } else if (params.viewerRole === 'supervisor' || params.scope === 'team') {
      targetIds = allEmployees
        .filter((e) => e.managerId === params.viewerEmployeeId || e.id === params.viewerEmployeeId)
        .map((e) => e.id);
    } else {
      targetIds = allEmployees.map((e) => e.id);
    }

    if (targetIds.length === 0) return [];

    const conditions = [inArray(attendanceLogs.employeeId, targetIds)];
    if (params.workDate) {
      conditions.push(eq(attendanceLogs.workDate, params.workDate));
    }

    const rows = await db
      .select()
      .from(attendanceLogs)
      .where(and(...conditions))
      .orderBy(desc(attendanceLogs.workDate), desc(attendanceLogs.clockInAt))
      .limit(150);

    return rows.map((row) => {
      const emp = empMap.get(row.employeeId);
      const marker = ' · Pulang: ';
      const markerIdx = row.notes.indexOf(marker);
      const fallbackIn = markerIdx >= 0 ? row.notes.slice(0, markerIdx).trim() : row.notes.trim();
      const fallbackOut = markerIdx >= 0 ? row.notes.slice(markerIdx + marker.length).trim() : '';
      return {
        id: row.id,
        employeeId: row.employeeId,
        employeeCode: emp?.employeeCode ?? '-',
        employeeName: emp?.fullName ?? 'Karyawan',
        employeeAvatarUrl: emp?.avatarUrl ?? '',
        departmentName: emp?.departmentName ?? null,
        workDate: row.workDate,
        clockInAt: row.clockInAt.toISOString(),
        clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
        clockInLat: row.clockInLat,
        clockInLng: row.clockInLng,
        clockOutLat: row.clockOutLat,
        clockOutLng: row.clockOutLng,
        clockInDistanceMeters: row.clockInDistanceMeters,
        isWithinGeofence: row.isWithinGeofence,
        status: row.status as 'on_time' | 'late' | 'early_leave',
        workMinutes: row.workMinutes,
        overtimeMinutes: row.overtimeMinutes,
        earlyLeaveMinutes: row.earlyLeaveMinutes,
        clockInPhotoUrl: row.clockInPhotoUrl,
        clockOutPhotoUrl: row.clockOutPhotoUrl,
        clockInReason: row.clockInReason || fallbackIn,
        clockOutReason: row.clockOutReason || fallbackOut,
        notes: row.notes,
      };
    });
  } catch (error) {
    console.error('Failed to list attendance logs:', error);
    throw new Error('Gagal memuat riwayat kehadiran.', { cause: error });
  }
}

export async function clockInEmployee(params: {
  employeeId: number;
  latitude: number | null;
  longitude: number | null;
  clockInPhotoUrl: string;
  clockInReason?: string;
  notes?: string;
}): Promise<AttendanceRecord> {
  try {
    if (!params.clockInPhotoUrl || !params.clockInPhotoUrl.startsWith('data:image/')) {
      throw new Error('VALIDATION:Foto selfie CLOCK IN wajib diambil sebelum mencatat presensi masuk.');
    }
    const reason = (params.clockInReason || params.notes || '').trim();
    if (reason.length < 3) {
      throw new Error('VALIDATION:Alasan atau catatan presensi CLOCK IN wajib diisi minimal 3 karakter.');
    }

    const today = getJakartaDateString();
    const existing = await db
      .select()
      .from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, params.employeeId), eq(attendanceLogs.workDate, today)));

    if (existing.length > 0) {
      throw new Error('VALIDATION:Anda sudah melakukan presensi masuk hari ini.');
    }

    const emp = await getEmployeeById(params.employeeId);
    if (!emp) {
      throw new Error('NOT_FOUND:Profil karyawan tidak ditemukan.');
    }

    const serverNow = new Date();
    const startMinutes = parseTimeToMinutes(emp.shiftStartTime ?? '08:30');
    let graceMinutes = 15;
    if (emp.shiftId) {
      const [shiftRow] = await db.select().from(workShifts).where(eq(workShifts.id, emp.shiftId));
      if (shiftRow) graceMinutes = shiftRow.gracePeriodMinutes;
    }

    const nowMinutes = getJakartaMinutesOfDay(serverNow);
    const status = nowMinutes > startMinutes + graceMinutes ? 'late' : 'on_time';

    let distanceMeters: number | null = null;
    let isWithinGeofence = true;
    if (
      params.latitude !== null &&
      params.longitude !== null &&
      emp.officeLat !== null &&
      emp.officeLng !== null &&
      emp.officeRadiusMeters !== null
    ) {
      distanceMeters = calculateDistanceMeters(
        params.latitude,
        params.longitude,
        emp.officeLat,
        emp.officeLng,
      );
      isWithinGeofence = distanceMeters <= emp.officeRadiusMeters;
    } else if (params.latitude === null || params.longitude === null) {
      isWithinGeofence = false;
    }

    const [created] = await db
      .insert(attendanceLogs)
      .values({
        employeeId: params.employeeId,
        workDate: today,
        clockInAt: serverNow,
        clockInLat: params.latitude,
        clockInLng: params.longitude,
        clockInDistanceMeters: distanceMeters,
        isWithinGeofence,
        status,
        workMinutes: 0,
        overtimeMinutes: 0,
        earlyLeaveMinutes: 0,
        clockInPhotoUrl: params.clockInPhotoUrl,
        clockOutPhotoUrl: '',
        clockInReason: reason,
        clockOutReason: '',
        notes: reason,
      })
      .returning();

    return {
      id: created.id,
      employeeId: created.employeeId,
      employeeCode: emp.employeeCode,
      employeeName: emp.fullName,
      employeeAvatarUrl: emp.avatarUrl,
      departmentName: emp.departmentName,
      workDate: created.workDate,
      clockInAt: created.clockInAt.toISOString(),
      clockOutAt: null,
      clockInLat: created.clockInLat,
      clockInLng: created.clockInLng,
      clockOutLat: null,
      clockOutLng: null,
      clockInDistanceMeters: created.clockInDistanceMeters,
      isWithinGeofence: created.isWithinGeofence,
      status: created.status as 'on_time' | 'late' | 'early_leave',
      workMinutes: created.workMinutes,
      overtimeMinutes: created.overtimeMinutes,
      earlyLeaveMinutes: created.earlyLeaveMinutes,
      clockInPhotoUrl: created.clockInPhotoUrl,
      clockOutPhotoUrl: created.clockOutPhotoUrl,
      clockInReason: created.clockInReason,
      clockOutReason: created.clockOutReason,
      notes: created.notes,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('VALIDATION:') || error.message.startsWith('NOT_FOUND:'))
    ) {
      throw error;
    }
    console.error('Clock-in failed:', error);
    throw new Error('Gagal mencatat presensi masuk.', { cause: error });
  }
}

export async function clockOutEmployee(params: {
  employeeId: number;
  latitude: number | null;
  longitude: number | null;
  clockOutPhotoUrl: string;
  clockOutReason?: string;
  notes?: string;
}): Promise<AttendanceRecord> {
  try {
    if (!params.clockOutPhotoUrl || !params.clockOutPhotoUrl.startsWith('data:image/')) {
      throw new Error('VALIDATION:Foto selfie CLOCK OUT wajib diambil sebelum mencatat presensi pulang.');
    }
    const reason = (params.clockOutReason || params.notes || '').trim();
    if (reason.length < 3) {
      throw new Error('VALIDATION:Alasan atau catatan presensi CLOCK OUT wajib diisi minimal 3 karakter.');
    }

    const today = getJakartaDateString();
    const existing = await db
      .select()
      .from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, params.employeeId), eq(attendanceLogs.workDate, today)));

    const log = existing[0];
    if (!log) {
      throw new Error('VALIDATION:Anda belum melakukan presensi masuk hari ini.');
    }
    if (log.clockOutAt) {
      throw new Error('VALIDATION:Anda sudah melakukan presensi pulang hari ini.');
    }

    const emp = await getEmployeeById(params.employeeId);
    const serverNow = new Date();
    const workMinutes = Math.max(1, Math.round((serverNow.getTime() - log.clockInAt.getTime()) / 60000));

    const endShiftMinutes = parseTimeToMinutes(emp?.shiftEndTime ?? '17:30');
    const outMinutes = getJakartaMinutesOfDay(serverNow);
    const earlyLeaveMinutes = outMinutes < endShiftMinutes - 15 ? endShiftMinutes - outMinutes : 0;
    const overtimeMinutes = outMinutes > endShiftMinutes + 30 ? outMinutes - endShiftMinutes : 0;
    const nextStatus =
      log.status === 'on_time' && earlyLeaveMinutes > 0 ? 'early_leave' : log.status;

    const baseInReason = log.clockInReason || log.notes;
    const mergedNotes = baseInReason ? `${baseInReason} · Pulang: ${reason}` : reason;

    const [updated] = await db
      .update(attendanceLogs)
      .set({
        clockOutAt: serverNow,
        clockOutLat: params.latitude,
        clockOutLng: params.longitude,
        clockOutPhotoUrl: params.clockOutPhotoUrl,
        clockInReason: baseInReason,
        clockOutReason: reason,
        workMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        status: nextStatus,
        notes: mergedNotes,
      })
      .where(eq(attendanceLogs.id, log.id))
      .returning();

    return {
      id: updated.id,
      employeeId: updated.employeeId,
      employeeCode: emp?.employeeCode ?? '-',
      employeeName: emp?.fullName ?? 'Karyawan',
      employeeAvatarUrl: emp?.avatarUrl ?? '',
      departmentName: emp?.departmentName ?? null,
      workDate: updated.workDate,
      clockInAt: updated.clockInAt.toISOString(),
      clockOutAt: updated.clockOutAt ? updated.clockOutAt.toISOString() : null,
      clockInLat: updated.clockInLat,
      clockInLng: updated.clockInLng,
      clockOutLat: updated.clockOutLat,
      clockOutLng: updated.clockOutLng,
      clockInDistanceMeters: updated.clockInDistanceMeters,
      isWithinGeofence: updated.isWithinGeofence,
      status: updated.status as 'on_time' | 'late' | 'early_leave',
      workMinutes: updated.workMinutes,
      overtimeMinutes: updated.overtimeMinutes,
      earlyLeaveMinutes: updated.earlyLeaveMinutes,
      clockInPhotoUrl: updated.clockInPhotoUrl,
      clockOutPhotoUrl: updated.clockOutPhotoUrl,
      clockInReason: updated.clockInReason,
      clockOutReason: updated.clockOutReason,
      notes: updated.notes,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      throw error;
    }
    console.error('Clock-out failed:', error);
    throw new Error('Gagal mencatat presensi pulang.', { cause: error });
  }
}

export async function listOvertimeRequests(params: {
  viewerRole: UserRole;
  viewerEmployeeId: number;
  scope: 'mine' | 'team' | 'all';
}): Promise<OvertimeRequestRecord[]> {
  try {
    const allEmps = await listEmployees();
    const empMap = new Map(allEmps.map((e) => [e.id, e]));

    let targetIds: number[];
    if (params.scope === 'mine' || params.viewerRole === 'employee') {
      targetIds = [params.viewerEmployeeId];
    } else if (params.viewerRole === 'supervisor' || params.scope === 'team') {
      targetIds = allEmps
        .filter((e) => e.managerId === params.viewerEmployeeId || e.id === params.viewerEmployeeId)
        .map((e) => e.id);
    } else {
      targetIds = allEmps.map((e) => e.id);
    }

    if (targetIds.length === 0) return [];
    const rows = await db
      .select()
      .from(overtimeRequests)
      .where(inArray(overtimeRequests.employeeId, targetIds))
      .orderBy(desc(overtimeRequests.createdAt));

    return rows.map((row) => {
      const emp = empMap.get(row.employeeId);
      return {
        id: row.id,
        employeeId: row.employeeId,
        employeeCode: emp?.employeeCode ?? '-',
        employeeName: emp?.fullName ?? 'Karyawan',
        departmentName: emp?.departmentName ?? null,
        workDate: row.workDate,
        hours: row.hours,
        reason: row.reason,
        status: row.status as OvertimeRequestRecord['status'],
        reviewNote: row.reviewNote,
        createdAt: row.createdAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Failed to list overtime requests:', error);
    throw new Error('Gagal memuat pengajuan lembur.', { cause: error });
  }
}

export async function submitOvertimeRequest(params: {
  employeeId: number;
  workDate: string;
  hours: number;
  reason: string;
}): Promise<OvertimeRequestRecord> {
  try {
    const trimmedReason = params.reason.trim();
    if (trimmedReason.length < 5) {
      throw new Error('VALIDATION:Alasan atau catatan pengajuan lembur wajib diisi minimal 5 karakter.');
    }

    const emp = await getEmployeeById(params.employeeId);
    const initialStatus = emp?.managerId ? 'pending_supervisor' : 'pending_hr';
    const [created] = await db
      .insert(overtimeRequests)
      .values({
        employeeId: params.employeeId,
        workDate: params.workDate,
        hours: params.hours,
        reason: trimmedReason,
        status: initialStatus,
      })
      .returning();

    if (emp?.managerId) {
      await createNotification({
        recipientEmployeeId: emp.managerId,
        title: 'Pengajuan Lembur Baru',
        message: `${emp.fullName} mengajukan lembur ${params.hours} jam pada ${params.workDate}.`,
        category: 'approval',
      });
    }

    return {
      id: created.id,
      employeeId: created.employeeId,
      employeeCode: emp?.employeeCode ?? '-',
      employeeName: emp?.fullName ?? 'Karyawan',
      departmentName: emp?.departmentName ?? null,
      workDate: created.workDate,
      hours: created.hours,
      reason: created.reason,
      status: created.status as OvertimeRequestRecord['status'],
      reviewNote: created.reviewNote,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      throw error;
    }
    console.error('Failed to submit overtime:', error);
    throw new Error('Gagal mengajukan lembur.', { cause: error });
  }
}

export async function reviewOvertimeRequest(params: {
  id: number;
  decision: 'approved' | 'rejected';
  reviewNote: string;
  reviewerEmployeeId: number;
  reviewerRole: UserRole;
}): Promise<OvertimeRequestRecord> {
  try {
    const [existing] = await db
      .select()
      .from(overtimeRequests)
      .where(eq(overtimeRequests.id, params.id));

    if (!existing) throw new Error('NOT_FOUND:Pengajuan lembur tidak ditemukan.');
    if (existing.status === 'approved' || existing.status === 'rejected') {
      throw new Error('VALIDATION:Pengajuan lembur ini sudah diproses.');
    }

    const nextStatus =
      params.decision === 'rejected'
        ? 'rejected'
        : params.reviewerRole === 'supervisor' && existing.status === 'pending_supervisor'
          ? 'pending_hr'
          : 'approved';

    const [updated] = await db
      .update(overtimeRequests)
      .set({
        status: nextStatus,
        reviewedByEmployeeId: params.reviewerEmployeeId,
        reviewNote: params.reviewNote,
      })
      .where(eq(overtimeRequests.id, params.id))
      .returning();

    const emp = await getEmployeeById(updated.employeeId);
    await createNotification({
      recipientEmployeeId: updated.employeeId,
      title: 'Status Pengajuan Lembur',
      message: `Lembur ${updated.workDate} (${updated.hours} jam) berstatus: ${nextStatus === 'approved' ? 'Disetujui' : nextStatus === 'pending_hr' ? 'Disetujui Supervisor, Menunggu HR' : 'Ditolak'}.`,
      category: 'approval',
    });

    return {
      id: updated.id,
      employeeId: updated.employeeId,
      employeeCode: emp?.employeeCode ?? '-',
      employeeName: emp?.fullName ?? 'Karyawan',
      departmentName: emp?.departmentName ?? null,
      workDate: updated.workDate,
      hours: updated.hours,
      reason: updated.reason,
      status: updated.status as OvertimeRequestRecord['status'],
      reviewNote: updated.reviewNote,
      createdAt: updated.createdAt.toISOString(),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('VALIDATION:') || error.message.startsWith('NOT_FOUND:'))
    ) {
      throw error;
    }
    console.error('Failed to review overtime:', error);
    throw new Error('Gagal memproses persetujuan lembur.', { cause: error });
  }
}

export async function getLeaveTypesList() {
  try {
    return await db.select().from(leaveTypes).orderBy(leaveTypes.id);
  } catch (error) {
    console.error('Failed to get leave types:', error);
    throw new Error('Gagal memuat jenis cuti.', { cause: error });
  }
}

export async function getEmployeeLeaveBalances(employeeId: number): Promise<LeaveBalanceRecord[]> {
  try {
    const currentYear = Number(getJakartaDateString().slice(0, 4));
    const [balances, types] = await Promise.all([
      db
        .select()
        .from(leaveBalances)
        .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, currentYear))),
      db.select().from(leaveTypes),
    ]);

    const typeMap = new Map(types.map((t) => [t.id, t]));
    return balances.map((b) => {
      const lt = typeMap.get(b.leaveTypeId);
      return {
        id: b.id,
        employeeId: b.employeeId,
        leaveTypeId: b.leaveTypeId,
        leaveTypeCode: lt?.code ?? 'LEAVE',
        leaveTypeName: lt?.name ?? 'Cuti',
        year: b.year,
        allocatedDays: b.allocatedDays,
        usedDays: b.usedDays,
        remainingDays: Math.max(0, b.allocatedDays - b.usedDays),
      };
    });
  } catch (error) {
    console.error('Failed to load leave balances:', error);
    throw new Error('Gagal memuat kuota cuti karyawan.', { cause: error });
  }
}

export async function listLeaveRequests(params: {
  viewerRole: UserRole;
  viewerEmployeeId: number;
  scope: 'mine' | 'team' | 'all';
}): Promise<LeaveRequestRecord[]> {
  try {
    const [allEmps, allTypes] = await Promise.all([listEmployees(), db.select().from(leaveTypes)]);
    const empMap = new Map(allEmps.map((e) => [e.id, e]));
    const typeMap = new Map(allTypes.map((t) => [t.id, t]));

    let targetIds: number[];
    if (params.scope === 'mine' || params.viewerRole === 'employee') {
      targetIds = [params.viewerEmployeeId];
    } else if (params.viewerRole === 'supervisor' || params.scope === 'team') {
      targetIds = allEmps
        .filter((e) => e.managerId === params.viewerEmployeeId || e.id === params.viewerEmployeeId)
        .map((e) => e.id);
    } else {
      targetIds = allEmps.map((e) => e.id);
    }

    if (targetIds.length === 0) return [];

    const rows = await db
      .select()
      .from(leaveRequests)
      .where(inArray(leaveRequests.employeeId, targetIds))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(100);

    return rows.map((row) => {
      const emp = empMap.get(row.employeeId);
      const supReviewer = row.supervisorReviewedById
        ? empMap.get(row.supervisorReviewedById)
        : undefined;
      const reviewer = row.reviewedByEmployeeId ? empMap.get(row.reviewedByEmployeeId) : undefined;
      const lt = typeMap.get(row.leaveTypeId);
      const normalizedStatus =
        row.status === 'pending' ? 'pending_supervisor' : (row.status as LeaveStatus);

      return {
        id: row.id,
        employeeId: row.employeeId,
        employeeCode: emp?.employeeCode ?? '-',
        employeeName: emp?.fullName ?? 'Karyawan',
        employeeAvatarUrl: emp?.avatarUrl ?? '',
        departmentName: emp?.departmentName ?? null,
        managerId: emp?.managerId ?? null,
        leaveTypeId: row.leaveTypeId,
        leaveTypeName: lt?.name ?? 'Cuti',
        leaveTypeCode: lt?.code ?? 'LEAVE',
        startDate: row.startDate,
        endDate: row.endDate,
        totalDays: row.totalDays,
        reason: row.reason,
        status: normalizedStatus,
        supervisorReviewerName: supReviewer?.fullName ?? null,
        supervisorReviewedAt: row.supervisorReviewedAt
          ? row.supervisorReviewedAt.toISOString()
          : null,
        supervisorNote: row.supervisorNote,
        reviewedByEmployeeId: row.reviewedByEmployeeId,
        reviewerName: reviewer?.fullName ?? null,
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
        reviewNote: row.reviewNote,
        createdAt: row.createdAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Failed to list leave requests:', error);
    throw new Error('Gagal memuat daftar pengajuan cuti.', { cause: error });
  }
}

export async function submitLeaveRequest(params: {
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<LeaveRequestRecord> {
  try {
    const trimmedReason = params.reason.trim();
    if (trimmedReason.length < 5) {
      throw new Error(
        'VALIDATION:Alasan atau catatan pengajuan libur/cuti wajib diisi minimal 5 karakter.',
      );
    }
    if (params.endDate < params.startDate) {
      throw new Error('VALIDATION:Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
    }
    const totalDays = calculateDaysInclusive(params.startDate, params.endDate);
    if (totalDays <= 0 || totalDays > 60) {
      throw new Error('VALIDATION:Durasi cuti harus antara 1 hingga 60 hari.');
    }

    const year = Number(params.startDate.slice(0, 4));
    const [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, params.employeeId),
          eq(leaveBalances.leaveTypeId, params.leaveTypeId),
          eq(leaveBalances.year, year),
        ),
      );

    if (balance && balance.allocatedDays - balance.usedDays < totalDays) {
      throw new Error(
        `VALIDATION:Sisa kuota cuti tidak mencukupi (tersisa ${Math.max(0, balance.allocatedDays - balance.usedDays)} hari).`,
      );
    }

    const emp = await getEmployeeById(params.employeeId);
    const initialStatus: LeaveStatus = emp?.managerId ? 'pending_supervisor' : 'pending_hr';

    const [created] = await db
      .insert(leaveRequests)
      .values({
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        startDate: params.startDate,
        endDate: params.endDate,
        totalDays,
        reason: params.reason,
        status: initialStatus,
      })
      .returning();

    const [lt] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, params.leaveTypeId));

    if (emp?.managerId) {
      await createNotification({
        recipientEmployeeId: emp.managerId,
        title: 'Permohonan Cuti Tim',
        message: `${emp.fullName} mengajukan ${lt?.name ?? 'Cuti'} (${totalDays} hari) dan menunggu persetujuan Anda.`,
        category: 'approval',
      });
    }

    return {
      id: created.id,
      employeeId: created.employeeId,
      employeeCode: emp?.employeeCode ?? '-',
      employeeName: emp?.fullName ?? 'Karyawan',
      employeeAvatarUrl: emp?.avatarUrl ?? '',
      departmentName: emp?.departmentName ?? null,
      managerId: emp?.managerId ?? null,
      leaveTypeId: created.leaveTypeId,
      leaveTypeName: lt?.name ?? 'Cuti',
      leaveTypeCode: lt?.code ?? 'LEAVE',
      startDate: created.startDate,
      endDate: created.endDate,
      totalDays: created.totalDays,
      reason: created.reason,
      status: created.status as LeaveStatus,
      supervisorReviewerName: null,
      supervisorReviewedAt: null,
      supervisorNote: '',
      reviewedByEmployeeId: null,
      reviewerName: null,
      reviewedAt: null,
      reviewNote: '',
      createdAt: created.createdAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      throw error;
    }
    console.error('Failed to submit leave request:', error);
    throw new Error('Gagal mengirimkan pengajuan cuti.', { cause: error });
  }
}

export async function reviewLeaveRequest(params: {
  requestId: number;
  decision: 'approved' | 'rejected';
  reviewNote: string;
  reviewerEmployeeId: number;
  reviewerUserId: number;
  reviewerEmail: string;
  reviewerRole: UserRole;
}): Promise<LeaveRequestRecord> {
  try {
    if (params.decision === 'rejected' && !params.reviewNote.trim()) {
      throw new Error('VALIDATION:Alasan penolakan wajib diisi.');
    }

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, params.requestId));

      if (!existing) {
        throw new Error('NOT_FOUND:Pengajuan cuti tidak ditemukan.');
      }

      const currentStatus =
        existing.status === 'pending' ? 'pending_supervisor' : existing.status;

      if (!['pending_supervisor', 'pending_hr'].includes(currentStatus)) {
        throw new Error('VALIDATION:Pengajuan ini sudah selesai diproses.');
      }

      const [applicant] = await tx
        .select()
        .from(employees)
        .where(eq(employees.id, existing.employeeId));

      if (
        params.reviewerRole === 'supervisor' &&
        applicant?.managerId !== params.reviewerEmployeeId
      ) {
        throw new Error('FORBIDDEN:Supervisor hanya dapat memproses pengajuan anggota timnya.');
      }

      if (
        params.reviewerRole === 'supervisor' &&
        currentStatus !== 'pending_supervisor'
      ) {
        throw new Error('VALIDATION:Pengajuan ini sudah melewati tahap supervisor dan menunggu HR.');
      }

      if (existing.employeeId === params.reviewerEmployeeId && params.reviewerRole !== 'super_admin') {
        throw new Error('FORBIDDEN:Anda tidak dapat menyetujui pengajuan cuti milik sendiri.');
      }

      // Supervisor approval stage -> moves to pending_hr
      if (params.decision === 'approved' && params.reviewerRole === 'supervisor') {
        const [row] = await tx
          .update(leaveRequests)
          .set({
            status: 'pending_hr',
            supervisorReviewedById: params.reviewerEmployeeId,
            supervisorReviewedAt: new Date(),
            supervisorNote: params.reviewNote.trim() || 'Disetujui supervisor',
          })
          .where(eq(leaveRequests.id, params.requestId))
          .returning();
        return row;
      }

      // Final HR / Management approval stage
      if (params.decision === 'approved') {
        const year = Number(existing.startDate.slice(0, 4));
        const [bal] = await tx
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.employeeId, existing.employeeId),
              eq(leaveBalances.leaveTypeId, existing.leaveTypeId),
              eq(leaveBalances.year, year),
            ),
          );

        if (bal) {
          if (bal.allocatedDays - bal.usedDays < existing.totalDays) {
            throw new Error('VALIDATION:Kuota cuti karyawan tidak lagi mencukupi.');
          }
          await tx
            .update(leaveBalances)
            .set({ usedDays: sql`${leaveBalances.usedDays} + ${existing.totalDays}` })
            .where(eq(leaveBalances.id, bal.id));
        }
      }

      const [row] = await tx
        .update(leaveRequests)
        .set({
          status: params.decision,
          reviewedByEmployeeId: params.reviewerEmployeeId,
          reviewedAt: new Date(),
          reviewNote: params.reviewNote.trim(),
        })
        .where(eq(leaveRequests.id, params.requestId))
        .returning();

      return row;
    });

    await recordAuditLog({
      actorUserId: params.reviewerUserId,
      actorEmail: params.reviewerEmail,
      action:
        updated.status === 'pending_hr'
          ? 'SUPERVISOR_APPROVE_LEAVE'
          : params.decision === 'approved'
            ? 'HR_APPROVE_LEAVE'
            : 'REJECT_LEAVE',
      entityType: 'leave_request',
      entityId: String(params.requestId),
      summary: `Status pengajuan cuti #${params.requestId} diperbarui menjadi ${updated.status}`,
    });

    await createNotification({
      recipientEmployeeId: updated.employeeId,
      title: 'Pembaruan Status Cuti',
      message:
        updated.status === 'pending_hr'
          ? 'Pengajuan cuti Anda disetujui Supervisor dan diteruskan ke HRD.'
          : updated.status === 'approved'
            ? 'Pengajuan cuti Anda telah disetujui final oleh HRD.'
            : `Pengajuan cuti Anda ditolak: ${params.reviewNote}`,
      category: 'approval',
    });

    const allRequests = await listLeaveRequests({
      viewerRole: 'super_admin',
      viewerEmployeeId: params.reviewerEmployeeId,
      scope: 'all',
    });
    const found = allRequests.find((r) => r.id === updated.id);
    if (!found) throw new Error('Pengajuan tidak ditemukan setelah diperbarui.');
    return found;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('VALIDATION:') ||
        error.message.startsWith('NOT_FOUND:') ||
        error.message.startsWith('FORBIDDEN:'))
    ) {
      throw error;
    }
    console.error('Failed to review leave request:', error);
    throw new Error('Gagal memproses persetujuan cuti.', { cause: error });
  }
}

// Module D: Payroll Management
export async function listPayrollRecords(params: {
  periodMonth?: string;
  viewerRole: UserRole;
  viewerEmployeeId: number;
}): Promise<PayrollRecordItem[]> {
  try {
    const allEmps = await listEmployees();
    const empMap = new Map(allEmps.map((e) => [e.id, e]));

    const conditions = [];
    if (params.periodMonth) {
      conditions.push(eq(payrollRecords.periodMonth, params.periodMonth));
    }

    if (params.viewerRole === 'employee' || params.viewerRole === 'supervisor') {
      conditions.push(eq(payrollRecords.employeeId, params.viewerEmployeeId));
      conditions.push(eq(payrollRecords.status, 'published'));
    }

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(payrollRecords)
            .where(and(...conditions))
            .orderBy(desc(payrollRecords.periodMonth), payrollRecords.employeeId)
        : await db
            .select()
            .from(payrollRecords)
            .orderBy(desc(payrollRecords.periodMonth), payrollRecords.employeeId);

    return rows.map((r) => {
      const emp = empMap.get(r.employeeId);
      return {
        id: r.id,
        employeeId: r.employeeId,
        employeeCode: emp?.employeeCode ?? '-',
        employeeName: emp?.fullName ?? 'Karyawan',
        departmentName: emp?.departmentName ?? null,
        jobTitle: emp?.jobTitle ?? '',
        periodMonth: r.periodMonth,
        baseSalary: r.baseSalary,
        allowances: r.allowances,
        overtimePay: r.overtimePay,
        deductions: r.deductions,
        netSalary: r.netSalary,
        attendanceDays: r.attendanceDays,
        lateCount: r.lateCount,
        status: r.status as 'draft' | 'published',
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      };
    });
  } catch (error) {
    console.error('Failed to list payroll:', error);
    throw new Error('Gagal memuat data penggajian.', { cause: error });
  }
}

export async function generateMonthlyPayroll(
  periodMonth: string,
  actor: { userId: number; email: string },
): Promise<PayrollRecordItem[]> {
  try {
    const activeEmps = (await listEmployees()).filter((e) => e.employmentStatus !== 'inactive');
    const [allAtt, allOvertime] = await Promise.all([
      db.select().from(attendanceLogs),
      db.select().from(overtimeRequests),
    ]);

    for (const emp of activeEmps) {
      const monthLogs = allAtt.filter(
        (a) => a.employeeId === emp.id && a.workDate.startsWith(periodMonth),
      );
      const attendanceDays = monthLogs.length;
      const lateCount = monthLogs.filter((a) => a.status === 'late').length;

      const approvedOtHours = allOvertime
        .filter(
          (o) =>
            o.employeeId === emp.id &&
            o.status === 'approved' &&
            o.workDate.startsWith(periodMonth),
        )
        .reduce((acc, o) => acc + o.hours, 0);

      const overtimePay = Math.round(approvedOtHours * 75000);
      const baseDeductions = Math.round(emp.baseSalary * 0.03);
      const lateDeduction = lateCount * 50000;
      const deductions = baseDeductions + lateDeduction;
      const netSalary = Math.max(0, emp.baseSalary + emp.defaultAllowance + overtimePay - deductions);

      await db
        .insert(payrollRecords)
        .values({
          employeeId: emp.id,
          periodMonth,
          baseSalary: emp.baseSalary,
          allowances: emp.defaultAllowance,
          overtimePay,
          deductions,
          netSalary,
          attendanceDays,
          lateCount,
          status: 'draft',
        })
        .onConflictDoUpdate({
          target: [payrollRecords.employeeId, payrollRecords.periodMonth],
          set: {
            baseSalary: emp.baseSalary,
            allowances: emp.defaultAllowance,
            overtimePay,
            deductions,
            netSalary,
            attendanceDays,
            lateCount,
          },
        });
    }

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'GENERATE_PAYROLL',
      entityType: 'payroll',
      entityId: periodMonth,
      summary: `Menghitung rekap payroll periode ${periodMonth} untuk ${activeEmps.length} karyawan`,
    });

    return listPayrollRecords({
      periodMonth,
      viewerRole: 'hr_admin',
      viewerEmployeeId: 0,
    });
  } catch (error) {
    console.error('Failed to generate payroll:', error);
    throw new Error('Gagal memproses perhitungan payroll.', { cause: error });
  }
}

export async function publishPayrollPeriod(
  periodMonth: string,
  actor: { userId: number; email: string },
): Promise<void> {
  try {
    const updated = await db
      .update(payrollRecords)
      .set({
        status: 'published',
        publishedAt: new Date(),
      })
      .where(eq(payrollRecords.periodMonth, periodMonth))
      .returning();

    for (const row of updated) {
      await createNotification({
        recipientEmployeeId: row.employeeId,
        title: `Slip Gaji ${periodMonth} Terbit`,
        message: `Slip gaji periode ${periodMonth} sebesar Rp ${row.netSalary.toLocaleString('id-ID')} telah diterbitkan.`,
        category: 'payroll',
      });
    }

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'PUBLISH_PAYROLL',
      entityType: 'payroll',
      entityId: periodMonth,
      summary: `Menerbitkan ${updated.length} slip gaji periode ${periodMonth}`,
    });
  } catch (error) {
    console.error('Failed to publish payroll:', error);
    throw new Error('Gagal menerbitkan slip gaji.', { cause: error });
  }
}

// Module F: Performance Management
export async function listPerformanceReviews(params: {
  viewerRole: UserRole;
  viewerEmployeeId: number;
}): Promise<PerformanceReviewRecord[]> {
  try {
    const allEmps = await listEmployees();
    const empMap = new Map(allEmps.map((e) => [e.id, e]));

    let targetIds: number[];
    if (params.viewerRole === 'employee') {
      targetIds = [params.viewerEmployeeId];
    } else if (params.viewerRole === 'supervisor') {
      targetIds = allEmps
        .filter((e) => e.managerId === params.viewerEmployeeId || e.id === params.viewerEmployeeId)
        .map((e) => e.id);
    } else {
      targetIds = allEmps.map((e) => e.id);
    }

    if (targetIds.length === 0) return [];

    const rows = await db
      .select()
      .from(performanceReviews)
      .where(inArray(performanceReviews.employeeId, targetIds))
      .orderBy(desc(performanceReviews.createdAt));

    return rows.map((r) => {
      const emp = empMap.get(r.employeeId);
      const reviewer = empMap.get(r.reviewerEmployeeId);
      return {
        id: r.id,
        employeeId: r.employeeId,
        employeeCode: emp?.employeeCode ?? '-',
        employeeName: emp?.fullName ?? 'Karyawan',
        departmentName: emp?.departmentName ?? null,
        jobTitle: emp?.jobTitle ?? '',
        reviewerEmployeeId: r.reviewerEmployeeId,
        reviewerName: reviewer?.fullName ?? 'Supervisor',
        periodLabel: r.periodLabel,
        kpiItems: safeParseJson<PerformanceKpiItem[]>(r.kpiItemsJson, []),
        overallScore: r.overallScore,
        ratingLabel: r.ratingLabel,
        supervisorNotes: r.supervisorNotes,
        status: r.status as 'draft' | 'finalized',
        createdAt: r.createdAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Failed to list performance reviews:', error);
    throw new Error('Gagal memuat evaluasi kinerja.', { cause: error });
  }
}

export async function createPerformanceReviewRecord(
  input: {
    employeeId: number;
    periodLabel: string;
    kpiItems: PerformanceKpiItem[];
    supervisorNotes: string;
  },
  actor: { userId: number; email: string; employeeId: number },
): Promise<PerformanceReviewRecord> {
  try {
    const totalWeight = input.kpiItems.reduce((acc, item) => acc + item.weight, 0);
    const weightedSum = input.kpiItems.reduce((acc, item) => acc + item.score * item.weight, 0);
    const overallScore =
      totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(1)) : 0;

    const ratingLabel =
      overallScore >= 90
        ? 'Sangat Baik'
        : overallScore >= 75
          ? 'Baik'
          : overallScore >= 60
            ? 'Cukup'
            : 'Perlu Pembinaan';

    const [created] = await db
      .insert(performanceReviews)
      .values({
        employeeId: input.employeeId,
        reviewerEmployeeId: actor.employeeId,
        periodLabel: input.periodLabel,
        kpiItemsJson: JSON.stringify(input.kpiItems),
        overallScore,
        ratingLabel,
        supervisorNotes: input.supervisorNotes,
        status: 'finalized',
      })
      .returning();

    await createNotification({
      recipientEmployeeId: input.employeeId,
      title: `Evaluasi Kinerja ${input.periodLabel}`,
      message: `Penilaian KPI periode ${input.periodLabel} selesai dengan skor akhir ${overallScore} (${ratingLabel}).`,
      category: 'info',
    });

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'CREATE_PERFORMANCE_REVIEW',
      entityType: 'performance_review',
      entityId: String(created.id),
      summary: `Menerbitkan evaluasi KPI ${input.periodLabel} untuk karyawan #${input.employeeId} (Skor: ${overallScore})`,
    });

    const list = await listPerformanceReviews({
      viewerRole: 'super_admin',
      viewerEmployeeId: actor.employeeId,
    });
    const found = list.find((item) => item.id === created.id);
    if (!found) throw new Error('Evaluasi gagal dimuat.');
    return found;
  } catch (error) {
    console.error('Failed to create performance review:', error);
    throw new Error('Gagal menyimpan evaluasi kinerja.', { cause: error });
  }
}

// Module G: Announcements & Notifications
export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  try {
    const [rows, allEmps] = await Promise.all([
      db.select().from(announcements).orderBy(desc(announcements.isPinned), desc(announcements.createdAt)),
      db.select().from(employees),
    ]);
    const empMap = new Map(allEmps.map((e) => [e.id, e.fullName]));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category as AnnouncementRecord['category'],
      content: r.content,
      authorName: empMap.get(r.authorEmployeeId) ?? 'HRD',
      isPinned: r.isPinned,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Failed to list announcements:', error);
    throw new Error('Gagal memuat pengumuman perusahaan.', { cause: error });
  }
}

export async function createAnnouncementRecord(
  input: {
    title: string;
    category: 'company' | 'hr_info' | 'policy';
    content: string;
    isPinned: boolean;
  },
  actor: { userId: number; email: string; employeeId: number },
): Promise<AnnouncementRecord> {
  try {
    const [created] = await db
      .insert(announcements)
      .values({
        title: input.title,
        category: input.category,
        content: input.content,
        authorEmployeeId: actor.employeeId,
        isPinned: input.isPinned,
      })
      .returning();

    await createNotification({
      recipientEmployeeId: null,
      title: `Pengumuman: ${input.title}`,
      message: input.content.slice(0, 140),
      category: 'announcement',
    });

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'PUBLISH_ANNOUNCEMENT',
      entityType: 'announcement',
      entityId: String(created.id),
      summary: `Menerbitkan pengumuman "${created.title}"`,
    });

    const emp = await getEmployeeById(actor.employeeId);
    return {
      id: created.id,
      title: created.title,
      category: created.category as AnnouncementRecord['category'],
      content: created.content,
      authorName: emp?.fullName ?? 'HRD',
      isPinned: created.isPinned,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Failed to create announcement:', error);
    throw new Error('Gagal menerbitkan pengumuman.', { cause: error });
  }
}

export async function listNotificationsForEmployee(
  employeeId: number,
): Promise<NotificationRecord[]> {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(
        or(
          eq(notifications.recipientEmployeeId, employeeId),
          isNull(notifications.recipientEmployeeId),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    return rows.map((r) => ({
      id: r.id,
      recipientEmployeeId: r.recipientEmployeeId,
      title: r.title,
      message: r.message,
      category: r.category as NotificationRecord['category'],
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Failed to list notifications:', error);
    throw new Error('Gagal memuat notifikasi.', { cause: error });
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  try {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  } catch (error) {
    console.error('Failed to mark notification read:', error);
  }
}

export async function sendAttendanceReminders(actor: { userId: number; email: string }): Promise<number> {
  try {
    const today = getJakartaDateString();
    const [activeEmps, todayLogs] = await Promise.all([
      db.select().from(employees).where(eq(employees.employmentStatus, 'active')),
      db.select().from(attendanceLogs).where(eq(attendanceLogs.workDate, today)),
    ]);

    const clockedInIds = new Set(todayLogs.map((l) => l.employeeId));
    const missingEmps = activeEmps.filter((e) => !clockedInIds.has(e.id));

    for (const emp of missingEmps) {
      await createNotification({
        recipientEmployeeId: emp.id,
        title: 'Pengingat Presensi Masuk',
        message: `Halo ${emp.fullName}, Anda belum mencatat presensi masuk hari ini (${today}). Segera lakukan clock-in melalui KaryaFlow PWA.`,
        category: 'attendance_reminder',
      });
    }

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'SEND_ATTENDANCE_REMINDER',
      entityType: 'notification',
      entityId: today,
      summary: `Mengirim pengingat presensi ke ${missingEmps.length} karyawan yang belum clock-in`,
    });

    return missingEmps.length;
  } catch (error) {
    console.error('Failed to send attendance reminders:', error);
    throw new Error('Gagal mengirim pengingat presensi.', { cause: error });
  }
}

// Master Data & Audit
export async function getOrganizationMasterData() {
  try {
    const [deptList, shiftList, locationList, leaveTypeList] = await Promise.all([
      db.select().from(departments).orderBy(departments.name),
      db.select().from(workShifts).orderBy(workShifts.startTime),
      db.select().from(officeLocations).orderBy(officeLocations.name),
      db.select().from(leaveTypes).orderBy(leaveTypes.id),
    ]);
    return {
      departments: deptList,
      workShifts: shiftList,
      officeLocations: locationList,
      leaveTypes: leaveTypeList,
    };
  } catch (error) {
    console.error('Failed to load organization master data:', error);
    throw new Error('Gagal memuat konfigurasi organisasi.', { cause: error });
  }
}

export async function createDepartmentRecord(
  input: { code: string; name: string; division: string; description: string },
  actor: { userId: number; email: string },
) {
  try {
    const [created] = await db
      .insert(departments)
      .values({
        code: input.code.toUpperCase(),
        name: input.name,
        division: input.division || 'Operasional Korporat',
        description: input.description,
      })
      .returning();

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'CREATE_DEPARTMENT',
      entityType: 'department',
      entityId: String(created.id),
      summary: `Menambahkan departemen ${created.name} (${created.code}) di divisi ${created.division}`,
    });
    return created;
  } catch (error) {
    console.error('Failed to create department:', error);
    throw new Error('Gagal menambahkan departemen baru (kode atau nama mungkin sudah digunakan).', {
      cause: error,
    });
  }
}

export async function createOfficeLocationRecord(
  input: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  },
  actor: { userId: number; email: string },
) {
  try {
    const [created] = await db
      .insert(officeLocations)
      .values({
        name: input.name,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
        isActive: true,
      })
      .returning();

    await recordAuditLog({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'CREATE_OFFICE_LOCATION',
      entityType: 'office_location',
      entityId: String(created.id),
      summary: `Menambahkan lokasi kantor ${created.name} (radius ${created.radiusMeters}m)`,
    });
    return created;
  } catch (error) {
    console.error('Failed to create office location:', error);
    throw new Error('Gagal menambahkan lokasi kantor baru.', { cause: error });
  }
}

export async function listAuditLogs(): Promise<AuditLogRecord[]> {
  try {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
    return rows.map((row) => ({
      id: row.id,
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Failed to list audit logs:', error);
    throw new Error('Gagal memuat log audit.', { cause: error });
  }
}
