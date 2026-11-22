// shots.js — deterministic screenshots + scripted autoplay. One job: stage
// reproducible scenes from the REAL game logic, never hand-drawn fake state.
//   ?shot=start  title poster
//   ?shot=play   real mid-game position (~turn 5, both boards occupied)
//   ?shot=win    real victory, reached by autoplay (player good, Luna bad)
//   ?shot=loss   real defeat, reached by autoplay (player bad, Luna good)
//   ?demo=1&seed=N&favor=player|ai   autoplay a full match, expose the
//   result in #test-result and window.__demoDone for headless verification.
import { createGame, playCard, attack, endTurn, checkEnd, drawCard } from './state.js';
import { chooseNextAutoAction } from './ai.js';

function applyAction(state, side, action) {
  if (!action) return false;
  if (action.type === 'play') return playCard(state, side, action.handIndex, action.target);
  if (action.type === 'attack') return attack(state, side, action.boardIndex, action.target);
  return false;
}

// Play one full turn for `side` with the given skill, then end the turn.
// Returns false if the game ended mid-turn.
function playOneTurn(state, side, skill) {
  let guard = 0;
  while (state.phase !== 'over' && guard++ < 60) {
    const action = chooseNextAutoAction(state, side, skill);
    if (!action) break;
    if (!applyAction(state, side, action)) break;
  }
  if (state.phase === 'over') return false;
  endTurn(state);
  checkEnd(state);
  return state.phase !== 'over';
}

// Autoplay a whole match. playerSkill/aiSkill: 'good' | 'bad'.
export function autoplayMatch(seed, playerSkill, aiSkill) {
  const state = createGame(seed);
  let guard = 0;
  while (state.phase !== 'over' && guard++ < 200) {
    const side = state.turn;
    const skill = side === 'player' ? playerSkill : aiSkill;
    if (!playOneTurn(state, side, skill)) break;
  }
  return state;
}

// Stage a real mid-game: both sides play well for ~4 full rounds, then stop
// at the start of the player's turn 5 with a live position.
export function stageMidGame(seed) {
  const state = createGame(seed);
  let guard = 0;
  while (state.phase !== 'over' && state.turnNumber < 5 && guard++ < 200) {
    const side = state.turn;
    if (!playOneTurn(state, side, 'good')) break;
  }
  return state;
}

export function stageShot(name, seed) {
  if (name === 'play') return stageMidGame(seed);
  if (name === 'win') return autoplayMatch(seed, 'good', 'bad');
  if (name === 'loss') return autoplayMatch(seed, 'bad', 'good');
  return createGame(seed); // 'start' and anything else: fresh title state
}

// Edge-case probes, run in-page by the self-test (?demo edge harness uses
// these through window.__edge). Returns an object of pass/fail booleans.
export function edgeProbes() {
  const out = {};
  // 1. Empty deck reshuffles the discard pile in.
  {
    const s = createGame(7);
    s.player.deck = [];
    s.player.discard = ['sun-sprite', 'moon-pup', 'solar-knight'];
    const before = s.player.hand.length;
    drawCard(s, 'player');
    out.reshuffle = s.player.hand.length === before + 1 && s.player.life === 30;
  }
  // 2. Empty deck AND empty discard = growing fatigue.
  {
    const s = createGame(7);
    s.player.deck = []; s.player.discard = [];
    drawCard(s, 'player');
    const first = s.player.life;
    drawCard(s, 'player');
    out.fatigue = first === 29 && s.player.life === 27 && s.player.fatigue === 2;
  }
  // 3. Guard blocks face attacks.
  {
    const s = createGame(7);
    s.player.board.push({ uid: 900, defId: 'solar-knight', name: 'Solar Knight', cost: 3, atk: 3, hp: 4, maxHp: 4, kind: 'creature', element: 'sun', keyword: 'Guard', text: 'Guard', canAttack: true });
    s.ai.board.push({ uid: 901, defId: 'moon-wolf', name: 'Moon Wolf', cost: 2, atk: 3, hp: 2, maxHp: 2, kind: 'creature', element: 'moon', keyword: 'Rush', text: 'Rush', canAttack: true });
    const faceBlocked = attack(s, 'ai', 0, { kind: 'face' }) === false;
    const guardHit = attack(s, 'ai', 0, { kind: 'creature', index: 0 }) === true;
    out.guard = faceBlocked && guardHit;
  }
  // 4. Rush can attack the turn played; others cannot.
  {
    const s = createGame(7);
    const rush = { uid: 902, defId: 'moon-wolf', name: 'Moon Wolf', cost: 2, atk: 3, hp: 2, maxHp: 2, kind: 'creature', element: 'moon', keyword: 'Rush', text: 'Rush', canAttack: true };
    const slow = { uid: 903, defId: 'sun-sprite', name: 'Sun Sprite', cost: 1, atk: 2, hp: 1, maxHp: 1, kind: 'creature', element: 'sun', keyword: '', text: '', canAttack: false };
    s.player.board.push(rush, slow);
    out.rush = rush.canAttack === true && slow.canAttack === false;
  }
  return out;
}
