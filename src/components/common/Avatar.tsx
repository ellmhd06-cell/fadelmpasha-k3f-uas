import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md' }) => {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const sizeClass =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
        ? 'w-12 h-12 text-sm'
        : 'w-9 h-9 text-xs';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`Foto profil ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-semibold flex items-center justify-center shrink-0 select-none`}
    >
      {initials || 'KF'}
    </div>
  );
};
