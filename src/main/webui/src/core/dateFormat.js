import { useSyncExternalStore } from 'react';
import { apiFetch } from './api.js';

export const FORMAT_DD_MM_YYYY = 'dd/mm/yyyy';
export const FORMAT_MM_DD_YYYY = 'mm/dd/yyyy';

const STORAGE_KEY = 'app_date_format';
let currentFormat = localStorage.getItem(STORAGE_KEY) || FORMAT_DD_MM_YYYY;
if (currentFormat !== FORMAT_DD_MM_YYYY && currentFormat !== FORMAT_MM_DD_YYYY) {
  currentFormat = FORMAT_DD_MM_YYYY;
}

const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn());

export function getDateFormat() {
  return currentFormat;
}

export function setDateFormat(fmt) {
  const normalized = (fmt || '').toLowerCase().trim();
  if (normalized === FORMAT_DD_MM_YYYY || normalized === FORMAT_MM_DD_YYYY) {
    currentFormat = normalized;
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (_) {}
    emit();
  }
}

export function useDateFormat() {
  return useSyncExternalStore(subscribe, () => currentFormat, () => currentFormat);
}

/**
 * Định dạng chuỗi ngày YYYY-MM-DD sang định dạng đã chọn (dd/mm/yyyy hoặc mm/dd/yyyy).
 */
export function formatDate(dateVal, format = currentFormat) {
  if (dateVal == null || dateVal === '') return '';
  const str = String(dateVal).trim();
  const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    return format === FORMAT_MM_DD_YYYY ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  }
  return str;
}

/**
 * Định dạng ngày giờ: định dạng phần ngày và giữ nguyên phần giờ (nếu có).
 */
export function formatDateTime(dateTimeVal, format = currentFormat) {
  if (dateTimeVal == null || dateTimeVal === '') return '';
  const str = String(dateTimeVal).trim();
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime()) && (str.includes('T') || str.includes('Z'))) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      const formattedDate = format === FORMAT_MM_DD_YYYY ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
      return `${formattedDate} ${hours}:${mins}:${secs}`;
    }
  } catch (_) {}
  const [datePart, ...timeParts] = str.split(/[T ]/);
  const formattedDate = formatDate(datePart, format);
  if (timeParts.length > 0 && timeParts[0]) {
    const time = timeParts.join(' ').slice(0, 8);
    return `${formattedDate} ${time}`;
  }
  return formattedDate;
}

let initialized = false;
export async function initDateFormat() {
  if (initialized) return;
  initialized = true;
  try {
    const res = await apiFetch('/api/settings/date_format', { silent401: true });
    if (res?.value) {
      setDateFormat(res.value);
    }
  } catch (_) {
    // Không block app nếu chưa tải được cấu hình
  }
}

