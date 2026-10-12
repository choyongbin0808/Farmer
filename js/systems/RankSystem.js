import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { RANKS } from '../data/ranks.js';
import { AudioManager } from '../core/AudioManager.js';
import { banner } from '../ui/HUD.js';

export const RankSystem = {
  name() {
    return RANKS[G.state.rank].name;
  },

  update() {
    const done = G.state.quests.mainIndex;
    let r = 0;
    for (let i = 0; i < RANKS.length; i++) if (done >= RANKS[i].need) r = i;
    if (r > G.state.rank) {
      G.state.rank = r;
      AudioManager.sfx('rank');
      banner('🏅 직책 상승!', `${RANKS[r].name} · 해금: ${RANKS[r].unlock}`);
      // 마을 이장이 되면 박 이장은 부이장으로 물러난다
      if (r === RANKS.length - 1) banner('🤝 박 이장 → 박 부이장', '이제부터 박 할아버지가 부이장으로 새 이장님을 도와요');
      EventBus.emit('rank');
    }
  },
};
