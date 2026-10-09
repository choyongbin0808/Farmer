// 이장 메인 퀘스트 16개 — 순서대로 1개씩 진행 (15번째: 새 마을회관 짓기)
// objective kind: talk, till, plant, plantedPlots, harvest, earn, sellCount, deliver, toolLevel(장비 등급),
//                 enhance(장비 강화), relation, dayHarvest, totalEarned, talkRain, talkTimes,
//                 hallFund(마을회관 건축비 내기), hallBuilt(마을회관 완공)

/** 새 마을회관 건축비 */
export const HALL_COST = 20000;
export const MAIN_QUESTS = [
  {
    id: 'main_01', title: '마을에 온 것을 환영하네', desc: '마을 사람들에게 인사를 해 보자.',
    offer: ['우선 마을 사람들과 얼굴부터 익혀 두게나.', '상점의 최 사장, 대장간의 강 대장, 그리고 김 할머니에게 인사하고 오게.'],
    done: ['허허, 벌써 다들 자네 칭찬이 자자하더군.', '자, 이건 내 작은 성의일세.'],
    objectives: [{ kind: 'talk', targets: ['shop', 'smith', 'grandma'] }],
    rewards: { money: 100, items: [{ id: 'seed_radish', n: 5 }] },
  },
  {
    id: 'main_02', title: '첫 씨앗', desc: '호미로 밭을 갈고 상추 씨앗을 심어 보자.',
    offer: ['이제 농사를 시작해 볼 차례일세.', '빈 밭을 누르면 호미로 갈아 준다네. 세 칸을 갈고, 한 번 더 눌러 물을 주게.', '씨앗은 갈고 물까지 준 땅에만 심을 수 있다네. 핫바에서 상추 씨앗을 골라 세 개 심어 보게.', '씨앗을 심으면 체력이 조금 닳으니 너무 무리하지는 말고.'],
    done: ['오, 제법 농부 티가 나는구먼!'],
    objectives: [{ kind: 'till', count: 3 }, { kind: 'plant', crop: 'lettuce', count: 3 }],
    rewards: { items: [{ id: 'seed_lettuce', n: 5 }] },
  },
  {
    id: 'main_03', title: '땀의 결실', desc: '물을 주고 정성껏 키운 상추를 수확하자.',
    offer: ['작물은 물을 준 날에만 자란다네.', '작물은 물을 준 날 밤에 자란다네. 다음 날부터는 아침마다 밭을 눌러 물을 다시 주게.', '다 자란 밭을 누르면 낫으로 수확하지. 상추 세 개를 수확해 보게. 수확한 건 창고로 바로 들어간다네.', '수확하고 나면 땅이 굳으니, 다시 심기 전에 한 번 더 갈아 주게.'],
    done: ['첫 수확을 축하하네! 그 기쁨을 잊지 말게.'],
    objectives: [{ kind: 'harvest', crop: 'lettuce', count: 3 }],
    rewards: { money: 150 },
  },
  {
    id: 'main_04', title: '장사의 기본', desc: '상점에서 작물을 팔아 200원을 벌어 보자.',
    offer: ['농사꾼도 셈은 할 줄 알아야지.', '상점의 최 사장에게 작물을 팔아서 200원을 벌어 오게.'],
    done: ['장사 수완도 있구먼! 감자 씨앗을 좀 주지.'],
    objectives: [{ kind: 'earn', amount: 200 }],
    rewards: { items: [{ id: 'seed_potato', n: 5 }] },
  },
  {
    id: 'main_05', title: '이웃의 정', desc: '김 할머니에게 감자 3개를 전해 드리자.',
    offer: ['김 할머니가 요즘 감자 요리가 드시고 싶다더군.', '감자 세 개를 키워서 할머니께 전해 드리게.'],
    done: ['할머니가 아주 기뻐하시더군. 자, 햇볕 가리게 이 모자를 쓰게.'],
    objectives: [{ kind: 'deliver', to: 'grandma', item: 'crop_potato', n: 3 }],
    rewards: { money: 300, clothes: ['cloth_straw_hat'], relation: { grandma: 10 } },
  },
  {
    id: 'main_06', title: '더 좋은 도구', desc: '상점에서 구리 농기구를 하나 사서 장착하자.',
    offer: ['낡은 도구로는 한계가 있지.', '자네도 이제 초보 농부니, 상점에서 구리 농기구를 하나 사서 써 보게.'],
    done: ['반짝반짝하구먼! 일이 훨씬 수월해질 걸세.'],
    objectives: [{ kind: 'toolLevel', level: 2, count: 1 }],
    rewards: { money: 500 },
  },
  {
    id: 'main_07', title: '넓어지는 밭', desc: '밭 9칸을 모두 작물로 채우면 이장님이 밭을 넓혀 준다.',
    offer: ['자네 밭이 좀 좁아 보이는구먼.', '지금 밭 아홉 칸을 모두 작물로 채워 보게. 그럼 내가 밭을 4x4로 넓혀 주지.'],
    done: ['약속대로 밭을 넓혀 주겠네! 당근 씨앗도 가져가게.'],
    objectives: [{ kind: 'plantedPlots', count: 9 }],
    rewards: { expand: 4, items: [{ id: 'seed_carrot', n: 10 }] },
  },
  {
    id: 'main_08', title: '마을 잔치 준비', desc: '잔치에 쓸 당근 5개와 토마토 5개를 이장님께 가져가자.',
    offer: ['곧 마을 잔치가 있다네.', '잔치 음식에 쓸 당근 다섯 개, 토마토 다섯 개를 구해 오게.'],
    done: ['이걸로 잔치 준비는 끝이구먼! 고맙네.'],
    objectives: [
      { kind: 'deliver', to: 'chief', item: 'crop_carrot', n: 5 },
      { kind: 'deliver', to: 'chief', item: 'crop_tomato', n: 5 },
    ],
    rewards: { money: 800 },
  },
  {
    id: 'main_09', title: '아이들의 웃음', desc: '민지에게 딸기 3개를 선물하자.',
    offer: ['민지가 요즘 기운이 없어 보여.', '그 아이가 딸기를 참 좋아하는데, 세 개만 가져다주겠나?'],
    done: ['민지가 하루 종일 웃고 다니더군. 자, 농부라면 이 모자 하나쯤은 있어야지.'],
    objectives: [{ kind: 'deliver', to: 'minji', item: 'crop_strawberry', n: 3 }],
    rewards: { money: 1000, clothes: ['cloth_farmer_hat'], relation: { minji: 10 } },
  },
  {
    id: 'main_10', title: '마을의 일꾼', desc: '주민 3명과 친밀도 2하트 이상이 되자.',
    offer: ['마을 일은 결국 사람 일이라네.', '주민들과 매일 이야기를 나누고 부탁도 들어주면서 친해져 보게.'],
    done: ['이제 다들 자네를 진짜 이웃으로 생각하더군.'],
    objectives: [{ kind: 'relation', hearts: 2, count: 3 }],
    rewards: { money: 1000 },
  },
  {
    id: 'main_11', title: '대장간의 부탁', desc: '장착한 농기구 2개를 +2 이상으로 강화하자.',
    offer: ['강 대장이 실력 발휘를 하고 싶어 하더군.', '쓰고 있는 농기구 두 개를 +2 이상으로 강화해 보게.'],
    done: ['강 대장이 자네를 단골이라고 부르더군. 허허.'],
    objectives: [{ kind: 'enhance', level: 2, count: 2 }],
    rewards: { money: 1500, relation: { smith: 10 } },
  },
  {
    id: 'main_12', title: '풍년을 꿈꾸며', desc: '하루에 작물 20개를 수확하자.',
    offer: ['올해는 풍년이 들었으면 좋겠구먼.', '하루에 작물 스무 개를 수확해 보게. 해내면 밭을 6x6으로 넓혀 주지.'],
    done: ['대단하구먼! 약속대로 밭을 6x6으로 넓혀 주겠네.'],
    objectives: [{ kind: 'dayHarvest', count: 20 }],
    rewards: { expand: 6 },
  },
  {
    id: 'main_13', title: '마을의 자랑', desc: '옥수수 10개를 수확하자.',
    offer: ['옥수수는 우리 마을의 자랑이었다네.', '옥수수 열 개를 수확해 보게. 그럼 귀한 수박 씨앗을 주지.'],
    done: ['훌륭하네! 이건 아무에게나 주지 않는 수박 씨앗일세.'],
    objectives: [{ kind: 'harvest', crop: 'corn', count: 10 }],
    rewards: { flags: ['watermelon'], items: [{ id: 'seed_watermelon', n: 5 }] },
  },
  {
    id: 'main_14', title: '큰 손', desc: '누적 판매 금액 10,000원을 달성하자.',
    offer: ['마을 살림을 맡으려면 살림 솜씨도 있어야지.', '지금까지 판 작물 값이 모두 만 원이 넘으면 다시 오게.'],
    done: ['이 정도면 마을 살림도 걱정 없겠구먼.'],
    objectives: [{ kind: 'totalEarned', amount: 10000 }],
    rewards: { money: 2000 },
  },
  {
    id: 'main_hall', title: '새 마을회관', desc: '마을회관을 새로 지을 건축비를 내고, 일꾼들 새참으로 감자 20개를 드리자. 하룻밤 자고 나면 완공!',
    offer: [
      '자네에게 마을을 맡기기 전에 꼭 하고 싶은 일이 있다네.',
      '이 낡은 마을회관을 새로 짓는 걸세. 앞으로 자네가 일할 곳이니 번듯해야지.',
      `건축비 ${HALL_COST.toLocaleString()}원을 내 주고, 일꾼들 새참으로 감자 스무 개를 가져다주게. 하룻밤 새에 뚝딱 지어 놓겠네.`,
    ],
    done: ['보게, 이 늠름한 새 마을회관을! 다 자네 덕분일세.', '이제 정말 마지막 부탁만 남았구먼.'],
    objectives: [
      { kind: 'hallFund', amount: HALL_COST },
      { kind: 'deliver', to: 'chief', item: 'crop_potato', n: 20 },
      { kind: 'hallBuilt' },
    ],
    rewards: { money: 3000 },
  },
  {
    id: 'main_15', title: '다음 이장에게', desc: '호박과 수박을 이장님께 드리고, 모든 주민과 3하트 이상이 되자.',
    offer: ['이제 마지막 부탁일세.', '호박 하나, 수박 하나를 키워 오게. 그리고 마을 사람 모두와 깊이 친해지게.', '그걸 해낸다면… 자네에게 이 마을을 맡기고 싶네.'],
    done: ['……정말 해냈구먼.', '모두 광장으로 모이라고 하게. 오늘은 특별한 날이야.'],
    objectives: [
      { kind: 'deliver', to: 'chief', item: 'crop_pumpkin', n: 1 },
      { kind: 'deliver', to: 'chief', item: 'crop_watermelon', n: 1 },
      { kind: 'relation', hearts: 3, count: 5 },
    ],
    rewards: { clothes: ['cloth_chief_hat', 'cloth_chief_top', 'cloth_chief_bot'], autoEquip: true, ending: true },
  },
];

for (const q of MAIN_QUESTS) {
  q.type = 'main';
  q.giver = 'chief';
}
