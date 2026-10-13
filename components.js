/* Job Signal Board — reusable Web Components.
   Light DOM, dependency-free, presentation only: never touches data files.
   Shared helpers and the gamification layer live on window.JB so app.js
   and the components stay in sync. All client state goes through the
   centralized store (store.js, loaded first); no direct localStorage
   access remains in this file. */
(function () {
  'use strict';

  const store = () => window.JB.store;

  const esc = (value) => String(value === undefined || value === null ? '' : value)
    .replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);

  const normCompany = (name) => String(name).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-');

  /* ---------- Rarity (display badges only, derived from company name) ---------- */
  const TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  /* Two track-specific tier lists: FT ranks career signal, Intern ranks conversion + program strength.
     Legendary = asymmetric upside. DoorDash Labs is legendary via the labs-title rule below. */
  const RARITY_FT = {
    mythic: ['databricks', 'snowflake', 'google', 'akuna-capital'],
    legendary: ['nvidia', 'amd', 'jane-street', 'citadel-securities', 'hrt', 'anthropic', 'openai'],
    epic: ['meta', 'apple', 'netflix', 'tesla', 'stripe', 'doordash', 'uber', 'bloomberg', 'chalk', 'tenstorrent', 'singlestore'],
    rare: ['oracle', 'microsoft', 'amazon', 'cisco', 'ibm', 'intel'],
  };
  const RARITY_INTERN = {
    mythic: ['databricks', 'snowflake', 'google', 'akuna-capital'],
    legendary: ['jane-street', 'citadel-securities', 'hrt', 'nvidia'],
    epic: ['bloomberg', 'doordash', 'uber', 'meta', 'stripe'],
    rare: ['oracle', 'microsoft', 'amazon'],
  };
  const RARITY_LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };
  const rarityOf = (company, type, title) => {
    const n = normCompany(company);
    const hay = (String(company) + ' ' + String(title || '')).toLowerCase();
    if (n === 'doordash' && hay.includes('labs')) return 'legendary';
    const map = /intern/i.test(String(type || '')) ? RARITY_INTERN : RARITY_FT;
    for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
      const t = TIER_ORDER[i];
      if (map[t] && map[t].includes(n)) return t;
    }
    return 'common';
  };
  const tierIndex = (t) => TIER_ORDER.indexOf(t);
  const TIER_HEX = { common: '#58B368', rare: '#4EA8DE', epic: '#9B5DE5', legendary: '#FFC53D', mythic: '#E3350D' };
  /* Split analysis text into bullet points. Pure presentation: exact original
     wording preserved, only the sentence boundaries become list items. */
  const toBullets = (text) => {
    const t = String(text || '').trim();
    if (!t) return '';
    const PROTECT = /\b(U\.S|e\.g|i\.e|vs|St|Mr|Mrs|Ms|Dr|Req)\./g;
    const parts = t
      .replace(PROTECT, (m) => m.replace(/\./g, '\uFFFF'))
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201C(])/)
      .map((s) => s.replace(/\uFFFF/g, '.').trim())
      .filter(Boolean);
    const items = parts.length ? parts : [t];
    return `<ul class="fit-bullets">${items.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
  };

  // Display only compensation explicitly present in the collected analysis.
  const compensationTag = (text) => {
    const t = String(text || '');
    const money = /\$\s?[\d,]+(?:\.\d+)?\s?[KkMm]?(?:\s*[-–—]\s*\$?\s?[\d,]+(?:\.\d+)?\s?[KkMm]?)?(?:\s*(?:\/(?:hr|hour|year|yr|week)|per (?:hour|year)))?/g;
    const matches = [...t.matchAll(money)];
    if (!matches.length) return 'Comp not listed';
    const labelled = matches.find(m => /(?:base|salary|total compensation|\bTC\b)\s*[:=]?\s*$/i.test(t.slice(Math.max(0, m.index - 30), m.index)));
    const hit = labelled || matches[0];
    const before = t.slice(Math.max(0, hit.index - 30), hit.index);
    const after = t.slice(hit.index + hit[0].length, hit.index + hit[0].length + 25);
    const kind = /(?:total compensation|\bTC\b)\s*[:=]?\s*$/i.test(before) ? 'TC' : (/(?:base|salary)\s*[:=]?\s*$/i.test(before) || /^\s*(?:US\s+)?(?:base|salary)\b/i.test(after)) ? 'Base' : 'Comp';
    return `${kind} ${hit[0].trim()}`;
  };

  /* ---------- Shiny: comp at or above $200K, parsed from existing text only ---------- */
  const maxCompValue = (text) => {
    if (!text) return 0;
    if (/\/(hr|hour)\b/i.test(text)) return 0;
    let max = 0;
    const re = /\$([\d,]+(?:\.\d+)?)(?:\s*[\-\u2013\u2014]\s*([\d,]+(?:\.\d+)?))?\s*([Kk])?/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const k = m[3] ? 1000 : 1;
      const v1 = parseFloat(m[1].replace(/,/g, '')) * k;
      const v2 = m[2] ? parseFloat(m[2].replace(/,/g, '')) * k : 0;
      if (v1 > max) max = v1;
      if (v2 > max) max = v2;
    }
    return max;
  };

  /* ---------- XP + levels (store-backed, per-role max milestones) ---------- */
  const XP_BY_STATUS = { New: 0, Applied: 50, OA: 100, 'Phone Screen': 250, Interview: 250, Onsite: 500, Offer: 1000, Rejected: 0, Withdrawn: 0 };
  const LEVELS = [
    { min: 0, title: 'Resume Rookie' },
    { min: 200, title: 'Applicant' },
    { min: 500, title: 'Phone Screen Pro' },
    { min: 1200, title: 'Onsite Warrior' },
    { min: 2500, title: 'Offer Collector' },
  ];
  const getXp = () => Number(store().get('progress.xp') || 0);
  const addXp = (n) => {
    const v = getXp() + n;
    store().set('progress.xp', v);
    return v;
  };
  const getXpAwards = () => store().get('progress.xpAwards') || {};
  const awardXpForStatus = (roleId, status) => {
    const target = XP_BY_STATUS[status] || 0;
    const prev = getXpAwards()[roleId] || 0;
    if (target > prev) {
      store().update('progress', (p) => {
        p.xp = (p.xp || 0) + (target - prev);
        p.xpAwards[roleId] = target;
        return p;
      });
    }
  };
  const levelFor = (xp) => {
    let lvl = LEVELS[0];
    let next = null;
    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i].min) lvl = LEVELS[i];
      else { next = LEVELS[i]; break; }
    }
    return { lvl, next };
  };

  /* ---------- Streaks: consecutive days with tracker activity (store-backed) ---------- */
  const dayStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const recordStreakDay = () => {
    const today = dayStamp();
    store().update('progress.streakDays', (days) => {
      days = Array.isArray(days) ? days : [];
      if (!days.includes(today)) days.push(today);
      return days.slice(-90);
    });
  };
  const streakCount = () => {
    const days = new Set(store().get('progress.streakDays') || []);
    const d = new Date();
    if (!days.has(dayStamp(d))) d.setDate(d.getDate() - 1);
    let count = 0;
    while (days.has(dayStamp(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  };

  /* ---------- Wild encounters: unseen story drops (store-backed) ---------- */
  const SEEN_DROPS_KEY = 'job-signal-seen-drops'; // legacy key, kept for reference only
  const dropKey = (d) => `${d.dateSeen}|${d.company}|${d.title}`;
  const seenDrops = () => new Set(store().get('drops.seenDropIds') || []);
  const markDropSeen = (key) => {
    store().update('drops.seenDropIds', (ids) => {
      ids = Array.isArray(ids) ? ids : [];
      if (key && !ids.includes(key)) ids.push(key);
      return ids;
    });
  };

  const JB = {
    esc, normCompany,
    logoManifest: {},
    TIER_ORDER, tierIndex, TIER_HEX, toBullets,
    rarityOf, maxCompValue, compensationTag,
    getXp, addXp, awardXpForStatus, levelFor, recordStreakDay, streakCount, dayStamp,
    dropKey, seenDrops, markDropSeen, SEEN_DROPS_KEY,
    logoFallback(img) {
      const company = img.getAttribute('data-company') || '';
      const cls = img.getAttribute('data-cls') || 'company-logo';
      const initial = (String(company).trim()[0] || '?').toUpperCase();
      const span = document.createElement('span');
      span.className = `${cls} logo-fallback`;
      span.setAttribute('aria-hidden', 'true');
      span.textContent = initial;
      img.replaceWith(span);
    },
  };

  /* ================= Components ================= */

  class LogoImg extends HTMLElement {
    static get observedAttributes() { return ['company', 'cls']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const company = this.getAttribute('company') || '';
      const cls = this.getAttribute('cls') || 'company-logo';
      const path = JB.logoManifest[normCompany(company)];
      if (path) {
        this.innerHTML = `<img class="${esc(cls)}" src="${esc(path)}" alt="${esc(company)} logo" loading="lazy" data-company="${esc(company)}" data-cls="${esc(cls)}" onerror="JB.logoFallback(this)">`;
      } else {
        const initial = (String(company).trim()[0] || '?').toUpperCase();
        this.innerHTML = `<span class="${esc(cls)} logo-fallback" aria-hidden="true">${esc(initial)}</span>`;
      }
    }
  }

  class StatusPill extends HTMLElement {
    static get observedAttributes() { return ['kind', 'value']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const kind = this.getAttribute('kind');
      const value = this.getAttribute('value') || '';
      if (kind === 'sudo') {
        const label = { added: 'Added', pending: 'Pending', skipped: 'Skipped' }[value] || 'Pending';
        this.innerHTML = `<span class="pill ${esc(value || 'pending')}">${esc(label)}</span>`;
      } else if (kind === 'priority') {
        const cls = value.toLowerCase().replaceAll(' ', '-');
        this.innerHTML = `<span class="priority ${esc(cls)}">${esc(value)}</span>`;
      } else {
        this.innerHTML = `<span class="pill">${esc(value)}</span>`;
      }
    }
  }

  class RarityBadge extends HTMLElement {
    static get observedAttributes() { return ['company', 'type', 'title']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const tier = rarityOf(this.getAttribute('company') || '', this.getAttribute('type') || '', this.getAttribute('title') || '');
      this.innerHTML = `<span class="rarity ${tier}">${RARITY_LABEL[tier]}</span>`;
    }
  }

  class ShinyBadge extends HTMLElement {
    static get observedAttributes() { return ['comp']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      this.innerHTML = maxCompValue(this.getAttribute('comp') || '') >= 200000
        ? '<span class="shiny-badge">Shiny</span>' : '';
    }
  }

  class RoleCard extends HTMLElement {
    static get observedAttributes() {
      return ['company', 'title', 'location', 'emptype', 'category', 'priority', 'posted', 'discovered', 'freshness', 'rationale', 'url', 'role-id'];
    }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      const tier = rarityOf(g('company'), g('emptype'), g('title'));
      const fresh = g('freshness') ? `<span class="freshness">Source freshness: ${esc(g('freshness'))}</span>` : '';
      const officialTitle = g('title');
      const title = officialTitle.replace(/\s*[-–—]\s*(?:New College Grad|New Grad|New Graduate|University Graduate)\s*\d{4}.*$/i, '');
      const year = officialTitle.match(/\b20\d{2}\b/)?.[0];
      const locations = g('location').split(/;\s*/).filter(Boolean);
      const locationTags = locations.slice(0, 2).map(location => `<span class="role-tag">${esc(location)}</span>`).join('');
      const fullAnalysis = toBullets(g('rationale'));
      const preview = fullAnalysis.match(/<li>(.*?)<\/li>/s)?.[1] || 'Open analysis for role details.';
      this.innerHTML = `<article class="role-card compact-role t-${tier}">
        <div class="compact-role-head">
          <logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img>
          <strong class="compact-company">${esc(g('company'))}</strong>
          <span class="rarity ${tier}" title="Company tier">${RARITY_LABEL[tier]}</span>
        </div>
        <h3>${esc(title)}</h3>
        <div class="role-tags" aria-label="Role basics">
          <span class="role-tag">${g('emptype') === 'FT' ? 'Full-time' : esc(g('emptype'))}</span>
          ${year ? `<span class="role-tag">${esc(year)}</span>` : ''}
          ${locationTags}${locations.length > 2 ? `<span class="role-tag">+${locations.length - 2} locations</span>` : ''}
          <span class="role-tag role-tag-comp">${esc(compensationTag(g('rationale')))}</span>
        </div>
        <p class="role-fit-preview">${preview}</p>
        <details class="role-analysis">
          <summary>View analysis</summary>
          <p class="role-domain">${esc(g('category'))}</p>
          ${fullAnalysis}
          <details class="role-source-details">
            <summary>Source details</summary>
            <p><strong>Official title:</strong> ${esc(officialTitle)}</p>
            <p><strong>Locations:</strong> ${esc(g('location'))}</p>
            <div class="meta"><span>Employer posted date: ${esc(g('posted') || 'Not listed')}</span><span>Discovered: ${esc(g('discovered'))}</span>${fresh}</div>
          </details>
        </details>
        <div class="compact-role-foot"><button type="button" data-queue-role="${esc(g('role-id'))}"${(store().get('workflow.applications') || {})[g('role-id')] ? ' disabled' : ''}>${(store().get('workflow.applications') || {})[g('role-id')] ? 'Queued' : 'Queue application'}</button><status-pill kind="priority" value="${esc(g('priority'))}"></status-pill><a href="${esc(g('url'))}" target="_blank" rel="noreferrer" data-track-role="${esc(g('role-id'))}">Open application</a></div>
      </article>`;
    }
  }

  class DropEntry extends HTMLElement {
    static get observedAttributes() {
      return ['mode', 'company', 'title', 'location', 'type', 'dateseen', 'comp', 'status', 'skipreason', 'note', 'url', 'wild'];
    }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      if (g('mode') === 'compact') {
        const isNew = g('wild') === '1';
        const wild = isNew ? `<span class="wild-header">A new opportunity awaits</span>` : '';
        this.innerHTML = `<div class="sudo-line${isNew ? ' wild-new' : ''}">${wild}<status-pill kind="sudo" value="${esc(g('status'))}"></status-pill><span>${esc(g('title'))} — ${esc(g('company'))}</span></div>`;
        return;
      }
      const reason = g('skipreason') ? `<p class="skip-reason">Skipped: ${esc(g('skipreason'))}</p>` : '';
      const note = g('note') ? toBullets(g('note')) : '';
      const link = g('url')
        ? `<a href="${esc(g('url'))}" target="_blank" rel="noreferrer">Open posting</a>`
        : `<span class="meta no-link">No link captured from story</span>`;
      this.innerHTML = `<article class="role-card drop-card">
        <div class="role-head"><div class="company-line"><logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img><div><p class="eyebrow">${esc(g('type'))} · SEEN ${esc(g('dateseen'))}</p><h3>${esc(g('title'))}</h3><p class="company">${esc(g('company'))} <span>·</span> ${esc(g('location'))}</p></div></div><div class="head-badges"><rarity-badge company="${esc(g('company'))}" type="${esc(g('type'))}" title="${esc(g('title'))}"></rarity-badge><shiny-badge comp="${esc(g('comp'))}"></shiny-badge><status-pill kind="sudo" value="${esc(g('status'))}"></status-pill></div></div>
        ${g('comp') ? `<div class="meta"><span>Comp: ${esc(g('comp'))}</span></div>` : ''}
        ${reason}${note}
        ${link}
      </article>`;
    }
  }

  /* Dense single-line row for the Story Drops expanded view.
     Tapping toggles ONLY this row's full details inline. */
  class DropRow extends HTMLElement {
    static get observedAttributes() {
      return ['company', 'title', 'location', 'type', 'dateseen', 'comp', 'status', 'skipreason', 'note', 'url'];
    }
    connectedCallback() { this.render(); this._bind(); }
    attributeChangedCallback() { this.render(); }
    _bind() {
      if (this._bound) return;
      this._bound = true;
      this.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        this.toggle();
      });
      this.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); this.toggle(); }
      });
    }
    toggle() {
      this._open = !this._open;
      this.render();
    }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      const open = !!this._open;
      const reason = g('skipreason') ? `<p class="skip-reason">Skipped: ${esc(g('skipreason'))}</p>` : '';
      const note = g('note') ? toBullets(g('note')) : '';
      const link = g('url')
        ? `<a href="${esc(g('url'))}" target="_blank" rel="noreferrer">Open posting</a>`
        : `<span class="meta no-link">No link captured from story</span>`;
      const details = open ? `<div class="drop-row-details">
          <div class="meta"><span>${esc(g('type'))}</span><span>Seen ${esc(g('dateseen'))}</span><span>${esc(g('location'))}</span>${g('comp') ? `<span>Comp: ${esc(g('comp'))}</span>` : ''}</div>
          ${reason}${note}${link}
        </div>` : '';
      this.innerHTML = `<div class="drop-row${open ? ' open' : ''}" role="button" tabindex="0" aria-expanded="${open ? 'true' : 'false'}" aria-label="${esc(g('title'))} at ${esc(g('company'))}. Activate for details.">
          <logo-img company="${esc(g('company'))}" cls="drop-row-logo"></logo-img>
          <span class="drop-row-title"><strong>${esc(g('title'))}</strong> &mdash; ${esc(g('company'))}</span>
          <span class="drop-row-badges"><rarity-badge company="${esc(g('company'))}" type="${esc(g('type'))}" title="${esc(g('title'))}"></rarity-badge><status-pill kind="sudo" value="${esc(g('status'))}"></status-pill></span>
          <span class="drop-row-caret" aria-hidden="true">${open ? '&#9662;' : '&#9656;'}</span>
        </div>${details}`;
    }
  }

  class XpHud extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.bound) {
        this.dataset.bound = '1';
        // Re-render whenever progress changes; replaces the old jb:hud event.
        store().subscribe('progress', () => this.render());
      }
      this.render();
    }
    render() {
      const xp = getXp();
      const compact = this.closest('.dashboard-progress')?.querySelector('#progress-summary');
      if (compact) compact.textContent = `${xp} XP · ${streakCount()}d streak`;
      const { lvl, next } = levelFor(xp);
      const pct = next ? Math.min(100, Math.round(((xp - lvl.min) / (next.min - lvl.min)) * 100)) : 100;
      this.innerHTML = `<div class="hud-row">`
        + `<span class="hud-level">${esc(lvl.title)}</span>`
        + `<div class="xp-bar" role="progressbar" aria-valuenow="${xp}" aria-valuemin="0" aria-label="Experience points"><div class="xp-fill" style="width:${pct}%"></div></div>`
        + `<span class="hud-xp coin-pill">${xp} XP<span class="coin-plus" aria-hidden="true">+</span></span>`
        + `<span class="hud-streak coin-pill gold" title="Consecutive active days">🔥 ${streakCount()}</span>`
        + `</div>`
        + (next
          ? `<p class="hud-next">${next.min - xp} XP to ${esc(next.title)}</p>`
          : `<p class="hud-next">Max level reached</p>`);
    }
  }

  class ProcCard extends HTMLElement {
    static get observedAttributes() { return ['company', 'title', 'url', 'status', 'days', 'next']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      const daysRaw = g('days');
      const days = daysRaw === '' ? null : Number(daysRaw);
      const stale = days !== null && days >= 7;
      const daysText = days === null ? 'date unknown' : (days === 0 ? 'today' : `${days}d ago`);
      const tier = rarityOf(g('company'), '', g('title'));
      this.innerHTML = `<article class="role-card proc-card t-${tier}${stale ? ' stale' : ''}">
        <div class="role-head"><div class="company-line"><logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img><div><p class="eyebrow">${esc(g('status'))}</p><h3>${esc(g('title'))}</h3><p class="company">${esc(g('company'))}</p></div></div><div class="head-badges"><rarity-badge company="${esc(g('company'))}" title="${esc(g('title'))}"></rarity-badge></div></div>
        <p class="proc-next">Next: ${esc(g('next'))}</p>
        <div class="meta"><span>Last change: ${esc(daysText)}</span>${stale ? '<span class="stale-flag">Stale 7+ days</span>' : ''}</div>
        <a href="${esc(g('url'))}" target="_blank" rel="noreferrer">Open posting</a>
      </article>`;
    }
  }

  /* ================= Pack opening: <drop-card> + <pack-opening> =================
     Brawl-Stars-style reveal. Each card starts face-down; tapping flips it to
     Common and each further tap upgrades one tier, stopping at the card's
     true tier (derived from company name, never past it). Mystery cards are
     unlocked by spam-tapping or swiping. Presentation only; all state in
     localStorage. Emits bubbling 'dropcard:done' when a card hits its true
     tier, and 'dropcard:seen' when a mystery is unlocked. */

  class DropCard extends HTMLElement {
    static get observedAttributes() {
      return ['company', 'title', 'location', 'type', 'comp', 'status', 'skipreason', 'url', 'dropkey', 'mystery', 'glow', 'mini'];
    }
    connectedCallback() {
      const company = this.getAttribute('company') || '';
      this._trueTier = rarityOf(company, this.getAttribute('type') || '', this.getAttribute('title') || '');
      this._stage = this.getAttribute('mystery') === '1' ? 'mystery' : 'back';
      this._taps = [];
      this._done = false;
      this._bound = false;
      this.render();
      this._bind();
    }
    attributeChangedCallback() { /* stage changes re-render internally */ }
    get trueTier() { return this._trueTier || 'common'; }

    _bind() {
      if (this._bound) return;
      this._bound = true;
      this.addEventListener('click', () => this._tap());
      this.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); this._tap(); }
      });
      let sx = null;
      this.addEventListener('pointermove', (e) => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const card = this.querySelector('.dropcard');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--tilt-x', `${((e.clientY-r.top)/r.height-.5)*-10}deg`);
        card.style.setProperty('--tilt-y', `${((e.clientX-r.left)/r.width-.5)*12}deg`);
      });
      this.addEventListener('pointerleave', () => {
        const card = this.querySelector('.dropcard');
        card?.style.setProperty('--tilt-x', '0deg');
        card?.style.setProperty('--tilt-y', '0deg');
      });
      this.addEventListener('pointerdown', (e) => { sx = e.clientX; });
      this.addEventListener('pointerup', (e) => {
        if (sx !== null && Math.abs(e.clientX - sx) > 60 && this._stage === 'mystery') this._unlock();
        sx = null;
      });
    }

    _tap() {
      if (this._stage === 'mystery') {
        this._unlock();
        this._stage = 'common';
        this._pop();
        this._checkDone();
        return;
      }
      if (this._stage === 'back') {
        this._stage = 'common';
        this._pop();
        this._checkDone();
        return;
      }
      const idx = tierIndex(this._stage);
      const trueIdx = tierIndex(this.trueTier);
      if (idx < trueIdx) {
        this._stage = TIER_ORDER[idx + 1];
        this._pop();
        this._checkDone();
      } else {
        const el = this.querySelector('.dropcard');
        if (el) { el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); }
      }
    }

    _unlock() {
      if (this._stage !== 'mystery') return;
      this._stage = 'back';
      const key = this.getAttribute('dropkey');
      if (key) markDropSeen(key);
      this._taps = [];
      this.render();
      this.dispatchEvent(new CustomEvent('dropcard:seen', { bubbles: true, composed: true }));
    }

    revealFully() {
      if (this._stage === 'mystery') this._unlock();
      this._stage = this.trueTier;
      this._pop();
      this._checkDone();
    }

    _pop() {
      const focused = this.contains(document.activeElement);
      this.render();
      if (focused) this.querySelector('[tabindex]')?.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('dropcard:stage', { bubbles: true, composed: true, detail: { tier: this._stage } }));
      const el = this.querySelector('.dropcard');
      if (!el) return;
      el.classList.add('pop');
      // Card-battler punch: springy scale/tilt with a flash of the new tier hue.
      if (el.animate && typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const hex = TIER_HEX[this._stage] || TIER_HEX.common;
        el.animate([
          { transform: 'scale(.9) rotate(-2deg)', boxShadow: `0 0 0 ${hex}00`, opacity: .75 },
          { transform: 'scale(1.06) rotate(1.5deg)', boxShadow: `0 0 46px ${hex}`, opacity: 1, offset: .55 },
          { transform: 'scale(1) rotate(0deg)', boxShadow: `0 0 20px ${hex}99` },
        ], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    }

    _checkDone() {
      if (!this._done && this._stage === this.trueTier) {
        this._done = true;
        const logo = this.querySelector('.dropcard-art');
        if (logo?.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) logo.animate([{transform:'scale(.6)',filter:'brightness(3)'},{transform:'scale(1.15)',filter:'brightness(1.4)',offset:.6},{transform:'scale(1)',filter:'brightness(1)'}],{duration:650,easing:'cubic-bezier(.16,1,.3,1)'});
        this.dispatchEvent(new CustomEvent('dropcard:done', { bubbles: true, composed: true, detail: { tier: this.trueTier } }));
      }
    }

    render() {
      const g = (n) => this.getAttribute(n) || '';
      const glow = g('glow');
      const mini = g('mini') === '1';
      const glowCls = glow === 'strong' ? ' glow-strong' : glow === 'weak' ? ' glow-weak' : '';
      const miniCls = mini ? ' mini' : '';
      if (this._stage === 'mystery') {
        this.innerHTML = `<article class="dropcard mystery${miniCls}" role="button" tabindex="0" aria-label="Mystery drop. Tap to reveal.">
          <p class="wild-header">A new opportunity awaits</p>
          <div class="mystery-q">?</div>
          <p class="mystery-count">Tap to reveal</p>
          <p class="dropcard-hint">tap to open</p>
        </article>`;
        return;
      }
      if (this._stage === 'back') {
        this.innerHTML = `<article class="dropcard back${miniCls}" role="button" tabindex="0" aria-label="Face-down drop card. Tap to reveal.">
          <div class="card-back-pattern"></div>
          <p class="dropcard-hint">tap to reveal</p>
        </article>`;
        return;
      }
      const stage = this._stage;
      const isTrue = stage === this.trueTier;
      const reason = g('skipreason') ? `<p class="skip-reason">Skipped: ${esc(g('skipreason'))}</p>` : '';
      // Figma "Poke Breed" split card: teal-gradient top with the logo in a
      // white circular badge, black bottom sheet with stat rows.
      const full = isTrue ? `
          <div class="dropcard-stats">
            <div class="stat-row"><span>Location</span><span>${esc(g('location'))}</span></div>
            <div class="stat-row"><span>Track</span><span>${esc(g('type'))}</span></div>
            ${g('comp') ? `<div class="stat-row"><span>Comp</span><span>${esc(g('comp'))}</span></div>` : ''}
          </div>
          <div class="dropcard-badges"><status-pill kind="sudo" value="${esc(g('status'))}"></status-pill><shiny-badge comp="${esc(g('comp'))}"></shiny-badge></div>
          ${reason}
          ${g('url') ? `<a class="dropcard-link" href="${esc(g('url'))}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Open posting</a>` : ''}`
        : '';
      const nextHint = !isTrue ? `<p class="dropcard-hint">tap to power up</p>` : `<p class="dropcard-hint done">Fully revealed</p>`;
      this.innerHTML = `<article data-revealed="${isTrue}" class="dropcard t-${stage}${glowCls}${miniCls}" role="button" tabindex="0" aria-label="${isTrue ? esc(g('title')) + ' at ' + esc(g('company')) : 'Charging drop'}, ${RARITY_LABEL[stage]} tier.">
        <div class="dropcard-top">
          <div class="dropcard-art">${isTrue ? `<logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img>` : `<span class="charge-symbol" aria-hidden="true">?</span>`}</div>
          <span class="rarity ${stage}">${RARITY_LABEL[stage]}</span>
        </div>
        <div class="dropcard-sheet">
          <p class="dropcard-company">${isTrue ? esc(g('company')) : 'Power building'}</p>
          <h4>${isTrue ? esc(g('title')) : 'Something stronger is inside'}</h4>
          ${full}
          ${nextHint}
        </div>
      </article>`;
    }
  }

  class PackOpening extends HTMLElement {
    // Initialized at construction (not in connectedCallback) so the `items`
    // setter is safe to call before the element is attached — showPack() sets
    // items and *then* appends, and the setter renders immediately.
    _items = [];
    _doneKeys = new Set();
    _expected = 0;
    _claimed = false;
    _closed = false;
    _wired = false;
    connectedCallback() {
      if (this._wired) return;
      this._wired = true;
      this._previousFocus = document.activeElement;
      this._previousOverflow = document.body.style.overflow;
      store().set('ui.packOpen', true);
      this.render();
      this._wire();
      this.setActiveCard(0);
      this.querySelectorAll('.pack-row [tabindex], .pack-tools button, .pack-nav button').forEach((el) => el.setAttribute('tabindex', '-1'));
      this.querySelector('.pack-close')?.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('pack:mounted', { bubbles: true }));
    }
    set items(val) {
      this._items = Array.isArray(val) ? val : [];
      this.render();
    }
    get items() { return this._items; }

    _wire() {
      this.addEventListener('click', (e) => {
        if (e.target.closest('.pack-tear-button')) return this.openSeal();
        if (e.target.closest('.pack-close')) return this.close(false);
        if (e.target === this.querySelector('.pack-overlay')) return this.close(false);
        if (e.target.closest('.pack-reveal-all')) return this.revealAll();
        const claim = e.target.closest('.pack-claim');
        if (claim) return this.claim();
        const nav = e.target.closest('[data-pack-nav]');
        if (nav) {
          this.setActiveCard((this._activeIndex || 0) + Number(nav.dataset.packNav));
          return;
        }
        const combo = e.target.closest('.double-combo');
        if (combo) return this._splitDouble(combo);
      });
      this.addEventListener('dropcard:done', (e) => {
        const card = e.target;
        const key = card.getAttribute && card.getAttribute('dropkey');
        if (key && !this._doneKeys.has(key)) {
          this._doneKeys.add(key);
          this._checkComplete();
        }
      });
      document.addEventListener('keydown', this._escHandler = (e) => {
        if (e.key === 'Escape') return this.close(false);
        const combo = e.target.closest?.('.double-combo');
        if (combo && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          this._splitDouble(combo);
          return;
        }
        if (e.key === 'Tab') {
          const targets = [...this.querySelectorAll('button, a[href], [tabindex="0"]')].filter((el) => !el.disabled && !el.closest('[hidden]') && el.getAttribute('tabindex') !== '-1');
          const first = targets[0], last = targets[targets.length - 1];
          if (e.shiftKey && (document.activeElement === first || !this.contains(document.activeElement))) { e.preventDefault(); last?.focus({ preventScroll: true }); }
          else if (!e.shiftKey && (document.activeElement === last || !this.contains(document.activeElement))) { e.preventDefault(); first?.focus({ preventScroll: true }); }
        }
      });
      let startX = null;
      const tear = this.querySelector('.pack-tear-button');
      tear?.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
        tear.setPointerCapture(e.pointerId);
      });
      tear?.addEventListener('pointermove', (e) => {
        if (startX === null || this._sealOpen) return;
        this._tearProgress = Math.min(1, Math.abs(e.clientX-startX) / Math.max(80, tear.offsetWidth * .65));
        this.style.setProperty('--tear-progress', this._tearProgress);
        this.dispatchEvent(new CustomEvent('pack:charge', { bubbles: true }));
        if (this._tearProgress >= 1) this.openSeal();
      });
      const resetTear = () => { startX = null; if (!this._sealOpen) { this._tearProgress = 0; this.style.setProperty('--tear-progress', 0); } };
      tear?.addEventListener('pointerup', resetTear);
      tear?.addEventListener('pointercancel', resetTear);
      document.body.style.overflow = 'hidden';
    }

    openSeal() {
      if (this._sealOpen || this._closed) return;
      this._sealOpen = true;
      this.classList.add('pack-tearing');
      this.querySelector('.pack-seal')?.setAttribute('aria-hidden', 'true');
      const button = this.querySelector('.pack-tear-button');
      if (button) button.disabled = true;
      this.dispatchEvent(new CustomEvent('pack:tear', { bubbles: true }));
      const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
      this._tearTimer = setTimeout(() => {
        if (this._closed) return;
        this.classList.remove('pack-sealed', 'pack-tearing');
        this.querySelectorAll('.pack-row [tabindex], .pack-tools button, .pack-nav button').forEach((el) => el.setAttribute('tabindex', '0'));
        this.querySelector('.pack-seal')?.setAttribute('hidden', '');
        this.querySelector('.dropcard, .double-combo')?.focus({ preventScroll: true });
      }, delay);
    }

    setActiveCard(index) {
      const cards = [...this.querySelectorAll('.pack-row drop-card, .pack-row .double-wrap')];
      this._activeIndex = Math.max(0, Math.min(cards.length - 1, index));
      cards.forEach((card, i) => { card.hidden = i !== this._activeIndex; });
      const label = this.querySelector('.pack-nav span');
      if (label) label.textContent = cards.length ? `Card ${this._activeIndex + 1} of ${cards.length}` : 'No cards';
      const previous = this.querySelector('[data-pack-nav="-1"]');
      const next = this.querySelector('[data-pack-nav="1"]');
      if (previous) previous.disabled = this._activeIndex <= 0;
      if (next) next.disabled = this._activeIndex >= cards.length - 1;
      this.dispatchEvent(new CustomEvent('pack:charge', { bubbles: true }));
    }

    _cardAttrs(d) {
      return `company="${esc(d.company || '')}" title="${esc(d.title || '')}" location="${esc(d.location || '')}" type="${esc(d.type || '')}" comp="${esc(d.comp || '')}" status="${esc(d.status || 'pending')}" skipreason="${esc(d.skipReason || '')}" url="${esc(d.url || '')}" dropkey="${esc(dropKey(d))}" mystery="${(!seenDrops().has(dropKey(d))) ? '1' : '0'}" glow="${esc(d.glow || '')}"`;
    }

    _expectedCount() {
      let n = 0;
      this._items.forEach((it) => { n += it.kind === 'double' ? 2 : 1; });
      return n;
    }

    render() {
      if (this._closed) return;
      const items = this._items;
      this._expected = this._expectedCount();
      const total = items.reduce((n, it) => n + (it.kind === 'double' ? it.drops.length : 1), 0);
      let cards = '';
      items.forEach((it, i) => {
        if (it.kind === 'double') {
          const [a, b] = it.drops;
          const anyMystery = [a, b].some((d) => !seenDrops().has(dropKey(d)));
          cards += `<div class="double-wrap" data-double="${i}">
            <div class="double-combo${anyMystery ? ' mystery' : ''}" role="button" tabindex="0" aria-label="Double drop from ${esc(a.company || '')}. Tap to split.">
              ${anyMystery ? `<p class="wild-header">Double drop</p><div class="mystery-q dim">2?</div><p class="dropcard-hint">tap to split your two drops</p>`
                : `<div class="card-back-pattern"></div><p class="double-label">2-in-1 drop</p><p class="dropcard-hint">tap to split</p>`}
            </div>
          </div>`;
        } else {
          cards += `<drop-card ${this._cardAttrs(it.drop)}></drop-card>`;
        }
      });
      this.classList.toggle('pack-sealed', !this._sealOpen);
      this.innerHTML = `<div class="pack-overlay">
        <div class="pack-modal" role="dialog" aria-modal="true" aria-label="Today's Drop Pack">
          <div class="pack-head">
            <div><h2>Daily drop pack</h2>
            <p class="pack-sub">${total} drop${total === 1 ? '' : 's'} · charge, reveal, collect</p></div>
            <button class="pack-close icon-btn" aria-label="Close pack">x</button>
          </div>
          <section class="pack-seal" aria-label="Sealed opportunity pack">
            <div class="pack-seal-art"><div class="seal-shard seal-shard-top" aria-hidden="true"></div><div class="seal-shard seal-shard-bottom" aria-hidden="true"></div>
              <span class="seal-edition">ZERO2SUDO · DAILY EDITION</span>
              <strong class="seal-title">Your next<br>big move.</strong>
              <span class="seal-count">${total} opportunities inside</span>
              <button class="pack-tear-button">Slide across to tear · or tap</button>
            </div>
            <p class="seal-instruction">Break the seal. See what’s inside.</p>
          </section>
          <div class="pack-tools"><p class="pack-progress" role="status">0 / ${total} revealed</p><button class="pack-reveal-all">Reveal all</button></div>
          <div class="pack-row">${cards || '<p class="empty">No drops today.</p>'}</div>
          <div class="pack-nav"><button data-pack-nav="-1" aria-label="Previous card">Previous</button><span>Card 1</span><button data-pack-nav="1" aria-label="Next card">Next</button></div>
          <div class="pack-foot" hidden>
            <p class="pack-summary"></p>
            <button class="pack-claim">${store().get(`drops.packRewards.${dayStamp()}`) ? "Done · XP already claimed" : "Claim +25 XP"}</button>
          </div>
        </div>
      </div>`;
      if (this._doneKeys.size >= this._expected && this._expected > 0) this._showComplete();
    }

    _splitDouble(comboEl) {
      const focused = comboEl.contains(document.activeElement) || comboEl === document.activeElement;
      const wrap = comboEl.closest('.double-wrap');
      const idx = Number(wrap.dataset.double);
      const it = this._items[idx];
      if (!it || it.kind !== 'double') return;
      const [a, b] = it.drops;
      [a, b].forEach((d) => markDropSeen(dropKey(d)));
      const anyMystery = comboEl.classList.contains('mystery');
      const mk = (d) => {
        const el = document.createElement('drop-card');
        const tmp = document.createElement('div');
        tmp.innerHTML = `<drop-card ${this._cardAttrs(d)}></drop-card>`;
        const card = tmp.firstChild;
        card.setAttribute('mini', '1');
        if (anyMystery) card.setAttribute('mystery', '0');
        return card;
      };
      const split = document.createElement('div');
      split.className = 'double-split';
      split.appendChild(mk(a));
      split.appendChild(mk(b));
      wrap.replaceWith(split);
      this.setActiveCard(this._activeIndex || 0);
      if (focused) split.querySelector('[tabindex]')?.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('dropcard:seen', { bubbles: true, composed: true }));
    }

    revealAll() {
      this.querySelectorAll('.double-combo').forEach((combo) => this._splitDouble(combo));
      this.querySelectorAll('drop-card').forEach((card) => card.revealFully());
    }

    _checkComplete() {
      const progress = this.querySelector('.pack-progress');
      if (progress) progress.textContent = `${this._doneKeys.size} / ${this._expected} revealed`;
      if (this._doneKeys.size >= this._expected && this._expected > 0) this._showComplete();
    }

    _showComplete() {
      const foot = this.querySelector('.pack-foot');
      if (!foot || this._claimed) return;
      const counts = {};
      this.querySelectorAll('drop-card').forEach((c) => {
        const t = (c.trueTier || 'common');
        counts[t] = (counts[t] || 0) + 1;
      });
      const parts = TIER_ORDER.slice().reverse()
        .filter((t) => counts[t])
        .map((t) => `${counts[t]} ${RARITY_LABEL[t]}`);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      foot.querySelector('.pack-summary').textContent = `${total} drop${total === 1 ? '' : 's'} revealed${parts.length ? ': ' + parts.join(' · ') : ''}`;
      foot.hidden = false;
      const reveal = this.querySelector('.pack-reveal-all');
      if (reveal) reveal.disabled = true;
    }

    claim() {
      if (this._claimed || !this._expected || this._doneKeys.size < this._expected) return;
      this._claimed = true;
      const rewarded = store().get(`drops.packRewards.${dayStamp()}`);
      if (!rewarded) {
        store().set(`drops.packRewards.${dayStamp()}`, true);
        addXp(25);
      } // store subscription refreshes the HUD automatically
      recordStreakDay();
      const btn = this.querySelector('.pack-claim');
      if (btn) { btn.textContent = rewarded ? 'Pack complete' : '+25 XP claimed'; btn.disabled = true; }
      setTimeout(() => this.close(true), 650);
    }

    close(claimed) {
      if (this._closed) return;
      this._closed = true;
      document.body.style.overflow = this._previousOverflow || '';
      document.removeEventListener('keydown', this._escHandler);
      store().set('ui.packOpen', false);
      store().set(`drops.packStamps.${dayStamp()}`, true);
      this.dispatchEvent(new CustomEvent('pack:closed', { bubbles: true, composed: true, detail: { claimed: !!claimed } }));
      this.remove();
      if (this._previousFocus?.isConnected) this._previousFocus.focus({ preventScroll: true });
    }

    disconnectedCallback() {
      clearTimeout(this._tearTimer);
      document.removeEventListener('keydown', this._escHandler);
      document.body.style.overflow = this._previousOverflow || '';
      store().set('ui.packOpen', false);
    }
  }

  customElements.define('logo-img', LogoImg);
  customElements.define('status-pill', StatusPill);
  customElements.define('rarity-badge', RarityBadge);
  customElements.define('shiny-badge', ShinyBadge);
  customElements.define('role-card', RoleCard);
  customElements.define('drop-entry', DropEntry);
  customElements.define('drop-row', DropRow);
  customElements.define('xp-hud', XpHud);
  customElements.define('proc-card', ProcCard);
  customElements.define('drop-card', DropCard);
  customElements.define('pack-opening', PackOpening);

  // store.js runs first and attaches window.JB.store; merge instead of
  // overwriting so the store survives.
  window.JB = Object.assign(window.JB || {}, JB);

  document.addEventListener('jb:logos', () => {
    document.querySelectorAll('logo-img').forEach((el) => el.render());
  });
})();
