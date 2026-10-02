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
      EventBus.emit('rank');
    }
  },
};
