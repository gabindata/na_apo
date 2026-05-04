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

/** 해당 월의 [시작, 다음 달 시작) 구간 (로컬 자정 기준) */
function monthRangeUtcStrings(year: number, month: number): { startIso: string; endExclusiveIso: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, month, 1, 0, 0, 0, 0);
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
