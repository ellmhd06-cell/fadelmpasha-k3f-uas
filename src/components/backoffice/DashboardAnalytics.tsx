import React, { useMemo } from 'react';
import type {
  AttendanceRecord,
  DepartmentRecord,
  EmployeeRecord,
  LeaveRequestRecord,
} from '../../shared/types';
import { formatDateID } from '../../utils/formatters';

interface DashboardAnalyticsProps {
  employees: EmployeeRecord[];
  departments: DepartmentRecord[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequestRecord[];
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  employees,
  departments,
  attendance,
  leaveRequests,
}) => {
  // 1. Attendance & Lateness Trend by Date (up to last 6 distinct recorded dates)
  const attendanceByDate = useMemo(() => {
    const grouped = new Map<string, { date: string; onTime: number; late: number }>();
    for (const log of attendance) {
      const entry = grouped.get(log.workDate) ?? {
        date: log.workDate,
        onTime: 0,
        late: 0,
      };
      if (log.status === 'on_time') entry.onTime += 1;
      else entry.late += 1;
      grouped.set(log.workDate, entry);
    }
    return Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-6);
  }, [attendance]);

  const maxDailyTotal = useMemo(
    () => Math.max(1, ...attendanceByDate.map((d) => d.onTime + d.late)),
    [attendanceByDate],
  );

  // 2. Department Headcount Distribution
  const deptStats = useMemo(() => {
    const counts = new Map<string, { name: string; active: number; probation: number; total: number }>();
    for (const dept of departments) {
      counts.set(dept.name, { name: dept.name, active: 0, probation: 0, total: 0 });
    }
    for (const emp of employees) {
      const deptName = emp.departmentName || 'Lainnya';
      const item = counts.get(deptName) ?? { name: deptName, active: 0, probation: 0, total: 0 };
      if (emp.employmentStatus === 'active') item.active += 1;
      else if (emp.employmentStatus === 'probation') item.probation += 1;
      item.total += 1;
      counts.set(deptName, item);
    }
    return Array.from(counts.values())
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [employees, departments]);

  const totalEmployees = Math.max(1, employees.length);

  // 3. Leave Approval Funnel Summary
  const leaveStats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const req of leaveRequests) {
      if (req.status === 'approved') approved += 1;
      else if (req.status === 'rejected' || req.status === 'cancelled') rejected += 1;
      else pending += 1;
    }
    return { pending, approved, rejected, total: leaveRequests.length };
  }, [leaveRequests]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Chart 1: Attendance Breakdown Bar Chart */}
      <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Analitik Kehadiran & Keterlambatan
            </h2>
            <p className="text-xs text-slate-500">
              Perbandingan presensi tepat waktu vs terlambat berdasarkan log server
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" />
              Tepat Waktu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              Terlambat / Awal
            </span>
          </div>
        </div>

        {attendanceByDate.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Belum ada catatan kehadiran untuk ditampilkan pada grafik.
          </div>
        ) : (
          <div className="mt-6">
            <div className="h-44 flex items-end justify-around gap-3 border-b border-slate-200 pb-2 px-2">
              {attendanceByDate.map((d) => {
                const onTimePct = Math.round((d.onTime / maxDailyTotal) * 100);
                const latePct = Math.round((d.late / maxDailyTotal) * 100);
                return (
                  <div key={d.date} className="flex-1 max-w-[64px] flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                      {d.onTime + d.late}
                    </span>
                    <div className="w-full flex items-end justify-center gap-1 h-32">
                      <div
                        title={`Tepat waktu: ${d.onTime}`}
                        style={{ height: `${Math.max(d.onTime > 0 ? 12 : 0, onTimePct)}%` }}
                        className="w-4 sm:w-5 rounded-t-sm bg-blue-700 transition-all"
                      />
                      <div
                        title={`Terlambat/Pulang awal: ${d.late}`}
                        style={{ height: `${Math.max(d.late > 0 ? 12 : 0, latePct)}%` }}
                        className="w-4 sm:w-5 rounded-t-sm bg-amber-500 transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-around gap-3 pt-2 px-2">
              {attendanceByDate.map((d) => (
                <span
                  key={d.date}
                  className="flex-1 max-w-[64px] text-center font-mono text-[11px] text-slate-500 truncate tabular-nums"
                >
                  {formatDateID(d.date).replace(/\s20\d{2}$/, '')}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Chart 2: Headcount per Department + Leave Funnel */}
      <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Distribusi Karyawan per Unit
              </h2>
              <p className="text-xs text-slate-500">Proporsi staf aktif di tiap departemen</p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
              {employees.length} total
            </span>
          </div>

          <div className="space-y-3">
            {deptStats.map((dept) => {
              const pct = Math.round((dept.total / totalEmployees) * 100);
              return (
                <div key={dept.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800 truncate">{dept.name}</span>
                    <span className="font-mono text-slate-600 tabular-nums shrink-0">
                      {dept.total} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-slate-800"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[11px] text-slate-500">Cuti Proses</p>
            <p className="font-mono text-lg font-bold text-amber-700 tabular-nums">
              {leaveStats.pending}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Cuti Disetujui</p>
            <p className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
              {leaveStats.approved}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Cuti Ditolak</p>
            <p className="font-mono text-lg font-bold text-slate-600 tabular-nums">
              {leaveStats.rejected}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
