// 주민 서브 퀘스트 — 메인 15개와 별개. req.prev: 먼저 끝내야 하는 퀘스트, req.hearts: 필요한 하트 수
export const SUB_QUESTS = [
  {
    id: 'sub_grandma_1', giver: 'grandma', title: '할머니의 무 반찬', desc: '김 할머니에게 무 5개를 가져다드리자.',
    offer: ['무생채를 좀 무쳐 볼까 하는디, 무가 없네.', '무 다섯 개만 갖다줄 수 있겄어?'],
    done: ['아이고 고마워라! 이건 할미가 싼 도시락이여. 배고플 때 먹어.'],
    objectives: [{ kind: 'deliver', to: 'grandma', item: 'crop_radish', n: 5 }],
    rewards: { items: [{ id: 'food_lunchbox', n: 3 }] },
  },
  {
    id: 'sub_grandma_2', giver: 'grandma', title: '할머니표 김치찌개', desc: '감자·당근·토마토를 3개씩 가져다드리자.', req: { prev: 'sub_grandma_1', hearts: 3 },
    offer: ['우리 강아지 주려고 특별한 찌개를 끓여 볼라는디…', '감자, 당근, 토마토 세 개씩만 구해 와 줘.'],
    done: ['맛있게 먹어! 그리고 이건 할미가 아끼던 비료여. 작물이 쑥쑥 클 겨.'],
    objectives: [
      { kind: 'deliver', to: 'grandma', item: 'crop_potato', n: 3 },
      { kind: 'deliver', to: 'grandma', item: 'crop_carrot', n: 3 },
      { kind: 'deliver', to: 'grandma', item: 'crop_tomato', n: 3 },
    ],
    rewards: { items: [{ id: 'special_fertilizer', n: 5 }] },
  },
  {
    id: 'sub_minji_1', giver: 'minji', title: '민지랑 놀아 줘!', desc: '하루 동안 민지와 3번 대화하자.',
    offer: ['심심해… 오늘 나랑 많이 놀아 줄 거지?', '오늘 하루 동안 나한테 세 번 말 걸어 줘! 약속!'],
    done: ['헤헤, 오늘 진짜 재밌었다! 이거 내가 그린 그림이야. 집에 걸어 둬!'],
    objectives: [{ kind: 'talkTimes', npc: 'minji', count: 3 }],
    rewards: { flags: ['deco_drawing'] },
  },
  {
    id: 'sub_minji_2', giver: 'minji', title: '딸기 파티', desc: '민지에게 딸기 10개를 가져다주자.', req: { prev: 'sub_minji_1', hearts: 3 },
    offer: ['나 친구들이랑 딸기 파티 할 거야!', '딸기 열 개 있으면 좋겠다…'],
    done: ['우와아! 고마워! 이거 내가 만든 꽃 머리띠야. 꼭 써 줘!'],
    objectives: [{ kind: 'deliver', to: 'minji', item: 'crop_strawberry', n: 10 }],
    rewards: { clothes: ['cloth_flower_hat'] },
  },
  {
    id: 'sub_sua_1', giver: 'sua', title: '수아의 샐러드', desc: '수아에게 상추 10개를 가져다주자.',
    offer: ['요즘 샐러드 가게를 같이 해 볼까 생각 중이야.', '상추 열 개만 구해 줄 수 있어?'],
    done: ['고마워! 이 블라우스, 나한텐 좀 작아서. 너한테 잘 어울릴 거야.'],
    objectives: [{ kind: 'deliver', to: 'sua', item: 'crop_lettuce', n: 10 }],
    rewards: { clothes: ['cloth_flower_top'] },
  },
  {
    id: 'sub_sua_2', giver: 'sua', title: '선배의 장사 비법', desc: '작물 30개를 판매하자.', req: { prev: 'sub_sua_1', hearts: 3 },
    offer: ['귀농 선배로서 하나 알려 줄게. 꾸준히 파는 게 제일 중요해.', '작물을 서른 개 팔고 나서 다시 와 봐.'],
    done: ['역시! 이 치마도 가져가. 블라우스랑 세트야.'],
    objectives: [{ kind: 'sellCount', count: 30 }],
    rewards: { clothes: ['cloth_flower_bot'] },
  },
  {
    id: 'sub_fisher_rod', giver: 'fisher', title: '오 씨의 낚시 친구', desc: '오 씨에게 감자 3개를 가져다주자.', req: { mainDone: 3 },
    offer: ['요즘 낚시하다 보면 출출해서 말이야.', '감자 세 개만 쪄 먹게 가져다주겠나? 그럼 내 낚시 비법을 알려 주지.'],
    done: [
      '고맙네! 약속대로 이 대나무 낚싯대를 주지.',
      '핫바에서 낚싯대를 고르고 시냇물을 누르게. 힘 게이지가 오르내릴 때 눌러서 던지는데, 멀리 던질수록 귀한 놈이 물지.',
      '❗가 뜨면 바로 눌러 챔질! 그다음엔 꾹 눌렀다 뗐다 하며 초록 막대 안에 고기를 붙잡아 두면 끌려 올라온다네.',
      '잡은 고기는 어망에 담기니 나한테 가져오게. 물고기는 타우린, 게는 키토산으로 바꿔 주지. 더 좋은 낚싯대도 팔고 있다네.',
    ],
    objectives: [{ kind: 'deliver', to: 'fisher', item: 'crop_potato', n: 3 }],
    rewards: { items: [{ id: 'rod_bamboo', n: 1 }] },
  },
  {
    id: 'sub_yun_mine', giver: 'yun', title: '광부의 도시락', desc: '윤 씨 아주머니에게 감자 5개와 무 5개를 가져다드리자.', req: { mainDone: 5 },
    offer: ['우리 그이 도시락을 싸야 하는데, 밭일이 바빠서 장을 못 봤지 뭐예요.', '감자 다섯 개랑 무 다섯 개만 구해다 줄 수 있어요?'],
    done: [
      '어머, 고마워라! 덕분에 도시락을 든든하게 쌀 수 있겠어요.',
      '사실… 우리 남편이 마을 동쪽 끝 광산에서 일하거든요.',
      '내가 얘기해 둘 테니 이제 언제든 광산에 들어가 봐요. 남편한테 말을 걸면 곡괭이도 하나 줄 거예요!',
    ],
    objectives: [
      { kind: 'deliver', to: 'yun', item: 'crop_potato', n: 5 },
      { kind: 'deliver', to: 'yun', item: 'crop_radish', n: 5 },
    ],
    rewards: { money: 300, flags: ['mine'] },
  },
  {
    id: 'sub_fisher_1', giver: 'fisher', title: '빗속의 시냇물', desc: '비 오는 날 시냇물에서 오 씨와 이야기하자.',
    offer: ['비 오는 날 시냇물을 본 적 있나?', '언젠가 비가 오면 여기로 와 보게. 보여 줄 게 있어.'],
    done: ['어때, 빗소리랑 물소리가 어우러지니 좋지?', '이건 내가 끓인 약초차야. 몸이 확 풀릴 걸세.'],
    objectives: [{ kind: 'talkRain', npc: 'fisher' }],
    rewards: { items: [{ id: 'food_tea', n: 3 }] },
  },
  {
    id: 'sub_fisher_2', giver: 'fisher', title: '구운 옥수수', desc: '오 씨에게 옥수수 5개를 가져다주자.', req: { prev: 'sub_fisher_1', hearts: 3 },
    offer: ['낚시하면서 구운 옥수수를 먹으면 그만이지.', '옥수수 다섯 개만 가져다주겠나?'],
    done: ['고맙네! 내 낚싯대를 자네 집에 하나 두지. 약초차는 이제 상점에서도 팔라고 해 두겠네.'],
    objectives: [{ kind: 'deliver', to: 'fisher', item: 'crop_corn', n: 5 }],
    rewards: { flags: ['deco_rod', 'tea'] },
  },
  {
    id: 'sub_smith_1', giver: 'smith', title: '첫 담금질', desc: '농기구 하나를 처음으로 강화하자.',
    offer: ['…도구를 강화해 본 적 있나?', '하나라도 강화해 와라. 그럼 인정해 주지.'],
    done: ['…좋은 눈이다. 이 두건 써라. 불똥 튀는 데선 필수다.'],
    objectives: [{ kind: 'enhance', level: 1, count: 1 }],
    rewards: { clothes: ['cloth_smith_hat'] },
  },
  {
    id: 'sub_smith_2', giver: 'smith', title: '명장의 길', desc: '장착한 모든 농기구를 +3 이상으로 강화하자.', req: { prev: 'sub_smith_1', hearts: 3 },
    offer: ['쓰고 있는 도구를 전부 +3까지 올려 봐라.', '해내면… 내 앞치마를 물려주지.'],
    done: ['…넌 이제 진짜 농부다. 이 앞치마 가져가. 앞으로 강화 비용도 깎아 주마.'],
    objectives: [{ kind: 'enhance', level: 3, count: 3 }],
    rewards: { clothes: ['cloth_smith_top'], flags: ['discount'] },
  },
];

for (const q of SUB_QUESTS) q.type = 'sub';
