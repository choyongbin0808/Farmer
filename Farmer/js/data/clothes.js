export const SLOT_NAMES = { hat: '모자', top: '상의', bottom: '하의' };
export const SLOTS = ['hat', 'top', 'bottom'];

export const SETS = {
  straw:  { name: '밀짚 세트',     icon: '👒', bonus: { stamina: 10 },                          desc: '최대 체력 +10' },
  farmer: { name: '농부 세트',     icon: '🧑‍🌾', bonus: { stamina: 15, plantCostReduce: 0.10 }, desc: '최대 체력 +15, 심기 체력 -10%' },
  flower: { name: '꽃 세트',       icon: '🌸', bonus: { stamina: 15, foodHealBonus: 0.50 },   desc: '최대 체력 +15, 음식 회복량 +50%' },
  smith:  { name: '대장장이 세트', icon: '🔨', bonus: { stamina: 20, plantCostReduce: 0.20 }, desc: '최대 체력 +20, 심기 체력 -20%' },
  chief:  { name: '이장 세트',     icon: '🎩', bonus: { stamina: 50, plantCostReduce: 0.30 }, desc: '최대 체력 +50, 심기 체력 -30%' },
};

// shop: 'shop' | 'forge' 이면 해당 가게에서 구매 가능, source: 획득처 안내 문구
export const CLOTHES = {
  cloth_straw_hat:  { name: '밀짚모자',       slot: 'hat',    setId: 'straw',  stamina: 5,  color: 0xe8c66a, icon: '👒', style: 'straw',    source: '메인 퀘스트 5' },
  cloth_straw_top:  { name: '밀짚 조끼',      slot: 'top',    setId: 'straw',  stamina: 5,  color: 0xd9b45a, icon: '🦺', shop: 'shop',  price: 150,  source: '상점' },
  cloth_straw_bot:  { name: '밀짚 반바지',    slot: 'bottom', setId: 'straw',  stamina: 5,  color: 0xc49a4a, icon: '🩳', shop: 'shop',  price: 150,  source: '상점' },

  cloth_farmer_hat: { name: '농부 모자',      slot: 'hat',    setId: 'farmer', stamina: 10, color: 0x4f8a3c, icon: '🧢', style: 'cap',      source: '메인 퀘스트 9' },
  cloth_farmer_top: { name: '체크 셔츠',      slot: 'top',    setId: 'farmer', stamina: 10, color: 0xd2483f, icon: '👕', shop: 'forge', price: 500,  rank: 1, source: '대장간' },
  cloth_farmer_bot: { name: '멜빵바지',       slot: 'bottom', setId: 'farmer', stamina: 10, color: 0x3f64a8, icon: '👖', shop: 'forge', price: 450,  rank: 1, source: '대장간' },

  cloth_flower_hat: { name: '꽃 머리띠',      slot: 'hat',    setId: 'flower', stamina: 12, color: 0xff8fb8, icon: '🌸', style: 'headband', source: '민지 서브 퀘스트 2' },
  cloth_flower_top: { name: '꽃무늬 블라우스', slot: 'top',   setId: 'flower', stamina: 12, color: 0xffc4dc, icon: '👚', source: '수아 서브 퀘스트 1' },
  cloth_flower_bot: { name: '꽃무늬 치마',    slot: 'bottom', setId: 'flower', stamina: 12, color: 0xf77fa8, icon: '👗', skirt: true, source: '수아 서브 퀘스트 2' },

  cloth_smith_hat:  { name: '대장장이 두건',  slot: 'hat',    setId: 'smith',  stamina: 15, color: 0x5a5a66, icon: '🧣', style: 'bandana',  source: '강 대장 서브 퀘스트 1' },
  cloth_smith_top:  { name: '대장장이 앞치마', slot: 'top',   setId: 'smith',  stamina: 15, color: 0x7a4e2d, icon: '🥼', source: '강 대장 서브 퀘스트 2' },
  cloth_smith_bot:  { name: '작업 바지',      slot: 'bottom', setId: 'smith',  stamina: 15, color: 0x4a4a52, icon: '👖', shop: 'forge', price: 1500, rank: 3, source: '대장간' },

  cloth_chief_hat:  { name: '이장 중절모',    slot: 'hat',    setId: 'chief',  stamina: 25, color: 0x2f2f3a, icon: '🎩', style: 'fedora',   source: '엔딩' },
  cloth_chief_top:  { name: '이장 정장 상의', slot: 'top',    setId: 'chief',  stamina: 25, color: 0x283a5e, icon: '🤵', source: '엔딩' },
  cloth_chief_bot:  { name: '이장 정장 바지', slot: 'bottom', setId: 'chief',  stamina: 25, color: 0x1f2a44, icon: '👖', source: '엔딩' },
};
