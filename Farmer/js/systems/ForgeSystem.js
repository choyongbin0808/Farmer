import { CLOTHES } from '../data/clothes.js';
import { ShopSystem } from './ShopSystem.js';
import { FarmSystem } from './FarmSystem.js';
import { GearSystem } from './GearSystem.js';

export const ForgeSystem = {
  /** 장비 하나의 다음 강화 비용 (최대면 null) */
  enhanceCost(gearId) {
    return GearSystem.enhanceCost(gearId);
  },

  /** 장비 하나를 강화 (장비마다 강화 단계가 따로 저장됨) */
  enhance(gearId) {
    GearSystem.enhance(gearId);
  },

  clothesList() {
    return Object.entries(CLOTHES).filter(([, c]) => c.shop === 'forge').map(([id, c]) => ({ id, ...c }));
  },

  buyCloth(id) {
    ShopSystem.buyCloth(id);
  },

  expandFarm() {
    FarmSystem.buyExpand();
  },
};
