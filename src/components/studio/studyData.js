import { useEffect, useState } from 'react';
import { attemptsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const characters = [
  {
    id: 'mira',
    name: 'Mira Margin',
    file: '/characters/mira-margin.png',
    note: 'One thoughtful step at a time.',
  },
  {
    id: 'theo',
    name: 'Theo Tally',
    file: '/characters/theo-tally.png',
    note: 'Make a little time. Make a little progress.',
  },
  {
    id: 'sana',
    name: 'Sana Solve',
    file: '/characters/sana-solve.png',
    note: 'Every answer is a new beginning.',
  },
];
export const accountKey = (user) => user?.id || user?._id || 'guest';
export function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveSaved(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The current view still works when browser storage is unavailable.
  }
}
export function saveLocalAttempt(user, attempt) {
  const key = `solvescript:attempts:${accountKey(user)}`;
  const saved = readSaved(key, []);
  localStorage.setItem(
    key,
    JSON.stringify(
      [attempt, ...(Array.isArray(saved) ? saved : [])],
    ),
  );
}
export function useStudyData() {
  const { user } = useAuth();
  const [state, setState] = useState({
    attempts: [],
    loading: true,
    error: '',
  });
  useEffect(() => {
    let active = true;
    const local = readSaved(`solvescript:attempts:${accountKey(user)}`, []);
    const load = async () => {
      let remote = [],
        error = '';
      if (user) {
        try {
          remote = (await attemptsAPI.getAll()).data.attempts || [];
        } catch {
          error =
            'Account progress is unavailable. Showing results saved on this device.';
        }
      }
      if (active)
        setState({
          attempts: [...remote, ...(Array.isArray(local) ? local : [])].sort(
            (a, b) => new Date(b.completedAt) - new Date(a.completedAt),
          ),
          loading: false,
          error,
        });
    };
    load();
    return () => {
      active = false;
    };
  }, [user]);
  return state;
}
export const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const cleanSubject = (subject = 'General') =>
  subject.replace(/^A-Level\s+/i, '');
