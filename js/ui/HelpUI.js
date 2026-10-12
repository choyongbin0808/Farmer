import { HOTBAR_SIZE } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';
import { openModal, refreshModal, closeModal, currentModal } from './Panels.js';
import { BookPreview } from './BookPreview.js';
import { itemSvg } from './ItemIcons.js';
import { makeCropModel, makeHeldItem } from '../world/Models.js';
import { makeFishModel, makeOreNode, setOreNode, makeNursery, makeBrewer } from '../world/ExtraModels.js';
import { SOIL_BOX_CAP, SOIL_BOX_COUNT } from '../systems/SoilBoxSystem.js';
import { getItem } from '../data/items.js';
import { TOOLS, MAX_ENHANCE } from '../data/tools.js';
import { CROPS, growSeconds, growText } from '../data/crops.js';
import { ORES, ORE_ORDER, PICKAXES } from '../data/mining.js';
import { RODS } from '../data/fishing.js';
import { FACILITIES, BREW_RECIPE } from '../data/facilities.js';
import { CLOTHES, SETS } from '../data/clothes.js';

/*
 * 도움말 (Esc 메뉴 → 📖 도움말)
 * 나무 판자 모양 창에 줄(기본 요령 · 농사 · 집 · 시설 · 낚시 · 채굴)마다 주제 버튼이 있고 (버튼 색은 줄마다 노랑 · 청록 번갈아),
 * 주제를 누르면 그림과 설명이 담긴 장을 ◀ ▶ 로 넘겨 본다.
 * 그림은 HTML/CSS 로 그린 작은 장면 + (있으면) 게임 속 3D 모델 미리보기.
 */

// ───────── 그림 조각 ─────────
const tile = (icon, label = '', cls = '') => `<div class="h-tile ${cls}"><span>${icon}</span>${label ? `<small>${label}</small>` : ''}</div>`;
const arrow = (d = '→') => `<span class="h-arrow">${d}</span>`;
/** 그림 칸들 사이에 화살표를 넣어 흐름을 보여 준다 */
const flow = (items, cls = '') => `<div class="h-flow ${cls}">${items.join(arrow())}</div>`;
const plus = '<span class="h-arrow plus">+</span>';
const bubble = (html, cls = '') => `<div class="h-bubble ${cls}">${html}</div>`;
/** 손글씨 메모 */
const note = (t, cls = '') => `<span class="h-note ${cls}">${t}</span>`;
const key = (k, cls = '') => `<kbd class="h-key ${cls}">${k}</kbd>`;
/** 땀 흘리는 농부 (마스코트) */
const farmer = (say = '', mood = 'sweat') => `
  <div class="h-mascot ${mood}">
    <span class="face">🧑‍🌾</span>${mood === 'sweat' ? '<i class="sweat">💦</i>' : ''}
    ${say ? note(say, 'say') : ''}
  </div>`;
const stamBar = (cur, max, label = '') => `
  <div class="h-stam"><span>⚡</span><div class="bar"><i style="width:${(cur / max) * 100}%"></i></div><b>${label || `${cur} / ${max}`}</b></div>`;
const hotbar = (icons, sel = -1) => `
  <div class="h-hotbar">${Array.from({ length: Math.min(HOTBAR_SIZE, 7) }, (_, i) => `
    <div class="h-slot ${i === sel ? 'sel' : ''}"><span>${icons[i] || ''}</span><em>${i + 1}</em></div>`).join('')}
  </div>`;
/** 3D 모델 자리 (page.model 이 있을 때만 채워짐) */
const model3d = (cap = '') => `<div class="h-model"><div class="h-3d"></div>${cap ? `<small>${cap}</small>` : ''}</div>`;
const won = (n) => `${n.toLocaleString()}원`;

// ───────── 주제 · 장 ─────────
// page: { text, art, model?: [key, make] , side?: true (그림을 오른쪽에) }
const farmSet = ['cloth_farmer_hat', 'cloth_farmer_top', 'cloth_farmer_bot'].map((id) => CLOTHES[id]);
const brewNeed = BREW_RECIPE;

