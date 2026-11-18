import { count, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  announcements,
  attendanceLogs,
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
import type { UserRole } from '../../shared/types.ts';

let seedPromise: Promise<void> | null = null;

export function getJakartaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getJakartaMonthString(date = new Date()): string {
  return getJakartaDateString(date).slice(0, 7);
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  try {
    // 1. Departments & Divisions
    await db
      .insert(departments)
      .values([
        {
          code: 'HRD',
          name: 'Human Resources & People Ops',
          division: 'People & Corporate Services',
          description: 'Pengelolaan SDM, payroll, rekrutmen, dan kepatuhan ketenagakerjaan.',
        },
        {
          code: 'ENG',
          name: 'Technology & Engineering',
          division: 'Digital & Product',
          description: 'Pengembangan sistem inti, infrastruktur cloud, dan produk digital.',
        },
        {
          code: 'FIN',
          name: 'Finance & Accounting',
          division: 'Finance & Corporate Governance',
          description: 'Pengelolaan anggaran, perpajakan, dan pelaporan keuangan.',
        },
        {
          code: 'OPS',
          name: 'Operations & Management',
          division: 'Executive & Operations',
          description: 'Operasional lapangan, strategi eksekutif, dan layanan korporat.',
        },
      ])
      .onConflictDoNothing();

    const deptList = await db.select().from(departments);
    const deptByCode = new Map(deptList.map((d) => [d.code, d]));

    // 2. Office Locations
    await db
      .insert(officeLocations)
      .values([
        {
          name: 'Kantor Pusat Jakarta (SCBD)',
          address: 'Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan',
          latitude: -6.225014,
          longitude: 106.809547,
          radiusMeters: 300,
          isActive: true,
        },
        {
          name: 'Hub Operasional Bandung',
          address: 'Jl. Asia Afrika No. 112, Kota Bandung',
          latitude: -6.921857,
          longitude: 107.607058,
          radiusMeters: 250,
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    const locationList = await db.select().from(officeLocations);
    const mainOffice = locationList[0];

    // 3. Work Shifts
    await db
      .insert(workShifts)
      .values([
        { name: 'Shift Reguler Pagi', startTime: '08:30', endTime: '17:30', gracePeriodMinutes: 15 },
        { name: 'Shift Operasional Siang', startTime: '10:00', endTime: '19:00', gracePeriodMinutes: 15 },
      ])
      .onConflictDoNothing();

    const shiftList = await db.select().from(workShifts);
    const regularShift = shiftList[0];

    // 4. Leave Types (Cuti, Izin Tidak Masuk, Sakit, Cuti Khusus)
    await db
      .insert(leaveTypes)
      .values([
        { code: 'ANNUAL', name: 'Cuti Tahunan', defaultQuotaDays: 12, isPaid: true },
        { code: 'PERMIT', name: 'Izin Tidak Masuk', defaultQuotaDays: 6, isPaid: true },
        { code: 'SICK', name: 'Izin Sakit', defaultQuotaDays: 14, isPaid: true },
        { code: 'SPECIAL', name: 'Cuti Keperluan Khusus', defaultQuotaDays: 5, isPaid: true },
      ])
      .onConflictDoNothing();

    const leaveTypeList = await db.select().from(leaveTypes);
    const annualLeave = leaveTypeList.find((lt) => lt.code === 'ANNUAL') ?? leaveTypeList[0];
    const sickLeave = leaveTypeList.find((lt) => lt.code === 'SICK') ?? leaveTypeList[0];
    const permitLeave = leaveTypeList.find((lt) => lt.code === 'PERMIT') ?? leaveTypeList[0];

    // 5. Ensure Demo Employees + Team Members exist
    const demoEmployeesSeed = [
      {
        employeeCode: 'KF-001',
        fullName: 'Ratna Pratiwi',
        email: 'hr.admin@karyaflow.id',
        phone: '0812-8801-1101',
        identityNumber: '3174015403880001',
        address: 'Jl. Kemang Timur No. 18, Jakarta Selatan',
        jobTitle: 'Head of People Operations',
        divisionName: 'People & Corporate Services',
        employmentStatus: 'active',
        joinDate: '2022-03-01',
        avatarUrl: '/src/assets/images/avatar_hr_director_1794971297186.jpg',
        role: 'hr_admin',
        departmentId: deptByCode.get('HRD')?.id ?? null,
        shiftId: regularShift?.id ?? null,
        officeLocationId: mainOffice?.id ?? null,
        baseSalary: 22000000,
        defaultAllowance: 3500000,
        employmentHistory: JSON.stringify([
          { period: '2024 – Sekarang', title: 'Head of People Operations', department: 'HRD', note: 'Memimpin transformasi digital HR & kepatuhan.' },
          { period: '2022 – 2024', title: 'HR Business Partner Lead', department: 'HRD', note: 'Mengelola rekrutmen dan kompensasi.' },
        ]),
        documentsJson: JSON.stringify([
          { id: 'doc-1', title: 'Perjanjian Kerja Waktu Tidak Tertentu (PKWTT)', category: 'Kontrak', uploadedAt: '2022-03-01', fileUrl: '#pkwt-kf001' },
          { id: 'doc-2', title: 'NPWP & Kepesertaan BPJS Kesehatan', category: 'Administrasi', uploadedAt: '2022-03-05', fileUrl: '#bpjs-kf001' },
        ]),
      },
      {
        employeeCode: 'KF-000',
        fullName: 'Hendra Gunawan',
        email: 'manajemen@karyaflow.id',
        phone: '0811-9000-2201',
        identityNumber: '3171021208810004',
        address: 'Jl. Senopati Raya No. 45, Jakarta Selatan',
        jobTitle: 'VP of Corporate Operations',
        divisionName: 'Executive & Operations',
        employmentStatus: 'active',
        joinDate: '2021-01-10',
        avatarUrl: '',
        role: 'management',
        departmentId: deptByCode.get('OPS')?.id ?? null,
        shiftId: regularShift?.id ?? null,
        officeLocationId: mainOffice?.id ?? null,
        baseSalary: 32000000,
        defaultAllowance: 6000000,
        employmentHistory: JSON.stringify([
          { period: '2021 – Sekarang', title: 'VP of Corporate Operations', department: 'OPS', note: 'Pengawasan eksekutif kinerja dan anggaran operasional.' },
        ]),
        documentsJson: JSON.stringify([
          { id: 'doc-3', title: 'SK Pengangkatan Eksekutif', category: 'Kontrak', uploadedAt: '2021-01-10', fileUrl: '#sk-kf000' },
        ]),
      },
      {
        employeeCode: 'KF-002',
        fullName: 'Budi Santoso',
        email: 'supervisor@karyaflow.id',
        phone: '0812-8801-1102',
        identityNumber: '3273041907900002',
        address: 'Jl. Bintaro Utama Blok E2, Tangerang Selatan',
        jobTitle: 'Engineering Manager',
        divisionName: 'Digital & Product',
        employmentStatus: 'active',
        joinDate: '2022-07-15',
        avatarUrl: '/src/assets/images/avatar_tech_supervisor_1794971297687.jpg',
        role: 'supervisor',
        departmentId: deptByCode.get('ENG')?.id ?? null,
        shiftId: regularShift?.id ?? null,
        officeLocationId: mainOffice?.id ?? null,
        baseSalary: 18500000,
        defaultAllowance: 2800000,
        employmentHistory: JSON.stringify([
          { period: '2024 – Sekarang', title: 'Engineering Manager', department: 'ENG', note: 'Supervisor langsung tim Product & Backend.' },
          { period: '2022 – 2024', title: 'Senior Full-Stack Engineer', department: 'ENG', note: 'Arsitektur layanan inti perusahaan.' },
        ]),
        documentsJson: JSON.stringify([
          { id: 'doc-4', title: 'PKWTT Engineering Manager', category: 'Kontrak', uploadedAt: '2022-07-15', fileUrl: '#pkwt-kf002' },
        ]),
      },
      {
        employeeCode: 'KF-003',
        fullName: 'Nadia Kusuma',
        email: 'karyawan@karyaflow.id',
        phone: '0813-9022-4410',
        identityNumber: '3174056205950003',
        address: 'Jl. Tebet Barat Dalam IX No. 7, Jakarta Selatan',
        jobTitle: 'Senior Product Designer',
        divisionName: 'Digital & Product',
        employmentStatus: 'active',
        joinDate: '2023-01-10',
        avatarUrl: '/src/assets/images/avatar_staff_employee_1794971297453.jpg',
        role: 'employee',
        departmentId: deptByCode.get('ENG')?.id ?? null,
        shiftId: regularShift?.id ?? null,
        officeLocationId: mainOffice?.id ?? null,
        baseSalary: 12500000,
        defaultAllowance: 1800000,
        employmentHistory: JSON.stringify([
          { period: '2025 – Sekarang', title: 'Senior Product Designer', department: 'ENG', note: 'Desain pengalaman sistem enterprise & PWA.' },
          { period: '2023 – 2025', title: 'Product Designer', department: 'ENG', note: 'Pengembangan sistem desain komponen.' },
        ]),
        documentsJson: JSON.stringify([
          { id: 'doc-5', title: 'PKWTT Senior Product Designer', category: 'Kontrak', uploadedAt: '2023-01-10', fileUrl: '#pkwt-kf003' },
          { id: 'doc-6', title: 'Sertifikat Pelatihan UX Accessibility', category: 'Sertifikasi', uploadedAt: '2025-04-12', fileUrl: '#cert-kf003' },
        ]),
      },
      {
        employeeCode: 'KF-004',
        fullName: 'Dimas Wijaya',
        email: 'dimas.wijaya@karyaflow.id',
        phone: '0811-7745-2090',
        identityNumber: '3173011104940008',
        address: 'Jl. Palmerah Barat No. 22, Jakarta Barat',
        jobTitle: 'Backend Software Engineer',
        divisionName: 'Digital & Product',
        employmentStatus: 'active',
        joinDate: '2023-06-05',
        avatarUrl: '',
        role: 'employee',
        departmentId: deptByCode.get('ENG')?.id ?? null,
        shiftId: regularShift?.id ?? null,
        officeLocationId: mainOffice?.id ?? null,
        baseSalary: 13000000,
        defaultAllowance: 1800000,
        employmentHistory: JSON.stringify([
          { period: '2023 – Sekarang', title: 'Backend Software Engineer', department: 'ENG', note: 'Layanan API & integrasi PostgreSQL.' },
        ]),
        documentsJson: JSON.stringify([
          { id: 'doc-7', title: 'PKWTT Backend Engineer', category: 'Kontrak', uploadedAt: '2023-06-05', fileUrl: '#pkwt-kf004' },
        ]),
      },
      {
        employeeCode: 'KF-005',
        fullName: 'Siti Rahmawati',
        email: 'siti.rahmawati@karyaflow.id',
        phone: '0815-6632-9981',
        identityNumber: '3275034809970005',
        address: 'Jl. Kalibata Raya No. 14, Jakarta Selatan',
        jobTitle: 'Finance Analyst',
        divisionName: 'Finance & Corporate Governance',
        employmentStatus: 'probation',
        joinDate: '2026-09-01',
        avatarUrl: '',
        role: 'employee',
        departmentId: deptByCode.get('FIN')?.id ?? null,
        shiftId: regularShift?.id ?? null,
        officeLocationId: mainOffice?.id ?? null,
        baseSalary: 9500000,
        defaultAllowance: 1200000,
        employmentHistory: JSON.stringify([
          { period: '2026 – Sekarang', title: 'Finance Analyst (Probation)', department: 'FIN', note: 'Analisis rekonsiliasi payroll & pajak.' },
        ]),
        documentsJson: JSON.stringify([
          { id: 'doc-8', title: 'Kontrak Masa Percobaan (3 Bulan)', category: 'Kontrak', uploadedAt: '2026-09-01', fileUrl: '#pkwt-kf005' },
        ]),
      },
    ];

    // Insert missing demo employees by email or employeeCode safely
    for (const item of demoEmployeesSeed) {
      const existingByCode = await db
        .select()
        .from(employees)
        .where(eq(employees.employeeCode, item.employeeCode));

      if (existingByCode[0]) {
        // Keep demo emails aligned for the 4 demo login buttons if previously seeded with @karyaflow.id old emails
        await db
          .update(employees)
          .set({
            email: item.email,
            role: item.role,
            identityNumber: existingByCode[0].identityNumber || item.identityNumber,
            address: existingByCode[0].address || item.address,
            divisionName: existingByCode[0].divisionName || item.divisionName,
            baseSalary: item.baseSalary,
            defaultAllowance: item.defaultAllowance,
            employmentHistory:
              existingByCode[0].employmentHistory === '[]'
                ? item.employmentHistory
                : existingByCode[0].employmentHistory,
            documentsJson:
              existingByCode[0].documentsJson === '[]'
                ? item.documentsJson
                : existingByCode[0].documentsJson,
          })
          .where(eq(employees.id, existingByCode[0].id));
      } else {
        await db.insert(employees).values(item).onConflictDoNothing();
      }
    }

    const allEmps = await db.select().from(employees);
    const mgmtEmp = allEmps.find((e) => e.employeeCode === 'KF-000');
    const hrEmp = allEmps.find((e) => e.employeeCode === 'KF-001');
    const supEmp = allEmps.find((e) => e.employeeCode === 'KF-002');
    const nadiaEmp = allEmps.find((e) => e.employeeCode === 'KF-003');
    const dimasEmp = allEmps.find((e) => e.employeeCode === 'KF-004');
    const sitiEmp = allEmps.find((e) => e.employeeCode === 'KF-005');

    // Set reporting hierarchy (Org Tree)
    if (mgmtEmp && hrEmp && supEmp) {
      await db.update(employees).set({ managerId: mgmtEmp.id }).where(eq(employees.id, hrEmp.id));
      await db.update(employees).set({ managerId: mgmtEmp.id }).where(eq(employees.id, supEmp.id));
    }
    if (supEmp && nadiaEmp && dimasEmp) {
      await db.update(employees).set({ managerId: supEmp.id }).where(eq(employees.id, nadiaEmp.id));
      await db.update(employees).set({ managerId: supEmp.id }).where(eq(employees.id, dimasEmp.id));
    }
    if (hrEmp && sitiEmp) {
      await db.update(employees).set({ managerId: hrEmp.id }).where(eq(employees.id, sitiEmp.id));
    }

    // 6. Leave Balances for all employees
    const currentYear = Number(getJakartaDateString().slice(0, 4));
    const balanceRows = [];
    for (const emp of allEmps) {
      for (const lt of leaveTypeList) {
        balanceRows.push({
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: currentYear,
          allocatedDays: lt.defaultQuotaDays,
          usedDays: emp.id === nadiaEmp?.id && lt.id === annualLeave?.id ? 2 : 0,
        });
      }
    }
    if (balanceRows.length > 0) {
      await db.insert(leaveBalances).values(balanceRows).onConflictDoNothing();
    }

    // 7. Attendance Logs for Today
    const today = getJakartaDateString();
    const now = new Date();
    const onTimeClockIn = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const lateClockIn = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    if (hrEmp && supEmp && nadiaEmp) {
      await db
        .insert(attendanceLogs)
        .values([
          {
            employeeId: hrEmp.id,
            workDate: today,
            clockInAt: onTimeClockIn,
            clockInLat: mainOffice?.latitude ?? -6.225014,
            clockInLng: mainOffice?.longitude ?? 106.809547,
            clockInDistanceMeters: 18,
            isWithinGeofence: true,
            status: 'on_time',
            workMinutes: 240,
            notes: 'Hadir di Kantor Pusat SCBD',
          },
          {
            employeeId: supEmp.id,
            workDate: today,
            clockInAt: onTimeClockIn,
            clockInLat: mainOffice?.latitude ?? -6.225014,
            clockInLng: mainOffice?.longitude ?? 106.809547,
            clockInDistanceMeters: 42,
            isWithinGeofence: true,
            status: 'on_time',
            workMinutes: 240,
            notes: 'Standup pagi tim engineering',
          },
          {
            employeeId: nadiaEmp.id,
            workDate: today,
            clockInAt: lateClockIn,
            clockInLat: -6.2261,
            clockInLng: 106.8102,
            clockInDistanceMeters: 140,
            isWithinGeofence: true,
            status: 'late',
            workMinutes: 120,
            notes: 'Terlambat karena kendala transportasi',
          },
        ])
        .onConflictDoNothing();
    }

    // 8. Leave Requests (2-tier demo: pending_supervisor & pending_hr)
    const [existingLeaveCount] = await db.select({ value: count() }).from(leaveRequests);
    if ((existingLeaveCount?.value ?? 0) === 0 && nadiaEmp && dimasEmp && annualLeave && sickLeave && permitLeave) {
      const nextWeekStart = getJakartaDateString(new Date(now.getTime() + 5 * 86400000));
      const nextWeekEnd = getJakartaDateString(new Date(now.getTime() + 6 * 86400000));
      const pastStart = getJakartaDateString(new Date(now.getTime() - 10 * 86400000));
      const pastEnd = getJakartaDateString(new Date(now.getTime() - 9 * 86400000));

      await db.insert(leaveRequests).values([
        {
          employeeId: nadiaEmp.id,
          leaveTypeId: annualLeave.id,
          startDate: pastStart,
          endDate: pastEnd,
          totalDays: 2,
          reason: 'Keperluan keluarga di Yogyakarta',
          status: 'approved',
          supervisorReviewedById: supEmp?.id ?? null,
          supervisorReviewedAt: new Date(now.getTime() - 11 * 86400000),
          supervisorNote: 'Disetujui di tingkat tim.',
          reviewedByEmployeeId: hrEmp?.id ?? null,
          reviewedAt: new Date(now.getTime() - 10 * 86400000),
          reviewNote: 'Disetujui HR, saldo cuti telah disesuaikan.',
        },
        {
          employeeId: dimasEmp.id,
          leaveTypeId: annualLeave.id,
          startDate: nextWeekStart,
          endDate: nextWeekEnd,
          totalDays: 2,
          reason: 'Cuti tahunan untuk menghadiri acara pernikahan saudara',
          status: 'pending_supervisor',
        },
        {
          employeeId: nadiaEmp.id,
          leaveTypeId: permitLeave.id,
          startDate: nextWeekStart,
          endDate: nextWeekStart,
          totalDays: 1,
          reason: 'Izin mengurus perpanjangan dokumen kependudukan',
          status: 'pending_hr',
          supervisorReviewedById: supEmp?.id ?? null,
          supervisorReviewedAt: new Date(now.getTime() - 3600000),
          supervisorNote: 'Direkomendasikan supervisor, menunggu finalisasi HR.',
        },
        {
          employeeId: sitiEmp?.id ?? nadiaEmp.id,
          leaveTypeId: sickLeave.id,
          startDate: today,
          endDate: today,
          totalDays: 1,
          reason: 'Pemeriksaan kesehatan rutin di klinik',
          status: 'pending_supervisor',
        },
      ]);
    }

    // 9. Overtime Requests
    const [existingOtCount] = await db.select({ value: count() }).from(overtimeRequests);
    if ((existingOtCount?.value ?? 0) === 0 && nadiaEmp && dimasEmp) {
      const yesterday = getJakartaDateString(new Date(now.getTime() - 86400000));
      await db.insert(overtimeRequests).values([
        {
          employeeId: dimasEmp.id,
          workDate: yesterday,
          hours: 2.5,
          reason: 'Deployment patch keamanan server produksi di luar jam kerja',
          status: 'approved',
          reviewedByEmployeeId: supEmp?.id ?? null,
          reviewNote: 'Terverifikasi log rilis malam.',
        },
        {
          employeeId: nadiaEmp.id,
          workDate: yesterday,
          hours: 2,
          reason: 'Finalisasi prototype desain sprint kuartal IV',
          status: 'pending_supervisor',
        },
      ]);
    }

    // 10. Payroll Sample Records (Current & Previous Month)
    const [existingPayrollCount] = await db.select({ value: count() }).from(payrollRecords);
    if ((existingPayrollCount?.value ?? 0) === 0) {
      const currentMonth = getJakartaMonthString();
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = getJakartaMonthString(prevMonthDate);

      const payrollSeed = allEmps.map((e) => {
        const overtimePay = e.employeeCode === 'KF-004' ? 350000 : 0;
        const deductions = Math.round(e.baseSalary * 0.03); // BPJS & PPh21 demo
        return {
          employeeId: e.id,
          periodMonth: prevMonth,
          baseSalary: e.baseSalary,
          allowances: e.defaultAllowance,
          overtimePay,
          deductions,
          netSalary: e.baseSalary + e.defaultAllowance + overtimePay - deductions,
          attendanceDays: 22,
          lateCount: e.employeeCode === 'KF-003' ? 1 : 0,
          status: 'published',
          publishedAt: new Date(now.getTime() - 15 * 86400000),
        };
      });

      await db.insert(payrollRecords).values(payrollSeed).onConflictDoNothing();

      // Draft for current month for HR to review/publish
      const currentDrafts = allEmps.slice(0, 3).map((e) => {
        const deductions = Math.round(e.baseSalary * 0.03);
        return {
          employeeId: e.id,
          periodMonth: currentMonth,
          baseSalary: e.baseSalary,
          allowances: e.defaultAllowance,
          overtimePay: 0,
          deductions,
          netSalary: e.baseSalary + e.defaultAllowance - deductions,
          attendanceDays: 14,
          lateCount: 0,
          status: 'draft',
        };
      });
      await db.insert(payrollRecords).values(currentDrafts).onConflictDoNothing();
    }

    // 11. Performance Reviews (KPI)
    const [existingPerfCount] = await db.select({ value: count() }).from(performanceReviews);
    if ((existingPerfCount?.value ?? 0) === 0 && nadiaEmp && dimasEmp && supEmp) {
      await db.insert(performanceReviews).values([
        {
          employeeId: nadiaEmp.id,
          reviewerEmployeeId: supEmp.id,
          periodLabel: 'Q4 2026',
          kpiItemsJson: JSON.stringify([
            { title: 'Ketepatan Jadwal Desain Produk', weight: 40, target: '95% tepat waktu', actual: '98% tepat waktu', score: 94 },
            { title: 'Adopsi Design System Lintas Tim', weight: 35, target: '3 modul utama', actual: '4 modul utama', score: 92 },
            { title: 'Kolaborasi & Review UI/UX', weight: 25, target: 'Skor feedback >= 4.2', actual: '4.6 / 5.0', score: 90 },
          ]),
          overallScore: 92.3,
          ratingLabel: 'Sangat Baik',
          supervisorNotes: 'Konsisten menjaga standar kualitas visual dan responsif terhadap masukan tim engineering.',
          status: 'finalized',
        },
        {
          employeeId: dimasEmp.id,
          reviewerEmployeeId: supEmp.id,
          periodLabel: 'Q4 2026',
          kpiItemsJson: JSON.stringify([
            { title: 'Uptime & Keandalan Layanan API', weight: 50, target: '99.9%', actual: '99.95%', score: 95 },
            { title: 'Penyelesaian Sprint & Code Review', weight: 50, target: '90% story points', actual: '88% story points', score: 86 },
          ]),
          overallScore: 90.5,
          ratingLabel: 'Sangat Baik',
          supervisorNotes: 'Performa teknis sangat solid, perlu menjaga keseimbangan beban sprint.',
          status: 'finalized',
        },
      ]);
    }

    // 12. Announcements & Notifications
    const [existingAnnCount] = await db.select({ value: count() }).from(announcements);
    if ((existingAnnCount?.value ?? 0) === 0 && hrEmp && mgmtEmp) {
      await db.insert(announcements).values([
        {
          title: 'Kebijakan Presensi GPS & Toleransi Shift Kuartal IV',
          category: 'policy',
          content:
            'Seluruh karyawan diharapkan melakukan clock-in melalui aplikasi KaryaFlow PWA dalam radius kantor yang terdaftar. Toleransi keterlambatan berlaku 15 menit dari jadwal shift masing-masing.',
          authorEmployeeId: hrEmp.id,
          isPinned: true,
        },
        {
          title: 'Jadwal Penutupan Data Penggajian (Cut-Off Payroll)',
          category: 'hr_info',
          content:
            'Batas akhir pengajuan lembur dan persetujuan cuti untuk perhitungan payroll bulan berjalan adalah setiap tanggal 25 pukul 17.00 WIB.',
          authorEmployeeId: hrEmp.id,
          isPinned: false,
        },
        {
          title: 'Townhall Perusahaan & Evaluasi Kinerja Tahunan',
          category: 'company',
          content:
            'Manajemen mengundang seluruh tim untuk menghadiri Townhall Akhir Tahun serta memastikan seluruh KPI kuartal IV telah diisi bersama supervisor.',
          authorEmployeeId: mgmtEmp.id,
          isPinned: false,
        },
      ]);
    }

    const [existingNotifCount] = await db.select({ value: count() }).from(notifications);
    if ((existingNotifCount?.value ?? 0) === 0) {
      await db.insert(notifications).values([
        {
          recipientEmployeeId: null,
          title: 'Pengingat Presensi Pagi',
          message: 'Jangan lupa melakukan clock-in melalui aplikasi KaryaFlow saat tiba di area kantor.',
          category: 'attendance_reminder',
          isRead: false,
        },
        {
          recipientEmployeeId: nadiaEmp?.id ?? null,
          title: 'Slip Gaji Tersedia',
          message: 'Slip gaji bulan lalu telah diterbitkan HR dan dapat diunduh melalui menu Payroll.',
          category: 'payroll',
          isRead: false,
        },
      ]);
    }
  } catch (error) {
    console.error('Database seed failed:', error);
    throw new Error('Gagal menginisialisasi data awal database.', { cause: error });
  }
}

export async function getOrCreateAuthenticatedProfile(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string,
) {
  try {
    await ensureSeeded();

    const existingUsers = await db.select({ value: count() }).from(users);
    const isFirstSystemUser = (existingUsers[0]?.value ?? 0) === 0;

    const matchingEmployees = await db.select().from(employees).where(eq(employees.email, email));
    const existingEmp = matchingEmployees[0];

    const resolvedRole: UserRole = existingEmp
      ? (existingEmp.role as UserRole)
      : isFirstSystemUser
        ? 'super_admin'
        : 'employee';

    const upsertedUsers = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: existingEmp?.fullName || displayName || email.split('@')[0],
        photoUrl: existingEmp?.avatarUrl || photoUrl || '',
        role: resolvedRole,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: existingEmp?.fullName || displayName || email.split('@')[0],
          photoUrl: existingEmp?.avatarUrl || photoUrl || '',
          lastLoginAt: new Date(),
        },
      })
      .returning();

    const userRow = upsertedUsers[0];

    if (existingEmp) {
      if (existingEmp.userId !== userRow.id || existingEmp.role !== userRow.role) {
        await db
          .update(employees)
          .set({
            userId: userRow.id,
            updatedAt: new Date(),
          })
          .where(eq(employees.id, existingEmp.id));

        if (userRow.role !== existingEmp.role) {
          await db.update(users).set({ role: existingEmp.role }).where(eq(users.id, userRow.id));
          userRow.role = existingEmp.role;
        }
      }
      return { user: userRow, employeeId: existingEmp.id };
    }

    const linkedByUser = await db.select().from(employees).where(eq(employees.userId, userRow.id));
    if (linkedByUser[0]) {
      return { user: userRow, employeeId: linkedByUser[0].id };
    }

    const [empCountRow] = await db.select({ value: count() }).from(employees);
    const nextNum = (empCountRow?.value ?? 0) + 1;
    const empCode = `KF-${String(nextNum).padStart(3, '0')}`;

    const [defaultDept] = await db.select().from(departments).limit(1);
    const [defaultShift] = await db.select().from(workShifts).limit(1);
    const [defaultOffice] = await db.select().from(officeLocations).limit(1);

    const [createdEmp] = await db
      .insert(employees)
      .values({
        userId: userRow.id,
        employeeCode: empCode,
        fullName: displayName || email.split('@')[0],
        email,
        phone: '',
        jobTitle: resolvedRole === 'super_admin' ? 'System Administrator' : 'Staff Karyawan',
        employmentStatus: 'active',
        joinDate: getJakartaDateString(),
        avatarUrl: photoUrl || '',
        role: resolvedRole,
        departmentId: defaultDept?.id ?? null,
        shiftId: defaultShift?.id ?? null,
        officeLocationId: defaultOffice?.id ?? null,
      })
      .returning();

    const leaveTypeList = await db.select().from(leaveTypes);
    const currentYear = Number(getJakartaDateString().slice(0, 4));
    if (leaveTypeList.length > 0) {
      await db
        .insert(leaveBalances)
        .values(
          leaveTypeList.map((lt) => ({
            employeeId: createdEmp.id,
            leaveTypeId: lt.id,
            year: currentYear,
            allocatedDays: lt.defaultQuotaDays,
            usedDays: 0,
          })),
        )
        .onConflictDoNothing();
    }

    return { user: userRow, employeeId: createdEmp.id };
  } catch (error) {
    console.error('Failed to sync authenticated user profile:', error);
    throw new Error('Gagal menyinkronkan profil pengguna.', { cause: error });
  }
}
