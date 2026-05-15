module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated v4 부터는 worklets 패키지의 플러그인을 사용해야 함.
    // 이 플러그인은 babel 플러그인 목록에서 항상 마지막에 위치해야 한다.
    plugins: ['react-native-worklets/plugin'],
  };
};