const ROWS = [
  {
    label: '기본 요령',
    topics: [
      {
        id: 'controls', label: '조작법',
        pages: [
          {
            text: '<b>W A S D</b> 로 걸어 다니고, <b>Shift</b> 를 누르고 있으면 달려요.<br>땅이나 주민을 <b>클릭</b>하면 그곳까지 걸어가서 알아서 일하거나 말을 걸어요.',
            art: `
              <div class="h-keys">
                <div class="h-wasd">${key('W')}<div>${key('A')}${key('S')}${key('D')}</div></div>
                ${key('Shift', 'wide')}${note('달리기!')}
              </div>
              ${bubble(`<span class="big">🖱️</span> 클릭 = 이동 · 일하기 · 대화`)}`,
          },
          {
            text: `숫자 <b>1 ~ ${HOTBAR_SIZE}</b> 로 아래 핫바 칸을 골라요. 씨앗 · 낚싯대 · 곡괭이 · 음식을 넣어 두고 꺼내 쓰는 곳이에요.<br>가까운 주민이나 건물과는 <b>E</b> 로도 이야기할 수 있어요.`,
            art: `
              ${hotbar(['🌱', '🎣', '⛏️', '🍞'], 1)}
              <div class="h-keyrow">
                <span>${key('I')}${key('Tab', 'wide')} 가방</span><span>${key('Q')} 퀘스트</span>
                <span>${key('B')} 도감</span><span>${key('E')} 대화</span><span>${key('Esc', 'wide')} 메뉴</span>
              </div>`,
          },
          {
            text: '마우스 <b>휠</b>로 카메라를 당기거나 멀리 보고, <b>오른쪽 버튼을 누른 채 끌면</b> 카메라를 돌릴 수 있어요.<br>건물에 가려서 안 보일 땐 살짝 돌려 보세요.',
            art: `
              ${flow([tile('🖱️', '휠 = 확대 · 축소'), tile('🔄', '우클릭 드래그 = 회전')])}
              ${farmer('어디 보자~', 'happy')}`,
          },
        ],
      },
      {
        id: 'stamina', label: '체력 관리 요령',
        pages: [
          {
            text: '<b>씨앗을 심을 때</b>와 <b>광석을 캘 때</b>마다 체력이 닳아요.<br>밭 갈기 · 물 주기 · 수확 · 낚시는 체력이 들지 않아요. 비싼 작물일수록 심을 때 체력이 많이 들어요.',
            art: `
              ${stamBar(28, 100)}
              <div class="h-list">
                ${['lettuce', 'potato', 'strawberry', 'watermelon'].map((id) => `<div>${CROPS[id].icon} ${CROPS[id].name}<b>⚡ ${CROPS[id].staminaCost}</b></div>`).join('')}
                <div>⛏️ 곡괭이질 한 번<b>⚡ 2~3</b></div>
              </div>
              ${farmer('헉… 헉…')}`,
          },
          {
            text: '체력이 바닥나면… 잠깐 쉬면서 조금씩 차오르기를 기다리거나 (게임 1시간에 +2), <b>가방을 열어 음식을 먹으면</b> 바로 회복돼요.<br>밤(오후 6시)에 <b>우리 집 침대</b>에서 자면 가득 차요. 집의 벽난로(+10)·부엌(+5)도 하루 한 번 체력을 채워 줘요.<br>⚠️ <b>주의!</b> 잠을 자지 않고 다음 날 아침이 되면 <b>체력이 회복되지 않아요.</b> 꼭 침대에서 자 주세요.',
            art: `
              <div class="h-scene">
                ${farmer('체력 +2…')}
                ${bubble(`<div class="h-foods">
                  ${['food_bread', 'food_tea', 'food_lunchbox'].map((id) => { const f = getItem(id); return tile(f.icon, `${f.name}<br>+${f.heal}`); }).join('')}
                </div>`, 'tail-left')}
              </div>
              ${flow([tile('🌙', '오후 6시'), tile('🛏️', '침대에서 자기'), tile('⚡', '가득!')], 'small')}`,
          },
          {
            text: '모자와 옷에는 <b>최대 체력</b>을 늘려 주는 옵션이 붙어 있어요. 옷은 <b>우리 집 옷장</b>에서 갈아입어요.<br>같은 세트를 세 벌 모두 입으면 세트 효과까지! 좋은 옷을 입으면 하루에 더 많이 심을 수 있어요.',
            art: `
              <div class="h-clothes">
                ${farmSet.map((c) => `<div class="h-cloth">${note(`MAX 체력 +${c.stamina}`)}<span>${c.icon}</span><small>${c.name}</small></div>`).join('')}
              </div>
              ${bubble(`${SETS.farmer.icon} <b>${SETS.farmer.name}</b> 완성 → ${SETS.farmer.desc}`)}`,
          },
        ],
      },
      {
        id: 'money', label: '돈 모으는 요령',
        pages: [
          {
            text: '수확한 작물은 <b>창고</b>로 바로 들어가요. 작물은 <b>창고에서만</b> 팔 수 있어요 — 창고를 눌러 \'작물 판매\'!<br>메인 퀘스트를 깨면 상금도 받고 직책이 올라 더 좋은 씨앗과 장비가 열려요.',
            art: `${flow([tile('🌾', '수확'), tile('📦', '창고'), tile('💰', '창고에서 판매')])}
              <div class="h-ranks">${['새내기 귀농인', '초보 농부', '마을 일꾼', '마을 반장', '부이장', '마을 이장'].map((r, i) => `<span style="--i:${i}">${r}</span>`).join('')}</div>`,
          },
          {
            text: '밭이 많아지면 체력이 감당이 안 돼요. 그럴 땐 모든 밭에 같은 작물을 키우기보다,<br><b>빨리 자라는 작물과 오래 자라는 비싼 작물을 나눠서</b> 키우면 매일 수확하고 매일 팔 수 있어요.',
            art: `
              <div class="h-plots-wrap">
                <div class="h-plots">${Array.from({ length: 9 }, (_, i) => `<i>${i < 6 ? '🍓' : '🎃'}</i>`).join('')}</div>
                <div class="h-plots">${Array.from({ length: 9 }, (_, i) => `<i>${i % 3 === 0 ? '🥬' : i % 3 === 1 ? '🥔' : '🍅'}</i>`).join('')}</div>
              </div>
              <div class="h-labels">${note('이 줄은 장기 작물 (비싸요)')}${note('이 줄은 단기 작물 (매일 수확)')}</div>
              ${farmer('많…많다.')}`,
          },
          {
            text: '<b>내 밭 팻말</b>을 누르면 밭을 넓힐 수 있어요 (최대 8×8). 메인 퀘스트 보상으로 무료로 넓어지기도 해요.<br>낚시와 광산은 쉬어 가는 콘텐츠예요. 벌이는 농사가 가장 좋아요!',
            art: `
              <div class="h-expand"><div class="g3"></div>${arrow()}<div class="g4"></div>${arrow()}<div class="g6"></div></div>
              ${flow([tile('🌾', '농사 ★★★'), tile('⛏️', '광석 ★★'), tile('🎣', '낚시 ★ (재료)')], 'small')}`,
          },
        ],
      },
    ],
  },
  {
    label: '농사',
    topics: [
      {
        id: 'till', label: '밭 갈기 · 물 주기',
        pages: [
          {
            text: '빈 땅을 <b>클릭</b>하면 호미로 땅을 갈고, 한 번 더 클릭하면 물뿌리개로 물을 줘요.<br>씨앗은 <b>갈고 물까지 준 땅</b>에만 심을 수 있어요.',
            art: flow([tile('🟩', '빈 땅', 'soil0'), tile('⛏️', '갈기', 'soil1'), tile('💧', '물 주기', 'soil2'), tile('🌱', '심기', 'soil2')]),
          },
          {
            text: '작물은 <b>물을 준 날</b>에만 자라요. 물을 주면 그날 <b>시간이 흐르는 만큼 계속</b> 자라고, 밤에 자는 동안에도 자라요.<br>아침이 되면 물이 마르니 다시 주세요. 비 오는 날엔 밭에 물이 저절로 뿌려지니 쉬어도 돼요!',
            art: `
              ${flow([tile('💧', '물 주기'), tile('⏳', '시간이 흐르면'), tile('🌙', '자는 동안도'), tile('🌿', '쑥쑥!')])}
              ${bubble('🌧️ 비 오는 날 = 물 주기 끝!', 'rain')}`,
          },
          {
            text: '농기구는 가방 <b>\'장비\'</b> 탭에서 장착한 것이 자동으로 쓰여요.<br>상점에서 좋은 등급을 사고 대장간에서 강화하면 일이 빨라지고, 낫은 한 번에 더 많이 거둬요. (직책이 올라야 쓸 수 있는 등급도 있어요)',
            art: `
              <div class="h-tiers">${[['낡은', '#8a7b6a'], ['구리', '#c8733a'], ['철', '#b8c0c8'], ['은', '#e4e9f0'], ['금', '#f2c641'], ['무지개', 'linear-gradient(90deg,#ff7b7b,#ffd36b,#7be38a,#6bc8ff,#c78bff)']]
                .map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>
              ${model3d('호미')}`,
            model: ['hoe', () => makeHeldItem(getItem(TOOLS.hoe.itemId), 0xc8733a)],
            side: true,
          },
        ],
      },
      {
        id: 'plant', label: '씨앗 심기 · 수확',
        pages: [
          {
            text: `핫바(1~${HOTBAR_SIZE})에서 씨앗을 고른 뒤 밭을 클릭하면 심어요.<br>씨앗을 고르지 않고 밭을 누르면 <b>가방에 있는 씨앗 중에서 고르는 창</b>이 떠요.`,
            art: `
              ${hotbar(['🌱', '🥕', '', '', ''], 0)}
              ${bubble(`<div class="h-picker"><b>🌱 어떤 씨앗을 심을까요?</b><div>${['lettuce', 'potato', 'carrot', 'tomato'].map((id) => `<span>${CROPS[id].icon}<small>${CROPS[id].name}</small></span>`).join('')}</div></div>`)}`,
          },
          {
            text: '작물마다 <b>다 자라는 시간</b>이 달라요. 물을 준 날에는 시간이 흐르는 만큼 자라니, 아침에 물을 주고 다른 일을 하다 오면 돼요.<br>창을 열어 둔 동안은 시간이 멈추고, 자는 동안의 밤 시간만큼은 더 자라요.',
            art: `<div class="h-table compact">
              <div class="th"><span>작물</span><span>성장 시간</span><span>모종</span><span>판매가</span></div>
              ${Object.values(CROPS).map((c, i) => `<div><span>${c.icon} ${c.name}</span><span>${growText(c.grow)}</span><span>${growText(growSeconds(Object.keys(CROPS)[i], true))}</span><span>${won(c.sellPrice)}</span></div>`).join('')}
            </div>`,
          },
          {
            text: '다 자라면 밭 위에 <b>수확 표시</b>가 뜨고 "다 자랐어요!" 알림도 와요. 클릭하면 낫으로 거둬서 창고로 쏙!<br>수확한 땅은 딱딱하게 굳으니, 다시 심기 전에 한 번 더 갈아 주세요.',
            art: `${model3d('다 자란 토마토')}${bubble('🧺 클릭해서 수확!', 'tail-left')}`,
            model: ['tomato', () => makeCropModel('tomato', 3)],
            side: true,
          },
          {
            text: '자라는 작물을 클릭하면 <b>다 자라기까지 남은 시간 · 판매가 · 예상 수확량</b>을 볼 수 있어요.<br>정보 창의 <b>⏳ 성장 촉진제</b> 버튼을 누르면 바로 다 자라고, <b>🔄 갈아엎기</b>를 두 번 누르면 작물을 없애고 다른 씨앗을 심을 수 있어요 (씨앗은 돌려받지 못해요).<br>할머니의 비료는 들고 작물을 누르면 성장이 15초 빨라져요.',
            art: `
              <div class="h-info">
                <b>🍓 딸기 · ★★★</b>
                <div><span>🌱 자라는 시간</span>${growText(CROPS.strawberry.grow)}</div>
                <div><span>💰 판매가</span>${won(CROPS.strawberry.sellPrice)}</div>
                <div><span>🧺 예상 수확</span>2~3개</div>
              </div>
              ${tile(itemSvg('hourglass'), '촉진제 = 바로 다 자람')}
              ${tile(itemSvg('plow'), '갈아엎기')}`,
          },
        ],
      },
      {
        id: 'seedling', label: '씨앗 vs 모종',
        pages: [
          {
            text: `<b>모종</b>은 씨앗보다 <b>3배 빨리</b> 자라요.<br>오래 걸리는 수박(${growText(CROPS.watermelon.grow)})도 모종으로 심으면 ${growText(growSeconds('watermelon', true))} 만에 수확!`,
            art: `
              <div class="h-compare">
                <div><span>🌰 씨앗</span><i style="--w:100%"></i><b>${growText(CROPS.watermelon.grow)}</b></div>
                <div><span>🌱 모종</span><i class="fast" style="--w:${100 / 3}%"></i><b>${growText(growSeconds('watermelon', true))}</b></div>
              </div>
              ${farmer('훨씬 빠르다!', 'happy')}`,
          },
          {
            text: `모종은 <b>육묘장</b>에서 <b>씨앗 + 토양 흙</b>으로 만들어요.<br>토양 흙은 <b>약탕기</b>에서 일반 흙 ${brewNeed.soil_plain} + 타우린 ${brewNeed.mat_taurine} + 키토산 ${brewNeed.mat_chitosan} 을 달여 만들어요. 타우린 · 키토산은 낚시로 얻어요!`,
            art: `
              <div class="h-recipe">${tile('🪣', '일반 흙')}${plus}${tile('🧪', `타우린 ×${brewNeed.mat_taurine}`)}${plus}${tile('🦀', '키토산')}${arrow()}${tile('🍲', '약탕기')}${arrow()}${tile('🟫', '토양 흙')}</div>
              <div class="h-recipe">${tile('🟫', '토양 흙')}${plus}${tile('🌰', '씨앗')}${arrow()}${tile('🏡', '육묘장')}${arrow()}${tile('🌱', '모종!')}</div>`,
          },
          {
            text: `약탕기(${won(FACILITIES.brewer.price)})와 육묘장(${won(FACILITIES.nursery.price)})은 상점 <b>'시설·흙'</b> 탭에서 사요.<br>사면 <b>우리 집 지하 작업실</b>에 바로 설치돼요. 자세한 건 '집 · 시설' 줄의 <b>지하 작업실</b>을 봐 주세요!`,
            art: `${model3d('육묘장')}${flow([tile('🛒', '상점에서 구매'), tile('🏠', '집 안 계단'), tile('🛠️', '지하 작업실')], 'small')}`,
            model: ['nursery', () => makeNursery()],
            side: true,
          },
        ],
      },
    ],
  },
  {
    label: '집 · 시설',
    topics: [
      {
        id: 'house', label: '우리 집 · 마을회관',
        pages: [
          {
            text: '마을에서 <b>우리 집</b>을 누르면 안으로 들어가요. 문을 누르면 다시 마을로 나가요.<br>카메라 쪽 벽은 낮아져서 방 안이 보여요. 카메라를 돌리면 다른 쪽 벽도 볼 수 있어요.',
            art: `<div class="h-furni">
              ${[['🛏️', '침대', '잠자기'], ['👕', '옷장', '옷 갈아입기'], ['📚', '책장', '도감'], ['📅', '달력', '날짜 · 날씨'],
                ['🔥', '벽난로', '하루 한 번 체력 +10'], ['🍵', '부엌', '하루 한 번 체력 +5'], ['⬇️', '계단', '지하 작업실']]
                .map(([i, n, d]) => tile(i, `<b>${n}</b><br>${d}`)).join('')}
            </div>`,
          },
          {
            text: '잠은 <b>오후 6시</b>부터 침대에서 잘 수 있어요. 자고 일어나면 다음 날 아침 <b>침대 옆</b>에서 눈을 뜨고 체력이 가득!<br>⚠️ <b>저절로 잠들지 않아요.</b> 자지 않고 아침 6시가 되면 그 자리에서 날짜만 바뀌고 <b>체력은 차지 않아요.</b>',
            art: `${flow([tile('🌙', '오후 6시~'), tile('🛏️', '침대에서 자기'), tile('⚡', '체력 가득')])}
              ${flow([tile('🌃', '밤새 놀기'), tile('☀️', '아침 6시'), tile('🪫', '체력 그대로')], 'small')}`,
          },
          {
            text: '<b>마을회관</b>에 들어가면 <b>마을 게시판</b>(퀘스트 창)과 이장 책상이 있어요.<br>새 마을회관이 지어지면 <b>🏆 명예의 전당</b>에서 지금까지의 기록과 도감 달성률을 볼 수 있어요. 메인 퀘스트는 회관 앞의 박 이장님께!',
            art: `${flow([tile('🏛️', '마을회관'), tile('📋', '게시판 = 퀘스트'), tile('🏆', '명예의 전당')])}
              ${bubble('👴 박 이장님은 회관 앞에 서 계신다네')}`,
          },
        ],
      },
      {
        id: 'wardrobe', label: '옷 갈아입기',
        pages: [
          {
            text: '옷은 <b>우리 집 옷장</b>에서만 갈아입어요. 옷장을 누르면 왼쪽엔 지금 입은 모습과 착용 칸, 오른쪽엔 가진 옷이 보여요.<br>가방(I)에서는 지금 입은 옷을 <b>보기만</b> 할 수 있어요.',
            art: `<div class="h-wardrobe">
              <div class="wr-l"><span class="me">🧑‍🌾</span><div>${['🎩', '👕', '👖'].map((i) => `<i>${i}</i>`).join('')}</div></div>
              <div class="wr-r">${farmSet.map((c) => `<span>${c.icon}<small>${c.name}</small></span>`).join('')}<span>👒<small>밀짚모자</small></span></div>
            </div>${note('옷장에서 쏙!')}`,
          },
          {
            text: '옷을 고르면 <b>입기 · 벗기 · 팔기</b>를 할 수 있어요. 옷마다 <b>최대 체력</b>이 늘어나요.<br>옷은 상점 · 대장간에서 사거나 주민 부탁(퀘스트) 보상으로 받아요. 받은 옷은 옷장에 들어가요.',
            art: flow([tile('👕', '옷 고르기'), tile('✨', '입기'), tile('⚡', 'MAX 체력 ↑')]),
          },
          {
            text: '같은 세트를 <b>모자 · 상의 · 하의 세 벌 모두</b> 입으면 세트 효과가 생겨요.',
            art: `<div class="h-table">
              <div class="th"><span>세트</span><span>효과</span></div>
              ${Object.values(SETS).map((s) => `<div><span>${s.icon} ${s.name}</span><span>${s.desc}</span></div>`).join('')}
            </div>`,
          },
        ],
      },
      {
        id: 'cellar', label: '지하 작업실',
        pages: [
          {
            text: `우리 집 안의 <b>계단</b>을 내려가면 지하 작업실이에요.<br>상점 '시설·흙' 탭에서 <b>약탕기 · 육묘장</b>을 사면 빈 자리에 <b>바로 설치</b>돼요 (종류별 ${FACILITIES.brewer.max}칸, 빈 자리는 점선으로 표시).`,
            art: `${model3d('약탕기')}${flow([tile('🛒', '구매'), tile('⬇️', '집 계단'), tile('🛠️', '자동 설치')], 'small')}`,
            model: ['brewer', () => makeBrewer()],
            side: true,
          },
          {
            text: `일반 흙은 상점에서 사면 지하의 <b>흙 상자</b>로 바로 들어가요 (상자 ${SOIL_BOX_COUNT}개 · 상자마다 ${SOIL_BOX_CAP}개).<br>상자가 가득 차면 더 살 수 없어요. 상자를 누르면 얼마나 찼는지 보고, 가방의 흙도 넣을 수 있어요.`,
            art: `<div class="h-crates">${[1, 0.64, 0].map((k) => `<div><i style="height:${k * 100}%"></i><b>${Math.round(k * SOIL_BOX_CAP)}/${SOIL_BOX_CAP}</b></div>`).join('')}</div>
              ${note('🪣 일반 흙 상자')}`,
          },
          {
            text: `제작 시간은 <b>토양 흙 1개당 ${FACILITIES.brewer.seconds}초</b>, <b>모종 1개당 ${FACILITIES.nursery.seconds}초</b>예요. 여러 개를 맡기면 그만큼 오래 걸려요 (한 번에 최대 20개).<br>재료는 <b>가방 · 창고 · 흙 상자</b>에 있는 걸 모두 써요. 창을 열어 둔 동안은 멈추고, 자고 일어나면 끝나 있어요.`,
            art: `
              <div class="h-recipe">${tile('🍲', '약탕기')}${arrow()}${tile('🟫', `토양 흙<br>${FACILITIES.brewer.seconds}초/개`)}</div>
              <div class="h-recipe">${tile('🏡', '육묘장')}${arrow()}${tile('🌱', `모종<br>${FACILITIES.nursery.seconds}초/개`)}</div>
              <div class="h-list"><div>📦 흙 상자<b>일반 흙</b></div><div>🎒 가방<b>모든 재료</b></div><div>🏠 창고<b>모든 재료</b></div></div>`,
          },
        ],
      },
    ],
  },
  {
    label: '낚시',
    topics: [
      {
        id: 'fish_start', label: '낚시 시작하기',
        pages: [
          {
            text: '시냇가의 <b>오 씨</b>가 출출하대요. 감자 3개를 가져다주면 <b>대나무 낚싯대</b>를 줘요.<br>(메인 퀘스트를 3개 깨면 부탁을 받을 수 있어요)',
            art: `${bubble('🎣 오 씨: "감자 세 개만 쪄 먹게 가져다주겠나?"')}${model3d('대나무 낚싯대')}`,
            model: ['rod', () => { const r = getItem('rod_bamboo'); return makeHeldItem(r, r.color); }],
            side: true,
          },
          {
            text: '핫바에서 <b>낚싯대</b>를 고르고 <b>시냇물을 클릭</b>하면 둑으로 걸어가 낚시 자세를 잡아요.<br>낚시 중에 걸어가면 낚싯줄을 감고 그만둬요.',
            art: `${hotbar(['🌱', '🎣', '⛏️', '', ''], 1)}<div class="h-stream">${tile('🧍', '둑')}<div class="water">〰️ 클릭! 〰️</div></div>`,
          },
        ],
      },
      {
        id: 'fish_cast', label: '던지기와 입질',
        pages: [
          {
            text: '파워 게이지가 오르내릴 때 <b>클릭(또는 Space)</b> 으로 던져요.<br>끝까지 꽉 채워 던지면 <b>"완벽!"</b> — 멀리 던질수록 귀한 고기가 잘 물어요.',
            art: `<div class="h-power"><i></i><b>완벽!</b></div>${note('이때 탁!')}${farmer('', 'happy')}`,
          },
          {
            text: '물고기 그림자가 찌 주위를 빙빙 돌며 점점 다가와요. 찌가 톡톡 흔들려도 꾹 참으세요!<br>너무 일찍 당기면 물고기가 놀라서 더 오래 기다려야 해요.',
            art: '<div class="h-pond"><div class="orbit"><i class="shadow"></i></div><div class="bobber"></div></div>' + note('아직… 아직…'),
          },
          {
            text: '찌 위에 <b>❗</b>가 뜨면 바로 클릭! 늦으면 미끼만 먹고 달아나요.<br>좋은 낚싯대일수록 입질이 빨리 오고, 챔질할 여유도 길어요.',
            art: '<div class="h-pond bite"><div class="bobber"></div><span class="alert">❗</span></div>' + bubble('지금이야!'),
          },
        ],
      },
      {
        id: 'fish_game', label: '낚시 미니게임',
        pages: [
          {
            text: '<b>꾹 누르고 있으면</b> 초록 막대가 올라가고, <b>떼면</b> 내려가요.<br>물고기를 초록 막대 안에 붙잡아 두면 오른쪽 게이지가 차올라요.',
            art: `<div class="h-game"><div class="track"><div class="bar"></div><div class="fish">🐟</div></div><div class="prog"><i></i></div></div>
              <div class="h-side-notes">${note('꾹 = 위로 ⬆')}${note('떼기 = 아래로 ⬇')}${note('게이지가 꽉 차면 낚았다!')}</div>`,
          },
          {
            text: '게이지가 가득 차면 낚아요! 반대로 바닥나면 줄이 끊어져요.<br><b>★3 이상</b> 귀한 고기는 가끔 반대쪽 끝으로 확 내달리니 조심하세요.',
            art: `${model3d('황금 잉어 ★★★★★')}<div class="h-stars">${[1, 2, 3, 4, 5].map((g) => `<span>${'★'.repeat(g)}</span>`).join('')}</div>`,
            model: ['goldcarp', () => makeFishModel('fish_goldcarp')],
            side: true,
          },
          {
            text: '잡은 고기는 가방 <b>\'낚시\'</b> 칸에 담겨요. 오 씨에게 가져가면 물고기는 <b>타우린</b>, 게는 <b>키토산</b>으로 바꿔 줘요. 무겁고 귀할수록 많이!<br>오 씨가 파는 좋은 낚싯대는 입질이 빠르고 막대도 커져요.',
            art: `
              <div class="h-recipe">${tile('🐟', '물고기')}${arrow()}${tile('🧪', '타우린')}</div>
              <div class="h-recipe">${tile('🦀', '게')}${arrow()}${tile('🧪', '키토산')}</div>
              <div class="h-list">${RODS.slice(1).map((r) => `<div>🎣 ${r.name}<b>${won(r.price)}</b></div>`).join('')}</div>`,
          },
        ],
      },
    ],
  },
  {
    label: '채굴',
    topics: [
      {
        id: 'mine_enter', label: '광산 들어가기',
        pages: [
          {
            text: '<b>윤 씨 아주머니</b>의 부탁(감자 5 + 무 5)을 들어주면 마을 동쪽 끝 <b>광산</b>에 들어갈 수 있어요.<br>(메인 퀘스트를 5개 깨면 부탁을 받을 수 있어요)',
            art: `${bubble('👩‍🦱 "우리 남편이 광산에서 일한답니다. 얘기해 둘게요!"')}${flow([tile('🏘️', '마을'), tile('🚪', '광산 입구'), tile('⛏️', '광산 1층')])}`,
          },
          {
            text: '광산 안의 <b>한 반장</b>에게 말을 걸면 <b>낡은 곡괭이</b>를 줘요. 캐낸 광석도 한 반장이 사 줘요.<br>옆의 <b>돌쇠</b>는 더 좋은 곡괭이를 팔아요.',
            art: `<div class="h-npcs">${bubble('👷 한 반장<br><small>곡괭이 지급 · 광석 매입</small>')}${bubble('🧑‍🔧 돌쇠<br><small>곡괭이 판매</small>')}</div>`,
          },
        ],
      },
      {
        id: 'mine_dig', label: '광석 캐기',
        pages: [
          {
            text: '핫바에서 <b>곡괭이</b>를 고르고 <b>광맥을 클릭</b>하면 캐요. 한 번 캘 때마다 체력이 2~3 닳아요.<br>다 캐면 광맥은 깨끗이 사라져요.',
            art: `${model3d('금 광맥')}${stamBar(70, 100, '⚡ -2')}`,
            model: ['ore_gold', () => { const n = makeOreNode(); setOreNode(n, 'ore_gold'); return n; }],
            side: true,
          },
          {
            text: '단단한 광석은 <b>좋은 곡괭이</b>가 있어야 캘 수 있어요.',
            art: `<div class="h-table">
              <div class="th"><span>광석</span><span>필요한 곡괭이</span><span>판매가</span></div>
              ${ORE_ORDER.map((id) => { const o = ORES[id]; return `<div><span>${o.icon} ${o.name}</span><span>${PICKAXES[o.tier].name}</span><span>${won(o.price)}</span></div>`; }).join('')}
            </div>`,
          },
          {
            text: '돌쇠에게 좋은 곡괭이를 사면 <b>더 빨리</b> 캐고, 광석이 <b>여러 개</b> 나올 때도 많아요.',
            art: `<div class="h-table">
              <div class="th"><span>곡괭이</span><span>가격</span><span>캐는 시간</span><span>추가 광석</span></div>
              ${PICKAXES.map((p) => `<div><span>⛏️ ${p.name}</span><span>${p.price ? won(p.price) : '한 반장'}</span><span>${p.time}초</span><span>${Math.round(p.extra * 100)}%</span></div>`).join('')}
            </div>`,
          },
        ],
      },
      {
        id: 'mine_floor', label: '층과 광석',
        pages: [
          {
            text: '광산은 <b>4층</b>까지 있어요. 동쪽 끝 사다리로 내려가고, 서쪽 사다리로 한 층씩 올라와요. 2층부터는 <b>🛗 승강기</b>를 타면 바로 1층(입구)으로!<br>깊이 갈수록 귀한 광석이 많고, <b>3층부터는 석탄 · 구리가 나오지 않아요.</b>',
            art: `<div class="h-floors">
              <div><b>1층</b><span>⚫🟠🟠⚪🩶</span></div>
              <div><b>2층</b><span>⚫🟠⚪⚪🩶🟡</span></div>
              <div><b>3층</b><span>⚪⚪🩶🩶🟡💎</span></div>
              <div><b>4층</b><span>⚪🩶🩶🟡🟡💎</span></div>
            </div>${note('깊을수록 반짝반짝!')}`,
          },
          {
            text: '캐낸 광맥은 사라진 채로 있다가, <b>약 2분마다 광산 전체가 초기화</b>되어 모든 층에 다시 가득 생겨요. 남은 시간은 오른쪽 위에 보여요.<br>초기화될 때 2~4층에 있으면 <b>1층(입구)으로 돌아와요</b>.<br>광산 벌이는 농사보다 적어요. 작물이 자라는 동안 쉬어 가는 마음으로 즐겨 보세요!',
            art: `${flow([tile('🪨', '캐기'), tile('✨', '사라짐'), tile('⏳', '시간이 지나면'), tile('🪨', '다시 생김')])}${farmer('쉬엄쉬엄~', 'happy')}`,
          },
        ],
      },
    ],
  },
];

