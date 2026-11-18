import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import type { ViewMode } from '../../contexts/AuthContext';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  fullWidth?: boolean;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onChange,
  fullWidth = false,
}) => {
  return (
    <div
      role="group"
      aria-label="Pilih mode tampilan"
      className={`inline-flex items-center p-1 rounded-xl border border-slate-200 bg-slate-100 ${
        fullWidth ? 'w-full grid grid-cols-2' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onChange('desktop')}
        aria-pressed={mode === 'desktop'}
        className={`min-h-[34px] px-3 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          mode === 'desktop'
            ? 'bg-white text-blue-700 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Monitor className="w-3.5 h-3.5 shrink-0" />
        <span>Mode Desktop</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('mobile')}
        aria-pressed={mode === 'mobile'}
        className={`min-h-[34px] px-3 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          mode === 'mobile'
            ? 'bg-white text-blue-700 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        <span>Mode Mobile</span>
      </button>
    </div>
  );
};
