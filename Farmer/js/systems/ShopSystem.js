import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { CROPS, CROP_ORDER, isCropUnlocked } from '../data/crops.js';
import { RANKS } from '../data/ranks.js';
import { CLOTHES } from '../data/clothes.js';
import { getItem } from '../data/items.js';
import { GEAR, GEAR_ORDER } from '../data/tools.js';
import { InventorySystem } from './InventorySystem.js';
import { OutfitSystem } from './OutfitSystem.js';
import { GearSystem } from './GearSystem.js';
import { toast } from '../ui/HUD.js';

export const ShopSystem = {
  seedList() {
    return CROP_ORDER.map((cropId) => {
      const c = CROPS[cropId];
      const unlocked = isCropUnlocked(cropId, G.state);
      const req = c.unlockFlag ? '메인 퀘스트 13 보상으로 해금' : `'${RANKS[c.unlockRank].name}' 직책 필요`;
      return { itemId: 'seed_' + cropId, cropId, crop: c, unlocked, req };
    });
  },

  goodsList() {
    const foods = ['food_bread', 'food_tea'].map((id) => {
      const it = getItem(id);
      return { itemId: id, item: it, unlocked: !it.unlockFlag || G.state.flags[it.unlockFlag], req: '오 씨의 부탁을 들어주면 판매' };
    });
    const specials = ['special_growth'].map((id) => ({ itemId: id, item: getItem(id), unlocked: true }));
    const clothes = Object.entries(CLOTHES).filter(([, c]) => c.shop === 'shop').map(([id, c]) => ({ itemId: id, item: { ...c, id, type: 'cloth' }, unlocked: true }));
    return [...foods, ...specials, ...clothes];
  },

  maxAffordable(itemId) {
    const it = getItem(itemId);
    return Math.max(0, Math.min(99, Math.floor(G.state.player.money / it.price)));
  },

  buy(itemId, n) {
    const it = getItem(itemId);
    if (n <= 0) return toast('돈이 부족해요', 'warn');
    const price = it.price * n;
    if (G.state.player.money < price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    if (!InventorySystem.canAdd(itemId, n)) {
      AudioManager.sfx('error');
      return toast('가방이 가득 찼어요', 'warn');
    }
    G.state.player.money -= price;
    InventorySystem.add(itemId, n);
    AudioManager.sfx('coin');
    toast(`${it.name} ${n}개를 샀어요 (-${price.toLocaleString()}원)`);
    EventBus.emit('money');
  },

  buyCloth(id) {
    const c = CLOTHES[id];
    if (OutfitSystem.owns(id)) return toast('이미 가지고 있어요');
    if (c.rank && G.state.rank < c.rank) return toast(`'${RANKS[c.rank].name}' 직책이 필요해요`, 'warn');
    if (G.state.player.money < c.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    G.state.player.money -= c.price;
    OutfitSystem.addClothes(id);
    AudioManager.sfx('coin');
    toast(`${c.icon} ${c.name}을(를) 샀어요! 가방의 '옷' 탭에서 입을 수 있어요`, 'good');
    EventBus.emit('money');
  },

  /** 상점 장비 목록 — 기본 지급(낡은) 장비는 제외. 구매는 직책 무관, 착용은 직책 필요 */
  gearList() {
    return GEAR_ORDER.filter((id) => GEAR[id].price > 0).map((id) => {
      const g = GEAR[id];
      return {
        id, gear: g,
        owned: GearSystem.owns(id),
        equipped: GearSystem.isEquipped(id),
        canEquip: GearSystem.canEquip(id),
        rankName: GearSystem.requiredRankName(id),
      };
    });
  },

  buyGear(id) {
    const g = GEAR[id];
    if (!g) return;
    if (GearSystem.owns(id)) return toast('이미 가지고 있어요');
    if (G.state.player.money < g.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    G.state.player.money -= g.price;
    GearSystem.add(id);
    AudioManager.sfx('coin');
    const hint = GearSystem.canEquip(id)
      ? "가방의 '장비' 탭에서 장착할 수 있어요"
      : `'${GearSystem.requiredRankName(id)}' 직책이 되면 장착할 수 있어요`;
    toast(`${g.icon} ${g.name}을(를) 샀어요! ${hint}`, 'good');
    EventBus.emit('money');
  },

  sellableCrops() {
    return CROP_ORDER.map((cropId) => {
      const id = 'crop_' + cropId;
      return { id, cropId, crop: CROPS[cropId], n: InventorySystem.countAll(id) };
    }).filter((e) => e.n > 0);
  },

  sell(cropId, n) {
    const id = 'crop_' + cropId;
    const have = InventorySystem.countAll(id);
    n = Math.min(n, have);
    if (n <= 0) return 0;
    InventorySystem.consumeAll(id, n);
    const money = CROPS[cropId].sellPrice * n;
    G.state.player.money += money;
    G.state.stats.totalEarned += money;
    G.state.stats.totalSold += n;
    EventBus.emit('sell', { cropId, n, money });
    EventBus.emit('money');
    return money;
  },

  sellAll() {
    let total = 0;
    for (const e of this.sellableCrops()) total += this.sell(e.cropId, e.n);
    if (total > 0) {
      AudioManager.sfx('coin');
      toast(`작물을 모두 팔았어요! +${total.toLocaleString()}원`, 'good');
    }
  },
};