const TOPICS = Object.fromEntries(ROWS.flatMap((r) => r.topics.map((t) => [t.id, t])));
const ARROW_SVG = '<svg viewBox="0 0 60 36" aria-hidden="true"><path d="M4 13h30V4l22 14-22 14v-9H4z"/></svg>';

let view = { topic: null, page: 0 };

function setTitle(body, text) {
  const h = body.closest('.modal')?.querySelector('.modal-head h2');
  if (h) h.textContent = text;
}

function renderMenu(body) {
  setTitle(body, '기본 도움말');
  body.innerHTML = `
    <div class="h-menu">
      ${ROWS.map((r, i) => `
        <div class="h-row">
          <div class="h-row-label">${r.label}</div>
          <div class="h-row-btns">${r.topics.map((t) => `<button class="h-btn ${i % 2 ? 'teal' : 'gold'}" data-topic="${t.id}">${t.label}</button>`).join('')}</div>
        </div>`).join('')}
    </div>
    <button class="h-cheat-link" title="치트 코드 보기">🔑 치트</button>`;
  body.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => {
    view = { topic: b.dataset.topic, page: 0 };
    AudioManager.sfx('click');
    refreshModal('help');
  }));
  body.querySelector('.h-cheat-link').onclick = () => {
    view = { topic: CHEAT, page: 0 };
    AudioManager.sfx('click');
    refreshModal('help');
  };
}

