import { supabase } from './supabase';

/** pain_records 한 행 (DB 스키마와 맞춤) */
export type PainRecord = {
  id: string;
  user_id: string;
  body_part: string | null;
  intensity: number | null;
  pain_type: string[] | null;
  sleep_hours: number | null;
  emotion: string | null;
  daily_note: string | null;
  /** 기록 시각 (라포가 저장 시 사용) */
  recorded_at: string;
};

async function requireUserId(): Promise<string> {
  // 앱 초기 구동 직후에는 getUser()가 null을 주는 타이밍이 있어 getSession()을 우선 사용
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const sessionUserId = sessionData.session?.user?.id;
  if (sessionUserId) return sessionUserId;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('로그인이 필요해요.');
  return userData.user.id;
}

function recordTime(row: Pick<PainRecord, 'recorded_at'>): string {
  return row.recorded_at;
}

/** 로컬 달력 기준 YYYY-MM-DD */
function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 로컬 달력 기준 오늘 날짜 키 — 오늘의 통증 기록·케어 캐시와 동일 기준 */
export function getLocalTodayDateKey(): string {
  return toLocalDateKey(new Date().toISOString());
}

/** 오늘(local)의 pain_records 전체 (케어 시그니처·캐시 무효화용) */
export async function fetchTodayPainRecords(): Promise<PainRecord[]> {
  return fetchPainRecordsForLocalDate(getLocalTodayDateKey());
}

/** 해당 월의 [시작, 다음 달 시작) 구간 (로컬 자정 기준) */
function monthRangeUtcStrings(year: number, month: number): { startIso: string; endExclusiveIso: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, month, 1, 0, 0, 0, 0);
  return { startIso: start.toISOString(), endExclusiveIso: endExclusive.toISOString() };
}

/** 로컬 YYYY-MM-DD 하루 구간 → UTC ISO 문자열 범위 [start, 다음날 자정) */
function localDayRangeUtcStrings(dateKey: string): { startIso: string; endExclusiveIso: string } {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endExclusive = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { startIso: start.toISOString(), endExclusiveIso: endExclusive.toISOString() };
}

/** 이번 주 월요일 00:00 ~ 일요일 끝 (로컬) */
function thisWeekRangeIso(): { startIso: string; endIso: string } {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { startIso: monday.toISOString(), endIso: sunday.toISOString() };
}

