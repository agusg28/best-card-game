// state.js — game state, deck, and rules. One job: the rules engine.
// Pure-ish: every function takes the state and mutates it in one legal step,
// appending a line to state.log. No DOM, no audio, no AI here.
import { buildDeck, defById } from './cards.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextUid = 1;

export function makeCreature(defId, rng) {
  const def = defById(defId);
  return {
    uid: nextUid++, defId, name: def.name, cost: def.cost,
    atk: def.atk, hp: def.hp, maxHp: def.hp, kind: 'creature',
    element: def.element, keyword: def.keyword, text: def.text,
    canAttack: def.keyword === 'Rush',
  };
}

export function makeHandCard(defId) {
  const def = defById(defId);
  return {
    uid: nextUid++, defId, name: def.name, cost: def.cost,
    atk: def.atk, hp: def.hp, kind: def.kind,
    element: def.element, keyword: def.keyword, text: def.text,
  };
}

function makeSide(rng, openingHand) {
  const side = {
    life: 30, maxLife: 30, mana: 0, maxMana: 0,
    deck: buildDeck(rng), hand: [], board: [], discard: [],
    fatigue: 0,
  };
  for (let i = 0; i < openingHand; i++) drawCardInto(side, true);
  return side;
}

export function createGame(seed) {
  nextUid = 1;
  const rng = mulberry32(seed);
  const state = {
    seed, rng,
    player: makeSide(rng, 3),
    ai: makeSide(rng, 4),
    turn: 'player', turnNumber: 1,
    phase: 'play', winner: null,
    log: ['The duel begins. Sol strikes first.'],
    stats: { turns: 0, damageDealt: 0, cardsPlayed: 0, damageByCard: {} },
    busy: false,
  };
  state.player.maxMana = 1; state.player.mana = 1;
  // AI starts at 0: its first startTurn raises it to 1, so both sides stay
  // on the same mana curve (player 1, Luna 1, player 2, Luna 2, ...).
  state.ai.maxMana = 0; state.ai.mana = 0;
  return state;
}

export function otherSide(side) { return side === 'player' ? 'ai' : 'player'; }
export function sideState(state, side) { return side === 'player' ? state.player : state.ai; }
export function sideName(side) { return side === 'player' ? 'Sol (you)' : 'Luna'; }

function log(state, line) {
  state.log.push(line);
  if (state.log.length > 40) state.log.shift();
}

// Draw one card for a side. Empty deck reshuffles the discard pile in;
// if the discard is also empty, fatigue damage grows 1, 2, 3...
export function drawCardInto(side, silent) {
  if (side.deck.length === 0) {
    if (side.discard.length > 0) {
      side.deck = side.discard;
      side.discard = [];
      // Shuffle the reshuffled deck with Math.random-independent Fisher-Yates
      // using a fresh deterministic pass is impossible here without rng, so
      // the caller passes rng via side._rng when available.
      if (side._rng) {
        for (let i = side.deck.length - 1; i > 0; i--) {
          const j = Math.floor(side._rng() * (i + 1));
          [side.deck[i], side.deck[j]] = [side.deck[j], side.deck[i]];
        }
      }
      return drawCardInto(side, silent);
    }
    side.fatigue += 1;
    side.life -= side.fatigue;
    return { fatigue: side.fatigue };
  }
  const defId = side.deck.pop();
  if (side.hand.length < 10) side.hand.push(makeHandCard(defId));
  return { card: defId };
}

export function drawCard(state, side) {
  const s = sideState(state, side);
  s._rng = state.rng;
  const result = drawCardInto(s);
  delete s._rng;
  if (result && result.fatigue) {
    log(state, `${sideName(side)} takes ${result.fatigue} fatigue damage!`);
    checkEnd(state);
  }
  return result;
}

// Final score: damage + surviving life + win bonus, minus a small per-turn cost.
export function finalScore(state) {
  const win = state.winner === 'player' ? 300 : 0;
  return Math.max(0, state.stats.damageDealt * 10 + Math.max(0, state.player.life) * 5 + win - state.stats.turns * 2);
}

export function mvpCard(state) {
  let best = null, bestDmg = 0;
  for (const [name, dmg] of Object.entries(state.stats.damageByCard)) {
    if (dmg > bestDmg) { best = name; bestDmg = dmg; }
  }
  return best ? { name: best, damage: bestDmg } : null;
}

function recordDamage(state, sourceName, amount, toAi) {
  if (!toAi) return;
  state.stats.damageDealt += amount;
  state.stats.damageByCard[sourceName] = (state.stats.damageByCard[sourceName] || 0) + amount;
}

export function startTurn(state, side) {
  const s = sideState(state, side);
  s.maxMana = Math.min(10, s.maxMana + 1);
  s.mana = s.maxMana;
  for (const c of s.board) c.canAttack = true;
  drawCard(state, side);
  if (side === 'player') state.stats.turns = state.turnNumber;
  log(state, `${sideName(side)} — turn ${state.turnNumber}, ${s.mana} mana.`);
}