/* ───── 치트 코드 안내 (목록 오른쪽 아래 작은 버튼) ───── */
const CHEAT = '__cheat';
const CHEATS = [
  { word: 'money', icon: '💰', title: '돈만 받기', items: ['돈 <b>100억 원</b>', '퀘스트 · 장비 · 직책 등 <b>다른 것은 그대로</b>'] },
  {
    word: 'farmer', icon: '🧑‍🌾', title: '메인 퀘스트 끝내기',
    items: ['<b>메인 퀘스트</b> 모두 완료 (엔딩 본 것으로 · 새 마을회관 완공)', '직책 <b>마을 이장</b>', `농기구 최종 장비 <b>+${MAX_ENHANCE}</b> · 모든 옷 + 이장 옷 세트 착용`,
      '황금 낚싯대 · 다이아 곡괭이 · 밭 최대 크기', '도감 모두 공개 · 돈 <b>10억 원</b>'],
  },
  {
    word: 'master', icon: '👑', title: '전부 다',
    items: ['<b>farmer</b> 의 모든 내용', '<b>서브 퀘스트</b>도 모두 완료', '씨앗 · 작물 · 음식 · 재료 · 광석 등 <b>모든 아이템 한 스택씩</b> (물고기 · 게는 한 마리씩)', '지하 흙 상자 가득'],
  },
];

