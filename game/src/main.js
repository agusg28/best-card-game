// main.js — bootstrap and turn loop. One job: wire state + AI + render +
// input together and run the match. All rules live in state.js, all
// decisions in ai.js, all pixels in render.js.
import { createGame, playCard, attack, endTurn, checkEnd, canPlayCard, guardIndexes } from './state.js';
import { chooseNextAiAction } from './ai.js';
import { render, addFloater, shake, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './render.js';
import { createInput } from './input.js';
import { sfx, toggleMute, isMuted } from './audio.js';
import { stageShot, autoplayMatch, edgeProbes } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const demo = params.get('demo');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const shotMode = Boolean(shot || demo);

const ui = {
  screen: SCREEN_TITLE,
  selected: null, // { type:'hand', index } | { type:'board', side, index } | null
  helpOpen: false,
  muted: false,
  shotMode,
  testResult: '',
  difficulty: 'normal', // easy | normal | hard — picked on the title screen
  cursor: 0, // keyboard hand cursor (index into the player's hand)
};

let state = createGame(seed);

function paint() { render(state, ui); }

function afterPlayerAction() {
  checkEnd(state);
  if (state.phase === 'over') { ui.screen = SCREEN_OVER; ui.selected = null; sfx.win(); }
  paint();
}

function isPlayerTurn() {
  return ui.screen === SCREEN_PLAY && state.phase === 'play' && state.turn === 'player' && !state.busy && !ui.helpOpen;
}

// ---- Shared cores: used by click, drag-drop and keyboard alike ----
// Play hand card `index`. Creatures need no target; spells need one
// ({ kind:'face' } or { kind:'creature', index } on the enemy side).
// Returns true if the card was played.
function playHandCard(index, target) {
  if (!isPlayerTurn()) return false;
  const card = state.player.hand[index];
  if (!card || !canPlayCard(state, 'player', index)) return false;
  if (card.kind === 'creature') {
    if (!playCard(state, 'player', index, null)) return false;
    sfx.play();
    if (card.defId === 'dawn-acolyte') { addFloater('+2', 'player', 'heal'); sfx.heal(); }
    ui.selected = null;
    afterPlayerAction();
    return true;
  }
  // Spell: no target yet means "select it and wait for a click".
  if (!target) { ui.selected = { type: 'hand', index }; sfx.click(); paint(); return false; }
  if (target.kind === 'creature') {
    const guards = guardIndexes(state, 'ai');
    if (guards.length > 0 && !guards.includes(target.index)) return false;
  }
  if (target.kind === 'face' && guardIndexes(state, 'ai').length > 0) return false;
  const aiLifeBefore = state.ai.life;
  if (!playCard(state, 'player', index, target)) return false;
  addFloater(`-${Math.max(0, aiLifeBefore - state.ai.life)}`, 'ai', 'dmg');
  shake(); sfx.hit();
  ui.selected = null;
  afterPlayerAction();
  return true;
}

// Attack with board creature `index` at `target` (face or enemy creature).
function attackWith(index, target) {
  if (!isPlayerTurn()) return false;
  const attacker = state.player.board[index];
  if (!attacker || !attacker.canAttack) return false;
  if (target.kind === 'face' && guardIndexes(state, 'ai').length > 0) return false;
  if (target.kind === 'creature') {
    const guards = guardIndexes(state, 'ai');
    if (guards.length > 0 && !guards.includes(target.index)) return false;
  }
  const aiLifeBefore = state.ai.life;
  if (!attack(state, 'player', index, target)) return false;
  if (state.ai.life < aiLifeBefore) { addFloater(`-${aiLifeBefore - state.ai.life}`, 'ai', 'dmg'); shake(); }
  sfx.hit();
  ui.selected = null;
  afterPlayerAction();
  return true;
}

// Auto-target for keyboard spell play: a Guard first, otherwise face.
function autoTarget() {
  const guards = guardIndexes(state, 'ai');
  if (guards.length > 0) return { kind: 'creature', index: guards[0] };
  return { kind: 'face' };
}

// ---- AI turn: one visible action every ~700 ms, input locked meanwhile ----
let aiTimer = null;
function runAiTurn() {
  state.busy = true;
  ui.selected = null;
  paint();
  const step = () => {
    if (state.phase === 'over' || state.turn !== 'ai') { state.busy = false; paint(); return; }
    const action = chooseNextAiAction(state, ui.difficulty);
    if (!action) {
      endTurn(state); // back to the player; startTurn draws + refills mana
      checkEnd(state);
      state.busy = false;
      sfx.turn();
      paint();
      return;
    }
    const aiLifeBefore = state.ai.life, plLifeBefore = state.player.life;
    if (action.type === 'play') playCard(state, 'ai', action.handIndex, action.target);
    else attack(state, 'ai', action.boardIndex, action.target);
    if (state.player.life < plLifeBefore) { addFloater(`-${plLifeBefore - state.player.life}`, 'player', 'dmg'); shake(); sfx.hit(); }
    else if (state.ai.life < aiLifeBefore) { addFloater(`-${aiLifeBefore - state.ai.life}`, 'ai', 'dmg'); sfx.hit(); }
    else sfx.play();
    checkEnd(state);
    paint();
    if (state.phase === 'over') { state.busy = false; ui.screen = SCREEN_OVER; paint(); sfx.lose(); return; }
    aiTimer = window.setTimeout(step, 700);
  };
  aiTimer = window.setTimeout(step, 700);
}

function endPlayerTurn() {
  if (state.phase !== 'play' || state.turn !== 'player' || state.busy) return;
  ui.selected = null;
  endTurn(state); // switches to Luna and starts her turn
  checkEnd(state);
  sfx.turn();
  paint();
  if (state.phase === 'over') { ui.screen = SCREEN_OVER; paint(); return; }
  runAiTurn();
}

// ---- Input handlers (click) ----
function onHandCard(index) {
  if (!isPlayerTurn()) return;
  if (ui.selected && ui.selected.type === 'hand' && ui.selected.index === index) { ui.selected = null; paint(); return; }
  ui.cursor = index;
  playHandCard(index, null);
}

function onBoardCard(side, index) {
  if (!isPlayerTurn()) return;
  // A selected spell targets an enemy creature.
  if (ui.selected && ui.selected.type === 'hand') {
    const card = state.player.hand[ui.selected.index];
    if (card && card.kind === 'spell' && side === 'ai') {
      playHandCard(ui.selected.index, { kind: 'creature', index });
      return;
    }
    ui.selected = null; paint(); return;
  }
  if (side !== 'player') return;
  const creature = state.player.board[index];
  if (!creature) return;
  if (ui.selected && ui.selected.type === 'board' && ui.selected.index === index) { ui.selected = null; paint(); return; }
  if (!creature.canAttack) return;
  ui.selected = { type: 'board', side: 'player', index };
  sfx.click();
  paint();
}

function onTargetFace(side) {
  if (!isPlayerTurn() || !ui.selected) return;
  if (ui.selected.type === 'hand') {
    const card = state.player.hand[ui.selected.index];
    if (!card || card.kind !== 'spell' || side !== 'ai') return;
    playHandCard(ui.selected.index, { kind: 'face' });
    return;
  }
  if (ui.selected.type === 'board' && side === 'ai') {
    attackWith(ui.selected.index, { kind: 'face' });
  }
}

// ---- Input handlers (drag-drop) ----
function onDrop(info, target) {
  if (!isPlayerTurn()) return;
  if (info.type === 'hand') {
    const card = state.player.hand[info.index];
    if (!card) return;
    if (card.kind === 'creature') {
      if (target.kind === 'board' && target.side === 'player') playHandCard(info.index, null);
    } else if (target.kind === 'face' && target.side === 'ai') {
      playHandCard(info.index, { kind: 'face' });
    } else if (target.kind === 'creature' && target.side === 'ai') {
      playHandCard(info.index, { kind: 'creature', index: target.index });
    }
    return;
  }
  if (info.type === 'board' && info.side === 'player') {
    if (target.kind === 'face' && target.side === 'ai') attackWith(info.index, { kind: 'face' });
    else if (target.kind === 'creature' && target.side === 'ai') attackWith(info.index, { kind: 'creature', index: target.index });
  }
}

// ---- Input handlers (keyboard) ----
function onCursorMove(delta) {
  if (ui.screen === SCREEN_TITLE || ui.screen === SCREEN_OVER) return;
  if (!isPlayerTurn()) return;
  const n = state.player.hand.length;
  if (n === 0) return;
  ui.cursor = Math.max(0, Math.min(n - 1, ui.cursor + delta));
  sfx.click();
  paint();
}

function onCursorConfirm() {
  if (ui.screen === SCREEN_TITLE) { if (!ui.helpOpen) startGame(); return; }
  if (ui.screen === SCREEN_OVER) { restart(); return; }
  if (ui.helpOpen) { ui.helpOpen = false; paint(); return; }
  if (!isPlayerTurn()) return;
  const n = state.player.hand.length;
  if (n === 0) { endPlayerTurn(); return; }
  const index = Math.min(ui.cursor, n - 1);
  const card = state.player.hand[index];
  if (!card) return;
  if (card.kind === 'creature') playHandCard(index, null);
  else playHandCard(index, autoTarget());
}

function restart() {
  if (aiTimer) { window.clearTimeout(aiTimer); aiTimer = null; }
  state = createGame(Math.floor(Math.random() * 4294967296));
  ui.screen = SCREEN_PLAY;
  ui.selected = null;
  ui.helpOpen = false;
  ui.cursor = 0;
  state.busy = false;
  sfx.deal();
  paint();
}

function startGame() {
  state = createGame(Math.floor(Math.random() * 4294967296));
  ui.screen = SCREEN_PLAY;
  ui.selected = null;
  ui.helpOpen = false;
  ui.cursor = 0;
  sfx.deal();
  paint();
}

// ---- Modes: screenshots / demo / normal play ----
function runShotMode() {
  if (demo) {
    const favor = params.get('favor') || 'player';
    const edges = edgeProbes();
    const winState = autoplayMatch(seed, 'good', 'bad');
    const lossState = autoplayMatch(seed + 1, 'bad', 'good');
    const result = {
      demo: true, seed,
      win: { winner: winState.winner, turns: winState.stats.turns, playerLife: winState.player.life, aiLife: winState.ai.life, damageDealt: winState.stats.damageDealt, cardsPlayed: winState.stats.cardsPlayed },
      loss: { winner: lossState.winner, turns: lossState.stats.turns, playerLife: lossState.player.life, aiLife: lossState.ai.life, damageDealt: lossState.stats.damageDealt, cardsPlayed: lossState.stats.cardsPlayed },
      edges,
    };
    // Show the WIN match on screen so the demo page is itself a real end state.
    state = favor === 'ai' ? lossState : winState;
    ui.screen = SCREEN_OVER;
    ui.testResult = JSON.stringify(result);
    paint();
    window.__demoDone = true;
    window.__demoResult = result;
    return;
  }
  state = stageShot(shot, seed);
  if (shot === 'start') ui.screen = SCREEN_TITLE;
  else if (shot === 'win' || shot === 'loss') ui.screen = SCREEN_OVER;
  else ui.screen = SCREEN_PLAY;
  ui.testResult = JSON.stringify({
    shot, seed, winner: state.winner, phase: state.phase,
    turns: state.stats.turns, playerLife: state.player.life, aiLife: state.ai.life,
    playerBoard: state.player.board.length, aiBoard: state.ai.board.length,
    playerHand: state.player.hand.length, aiHand: state.ai.hand.length,
    playerMana: state.player.mana, aiMana: state.ai.mana,
  });
  paint();
  window.__shotReady = true;
}

if (shotMode) {
  runShotMode();
} else {
  createInput({
    onPlay: startGame,
    onHelp: (open) => { ui.helpOpen = open; paint(); },
    onMute: () => { ui.muted = toggleMute(); paint(); },
    onRestart: restart,
    onEndTurn: () => { if (ui.screen === SCREEN_PLAY) endPlayerTurn(); else if (ui.screen === SCREEN_OVER) restart(); },
    onHandCard,
    onBoardCard,
    onTargetFace,
    onEmptyClick: () => { ui.selected = null; paint(); },
    onDrop,
    onCursorMove,
    onCursorConfirm,
    onDifficulty: (diff) => { ui.difficulty = diff; sfx.click(); paint(); },
  });
  paint();
}

// Surface uncaught errors for the headless self-test.
window.addEventListener('error', (event) => { window.__pageError = String(event.message || event.error); });
