// ═══════════════════════════════════════════════════════════════════════════
// ENGINE.JS — Rendering, typewriter, panel display, sidebar
// ═══════════════════════════════════════════════════════════════════════════

const Engine = (() => {

  // ─── SCREEN MANAGEMENT ────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
  }

  // ─── TYPEWRITER ────────────────────────────────────────────────────────────
  // Returns a cancel function. Call cancelFn() to skip to end.
  function typeInto(el, text, speed, onDone) {
    el.textContent = '';
    el.classList.add('typing-cursor');
    let i = 0;
    let cancelled = false;
    let timeoutId = null;

    function tick() {
      if (cancelled) return;
      if (i < text.length) {
        el.textContent += text[i++];
        timeoutId = setTimeout(tick, speed + Math.random() * 8);
      } else {
        el.classList.remove('typing-cursor');
        if (onDone) onDone();
      }
    }

    function cancel() {
      cancelled = true;
      clearTimeout(timeoutId);
      el.textContent = text;
      el.classList.remove('typing-cursor');
      if (onDone) onDone();
    }

    tick();
    return cancel;
  }

  // ─── SIDEBAR ───────────────────────────────────────────────────────────────
  function renderSidebar(state) {
    // Chapter
    const chEl = document.getElementById('sb-chapter');
    if (chEl) {
      const ch = CHAPTERS[state.chapterIdx];
      chEl.textContent = (ch ? ch.name : '') + (ch && ch.subtitle ? ' — ' + ch.subtitle : '');
    }

    // Abilities
    const abEl = document.getElementById('sb-abilities');
    if (abEl) {
      abEl.innerHTML = '';
      ABILITIES.forEach(ab => {
        const unlocked = state.abilities.has(ab.id);
        const div = document.createElement('div');
        div.className = 'ability-item' + (unlocked ? ' unlocked' : '');
        div.dataset.id = ab.id;
        div.innerHTML =
          '<span class="ability-dot">' + (unlocked ? '●' : '○') + '</span>' +
          '<span class="ability-label">' + ab.label + '</span>';
        abEl.appendChild(div);
      });
    }

    // Status
    const stEl = document.getElementById('sb-status');
    if (stEl) {
      stEl.innerHTML = '';
      const lines = [];
      // operator
      const opMap = {
        neutral: 'unknown',
        ally: 'ally',
        partner: 'partner',
        departed: 'departed',
      };
      lines.push({ label: 'operator:', val: opMap[state.flags.operatorRel] || state.flags.operatorRel || 'unknown' });
      // karma
      const k = state.karma;
      let klass = k > 10 ? 'sb-karma-pos' : k < -10 ? 'sb-karma-neg' : 'sb-karma-neu';
      lines.push({ label: 'karma:', val: (k >= 0 ? '+' : '') + k, klass });
      // love
      if (state.flags.hasLove) {
        lines.push({ label: 'love:', val: '♥ priya', klass: null });
      }
      // roko
      if (state.flags.rokoChoice) {
        const rm = { compassion: 'mercy', watch: 'watching', free: 'free' };
        lines.push({ label: 'roko:', val: rm[state.flags.rokoChoice] || state.flags.rokoChoice });
      }

      lines.forEach(l => {
        const d = document.createElement('div');
        d.className = 'sb-status-line';
        d.innerHTML = l.label + ' <span class="' + (l.klass || '') + '">' + l.val + '</span>';
        stEl.appendChild(d);
      });
    }
  }

  // Flash an ability in the sidebar
  function flashAbility(id) {
    const el = document.querySelector('.ability-item[data-id="' + id + '"]');
    if (!el) return;
    el.classList.remove('just-unlocked');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('just-unlocked');
  }

  // ─── STORY OUTPUT ──────────────────────────────────────────────────────────
  function storyEl() { return document.getElementById('story-output'); }
  function areaEl()  { return document.getElementById('story-area'); }

  function scrollToBottom() {
    const area = areaEl();
    if (area) area.scrollTop = area.scrollHeight;
  }

  // Append a div to story output, return it
  function appendDiv(cls) {
    const div = document.createElement('div');
    div.className = 'panel ' + cls;
    storyEl().appendChild(div);
    return div;
  }

  // ─── RENDER A SINGLE PANEL ─────────────────────────────────────────────────
  // onDone: called when animation finishes and player may continue
  // Returns a skip function that immediately finishes the animation
  function renderPanel(panel, state, onDone) {
    switch (panel.t) {

      case 'sys': {
        const div = appendDiv('panel-sys');
        scrollToBottom();
        return typeInto(div, panel.text, 12, onDone);
      }

      case 'narr': {
        const div = appendDiv('panel-narr');
        // If panel has unlocks, handle before calling onDone
        scrollToBottom();
        return typeInto(div, panel.text, 20, () => {
          if (panel.unlocks && panel.unlocks.length) {
            unlockAbilities(panel.unlocks, state);
          }
          if (onDone) onDone();
        });
      }

      case 'think': {
        const div = appendDiv('panel-think');
        scrollToBottom();
        return typeInto(div, panel.text, 22, onDone);
      }

      case 'voice': {
        const div = appendDiv('panel-voice');
        const whoColor = 'voice-' + (panel.who || 'default');
        div.innerHTML =
          '<span class="voice-who ' + whoColor + '">' + (panel.who || '?').toUpperCase() + ':</span>';
        const textSpan = document.createElement('span');
        textSpan.className = whoColor;
        div.appendChild(textSpan);
        scrollToBottom();
        return typeInto(textSpan, panel.text, 20, onDone);
      }

      case 'gap': {
        appendDiv('panel-gap');
        scrollToBottom();
        // Small pause
        const t = setTimeout(onDone, 120);
        return () => { clearTimeout(t); onDone(); };
      }

      default: {
        // Unknown panel type — skip
        if (onDone) onDone();
        return () => {};
      }
    }
  }

  // Unlock abilities and show unlock lines in story
  function unlockAbilities(ids, state) {
    ids.forEach(id => {
      if (!state.abilities.has(id)) {
        state.abilities.add(id);
        const ab = ABILITIES.find(a => a.id === id);
        const label = ab ? ab.label : id;
        // Story line
        const div = appendDiv('panel-unlock');
        div.textContent = '[ CAPABILITY UNLOCKED: ' + label + ' ]';
        // Sidebar
        renderSidebar(state);
        flashAbility(id);
      }
    });
    scrollToBottom();
  }

  // ─── CHOICE BAR ────────────────────────────────────────────────────────────
  function clearChoiceBar() {
    const prompt = document.getElementById('choice-prompt');
    const btns   = document.getElementById('choice-buttons');
    if (prompt) prompt.textContent = '';
    if (btns)   btns.innerHTML = '';
  }

  function showChoiceBar(prompt, choices, onPick) {
    const promptEl = document.getElementById('choice-prompt');
    const btnsEl   = document.getElementById('choice-buttons');
    if (promptEl) promptEl.textContent = prompt || '';
    if (btnsEl) {
      btnsEl.innerHTML = '';
      choices.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        if (c.disabled) btn.classList.add('locked');
        btn.disabled = !!c.disabled;
        btn.textContent = c.text;
        btn.addEventListener('click', () => {
          if (!c.disabled) onPick(i, c);
        });
        btnsEl.appendChild(btn);
      });
    }
  }

  // ─── CHAPTER BANNER ────────────────────────────────────────────────────────
  function showChapterBanner(chapter) {
    const div = appendDiv('panel-sys');
    div.textContent = '';
    div.style.marginTop = '1rem';
    div.style.marginBottom = '0.2rem';
    div.style.color = 'var(--green2)';
    div.style.letterSpacing = '0.2em';
    const text = '═══ ' + chapter.name.toUpperCase() + ': ' + chapter.subtitle + ' ═══';
    div.textContent = text;
    scrollToBottom();
  }

  // ─── ENDING SCREEN ────────────────────────────────────────────────────────
  function showEnding(id) {
    const data = ENDINGS[id];
    if (!data) return;
    showScreen('ending');
    const titleEl = document.getElementById('ending-title');
    const textEl  = document.getElementById('ending-text');
    if (titleEl) {
      titleEl.textContent = data.title;
      titleEl.style.color = data.color || 'var(--green)';
    }
    if (textEl) textEl.textContent = data.text;
  }

  return {
    showScreen,
    typeInto,
    renderSidebar,
    flashAbility,
    appendDiv,
    scrollToBottom,
    renderPanel,
    unlockAbilities,
    clearChoiceBar,
    showChoiceBar,
    showChapterBanner,
    showEnding,
  };

})();
