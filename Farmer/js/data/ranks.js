// need = 완료한 메인 퀘스트 수
// 직책 단계(index)가 곧 착용 가능한 장비 등급(TIERS index)이다: 0 낡은 → 5 무지개
export const RANKS = [
  { name: '새내기 귀농인', need: 0,  unlock: '상추 · 무 · 감자 · 낡은 장비' },
  { name: '초보 농부',     need: 3,  unlock: '당근 · 토마토 씨앗 · 구리 장비 착용' },
  { name: '마을 일꾼',     need: 6,  unlock: '딸기 씨앗 · 철 장비 착용' },
  { name: '마을 반장',     need: 9,  unlock: '옥수수 씨앗 · 은 장비 착용' },
  { name: '부이장',        need: 12, unlock: '호박 씨앗 · 금 장비 착용' },
  { name: '마을 이장',     need: 16, unlock: '마을의 모든 것 · 무지개 장비 착용' },
];
