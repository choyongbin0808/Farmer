// 시설 — 상점에서 사면 우리 집 지하 작업실의 빈 자리에 바로 설치된다 (종류별 max 칸)
// w x d: 바닥 크기(m), max: 최대 보유 수,
// seconds: 하나 만드는 데 걸리는 실제 시간(초) — 게임 시간으로 바꿔 저장하므로 창을 열어 둔 동안은 멈추고, 자고 일어나면 끝나 있다
export const FACILITIES = {
  brewer: {
    name: '약탕기', itemId: 'fac_brewer', icon: '🍲', price: 2500, w: 2.5, d: 2.5, max: 3, seconds: 20,
    desc: '일반 흙에 타우린과 키토산을 달여 영양 듬뿍 토양 흙을 만들어요.',
  },
  nursery: {
    name: '육묘장', itemId: 'fac_nursery', icon: '🏡', price: 5000, w: 5, d: 2.5, max: 3, seconds: 10,
    desc: '씨앗과 토양 흙으로 모종을 키워요. 모종은 밭에서 3배 빨리 자라요.',
  },
};
export const FACILITY_ORDER = Object.keys(FACILITIES);

/** 한 번에 맡길 수 있는 최대 개수 */
export const MAX_BATCH = 20;

/** 약탕기 레시피: 토양 흙 1개에 드는 재료 */
export const BREW_RECIPE = { soil_plain: 1, mat_taurine: 3, mat_chitosan: 1 };
export const BREW_OUTPUT = 'soil_rich';
