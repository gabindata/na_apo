import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PainRecord } from './painRecords';
import { getLocalTodayDateKey } from './painRecords';

export type TodayCareCache<T = unknown> = {
  date: string;
  painRecordSignature: string;
  data: T;
  cachedAt: string;
};

/** 로컬 달력 기준 오늘 날짜 키 (pain_records 조회와 동일) */
export function getTodayDateKey(): string {
  return getLocalTodayDateKey();
}

export function getTodayCareCacheKey(): string {
  return `today-care:${getTodayDateKey()}`;
}

export function createPainRecordSignature(records: PainRecord[]): string {
  if (!records || records.length === 0) return 'empty';

  return records
    .map((record) => {
      const id = record.id ?? '';
      const recordedAt = record.recorded_at ?? '';
      const updatedAt = (record as { updated_at?: string }).updated_at ?? '';
      const bodyPart = record.body_part ?? '';
      const intensity = record.intensity ?? '';
      const painType = Array.isArray(record.pain_type)
        ? record.pain_type.join(',')
        : record.pain_type ?? '';

      return `${id}:${recordedAt}:${updatedAt}:${bodyPart}:${intensity}:${painType}`;
    })
    .sort()
    .join('|');
}

export async function getCachedTodayCare<T>(currentSignature: string): Promise<T | null> {
  const key = getTodayCareCacheKey();
  const raw = await AsyncStorage.getItem(key);

  if (!raw) return null;

  try {
    const cache = JSON.parse(raw) as TodayCareCache<T>;

    if (cache.date !== getTodayDateKey()) return null;
    if (cache.painRecordSignature !== currentSignature) return null;

    return cache.data;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function saveCachedTodayCare<T>(data: T, painRecordSignature: string): Promise<void> {
  const key = getTodayCareCacheKey();

  const cache: TodayCareCache<T> = {
    date: getTodayDateKey(),
    painRecordSignature,
    data,
    cachedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(key, JSON.stringify(cache));
}

export async function clearTodayCareCache(): Promise<void> {
  const key = getTodayCareCacheKey();
  await AsyncStorage.removeItem(key);
}
