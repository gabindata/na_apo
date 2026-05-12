import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const SECURE_EMAIL = 'naapo_saved_login_email_v1';
const SECURE_PASSWORD = 'naapo_saved_login_password_v1';
/** 웹·폴백용 (네이티브에서는 SecureStore 우선) */
const AS_EMAIL = 'naapo_saved_login_email_as_v1';
const AS_PASSWORD = 'naapo_saved_login_password_as_v1';

async function preferSecureStore(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/** 저장된 로그인 정보가 있으면 이메일·비밀번호 반환 */
export async function loadSavedLogin(): Promise<{ email: string; password: string } | null> {
  try {
    if (await preferSecureStore()) {
      const [email, password] = await Promise.all([
        SecureStore.getItemAsync(SECURE_EMAIL),
        SecureStore.getItemAsync(SECURE_PASSWORD),
      ]);
      if (email?.trim() && password != null && password.length > 0) {
        return { email: email.trim(), password };
      }
      return null;
    }

    const [email, password] = await Promise.all([
      AsyncStorage.getItem(AS_EMAIL),
      AsyncStorage.getItem(AS_PASSWORD),
    ]);
    if (email?.trim() && password != null && password.length > 0) {
      return { email: email.trim(), password };
    }
    return null;
  } catch {
    return null;
  }
}

/** 로그인 정보 저장 (네이티브: 키체인/Keystore, 그 외: AsyncStorage) */
export async function saveSavedLogin(email: string, password: string): Promise<void> {
  const e = email.trim();
  if (!e || !password) return;

  try {
    if (await preferSecureStore()) {
      await SecureStore.setItemAsync(SECURE_EMAIL, e, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      await SecureStore.setItemAsync(SECURE_PASSWORD, password, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.multiRemove([AS_EMAIL, AS_PASSWORD]);
      return;
    }

    await AsyncStorage.multiSet([
      [AS_EMAIL, e],
      [AS_PASSWORD, password],
    ]);
  } catch (err) {
    console.warn('[savedLogin] 저장 실패:', err);
  }
}

/** 저장된 로그인 정보 삭제 */
export async function clearSavedLogin(): Promise<void> {
  try {
    if (await preferSecureStore()) {
      await SecureStore.deleteItemAsync(SECURE_EMAIL);
      await SecureStore.deleteItemAsync(SECURE_PASSWORD);
    }
    await AsyncStorage.multiRemove([AS_EMAIL, AS_PASSWORD]);
  } catch (err) {
    console.warn('[savedLogin] 삭제 실패:', err);
  }
}