/** 최근 N일: 오늘 포함, N일 전 00:00(로컬)부터 지금까지 */
function recentRangeIso(days: number): { startIso: string; endIso: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function clampIntensity(n: number): number {
  return Math.max(0, Math.min(10, n));
}

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of [...a, ...b]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * 이번 달 전체 기록 (캘린더용)
 * 같은 날 여러 건이면 그날 최대 intensity만 사용 (히트맵에 적합)
 */
export async function fetchMonthlyRecords(
  year: number,
  month: number,
): Promise<{ date: string; intensity: number }[]> {
  const userId = await requireUserId();
  const { startIso, endExclusiveIso } = monthRangeUtcStrings(year, month);

  const { data, error } = await supabase
    .from('pain_records')
    .select('id, intensity, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', startIso)
    .lt('recorded_at', endExclusiveIso);

  if (error) throw error;

  const byDay = new Map<string, number>();
  for (const row of (data ?? []) as Pick<PainRecord, 'intensity' | 'recorded_at'>[]) {
    const t = recordTime(row);
    if (!t) continue;
    if (row.intensity == null || Number.isNaN(Number(row.intensity))) continue;
    const key = toLocalDateKey(t);
    const v = clampIntensity(Number(row.intensity));
    const prev = byDay.get(key);
    byDay.set(key, prev === undefined ? v : Math.max(prev, v));
  }

  return Array.from(byDay.entries())
    .map(([date, intensity]) => ({ date, intensity }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 특정 로컬 날짜의 통증 기록 전체 (캘린더 날짜 탭 상세용, 최신순)
 */
export async function fetchPainRecordsForLocalDate(dateKey: string): Promise<PainRecord[]> {
  const userId = await requireUserId();
  const { startIso, endExclusiveIso } = localDayRangeUtcStrings(dateKey);

  const { data, error } = await supabase
    .from('pain_records')
    .select(
      'id, user_id, body_part, intensity, pain_type, sleep_hours, emotion, daily_note, recorded_at',
    )
    .eq('user_id', userId)
    .gte('recorded_at', startIso)
    .lt('recorded_at', endExclusiveIso);

  if (error) throw error;

  let rows = (data ?? []) as PainRecord[];
  rows = rows.filter((r) => toLocalDateKey(recordTime(r)) === dateKey);
  rows.sort((a, b) => new Date(recordTime(b)).getTime() - new Date(recordTime(a)).getTime());

  return rows;
}

/** 해당 월 통계 (홈 '월별 통계' 표시용) */
export async function fetchMonthlyStats(year: number, month: number): Promise<{
  topBodyPart: string;
  avgIntensity: number;
  recordCount: number;
}> {
  const userId = await requireUserId();
  const { startIso, endExclusiveIso } = monthRangeUtcStrings(year, month);

  const { data, error } = await supabase
    .from('pain_records')
    .select('id, body_part, intensity, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', startIso)
    .lt('recorded_at', endExclusiveIso);

  if (error) throw error;

  const inRange = data ?? [];

  const recordCount = inRange.length;
  if (recordCount === 0) {
    return { topBodyPart: '', avgIntensity: 0, recordCount: 0 };
  }

  const intensities = inRange
    .map((r) => r.intensity)
    .filter((n): n is number => n != null && !Number.isNaN(Number(n)))
    .map((n) => clampIntensity(Number(n)));
  const avgIntensity =
    intensities.length === 0
      ? 0
      : Math.round((intensities.reduce((a, b) => a + b, 0) / intensities.length) * 10) / 10;

  const partCounts = new Map<string, number>();
  for (const r of inRange) {
    const p = r.body_part?.trim();
    if (!p) continue;
    partCounts.set(p, (partCounts.get(p) ?? 0) + 1);
  }
  let topBodyPart = '';
  let best = 0;
  for (const [part, c] of Array.from(partCounts.entries())) {
    if (c > best || (c === best && part.localeCompare(topBodyPart) < 0)) {
      best = c;
      topBodyPart = part;
    }
  }

  return { topBodyPart, avgIntensity, recordCount };
}

/**
 * 최근 N일(기본 7일) 케어 요약 — '오늘의 케어 제안' 섹션에서 사용
 * 통증·수면·감정 흐름을 한 번에 보고 신호(signal)를 만들어 낸다.
 */
export type CareSummary = {
  periodDays: number;
  recordCount: number;
  topBodyPart: string | null;
  topBodyPartCount: number;
  avgIntensity: number;        // 0~10
  highIntensityDays: number;   // intensity >= 7 인 날 수
  avgSleepHours: number | null;
  shortSleepDays: number;      // sleep_hours < 5 인 날 수
  emotionGood: number;
  emotionNormal: number;
  emotionBad: number;
  painTypes: string[];         // 최근에 자주 나온 통증 유형
};

export async function fetchRecentCareSummary(days: number = 7): Promise<CareSummary> {
  const userId = await requireUserId();
  const { startIso, endIso } = recentRangeIso(days);

  console.log('[CARE SUMMARY] userId:', userId);
  console.log('[CARE SUMMARY] range:', startIso, '~', endIso);

  const { data, error } = await supabase
    .from('pain_records')
    .select('id, body_part, intensity, pain_type, sleep_hours, emotion, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', startIso)
    .lte('recorded_at', endIso);

  if (error) throw error;

  console.log('[CARE SUMMARY] rows fetched:', data?.length ?? 0);
  if ((data?.length ?? 0) > 0) {
    console.log('[CARE SUMMARY] sample row:', JSON.stringify(data![0]));
  }

  const rows = (data ?? []) as Pick<
    PainRecord,
    'body_part' | 'intensity' | 'pain_type' | 'sleep_hours' | 'emotion' | 'recorded_at'
  >[];

  const recordCount = rows.length;

  // 부위 빈도
  const partCounts = new Map<string, number>();
  for (const r of rows) {
    const p = r.body_part?.trim();
    if (!p) continue;
    partCounts.set(p, (partCounts.get(p) ?? 0) + 1);
  }
  let topBodyPart: string | null = null;
  let topBodyPartCount = 0;
  for (const [part, c] of Array.from(partCounts.entries())) {
    if (c > topBodyPartCount) {
      topBodyPart = part;
      topBodyPartCount = c;
    }
  }

  // 강도
  const intensities = rows
    .map((r) => r.intensity)
    .filter((n): n is number => n != null && !Number.isNaN(Number(n)))
    .map((n) => clampIntensity(Number(n)));
  const avgIntensity =
    intensities.length === 0
      ? 0
      : Math.round((intensities.reduce((a, b) => a + b, 0) / intensities.length) * 10) / 10;
  const highIntensityDays = intensities.filter((v) => v >= 7).length;

  // 수면 (하루 기준 — 같은 날 여러 기록이면 평균)
  const sleepByDay = new Map<string, number[]>();
  for (const r of rows) {
    if (r.sleep_hours == null || Number.isNaN(Number(r.sleep_hours))) continue;
    const key = toLocalDateKey(recordTime(r));
    const arr = sleepByDay.get(key) ?? [];
    arr.push(Number(r.sleep_hours));
    sleepByDay.set(key, arr);
  }
  const dailySleep = Array.from(sleepByDay.values()).map(
    (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
  );
  const avgSleepHours =
    dailySleep.length === 0
      ? null
      : Math.round((dailySleep.reduce((a, b) => a + b, 0) / dailySleep.length) * 10) / 10;
  const shortSleepDays = dailySleep.filter((h) => h < 5).length;

  // 감정
  let emotionGood = 0;
  let emotionNormal = 0;
  let emotionBad = 0;
  for (const r of rows) {
    if (r.emotion === '좋음') emotionGood += 1;
    else if (r.emotion === '보통') emotionNormal += 1;
    else if (r.emotion === '나쁨') emotionBad += 1;
  }

  // 통증 유형 (자주 나온 순서대로 최대 5개)
  const painTypeCounts = new Map<string, number>();
  for (const r of rows) {
    if (!Array.isArray(r.pain_type)) continue;
    for (const t of r.pain_type) {
      const trimmed = (t ?? '').trim();
      if (!trimmed) continue;
      painTypeCounts.set(trimmed, (painTypeCounts.get(trimmed) ?? 0) + 1);
    }
  }
  const painTypes = Array.from(painTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  return {
    periodDays: days,
    recordCount,
    topBodyPart,
    topBodyPartCount,
    avgIntensity,
    highIntensityDays,
    avgSleepHours,
    shortSleepDays,
    emotionGood,
    emotionNormal,
    emotionBad,
    painTypes,
  };
}

/** 최근 N일 기록 전체 (레포트용, 최신순) */
export async function fetchRecentRecords(days: number = 30): Promise<PainRecord[]> {
  const userId = await requireUserId();
  const { startIso, endIso } = recentRangeIso(days);

  const { data, error } = await supabase
    .from('pain_records')
    .select(
      'id, user_id, body_part, intensity, pain_type, sleep_hours, emotion, daily_note, recorded_at',
    )
    .eq('user_id', userId)
    .gte('recorded_at', startIso)
    .lte('recorded_at', endIso);

  if (error) throw error;

  let rows = (data ?? []) as PainRecord[];

  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  rows = rows.filter((r) => {
    const t = new Date(recordTime(r)).getTime();
    return t >= start && t <= end;
  });

  rows.sort((a, b) => new Date(recordTime(b)).getTime() - new Date(recordTime(a)).getTime());

  return rows;
}