function dealDamageToCreature(state, targetSide, index, amount, sourceName) {
  const s = sideState(state, targetSide);
  const c = s.board[index];
  if (!c) return false;
  c.hp -= amount;
  recordDamage(state, sourceName, amount, targetSide === 'ai');
  log(state, `${sourceName} hits ${c.name} for ${amount}.`);
  if (c.hp <= 0) {
    s.board.splice(index, 1);
    s.discard.push(c.defId);
    log(state, `${c.name} is destroyed.`);
  }
  return true;
}

function dealDamageToFace(state, targetSide, amount, sourceName) {
  const s = sideState(state, targetSide);
  s.life -= amount;
  recordDamage(state, sourceName, amount, targetSide === 'ai');
  log(state, `${sourceName} hits ${sideName(targetSide)} for ${amount}.`);
  checkEnd(state);
}

export function checkEnd(state) {
  if (state.phase === 'over') return;
  if (state.player.life <= 0 && state.ai.life <= 0) {
    state.winner = 'player'; // simultaneous lethal favours the attacker of record: the player
  } else if (state.ai.life <= 0) {
    state.winner = 'player';
  } else if (state.player.life <= 0) {
    state.winner = 'ai';
  }
  if (state.winner) {
    state.phase = 'over';
    state.stats.turns = state.turnNumber;
    log(state, state.winner === 'player' ? 'VICTORY — the Moon sets!' : 'DEFEAT — the Sun sets.');
  }
}

// Targets: { kind: 'face' } or { kind: 'creature', index }
export function guardIndexes(state, side) {
  const s = sideState(state, side);
  const guards = [];
  s.board.forEach((c, i) => { if (c.keyword === 'Guard') guards.push(i); });
  return guards;
}

export function canPlayCard(state, side, handIndex) {
  const s = sideState(state, side);
  const card = s.hand[handIndex];
  if (!card) return false;
  if (card.cost > s.mana) return false;
  if (card.kind === 'creature' && s.board.length >= 7) return false;
  return true;
}

// Play a hand card. Spells need a target: { kind:'face' } or { kind:'creature', index } on the ENEMY side.
export function playCard(state, side, handIndex, target) {
  const s = sideState(state, side);
  const card = s.hand[handIndex];
  if (!card || !canPlayCard(state, side, handIndex)) return false;
  if (card.kind === 'spell' && !target) return false;
  s.hand.splice(handIndex, 1);
  s.mana -= card.cost;
  s.discard.push(card.defId);
  state.stats.cardsPlayed += 1;
  const foe = otherSide(side);
  if (card.kind === 'creature') {
    const creature = makeCreature(card.defId, state.rng);
    s.board.push(creature);
    log(state, `${sideName(side)} summons ${card.name} (${card.atk}/${card.hp}).`);
    if (card.defId === 'moon-pup') { drawCard(state, side); log(state, `${card.name} draws a card.`); }
    if (card.defId === 'dawn-acolyte') {
      s.life = Math.min(s.maxLife, s.life + 2);
      log(state, `${card.name} heals ${sideName(side)} for 2.`);
    }
  } else {
    const dmg = card.defId === 'sunburst' ? 3 : card.defId === 'moonbeam' ? 2 : 5;
    if (target.kind === 'face') dealDamageToFace(state, foe, dmg, card.name);
    else dealDamageToCreature(state, foe, target.index, dmg, card.name);
    if (card.defId === 'moonbeam') { drawCard(state, side); log(state, `${card.name} draws a card.`); }
  }
  checkEnd(state);
  return true;
}

// Attack with a board creature. target: { kind:'face' } or { kind:'creature', index } on the ENEMY side.
// Guard rule: if the enemy has any Guard, a creature target must be a Guard.
export function attack(state, side, boardIndex, target) {
  const s = sideState(state, side);
  const foe = sideState(state, otherSide(side));
  const attacker = s.board[boardIndex];
  if (!attacker || !attacker.canAttack) return false;
  if (target.kind === 'creature') {
    const guards = guardIndexes(state, otherSide(side));
    if (guards.length > 0 && !guards.includes(target.index)) return false;
    const defender = foe.board[target.index];
    if (!defender) return false;
    attacker.canAttack = false;
    defender.hp -= attacker.atk;
    attacker.hp -= defender.atk;
    log(state, `${attacker.name} (${attacker.atk}) trades with ${defender.name} (${defender.atk}).`);
    if (defender.hp <= 0) {
      foe.board.splice(target.index, 1);
      foe.discard.push(defender.defId);
      log(state, `${defender.name} is destroyed.`);
    }
    if (attacker.hp <= 0) {
      s.board.splice(boardIndex, 1);
      s.discard.push(attacker.defId);
      log(state, `${attacker.name} falls in the trade.`);
    }
  } else {
    const guards = guardIndexes(state, otherSide(side));
    if (guards.length > 0) return false;
    attacker.canAttack = false;
    foe.life -= attacker.atk;
    recordDamage(state, attacker.name, attacker.atk, otherSide(side) === 'ai');
    log(state, `${attacker.name} strikes ${sideName(otherSide(side))} for ${attacker.atk}.`);
  }
  checkEnd(state);
  return true;
}

export function endTurn(state) {
  if (state.phase === 'over') return;
  state.turn = otherSide(state.turn);
  if (state.turn === 'player') state.turnNumber += 1;
  startTurn(state, state.turn);
}
