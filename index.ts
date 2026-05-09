// fonts를 expo-router/entry보다 먼저 로드해야
// Expo Router가 탭 화면 모듈을 등록하기 전에 StyleSheet.create 패치가 적용됨
import './lib/fonts';
import 'expo-router/entry';