function renderCheat(body) {
  setTitle(body, '치트 코드');
  body.innerHTML = `
    <div class="h-cheat">
      <p class="h-cheat-how">게임 화면에서 창을 모두 닫고 <b>키보드로 단어를 그대로 치면</b> 바로 발동해요. (입력 칸 없이 그냥 타자)</p>
      <div class="h-cheat-list">${CHEATS.map((c) => `
        <div class="h-cheat-card">
          <div class="h-cheat-head"><span>${c.icon}</span><kbd>${c.word}</kbd><b>${c.title}</b></div>
          <ul>${c.items.map((t) => `<li>${t}</li>`).join('')}</ul>
        </div>`).join('')}</div>
      <p class="h-cheat-warn">⚠️ farmer · master 는 퀘스트 진행이 끝난 상태로 바로 저장돼서 <b>되돌릴 수 없어요.</b> 처음부터 즐기고 싶다면 쓰지 마세요!</p>
    </div>
    <div class="h-nav"><span></span><div class="h-mid"><button class="h-back">☰ 목록으로</button></div><span></span></div>`;
  body.querySelector('.h-back').onclick = () => { view.topic = null; AudioManager.sfx('click'); refreshModal('help'); };
}

function renderPage(body) {
  const t = TOPICS[view.topic];
  const p = t.pages[view.page];
  const last = t.pages.length - 1;
  setTitle(body, t.label);
  body.innerHTML = `
    <div class="h-card ${p.side ? 'side' : ''}">
      <div class="h-text">${p.text}</div>
      <div class="h-art">${p.art}</div>
    </div>
    <div class="h-nav">
      <button class="h-arrow-btn prev" ${view.page === 0 ? 'disabled' : ''} title="이전 (←)">${ARROW_SVG}</button>
      <div class="h-mid">
        <div class="h-dots">${t.pages.map((_, i) => `<i class="${i === view.page ? 'on' : ''}"></i>`).join('')}</div>
        <button class="h-back">☰ 목록으로</button>
      </div>
      <button class="h-arrow-btn next" ${view.page === last ? 'disabled' : ''} title="다음 (→)">${ARROW_SVG}</button>
    </div>`;
  body.querySelector('.prev').onclick = () => go(-1);
  body.querySelector('.next').onclick = () => go(1);
  body.querySelector('.h-back').onclick = () => { view.topic = null; AudioManager.sfx('click'); refreshModal('help'); };
  if (p.model) {
    const [k, make] = p.model;
    BookPreview.mount(body.querySelector('.h-3d'), `help:${k}`, make);
  }
}

function go(d) {
  const t = TOPICS[view.topic];
  if (!t) return;
  const n = Math.max(0, Math.min(t.pages.length - 1, view.page + d));
  if (n === view.page) return;
  view.page = n;
  AudioManager.sfx('click');
  refreshModal('help');
}

function render(body) {
  if (view.topic === CHEAT) renderCheat(body);
  else if (view.topic && TOPICS[view.topic]) renderPage(body);
  else renderMenu(body);
}

/** 도움말이 열려 있는 동안 ← → 로 장 넘기기, Backspace 로 목록 */
function onKeyDown(e) {
  if (currentModal() !== 'help' || !view.topic) return;
  if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'Backspace') { view.topic = null; refreshModal('help'); }
  else return;
  e.preventDefault();
}

export const HelpUI = {
  /** topic 을 주면 그 주제의 첫 장부터 */
  open(topic = null) {
    view = { topic, page: 0 };
    window.addEventListener('keydown', onKeyDown);
    openModal('help', '기본 도움말', render, {
      cls: 'help-board',
      onClose: () => window.removeEventListener('keydown', onKeyDown),
    });
  },
  close() {
    if (currentModal() === 'help') closeModal();
  },
};
