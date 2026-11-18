import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../lib/apiClient';
import type {
  DepartmentRecord,
  EmployeeDocumentItem,
  EmployeeRecord,
  EmploymentHistoryItem,
  EmploymentStatus,
  OfficeLocationRecord,
  UserRole,
  WorkShiftRecord,
} from '../../shared/types';
import { formatDateID, getTodayISOJakarta } from '../../utils/formatters';

interface EmployeeFormDrawerProps {
  open: boolean;
  editingEmployee: EmployeeRecord | null;
  employees: EmployeeRecord[];
  departments: DepartmentRecord[];
  shifts: WorkShiftRecord[];
  locations: OfficeLocationRecord[];
  onClose: () => void;
  onSaved: (saved: EmployeeRecord, isNew: boolean) => void;
}

export const EmployeeFormDrawer: React.FC<EmployeeFormDrawerProps> = ({
  open,
  editingEmployee,
  employees,
  departments,
  shifts,
  locations,
  onClose,
  onSaved,
}) => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [address, setAddress] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('active');
  const [joinDate, setJoinDate] = useState(getTodayISOJakarta());
  const [role, setRole] = useState<UserRole>('employee');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [shiftId, setShiftId] = useState<string>('');
  const [officeLocationId, setOfficeLocationId] = useState<string>('');
  const [baseSalary, setBaseSalary] = useState('10000000');
  const [defaultAllowance, setDefaultAllowance] = useState('1500000');

  const [historyList, setHistoryList] = useState<EmploymentHistoryItem[]>([]);
  const [docList, setDocList] = useState<EmployeeDocumentItem[]>([]);
  const [newHistPeriod, setNewHistPeriod] = useState('');
  const [newHistTitle, setNewHistTitle] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('Kontrak');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { session } = useAuth();
  const actorRole = session?.user.role ?? 'employee';
  const canEditRole = ['super_admin', 'hr_admin', 'management'].includes(actorRole);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (editingEmployee) {
      setEmployeeCode(editingEmployee.employeeCode);
      setFullName(editingEmployee.fullName);
      setEmail(editingEmployee.email);
      setPhone(editingEmployee.phone);
      setIdentityNumber(editingEmployee.identityNumber);
      setAddress(editingEmployee.address);
      setJobTitle(editingEmployee.jobTitle);
      setDivisionName(editingEmployee.divisionName);
      setEmploymentStatus(editingEmployee.employmentStatus);
      setJoinDate(editingEmployee.joinDate);
      setRole(editingEmployee.role);
      setDepartmentId(editingEmployee.departmentId ? String(editingEmployee.departmentId) : '');
      setManagerId(editingEmployee.managerId ? String(editingEmployee.managerId) : '');
      setShiftId(editingEmployee.shiftId ? String(editingEmployee.shiftId) : '');
      setOfficeLocationId(
        editingEmployee.officeLocationId ? String(editingEmployee.officeLocationId) : '',
      );
      setBaseSalary(String(editingEmployee.baseSalary));
      setDefaultAllowance(String(editingEmployee.defaultAllowance));
      setHistoryList(editingEmployee.employmentHistory || []);
      setDocList(editingEmployee.documents || []);
    } else {
      const maxNum = employees.reduce((max, emp) => {
        const match = emp.employeeCode.match(/(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      const nextNum = Math.max(maxNum + 1, actorRole === 'supervisor' ? 101 : 1);
      const nextCode = `KF-${String(nextNum).padStart(3, '0')}`;
      setEmployeeCode(nextCode);
      setFullName('');
      setEmail('');
      setPhone('');
      setIdentityNumber('');
      setAddress('');
      setJobTitle('');
      setDivisionName(departments[0]?.division || 'Operasional Korporat');
      setEmploymentStatus('active');
      setJoinDate(getTodayISOJakarta());
      setRole('employee');
      setDepartmentId(departments[0]?.id ? String(departments[0].id) : '');
      setManagerId(actorRole === 'supervisor' && session?.employee.id ? String(session.employee.id) : '');
      setShiftId(shifts[0]?.id ? String(shifts[0].id) : '');
      setOfficeLocationId(locations[0]?.id ? String(locations[0].id) : '');
      setBaseSalary('10000000');
      setDefaultAllowance('1500000');
      setHistoryList([]);
      setDocList([]);
    }
  }, [open, editingEmployee, employees, departments, shifts, locations, actorRole, session?.employee.id]);

  if (!open) return null;

  const handleAddHistory = () => {
    if (!newHistPeriod.trim() || !newHistTitle.trim()) return;
    setHistoryList((prev) => [
      {
        period: newHistPeriod.trim(),
        title: newHistTitle.trim(),
        department: departments.find((d) => String(d.id) === departmentId)?.name || 'Perusahaan',
        note: 'Riwayat penugasan internal.',
      },
      ...prev,
    ]);
    setNewHistPeriod('');
    setNewHistTitle('');
  };

  const handleAddDocument = () => {
    if (!newDocTitle.trim()) return;
    setDocList((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        title: newDocTitle.trim(),
        category: newDocCategory,
        uploadedAt: getTodayISOJakarta(),
        fileUrl: `#doc-${Date.now()}`,
      },
    ]);
    setNewDocTitle('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      if (editingEmployee) {
        const updated = await apiRequest<EmployeeRecord>(`/employees/${editingEmployee.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: fullName.trim(),
            phone: phone.trim(),
            identityNumber: identityNumber.trim(),
            address: address.trim(),
            jobTitle: jobTitle.trim(),
            divisionName: divisionName.trim(),
            employmentStatus,
            ...(canEditRole ? { role } : {}),
            departmentId: departmentId ? Number(departmentId) : null,
            managerId: managerId ? Number(managerId) : null,
            shiftId: shiftId ? Number(shiftId) : null,
            officeLocationId: officeLocationId ? Number(officeLocationId) : null,
            baseSalary: Number(baseSalary) || 0,
            defaultAllowance: Number(defaultAllowance) || 0,
            employmentHistory: historyList,
            documents: docList,
          }),
        });
        onSaved(updated, false);
      } else {
        const created = await apiRequest<EmployeeRecord>('/employees', {
          method: 'POST',
          body: JSON.stringify({
            employeeCode: employeeCode.trim(),
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            identityNumber: identityNumber.trim(),
            address: address.trim(),
            jobTitle: jobTitle.trim(),
            divisionName: divisionName.trim(),
            employmentStatus,
            joinDate,
            role,
            departmentId: departmentId ? Number(departmentId) : null,
            managerId: managerId ? Number(managerId) : null,
            shiftId: shiftId ? Number(shiftId) : null,
            officeLocationId: officeLocationId ? Number(officeLocationId) : null,
            baseSalary: Number(baseSalary) || 0,
            defaultAllowance: Number(defaultAllowance) || 0,
          }),
        });
        onSaved(created, true);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan data karyawan.');
    } finally {
      setSubmitting(false);
    }
  };

  const potentialManagers = employees.filter((e) => e.id !== editingEmployee?.id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {editingEmployee ? 'Detail & Ubah Data Karyawan' : 'Tambah Karyawan Baru'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {editingEmployee
                ? `Data induk ${editingEmployee.employeeCode} · Identitas, Payroll, Riwayat & Dokumen`
                : 'Karyawan baru otomatis aktif di direktori & dapat masuk dengan sandi demo123'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NIP / Kode Karyawan
              </label>
              <input
                type="text"
                required
                disabled={!!editingEmployee}
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Bergabung
              </label>
              <input
                type="date"
                required
                disabled={!!editingEmployee}
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor Identitas (NIK / KTP)
              </label>
              <input
                type="text"
                value={identityNumber}
                onChange={(e) => setIdentityNumber(e.target.value)}
                placeholder="3174xxxxxxxxxxxx"
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Perusahaan
              </label>
              <input
                type="email"
                required
                disabled={!!editingEmployee}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nomor Telepon</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Domisili</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat tempat tinggal saat ini"
              className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jabatan</label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Divisi</label>
              <input
                type="text"
                value={divisionName}
                onChange={(e) => setDivisionName(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Peran Akses (RBAC)
              </label>
              <select
                value={canEditRole ? role : 'employee'}
                disabled={!canEditRole}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="employee">Karyawan (Mobile PWA)</option>
                {canEditRole && (
                  <>
                    <option value="supervisor">Supervisor / Manager</option>
                    <option value="management">Manajemen / Eksekutif</option>
                    <option value="hr_admin">HR Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Status Kepegawaian
              </label>
              <select
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="active">Aktif</option>
                <option value="probation">Masa Percobaan</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Departemen</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">— Pilih Departemen —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Atasan Langsung
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">— Tanpa Atasan —</option>
                {potentialManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.employeeCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jadwal Shift</label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">— Pilih Shift —</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lokasi Kantor (Geofence)
              </label>
              <select
                value={officeLocationId}
                onChange={(e) => setOfficeLocationId(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">— Pilih Lokasi —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Gaji Pokok (IDR)
              </label>
              <input
                type="number"
                min={0}
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tunjangan Tetap (IDR)
              </label>
              <input
                type="number"
                min={0}
                value={defaultAllowance}
                onChange={(e) => setDefaultAllowance(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {editingEmployee && (
            <>
              {/* Riwayat Pekerjaan */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-semibold text-slate-800">Riwayat Pekerjaan</p>
                {historyList.map((h, idx) => (
                  <div
                    key={`${h.period}-${idx}`}
                    className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{h.title}</p>
                      <p className="text-slate-500">
                        {h.period} · {h.department}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistoryList((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="2024–2026"
                    value={newHistPeriod}
                    onChange={(e) => setNewHistPeriod(e.target.value)}
                    className="col-span-2 min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Jabatan sebelumnya"
                    value={newHistTitle}
                    onChange={(e) => setNewHistTitle(e.target.value)}
                    className="col-span-2 min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddHistory}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dokumen Karyawan */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-semibold text-slate-800">Dokumen Karyawan</p>
                {docList.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{d.title}</p>
                      <p className="text-slate-500">
                        {d.category} · {formatDateID(d.uploadedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocList((prev) => prev.filter((item) => item.id !== d.id))}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Nama Dokumen (PKWT / NPWP)"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    className="col-span-3 min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs"
                  />
                  <select
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="Kontrak">Kontrak</option>
                    <option value="Administrasi">Administrasi</option>
                    <option value="Sertifikasi">Sertifikasi</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddDocument}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] px-5 rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : editingEmployee ? 'Simpan Perubahan' : 'Simpan Karyawan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
