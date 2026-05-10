import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const STORAGE_ENABLED = '@naapo/bgm_enabled';
const STORAGE_VOLUME = '@naapo/bgm_volume';
const DEFAULT_VOLUME = 0.35;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BGM_ASSET = require('../assets/bgm/Pearl Gears.mp3') as number;

type BgmContextValue = {
  prefsLoaded: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  volume: number;
  setVolume: (value: number) => void;
};

const BgmContext = createContext<BgmContextValue | undefined>(undefined);

export function BgmProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const soundRef = useRef<Audio.Sound | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    (async () => {
      try {
        const [rawEn, rawVol] = await Promise.all([
          AsyncStorage.getItem(STORAGE_ENABLED),
          AsyncStorage.getItem(STORAGE_VOLUME),
        ]);
        if (rawEn === '1') setEnabledState(true);
        if (rawVol != null) {
          const n = Number(rawVol);
          if (!Number.isNaN(n)) {
            setVolumeState(Math.min(1, Math.max(0, n)));
          }
        }
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

  const unloadSound = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (!s) return;
    try {
      await s.stopAsync();
    } catch {
      /* unloaded */
    }
    try {
      await s.unloadAsync();
    } catch {
      /* unloaded */
    }
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;

    let cancelled = false;

    (async () => {
      if (!session?.user || !enabled) {
        await unloadSound();
        return;
      }

      await unloadSound();
      if (cancelled) return;

      try {
        const { sound } = await Audio.Sound.createAsync(
          BGM_ASSET,
          { shouldPlay: true, isLooping: true, volume: volumeRef.current },
          undefined,
          true,
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch (err) {
        console.warn('[Bgm] 재생 시작 실패:', err);
      }
    })();

    return () => {
      cancelled = true;
      unloadSound();
    };
  }, [prefsLoaded, session?.user?.id, enabled, unloadSound]);

  useEffect(() => {
    const s = soundRef.current;
    if (s && enabled && session?.user) {
      s.setVolumeAsync(volume).catch(() => {});
    }
  }, [volume, enabled, session?.user]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    void AsyncStorage.setItem(STORAGE_ENABLED, value ? '1' : '0');
  }, []);

  const setVolume = useCallback((value: number) => {
    const v = Math.min(1, Math.max(0, value));
    setVolumeState(v);
    void AsyncStorage.setItem(STORAGE_VOLUME, String(v));
  }, []);

  const value = useMemo<BgmContextValue>(
    () => ({
      prefsLoaded,
      enabled,
      setEnabled,
      volume,
      setVolume,
    }),
    [prefsLoaded, enabled, setEnabled, volume, setVolume],
  );

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}

export function useBgm() {
  const ctx = useContext(BgmContext);
  if (!ctx) {
    throw new Error('useBgm는 BgmProvider 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
