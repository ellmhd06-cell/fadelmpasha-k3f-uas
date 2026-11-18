import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type {
  EmployeeRecord,
  PerformanceKpiItem,
  PerformanceReviewRecord,
} from '../../shared/types';

interface PerformancePanelProps {
  reviews: PerformanceReviewRecord[];
  employees: EmployeeRecord[];
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  reviews,
  employees,
  onRefresh,
  onNotify,
}) => {
  const [employeeId, setEmployeeId] = useState<string>(
    employees[0]?.id ? String(employees[0].id) : '',
  );
  const [periodLabel, setPeriodLabel] = useState('Q4 2026');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [kpiItems, setKpiItems] = useState<PerformanceKpiItem[]>([
    { title: 'Pencapaian Target KPI Utama', weight: 60, target: '95%', actual: '92%', score: 90 },
    { title: 'Kedisiplinan & Kolaborasi Tim', weight: 40, target: 'Skor 4.5/5', actual: '4.4/5', score: 88 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddKpiRow = () => {
    setKpiItems((prev) => [
      ...prev,
      { title: 'Indikator Kinerja Tambahan', weight: 20, target: '100%', actual: '90%', score: 85 },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await apiRequest('/performance', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(employeeId),
          periodLabel: periodLabel.trim(),
          kpiItems,
          supervisorNotes: supervisorNotes.trim(),
        }),
      });
      setSupervisorNotes('');
      onNotify('Evaluasi kinerja KPI berhasil disimpan.');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan evaluasi KPI.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Manajemen Kinerja & KPI Karyawan
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Penilaian berkala, bobot indikator KPI, skor akhir, dan catatan evaluasi supervisor
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Input Evaluasi */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
            Buat Evaluasi Kinerja Baru
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Karyawan</label>
                <select
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Periode</label>
                <input
                  type="text"
                  required
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="w-full min-h-[38px] rounded-lg border border-slate-200 px-2.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Indikator KPI</span>
                <button
                  type="button"
                  onClick={handleAddKpiRow}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah KPI
                </button>
              </div>
              {kpiItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      required
                      value={item.title}
                      onChange={(e) =>
                        setKpiItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, title: e.target.value } : row)),
                        )
                      }
                      className="flex-1 min-h-[34px] rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium"
                    />
                    {kpiItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setKpiItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500">Bobot (%)</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={item.weight}
                        onChange={(e) =>
                          setKpiItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, weight: Number(e.target.value) } : row,
                            ),
                          )
                        }
                        className="w-full min-h-[32px] rounded-md border border-slate-200 bg-white px-2 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Realisasi</span>
                      <input
                        type="text"
                        value={item.actual}
                        onChange={(e) =>
                          setKpiItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, actual: e.target.value } : row)),
                          )
                        }
                        className="w-full min-h-[32px] rounded-md border border-slate-200 bg-white px-2"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Skor (0-100)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.score}
                        onChange={(e) =>
                          setKpiItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, score: Number(e.target.value) } : row,
                            ),
                          )
                        }
                        className="w-full min-h-[32px] rounded-md border border-slate-200 bg-white px-2 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Catatan Supervisor
              </label>
              <textarea
                rows={3}
                value={supervisorNotes}
                onChange={(e) => setSupervisorNotes(e.target.value)}
                placeholder="Apresiasi pencapaian dan area pengembangan..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[42px] rounded-lg bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Menyimpan Evaluasi...' : 'Terbitkan Evaluasi KPI'}
            </button>
          </form>
        </section>

        {/* List Evaluasi */}
        <section className="lg:col-span-7 space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Belum ada evaluasi kinerja yang diterbitkan.
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{rev.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      {rev.jobTitle} · {rev.departmentName || 'Umum'} · Periode {rev.periodLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-bold text-blue-700 tabular-nums">
                      {rev.overallScore.toFixed(1)}
                    </p>
                    <p className="text-xs font-semibold text-slate-700">{rev.ratingLabel}</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {rev.kpiItems.map((kpi, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{kpi.title}</p>
                        <p className="text-slate-500">
                          Bobot {kpi.weight}% · Target: {kpi.target} · Realisasi: {kpi.actual}
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {kpi.score}
                      </span>
                    </div>
                  ))}
                </div>

                {rev.supervisorNotes && (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <strong className="text-slate-800">Catatan {rev.reviewerName}:</strong>{' '}
                    {rev.supervisorNotes}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
};
