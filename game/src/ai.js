// ai.js — the Luna opponent's brain. One job: choose the AI's next action.
// The AI is readable and counterable: it removes your biggest threat when it
// can, guards when its life is low, goes face when lethal is on the board,
// and otherwise trades efficiently. Returns one action at a time so the
// caller can pace it visibly; returns null when the AI is done.
import { canPlayCard, guardIndexes, otherSide, sideState, playCard, attack } from './state.js';
import { defById } from './cards.js';

// Action shapes:
//   { type: 'play', handIndex, target? }        target only for spells
//   { type: 'attack', boardIndex, target }      target { kind:'face' } | { kind:'creature', index }
//   null = done
//
// Difficulty: 'easy' misplay often, 'normal' pure heuristic, 'hard'
// heuristic + a 1-ply lookahead that scores the board after each candidate
// action and takes the best one.
export function chooseNextAiAction(state, difficulty = 'normal') {
  const heuristic = chooseHeuristicAction(state);
  if (difficulty === 'easy') {
    // Easy Luna often misplays: random legal action, or ends the turn early.
    const legal = listLegalActions(state);
    if (legal.length > 0 && Math.random() < 0.45) {
      return legal[Math.floor(Math.random() * legal.length)];
    }
    if (Math.random() < 0.15) return null;
    return heuristic;
  }
  if (difficulty !== 'hard') return heuristic;
  const legal = listLegalActions(state);
  if (legal.length === 0) return null;
  let best = null, bestScore = -Infinity;
  for (const action of legal) {
    const clone = cloneState(state);
    applyToClone(clone, action);
    const score = evaluateBoard(clone, 'ai');
    if (score > bestScore) { bestScore = score; best = action; }
  }
  return best || heuristic;
}

function listLegalActions(state) {
  const actions = [];
  const ai = state.ai;
  for (let i = 0; i < ai.hand.length; i++) {
    if (!canPlayCard(state, 'ai', i)) continue;
    const card = ai.hand[i];
    if (card.kind === 'creature') { actions.push({ type: 'play', handIndex: i }); continue; }
    actions.push({ type: 'play', handIndex: i, target: { kind: 'face' } });
    for (let j = 0; j < state.player.board.length; j++) {
      actions.push({ type: 'play', handIndex: i, target: { kind: 'creature', index: j } });
    }
  }
  const guards = guardIndexes(state, 'player');
  ai.board.forEach((c, i) => {
    if (!c.canAttack) return;
    if (guards.length === 0) actions.push({ type: 'attack', boardIndex: i, target: { kind: 'face' } });
    for (const g of guards) actions.push({ type: 'attack', boardIndex: i, target: { kind: 'creature', index: g } });
    if (guards.length === 0) {
      for (let j = 0; j < state.player.board.length; j++) {
        actions.push({ type: 'attack', boardIndex: i, target: { kind: 'creature', index: j } });
      }
    }
  });
  return actions;
}

// Plain-data clone (rng is shared by reference; draws inside the lookahead
// only reshuffle, which the shared rng handles deterministically enough).
function cloneState(state) {
  const copy = JSON.parse(JSON.stringify({
    player: state.player, ai: state.ai, turn: state.turn,
    turnNumber: state.turnNumber, phase: state.phase, winner: state.winner,
    log: state.log.slice(-4), stats: state.stats,
  }));
  copy.rng = state.rng;
  copy.seed = state.seed;
  return copy;
}

function applyToClone(clone, action) {
  if (action.type === 'play') playCardClone(clone, action);
  else attackClone(clone, action);
}

// The clone is plain data, so reuse the real rules: playCard/attack only
// touch state fields, so they run unchanged on the clone object.
function playCardClone(clone, action) { playCard(clone, 'ai', action.handIndex, action.target); }
function attackClone(clone, action) { attack(clone, 'ai', action.boardIndex, action.target); }

// Board evaluation from `side`'s point of view: life matters most, then
// board presence, then hand size and mana efficiency.
function evaluateBoard(state, side) {
  const me = sideState(state, side);
  const foe = sideState(state, otherSide(side));
  if (state.phase === 'over') return state.winner === side ? 10000 : -10000;
  const boardValue = (s) => s.board.reduce((sum, c) => sum + c.atk * 2 + c.hp, 0);
  return (me.life - foe.life) * 4
    + boardValue(me) - boardValue(foe)
    + me.hand.length * 0.5
    + (me.mana === 0 ? 1 : 0);
}

