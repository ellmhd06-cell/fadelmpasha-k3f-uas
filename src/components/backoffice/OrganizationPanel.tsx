import React, { useMemo, useState } from 'react';
import { GitBranch, MapPin, Plus } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type {
  AuditLogRecord,
  DepartmentRecord,
  EmployeeRecord,
  OfficeLocationRecord,
  WorkShiftRecord,
} from '../../shared/types';
import { formatDateID, formatTimeWIB, getRoleLabel } from '../../utils/formatters';
import { Avatar } from '../common/Avatar';

interface OrganizationPanelProps {
  departments: DepartmentRecord[];
  locations: OfficeLocationRecord[];
  shifts: WorkShiftRecord[];
  employees: EmployeeRecord[];
  auditLogs: AuditLogRecord[];
  canManageSettings: boolean;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export const OrganizationPanel: React.FC<OrganizationPanelProps> = ({
  departments,
  locations,
  shifts,
  employees,
  auditLogs,
  canManageSettings,
  onRefresh,
  onNotify,
}) => {
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDivision, setDeptDivision] = useState('Operasional Korporat');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptBusy, setDeptBusy] = useState(false);

  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locLat, setLocLat] = useState('-6.225014');
  const [locLng, setLocLng] = useState('106.809547');
  const [locRadius, setLocRadius] = useState('250');
  const [locBusy, setLocBusy] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const childrenByManager = useMemo(() => {
    const map = new Map<number | null, EmployeeRecord[]>();
    for (const emp of employees) {
      const key = emp.managerId && employees.some((m) => m.id === emp.managerId) ? emp.managerId : null;
      const list = map.get(key) ?? [];
      list.push(emp);
      map.set(key, list);
    }
    return map;
  }, [employees]);

  const positionSummary = useMemo(() => {
    const map = new Map<string, { jobTitle: string; division: string; department: string; count: number }>();
    for (const emp of employees) {
      const key = `${emp.jobTitle}__${emp.departmentName || 'Umum'}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          jobTitle: emp.jobTitle,
          division: emp.divisionName || 'Umum',
          department: emp.departmentName || 'Umum',
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [employees]);

  const renderHierarchyNode = (emp: EmployeeRecord, depth = 0): React.ReactNode => {
    const subordinates = childrenByManager.get(emp.id) ?? [];
    return (
      <div key={emp.id} className={depth > 0 ? 'ml-5 sm:ml-7 pl-4 border-l border-slate-200 mt-2.5' : 'mt-3 first:mt-0'}>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={emp.fullName} src={emp.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{emp.fullName}</p>
              <p className="text-xs text-slate-500 truncate">
                {emp.jobTitle} · {emp.departmentName || 'Umum'}
                {emp.divisionName ? ` (${emp.divisionName})` : ''}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-medium text-slate-700">{getRoleLabel(emp.role)}</p>
            {subordinates.length > 0 && (
              <p className="text-[11px] font-mono text-blue-700 tabular-nums">
                {subordinates.length} bawahan langsung
              </p>
            )}
          </div>
        </div>
        {subordinates.length > 0 && (
          <div className="space-y-1">{subordinates.map((sub) => renderHierarchyNode(sub, depth + 1))}</div>
        )}
      </div>
    );
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDeptBusy(true);
      setErrorMsg(null);
      await apiRequest('/organization/departments', {
        method: 'POST',
        body: JSON.stringify({
          code: deptCode.trim(),
          name: deptName.trim(),
          division: deptDivision.trim() || 'Operasional Korporat',
          description: deptDesc.trim(),
        }),
      });
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      onNotify('Departemen dan divisi baru berhasil ditambahkan.');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menambah departemen.');
    } finally {
      setDeptBusy(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLocBusy(true);
      setErrorMsg(null);
      await apiRequest('/organization/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: locName.trim(),
          address: locAddress.trim(),
          latitude: Number(locLat),
          longitude: Number(locLng),
          radiusMeters: Number(locRadius),
        }),
      });
      setLocName('');
      setLocAddress('');
      onNotify('Lokasi geofence kantor baru berhasil ditambahkan.');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menambah lokasi kantor.');
    } finally {
      setLocBusy(false);
    }
  };

  const rootEmployees = childrenByManager.get(null) ?? [];

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMsg}
        </div>
      )}

      {/* Visual Organization Hierarchy + Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-700" />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Struktur Organisasi & Hubungan Hierarki
                </h2>
                <p className="text-xs text-slate-500">
                  Pemetaan garis pelaporan dari pimpinan hingga staf operasional
                </p>
              </div>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {employees.length} personel
            </span>
          </div>

          <div className="pt-2">
            {rootEmployees.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Belum ada data struktur hierarki karyawan.</p>
            ) : (
              rootEmployees.map((root) => renderHierarchyNode(root, 0))
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Daftar Jabatan & Divisi
              </h2>
              <p className="text-xs text-slate-500">Pemetaan jabatan aktif per departemen</p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {positionSummary.length} jabatan
            </span>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {positionSummary.map((pos, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{pos.jobTitle}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {pos.department} · Divisi {pos.division}
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                  {pos.count} org
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Departments & Divisions */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Departemen & Divisi
              </h2>
              <p className="text-xs text-slate-500">Struktur unit kerja perusahaan</p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {departments.length} unit
            </span>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {departments.map((d) => (
              <div key={d.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    <span className="font-mono text-xs text-blue-700 mr-2">{d.code}</span>
                    {d.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Divisi: <span className="text-slate-700 font-medium">{d.division || 'Umum'}</span>
                    {d.description ? ` · ${d.description}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {canManageSettings && (
            <form onSubmit={handleAddDepartment} className="pt-4 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Tambah Departemen & Divisi</p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Kode (MKT)"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="text"
                  required
                  placeholder="Nama Departemen"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="col-span-2 min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Nama Divisi Induk (mis. Divisi Komersial)"
                value={deptDivision}
                onChange={(e) => setDeptDivision(e.target.value)}
                className="w-full min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Deskripsi singkat (opsional)"
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="flex-1 min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={deptBusy}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Office Locations & Geofences */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Lokasi Kantor & Radius Geofence
              </h2>
              <p className="text-xs text-slate-500">Titik validasi koordinat presensi seluler</p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {locations.length} lokasi
            </span>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {locations.map((loc) => (
              <div key={loc.id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{loc.name}</p>
                    <p className="text-xs text-slate-500">{loc.address}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                      {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} · Radius {loc.radiusMeters} m
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {canManageSettings && (
            <form onSubmit={handleAddLocation} className="pt-4 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Tambah Lokasi Kantor</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nama Lokasi (mis. Cabang Surabaya)"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="text"
                  required
                  placeholder="Alamat lengkap"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Latitude"
                  value={locLat}
                  onChange={(e) => setLocLat(e.target.value)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Longitude"
                  value={locLng}
                  onChange={(e) => setLocLng(e.target.value)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="number"
                  min={50}
                  max={5000}
                  required
                  placeholder="Radius (m)"
                  value={locRadius}
                  onChange={(e) => setLocRadius(e.target.value)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={locBusy}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Lokasi Kantor</span>
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Work Shifts + Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900">Jadwal Shift Kerja</h2>
          <div className="divide-y divide-slate-100">
            {shifts.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">Toleransi {s.gracePeriodMinutes} menit</p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                  {s.startTime} – {s.endTime}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Jejak Audit Sistem (Audit Trail)
            </h2>
            <span className="text-xs text-slate-500">50 aktivitas terakhir</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 pr-4">Waktu</th>
                  <th className="py-2.5 pr-4">Aktor</th>
                  <th className="py-2.5 pr-4">Aksi</th>
                  <th className="py-2.5">Ringkasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Belum ada aktivitas perubahan yang tercatat.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                        {formatDateID(log.createdAt)} {formatTimeWIB(log.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap">
                        {log.actorEmail}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-800 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-2.5 text-slate-700">{log.summary}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
