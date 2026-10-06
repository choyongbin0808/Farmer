// pos: 기본 위치 [x, z], face: 바라보는 방향(라디안), look: 3D 모델 외형
export const NPCS = {
  chief: {
    name: '박 이장', role: '마을 이장', avatar: '👴', pos: [0, -14.6], face: 0,
    look: { skin: 0xf0c8a4, top: 0xa8805a, bottom: 0x6a5848, hair: 0xeeece6, hairStyle: 'bald', beard: 0xeeece6, glasses: true },
    greet: [
      '허허, 오늘도 부지런하구먼.',
      '자네가 온 뒤로 마을에 활기가 도는 것 같아.',
      '천천히 하게나. 농사는 서두른다고 되는 게 아니라네.',
    ],
    chat: [
      '이 마을은 내가 젊었을 때부터 이 모습 그대로라네.',
      '작물마다 자라는 시간이 다르니, 계획을 세워 심어 보게.',
      '밤이 깊으면 집에 가서 푹 자게. 체력이 있어야 농사도 짓지.',
    ],
  },
  shop: {
    name: '최 사장', role: '상점 주인', avatar: '🧑‍💼', pos: [-15.6, -4], face: Math.PI / 2,
    look: { skin: 0xeec09a, top: 0xf0b048, bottom: 0x4a5a78, hair: 0x2e2420, hairStyle: 'short', cap: 0xd8503e },
    greet: [
      '어서 오세요! 오늘도 좋은 씨앗 많이 들어왔어요.',
      '싱싱한 작물은 언제든 사 드려요!',
      '장사는 신용이죠. 우리 가게는 가격이 늘 똑같답니다.',
    ],
    chat: [
      '비싼 작물일수록 심을 때 힘이 많이 든다더라고요.',
      '수확한 작물은 창고로 바로 들어가니까, 여기서 바로 파시면 돼요.',
    ],
  },
  smith: {
    name: '강 대장', role: '대장장이', avatar: '🧔', pos: [-15.6, -17], face: Math.PI / 2,
    look: { skin: 0xd8a07a, top: 0x8a5a3c, bottom: 0x4a4644, hair: 0x3a2618, hairStyle: 'short', beard: 0x3a2618 },
    greet: [
      '…왔나.',
      '도구는 손에 익어야 제맛이지.',
      '좋은 도구가 좋은 농사를 만든다.',
    ],
    chat: [
      '철 호미부터는 한 번에 여러 칸을 갈 수 있지. 상점에서 팔더군.',
      '강화하면 손놀림이 빨라지고, 낫은 더 많이 거둔다. 장비마다 따로 올려야 해.',
      '좋은 장비를 사 둬도 직책이 안 되면 못 쓴다. 마을 일부터 열심히 해라.',
    ],
  },
  grandma: {
    name: '김 할머니', role: '마을 주민', avatar: '👵', pos: [15.6, -17], face: -Math.PI / 2,
    look: { skin: 0xf4d0b4, top: 0xb08ac8, bottom: 0x7a6488, hair: 0xd0ccc6, hairStyle: 'bun' },
    greet: [
      '아이고, 우리 새 이웃 왔구먼!',
      '밥은 먹고 다니는 겨?',
      '오늘도 얼굴 보니 좋네.',
    ],
    chat: [
      '우리 손주도 너만 할 때가 있었는디….',
      '맛있는 반찬은 좋은 재료에서 나오는 겨.',
    ],
  },
  minji: {
    name: '민지', role: '마을 꼬마', avatar: '👧', pos: [3, -6], face: 0, wander: { x: 0, z: -6, r: 5 },
    look: { skin: 0xf6d2b4, top: 0xffd25a, bottom: 0x58a0d8, hair: 0x2e2420, hairStyle: 'pigtail', scale: 0.72 },
    greet: [
      '안녕! 오늘 뭐 하고 놀아?',
      '나 딸기 엄청 좋아해!',
      '광장에서 노는 게 제일 재밌어!',
    ],
    chat: [
      '어제 시냇물에서 반짝이는 돌을 주웠어!',
      '이장 할아버지는 엄청 착해!',
    ],
  },
  sua: {
    name: '수아', role: '꽃집 주인', avatar: '👩', pos: [15.6, -4], face: -Math.PI / 2,
    look: { skin: 0xf6d4bc, top: 0x96cc90, bottom: 0xf4f0e8, hair: 0x7a4a2a, hairStyle: 'long' },
    greet: [
      '안녕! 나도 도시에서 왔어. 반가워.',
      '시골 생활, 생각보다 할 만하지?',
      '꽃은 매일 봐도 예뻐.',
    ],
    chat: [
      '처음엔 나도 체력이 금방 떨어져서 고생했어. 옷을 잘 챙겨 입으면 훨씬 나아.',
      '같은 세트 옷을 모두 입으면 특별한 효과가 생긴대.',
    ],
  },
  fisher: {
    name: '오 씨', role: '어부', avatar: '🎣', pos: [12, -29], face: Math.PI,
    look: { skin: 0xd8a07a, top: 0x4a86c4, bottom: 0x6a6a44, hair: 0x5a5a5a, hairStyle: 'short', hatStraw: 0xe2c47e },
    greet: [
      '쉿… 물고기가 놀라.',
      '바람이 좋구먼.',
      '시냇물 소리는 들어도 들어도 안 질려.',
    ],
    chat: [
      '비 오는 날 시냇물은 또 다른 맛이 있지.',
      '느긋하게 사는 게 제일이야.',
    ],
  },
};

export const NPC_ORDER = ['chief', 'shop', 'smith', 'grandma', 'minji', 'sua', 'fisher'];