function chooseHeuristicAction(state) {
  const ai = state.ai;
  const player = state.player;
  if (state.phase === 'over') return null;

  const spellDamage = (defId) => (defId === 'sunburst' ? 3 : defId === 'moonbeam' ? 2 : defId === 'eclipse' ? 5 : 0);

  // 1. Lethal check: face damage on board + a burn spell in hand.
  const faceDamage = ai.board.filter((c) => c.canAttack).reduce((sum, c) => sum + c.atk, 0);
  const guards = guardIndexes(state, 'player');
  if (guards.length === 0 && faceDamage >= player.life) {
    const attacker = ai.board.findIndex((c) => c.canAttack);
    if (attacker >= 0) return { type: 'attack', boardIndex: attacker, target: { kind: 'face' } };
  }

  // 2. Remove the player's biggest threat with a spell, if it kills it.
  const threatIndex = player.board.reduce((best, c, i) => (best < 0 || c.atk > player.board[best].atk ? i : best), -1);
  if (threatIndex >= 0) {
    const threat = player.board[threatIndex];
    for (let i = 0; i < ai.hand.length; i++) {
      const card = ai.hand[i];
      if (card.kind === 'spell' && card.cost <= ai.mana && spellDamage(card.defId) >= threat.hp) {
        return { type: 'play', handIndex: i, target: { kind: 'creature', index: threatIndex } };
      }
    }
  }

  // 3. Play cards on curve: biggest affordable first; prefer Guard when low on life.
  let bestPlay = -1;
  for (let i = 0; i < ai.hand.length; i++) {
    const card = ai.hand[i];
    if (!canPlayCard(state, 'ai', i)) continue;
    const lowLife = ai.life <= 12;
    const score = card.cost * 10
      + (card.keyword === 'Guard' && lowLife ? 25 : 0)
      + (card.kind === 'creature' ? card.atk + card.hp : 0)
      + (card.defId === 'moon-pup' ? 4 : 0);
    if (bestPlay < 0 || score > bestPlay.score) bestPlay = { index: i, score };
  }
  if (bestPlay !== -1) {
    const card = ai.hand[bestPlay.index];
    if (card.kind === 'creature') return { type: 'play', handIndex: bestPlay.index };
    // Spells with no good creature target go face late, or at a big threat.
    if (threatIndex >= 0 && spellDamage(card.defId) > 0) {
      return { type: 'play', handIndex: bestPlay.index, target: { kind: 'creature', index: threatIndex } };
    }
    if (state.turnNumber >= 2) return { type: 'play', handIndex: bestPlay.index, target: { kind: 'face' } };
    // Early game: hold the burn, play something else instead — fall through to attacks.
    if (ai.hand.some((c, i) => i !== bestPlay.index && c.kind === 'creature' && canPlayCard(state, 'ai', i))) {
      // handled next call by the loop; avoid an infinite hold by playing the next best creature
      const next = ai.hand.findIndex((c, i) => i !== bestPlay.index && c.kind === 'creature' && canPlayCard(state, 'ai', i));
      return { type: 'play', handIndex: next };
    }
  }

  // 4. Attacks: lethal face first, then favourable trades, then face.
  const attackers = ai.board.map((c, i) => ({ c, i })).filter((a) => a.c.canAttack);
  if (attackers.length === 0) return null;
  if (guards.length === 0) {
    const total = attackers.reduce((s, a) => s + a.c.atk, 0);
    if (total >= player.life) return { type: 'attack', boardIndex: attackers[0].i, target: { kind: 'face' } };
  }
  // Favourable trade: my creature survives, theirs dies.
  for (const a of attackers) {
    for (let j = 0; j < player.board.length; j++) {
      const d = player.board[j];
      if (guards.length > 0 && !guards.includes(j)) continue;
      if (d.hp <= a.c.atk && d.atk < a.c.hp) return { type: 'attack', boardIndex: a.i, target: { kind: 'creature', index: j } };
    }
  }
  // Attack a Guard with the smallest creature that can kill it.
  if (guards.length > 0) {
    for (const g of guards) {
      const d = player.board[g];
      const killer = attackers.find((a) => a.c.atk >= d.hp);
      if (killer) return { type: 'attack', boardIndex: killer.i, target: { kind: 'creature', index: g } };
      // Otherwise chip the guard with the weakest attacker.
      const weakest = attackers.reduce((w, a) => (a.c.atk < w.c.atk ? a : w), attackers[0]);
      return { type: 'attack', boardIndex: weakest.i, target: { kind: 'creature', index: g } };
    }
  }
  // No good trade: go face with the biggest attacker.
  const biggest = attackers.reduce((b, a) => (a.c.atk > b.c.atk ? a : b), attackers[0]);
  return { type: 'attack', boardIndex: biggest.i, target: { kind: 'face' } };
}

