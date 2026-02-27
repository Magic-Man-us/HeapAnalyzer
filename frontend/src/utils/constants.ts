import { Language } from '../types';

export const LANG_COLORS: Record<Language, string> = {
  Rust: '#f97316',
  JavaScript: '#facc15',
  TypeScript: '#3b82f6',
  Go: '#06b6d4',
  Python: '#a78bfa',
};

export const STATUS_COLORS = {
  active: '#22d3ee',
  freed: '#4ade80',
  leaked: '#f87171',
  double_free: '#fbbf24',
} as const;
