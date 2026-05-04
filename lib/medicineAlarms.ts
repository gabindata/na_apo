import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type MedicineAlarmTimer = {
  id: string;
  hour: number;
  minute: number;
};

export type MedicineAlarm = {
  id: string;
  medicineName: string;
  dosageRule: string;
  timers: MedicineAlarmTimer[];
  notificationIds: string[];
  isActive: boolean;
  createdAt: string;
};

const STORAGE_KEY = 'naapo:medicine-alarms:v1';
const PERMISSION_GUIDE_SEEN_KEY = 'naapo:medicine-alarm-permission-guide-seen:v1';

export function createTimer(hour: number = 8, minute: number = 0): MedicineAlarmTimer {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hour: clampNumber(hour, 0, 23),
    minute: clampNumber(minute, 0, 59),
  };
}

export function createAlarm(input: {
  medicineName: string;
  dosageRule: string;
  timers: MedicineAlarmTimer[];
}): MedicineAlarm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    medicineName: input.medicineName.trim(),
    dosageRule: input.dosageRule.trim(),
    timers: input.timers.map((timer) => ({
      ...timer,
      hour: clampNumber(timer.hour, 0, 23),
      minute: clampNumber(timer.minute, 0, 59),
    })),
    notificationIds: [],
    isActive: false,
    createdAt: new Date().toISOString(),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatTime(hour: number, minute: number): string {
  return `${String(clampNumber(hour, 0, 23)).padStart(2, '0')}:${String(clampNumber(minute, 0, 59)).padStart(2, '0')}`;
}

export async function loadMedicineAlarms(): Promise<MedicineAlarm[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as MedicineAlarm[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((alarm) => ({
      ...alarm,
      medicineName: typeof alarm.medicineName === 'string' ? alarm.medicineName : '',
      dosageRule: typeof alarm.dosageRule === 'string' ? alarm.dosageRule : '',
      timers: Array.isArray(alarm.timers)
        ? alarm.timers.map((timer) => ({
          id: typeof timer.id === 'string' ? timer.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          hour: clampNumber(Number(timer.hour), 0, 23),
          minute: clampNumber(Number(timer.minute), 0, 59),
        }))
        : [],
      notificationIds: Array.isArray(alarm.notificationIds) ? alarm.notificationIds : [],
      isActive: !!alarm.isActive,
      createdAt: typeof alarm.createdAt === 'string' ? alarm.createdAt : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function saveMedicineAlarms(alarms: MedicineAlarm[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

export async function hasSeenAlarmPermissionGuide(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PERMISSION_GUIDE_SEEN_KEY);
  return value === 'true';
}

export async function markAlarmPermissionGuideSeen(): Promise<void> {
  await AsyncStorage.setItem(PERMISSION_GUIDE_SEEN_KEY, 'true');
}

async function ensureNotificationPermission(): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === 'granted') return;

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.status !== 'granted') {
    throw new Error('알림 권한이 필요해요. 기기 설정에서 알림을 허용해주세요.');
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('medicine-alarm', {
    name: '약 알람',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function cancelNotificationIds(notificationIds: string[]): Promise<void> {
  for (const notificationId of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // 이미 취소되었거나 존재하지 않는 경우 무시
    }
  }
}

export async function activateMedicineAlarm(alarm: MedicineAlarm): Promise<MedicineAlarm> {
  await ensureNotificationPermission();
  await ensureAndroidChannel();

  await cancelNotificationIds(alarm.notificationIds);

  const nextNotificationIds: string[] = [];
  for (const timer of alarm.timers) {
    const trigger: Notifications.NotificationTriggerInput = Platform.OS === 'android'
      ? {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: timer.hour,
        minute: timer.minute,
        channelId: 'medicine-alarm',
      }
      : {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: timer.hour,
        minute: timer.minute,
      };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💊 복약 알림',
        body: `${alarm.medicineName} 복용 시간이에요.`,
        ...(Platform.OS === 'android' ? { channelId: 'medicine-alarm' } : {}),
      },
      trigger,
    });
    nextNotificationIds.push(notificationId);
  }

  return {
    ...alarm,
    isActive: true,
    notificationIds: nextNotificationIds,
  };
}

export async function stopMedicineAlarm(alarm: MedicineAlarm): Promise<MedicineAlarm> {
  await cancelNotificationIds(alarm.notificationIds);
  return {
    ...alarm,
    isActive: false,
    notificationIds: [],
  };
}