// Greedy auto-player used by the demo/shot autoplay: same brain, either side.
export function chooseNextAutoAction(state, side, skill) {
  const me = sideState(state, side);
  const foe = sideState(state, otherSide(side));
  if (state.phase === 'over') return null;
  const spellDamage = (defId) => (defId === 'sunburst' ? 3 : defId === 'moonbeam' ? 2 : defId === 'eclipse' ? 5 : 0);
  const guards = guardIndexes(state, otherSide(side));

  if (skill === 'bad') {
    // Weak play: only the cheapest card, never attacks face, never trades up.
    const cheapest = me.hand.reduce((best, c, i) => {
      if (!canPlayCard(state, side, i)) return best;
      return best < 0 || c.cost < me.hand[best].cost ? i : best;
    }, -1);
    if (cheapest >= 0 && me.hand[cheapest].kind === 'creature') {
      return { type: 'play', handIndex: cheapest };
    }
    return null;
  }

  // Good play: reuse the AI brain for the AI side; mirror it for the player.
  if (side === 'ai') return chooseNextAiAction(state);
  const faceDamage = me.board.filter((c) => c.canAttack).reduce((s, c) => s + c.atk, 0);
  if (guards.length === 0 && faceDamage >= foe.life) {
    const a = me.board.findIndex((c) => c.canAttack);
    if (a >= 0) return { type: 'attack', boardIndex: a, target: { kind: 'face' } };
  }
  const threatIndex = foe.board.reduce((best, c, i) => (best < 0 || c.atk > foe.board[best].atk ? i : best), -1);
  if (threatIndex >= 0) {
    for (let i = 0; i < me.hand.length; i++) {
      const card = me.hand[i];
      if (card.kind === 'spell' && card.cost <= me.mana && spellDamage(card.defId) >= foe.board[threatIndex].hp) {
        return { type: 'play', handIndex: i, target: { kind: 'creature', index: threatIndex } };
      }
    }
  }
  let bestPlay = -1;
  for (let i = 0; i < me.hand.length; i++) {
    const card = me.hand[i];
    if (!canPlayCard(state, side, i)) continue;
    const score = card.cost * 10 + (card.kind === 'creature' ? card.atk + card.hp : 0);
    if (bestPlay < 0 || score > bestPlay.score) bestPlay = { index: i, score };
  }
  if (bestPlay !== -1) {
    const card = me.hand[bestPlay.index];
    if (card.kind === 'creature') return { type: 'play', handIndex: bestPlay.index };
    if (threatIndex >= 0) return { type: 'play', handIndex: bestPlay.index, target: { kind: 'creature', index: threatIndex } };
    if (state.turnNumber >= 2) return { type: 'play', handIndex: bestPlay.index, target: { kind: 'face' } };
  }
  const attackers = me.board.map((c, i) => ({ c, i })).filter((a) => a.c.canAttack);
  if (attackers.length === 0) return null;
  for (const a of attackers) {
    for (let j = 0; j < foe.board.length; j++) {
      const d = foe.board[j];
      if (guards.length > 0 && !guards.includes(j)) continue;
      if (d.hp <= a.c.atk && d.atk < a.c.hp) return { type: 'attack', boardIndex: a.i, target: { kind: 'creature', index: j } };
    }
  }
  if (guards.length > 0) {
    const g = guards[0];
    const d = foe.board[g];
    const killer = attackers.find((a) => a.c.atk >= d.hp);
    if (killer) return { type: 'attack', boardIndex: killer.i, target: { kind: 'creature', index: g } };
    return { type: 'attack', boardIndex: attackers[0].i, target: { kind: 'creature', index: g } };
  }
  const biggest = attackers.reduce((b, a) => (a.c.atk > b.c.atk ? a : b), attackers[0]);
  return { type: 'attack', boardIndex: biggest.i, target: { kind: 'face' } };
}
