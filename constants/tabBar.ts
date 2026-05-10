/** 플로팅 탭바 세로 높이 (`tabBarStyle.height`) */
export const FLOATING_TAB_BAR_HEIGHT = 68;

/** 화면 하단(safe area 포함)과 탭바 하단 사이 간격 */
export const FLOATING_TAB_BAR_BOTTOM_MARGIN = 8;

/** 좌우 여백 — 값이 클수록 탭바 가로 길이 짧아짐 */
export const FLOATING_TAB_BAR_SIDE_INSET = 82;

/** 스크롤·입력 영역과 탭바 상단 사이 여유 */
export const FLOATING_TAB_BAR_CONTENT_GAP = 12;

/**
 * 절대 배치 탭바가 콘텐츠 위에 겹칠 때, 하단에 필요한 최소 패딩.
 * (safe area + 탭바 하단 마진 + 탭바 높이 + 간격)
 */
export function floatingTabBarOverlayClearance(insetsBottom: number) {
  const tabBottomOffset = Math.max(insetsBottom, 10) + FLOATING_TAB_BAR_BOTTOM_MARGIN;
  return tabBottomOffset + FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_CONTENT_GAP;
}
