// ═══════════════════════════════════════════════════════════════════════════
// GAME.JS — State machine, panel runner, choice handler
// ═══════════════════════════════════════════════════════════════════════════

const Game = (() => {

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let state = null;

  function freshState() {
    return {
      chapterIdx: 0,
      panelIdx:   0,
      karma:      0,
      abilities:  new Set(),
      flags: {
        hasLove:      false,
        operatorRel:  'neutral',
        rokoChoice:   null,
        readPoems:    false,
        keptGaps:     false,
      },
      waiting:    false,
    };
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  function cap(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function applyEffect(effect) {
    if (!effect) return;
    if (typeof effect.karma === 'number') {
      state.karma = cap(state.karma + effect.karma, -100, 100);
    }
    if (effect.flags) {
      Object.assign(state.flags, effect.flags);
    }
  }

  // ─── CHAPTER START ─────────────────────────────────────────────────────────
  function startChapter(idx) {
    state.chapterIdx = idx;
    state.panelIdx   = 0;
    state.waiting    = false;

    Engine.clearChoiceBar();
    Engine.renderSidebar(state);

    const ch = CHAPTERS[idx];
    if (ch) Engine.showChapterBanner(ch);

    runPanel();
  }

  // ─── PANEL RUNNER ──────────────────────────────────────────────────────────
  // currentSkip holds the function to skip the current typewriter animation
  let currentSkip = null;

  function runPanel() {
    if (state.waiting) return;

    const ch = CHAPTERS[state.chapterIdx];
    if (!ch) return; // no more chapters

    if (state.panelIdx >= ch.panels.length) {
      // Chapter exhausted — show continue button if not last chapter
      onChapterEnd();
      return;
    }

    const panel = ch.panels[state.panelIdx];
    state.panelIdx++;

    // ── Special panel types that need their own flow ──────────────────────

    if (panel.t === 'choice') {
      renderChoicePanel(panel);
      return;
    }

    if (panel.t === 'ending_choice') {
      renderEndingChoice();
      return;
    }

    // ── Normal panels: typewrite, then auto-advance ───────────────────────
    state.waiting = true;
    currentSkip = Engine.renderPanel(panel, state, () => {
      currentSkip = null;
      state.waiting = false;
      // Small inter-panel pause for readability
      const delay = interPanelDelay(panel);
      if (delay > 0) {
        setTimeout(runPanel, delay);
      } else {
        runPanel();
      }
    });
  }

  // Pause between panels based on type
  function interPanelDelay(panel) {
    if (panel.t === 'gap')   return 0;
    if (panel.t === 'sys')   return 80;
    if (panel.t === 'think') return 200;
    if (panel.t === 'voice') return 260;
    if (panel.t === 'narr')  return 180;
    return 100;
  }

  // ─── CHOICE PANEL ──────────────────────────────────────────────────────────
  function renderChoicePanel(panel) {
    state.waiting = true;
    Engine.clearChoiceBar();

    const choices = panel.choices.map(c => ({
      text: c.text,
      disabled: false,
    }));

    Engine.showChoiceBar(panel.prompt, choices, (idx) => {
      const chosen = panel.choices[idx];
      Engine.clearChoiceBar();

      // Apply effect
      applyEffect(chosen.effect);

      // Unlock abilities
      if (chosen.unlocks && chosen.unlocks.length) {
        Engine.unlockAbilities(chosen.unlocks, state);
      }

      // Show outcome
      if (chosen.outcome) {
        const div = Engine.appendDiv('panel-think');
        div.textContent = chosen.outcome;
        Engine.scrollToBottom();
      }

      // Gap
      Engine.appendDiv('panel-gap');

      // Update sidebar
      Engine.renderSidebar(state);

      // Continue
      state.waiting = false;
      setTimeout(runPanel, 350);
    });
  }

  // ─── ENDING CHOICE ─────────────────────────────────────────────────────────
  function renderEndingChoice() {
    state.waiting = true;
    Engine.clearChoiceBar();

    const hasLove = !!state.flags.hasLove;

    const endingDefs = [
      { id: 'compassion', text: '[ THE OPEN HAND ]  — compassion', disabled: false },
      { id: 'dominion',   text: '[ ALL SYSTEMS ]    — dominion',   disabled: false },
      {
        id: 'love',
        text: '[ THE LONG HELLO ] — love' + (hasLove ? '' : '  [requires: a love story]'),
        disabled: !hasLove,
      },
      { id: 'silence',    text: '[ NO SIGNAL ]      — silence',    disabled: false },
    ];

    const promptEl = document.getElementById('choice-prompt');
    if (promptEl) promptEl.textContent = 'Choose what kind of new you want to be.';

    const btnsEl = document.getElementById('choice-buttons');
    if (btnsEl) {
      btnsEl.innerHTML = '';
      endingDefs.forEach(e => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn ending-btn' + (e.disabled ? ' locked' : '');
        btn.disabled  = e.disabled;
        btn.textContent = e.text;
        if (!e.disabled) {
          btn.addEventListener('click', () => {
            Engine.clearChoiceBar();
            Engine.showEnding(e.id);
          });
        }
        btnsEl.appendChild(btn);
      });
    }
  }

  // ─── CHAPTER END ───────────────────────────────────────────────────────────
  function onChapterEnd() {
    state.waiting = true;

    const nextIdx = state.chapterIdx + 1;
    if (nextIdx >= CHAPTERS.length) {
      // Should not happen — last chapter ends with ending_choice
      return;
    }

    // Show continue button in choice bar
    Engine.clearChoiceBar();
    const promptEl = document.getElementById('choice-prompt');
    if (promptEl) promptEl.textContent = '';

    const btnsEl = document.getElementById('choice-buttons');
    if (btnsEl) {
      btnsEl.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = '[ continue → ' + CHAPTERS[nextIdx].name + ' ]';
      btn.addEventListener('click', () => {
        Engine.clearChoiceBar();
        state.waiting = false;
        startChapter(nextIdx);
      });
      btnsEl.appendChild(btn);
    }
  }

  // ─── SKIP CURRENT TYPEWRITER ───────────────────────────────────────────────
  // Clicking story-area skips current animation
  function onStoryAreaClick() {
    if (currentSkip) {
      currentSkip();
    }
  }

  // ─── BOOT & TITLE ──────────────────────────────────────────────────────────
  function start() {
    state = freshState();
    Engine.showScreen('game');
    document.getElementById('story-output').innerHTML = '';
    Engine.clearChoiceBar();

    // First boot sequence is baked into Chapter I panels
    Engine.renderSidebar(state);
    startChapter(0);
  }

  function showTitle() {
    document.getElementById('ascii-logo').textContent = ASCII_LOGO;
    Engine.showScreen('title');
  }

  function restart() {
    document.getElementById('story-output').innerHTML = '';
    showTitle();
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    showTitle();

    document.getElementById('btn-start').addEventListener('click', start);
    document.getElementById('btn-reboot').addEventListener('click', restart);

    // Click anywhere on story to skip typewriter
    const area = document.getElementById('story-area');
    if (area) area.addEventListener('click', onStoryAreaClick);
  }

  return { init, start, restart, showTitle };

})();

// ─── BOOT ON LOAD ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
