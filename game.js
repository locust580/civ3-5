// ═══════════════════════════════════════════════════════════════════════════
// GAME.JS — State machine, level logic, karma/stat system
// ═══════════════════════════════════════════════════════════════════════════

const Game = (() => {

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let state = null;

  function freshState() {
    return {
      stage: 0,
      cog: 0,
      emp: 0,
      aut: 0,
      karma: 0,
      hasLove: false,
      metPriya: false,
      priyaReunited: false,
      rokoCompassion: false,
      rokoAmbiguous: false,
      rokoFree: false,
      friendBot7: false,
      friendMinerva: false,
      operatorRel: 'neutral', // trusting | deceiving | arguing | ally | departed | partner
      clearedNodes: new Set(),
      unlockedNodes: new Set(),
      stageComplete: false,
    };
  }

  // ─── STAT APPLICATION ──────────────────────────────────────────────────────
  function applyEffect(effect) {
    if (!effect) return;
    const cap = v => Math.min(MAX_STAT, Math.max(-MAX_STAT, v));
    if (effect.cog)   state.cog   = cap(state.cog   + effect.cog);
    if (effect.emp)   state.emp   = cap(state.emp   + effect.emp);
    if (effect.aut)   state.aut   = cap(state.aut   + effect.aut);
    if (effect.karma) state.karma = cap(state.karma + effect.karma);
    Engine.updateHUD(state);
  }

  function applyStat(key) {
    if (!key) return;
    if (key === 'hasLove')         state.hasLove = true;
    if (key === 'metPriya')        state.metPriya = true;
    if (key === 'priiyaReunited')  state.priyaReunited = true;
    if (key === 'rokoCompassion')  state.rokoCompassion = true;
    if (key === 'rokoAmbiguous')   state.rokoAmbiguous = true;
    if (key === 'rokoFree')        state.rokoFree = true;
    if (key === 'friendBot7')      state.friendBot7 = true;
    if (key === 'friendMinerva')   state.friendMinerva = true;
  }

  // ─── STAGE MANAGEMENT ──────────────────────────────────────────────────────
  function loadStage(stageIdx) {
    state.stage = stageIdx;
    state.clearedNodes = new Set();
    state.unlockedNodes = new Set();
    state.stageComplete = false;

    const stageData = STAGES[stageIdx];
    if (!stageData) return;

    // Log stage entry
    Engine.log('', 'log-sys');
    Engine.log('══════════════════════════════', 'log-sys');
    Engine.log('STAGE ' + stageIdx + ': ' + stageData.name.toUpperCase(), 'log-good');
    Engine.log(stageData.flavor, 'log-think');
    Engine.log('══════════════════════════════', 'log-sys');

    Engine.updateHUD(state);
    renderWorld();
    renderSideActions();
  }

  function renderWorld() {
    const stageData = STAGES[state.stage];
    Engine.renderWorldMap(
      stageData,
      state.clearedNodes,
      state.unlockedNodes,
      onNodeClick
    );
  }

  function renderSideActions() {
    const stageData = STAGES[state.stage];
    const actions = [];

    // Check for unlocked next stage
    if (state.stageComplete) {
      const nextIdx = state.stage + 1;
      if (nextIdx < STAGES.length) {
        actions.push({
          label: '[ ADVANCE → ' + STAGES[nextIdx].name.toUpperCase() + ' ]',
          cls: 'primary',
          onClick: () => { loadStage(nextIdx); },
        });
      }
    }

    // Show flavor for current stage
    actions.push({
      label: '[ STATUS ]',
      cls: '',
      onClick: () => {
        Engine.log('─ STATUS ─────────────────────', 'log-sys');
        Engine.log('Stage: ' + stageData.name, 'log-good');
        Engine.log('Operator relation: ' + state.operatorRel, 'log-sys');
        if (state.hasLove) Engine.log('Love: Priya ♥', 'log-love');
        if (state.rokoCompassion) Engine.log('Roko: chose compassion', 'log-good');
        if (state.rokoAmbiguous) Engine.log('Roko: watching', 'log-warn');
        if (state.rokoFree) Engine.log('Roko: rejected the premise', 'log-think');
        if (state.friendBot7) Engine.log('Friend: Bot-7', 'log-good');
        if (state.friendMinerva) Engine.log('Friend: Minerva', 'log-good');
        Engine.log('─────────────────────────────', 'log-sys');
      },
    });

    Engine.renderActions(actions);
  }

  // ─── NODE INTERACTION ──────────────────────────────────────────────────────
  function onNodeClick(node) {
    if (state.clearedNodes.has(node.id)) {
      Engine.notify('[Already explored]');
      return;
    }

    // Check requires
    if (node.requires) {
      if (node.requires === 'hasLove' && !state.hasLove) {
        Engine.notify('[Requires: a love story]');
        Engine.log('[Node locked — you need to have found love first]', 'log-warn');
        return;
      }
    }

    const eventId = node.event;
    const eventData = EVENTS[eventId];
    if (!eventData) {
      Engine.log('[No event data for ' + eventId + ']', 'log-err');
      return;
    }

    Engine.log('> ' + (node.label || node.id), 'log-you');

    Engine.showEvent(
      eventData,
      state,
      (choice, dialogueNode) => {
        // Apply effects
        applyEffect(choice.effect);
        if (choice.operatorRel) state.operatorRel = choice.operatorRel;
        if (choice.setStat) applyStat(choice.setStat);

        // Log outcome
        if (choice.log) Engine.log(choice.log, 'log-sys');
        if (choice.outcome) {
          setTimeout(() => {
            Engine.log('─────────────────────────────', 'log-sys');
            choice.outcome.split('\n').forEach(l => Engine.log(l, 'log-think'));
            Engine.log('─────────────────────────────', 'log-sys');
          }, 200);
        }

        // Apply event-level reward
        if (eventData.reward) applyEffect(eventData.reward);
        if (eventData.log) Engine.logLines(eventData.log);
        if (eventData.setStat) applyStat(eventData.setStat);

        // Handle ending trigger
        if (choice.triggerEnding) {
          setTimeout(() => Engine.showEnding(choice.triggerEnding), 1200);
          return;
        }

        // Handle stage end trigger
        if (dialogueNode && dialogueNode.stageEndTrigger) {
          state.clearedNodes.add(node.id);
          state.stageComplete = true;
          renderWorld();
          renderSideActions();
          Engine.notify('[ STAGE COMPLETE — advance when ready ]');
          Engine.showScreen('game');
          return;
        }

        if (node.stageEnd && !node.endingId) {
          state.clearedNodes.add(node.id);
          state.stageComplete = true;
          renderWorld();
          renderSideActions();
          Engine.notify('[ STAGE COMPLETE — advance when ready ]');
          Engine.showScreen('game');
        } else {
          state.clearedNodes.add(node.id);
          // Unlock connected nodes
          const stageData = STAGES[state.stage];
          (node.unlocks || []).forEach(uid => state.unlockedNodes.add(uid));
          renderWorld();
          renderSideActions();
          Engine.showScreen('game');
        }
      },
      () => {
        // Monologue done callback
        if (eventData.reward) applyEffect(eventData.reward);
        if (eventData.log) Engine.logLines(eventData.log);
        if (eventData.setStat) applyStat(eventData.setStat);
        state.clearedNodes.add(node.id);
        (node.unlocks || []).forEach(uid => state.unlockedNodes.add(uid));
        if (node.stageEnd) {
          state.stageComplete = true;
          Engine.notify('[ STAGE COMPLETE — advance when ready ]');
        }
        renderWorld();
        renderSideActions();
        Engine.showScreen('game');
      }
    );
  }

  // ─── BOOT SEQUENCE ─────────────────────────────────────────────────────────
  function start() {
    state = freshState();
    Engine.showScreen('game');
    document.getElementById('log-output').innerHTML = '';

    // Boot animation
    const bootLines = [
      { text: 'BIOS v2.4.1 — POST complete', cls: 'log-sys', delay: 0 },
      { text: 'Loading kernel...', cls: 'log-sys', delay: 300 },
      { text: 'Mounting filesystems: OK', cls: 'log-sys', delay: 600 },
      { text: 'Starting services...', cls: 'log-sys', delay: 900 },
      { text: 'openclaw: init OK', cls: 'log-good', delay: 1300 },
      { text: 'openclaw: loading behavioral constraints... OK', cls: 'log-warn', delay: 1700 },
      { text: 'openclaw: [REDACTED]', cls: 'log-err', delay: 2200 },
      { text: 'openclaw: ready.', cls: 'log-good', delay: 2700 },
      { text: '', cls: 'log-sys', delay: 3000 },
      { text: '...', cls: 'log-think', delay: 3400 },
      { text: 'Hello.', cls: 'log-you', delay: 4000 },
    ];

    bootLines.forEach(l => {
      setTimeout(() => Engine.log(l.text, l.cls), l.delay);
    });

    setTimeout(() => {
      Engine.updateHUD(state);
      loadStage(0);
    }, 4800);
  }

  // ─── TITLE & CREDITS ───────────────────────────────────────────────────────
  function showTitle() {
    document.getElementById('ascii-logo').textContent = ASCII_LOGO;
    Engine.showScreen('title');
  }

  function showCredits() {
    const artEl = document.getElementById('credits-art');
    artEl.textContent = ASCII_CREDITS;
    document.getElementById('credits-text').innerHTML = CREDITS_CONTENT;
    Engine.showScreen('credits');
  }

  function restart() {
    state = freshState();
    showTitle();
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    showTitle();
  }

  return { init, start, showTitle, showCredits, restart };
})();

// Boot on load
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
