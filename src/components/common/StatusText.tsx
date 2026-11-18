import React from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

export type SemanticTone = 'success' | 'warning' | 'danger' | 'neutral';

interface StatusTextProps {
  tone: SemanticTone;
  label: string;
}

export const StatusText: React.FC<StatusTextProps> = ({ tone, label }) => {
  const config = {
    success: {
      color: 'text-emerald-700',
      Icon: CheckCircle2,
    },
    warning: {
      color: 'text-amber-700',
      Icon: Clock,
    },
    danger: {
      color: 'text-red-700',
      Icon: XCircle,
    },
    neutral: {
      color: 'text-slate-600',
      Icon: AlertCircle,
    },
  }[tone];

  const { color, Icon } = config;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};
