// 오늘의 태클 조합 — UI
(function () {
  'use strict';

  const E = window.TackleEngine;
  const STORE_KEY = 'tackle-combo-v1';
  const UI_KEY = 'tackle-combo-ui-v1';
  const PACK_KEY = 'tackle-combo-pack-v1';
  const SESSION_KEY = 'tackle-combo-session-v1';
  const LOG_KEY = 'tackle-combo-log-v1';
  const APIKEY_KEY = 'tackle-combo-apikey';

  // ---------- 저장소 ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 저장 불가 환경 */ }
  }

  let data = readJSON(STORE_KEY, null) || clone(window.TACKLE_SEED);
  const ui = Object.assign({ tab: 'today', fieldId: null, dayOffset: 0, slot: null, lureFilter: '' }, readJSON(UI_KEY, {}));
  let overrides = {};
  const weatherCache = {};

  // 현장 모드(진행 중 출조)와 지난 출조 기록
  let session = readJSON(SESSION_KEY, null);
  let log = readJSON(LOG_KEY, []);
  const activeLure = Object.assign({}, session && session.lures); // 카테고리 → 지금 쓰는 루어 id
  function saveSession() { if (session) writeJSON(SESSION_KEY, session); else { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* noop */ } } }
  function saveLog() { writeJSON(LOG_KEY, log); }

  function save() { writeJSON(STORE_KEY, data); }
  function saveUi() { writeJSON(UI_KEY, ui); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- 유틸 ----------
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pad = (n) => String(n).padStart(2, '0');
  function dateStr(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function dateLabel(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const wd = '일월화수목금토'[d.getDay()];
    const rel = offset === 0 ? '오늘' : offset === 1 ? '내일' : '';
    return `${d.getMonth() + 1}/${d.getDate()} (${wd})${rel ? ' ' + rel : ''}`;
  }
  function defaultSlot() {
    const h = new Date().getHours();
    if (h < 9) return 'dawn';
    if (h < 16) return 'day';
    if (h < 20) return 'dusk';
    return 'night';
  }
  const TYPE_LABEL = { bait: '베이트', spinning: '스피닝', bfs: 'BFS' };
  const POWERS = ['UL', 'L', 'ML', 'M', 'MH', 'H', 'XH'];
  const catLabel = (id) => (E.CATEGORIES[id] ? E.CATEGORIES[id].short : id);

  // ---------- 탭 ----------
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => { ui.tab = b.dataset.tab; saveUi(); render(); });
  });

  function render() {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
    const view = $('#view');
    if (ui.tab === 'setups') view.innerHTML = renderSetups();
    else if (ui.tab === 'lures') view.innerHTML = renderLures();
    else if (ui.tab === 'fields') view.innerHTML = renderFields();
    else if (ui.tab === 'backup') view.innerHTML = renderBackup();
    else { view.innerHTML = renderTodayShell(); bindToday(); updateToday(); }
  }

  // ---------- 오늘 ----------
  function renderTodayShell() {
    if (!data.fields.length) {
      return '<div class="card empty">먼저 <b>필드</b> 탭에서 자주 가는 저수지·낚시터를 등록하세요.</div>';
    }
    if (session && !data.fields.some((f) => f.id === session.fieldId)) { session = null; saveSession(); }
    if (session) { ui.fieldId = session.fieldId; ui.dayOffset = 0; } // 현장 모드 중엔 필드·날짜 고정
    if (!data.fields.some((f) => f.id === ui.fieldId)) ui.fieldId = data.fields[0].id;
    if (!ui.slot) ui.slot = defaultSlot();
    const lock = session ? ' disabled' : '';
    const fieldOpts = data.fields.map((f) => `<option value="${esc(f.id)}"${f.id === ui.fieldId ? ' selected' : ''}>${esc(f.name)} · ${E.LABELS.field[f.type] || ''}</option>`).join('');
    const dayOpts = [0, 1, 2, 3, 4, 5, 6].map((o) => `<option value="${o}"${o === ui.dayOffset ? ' selected' : ''}>${dateLabel(o)}</option>`).join('');
    const slots = Object.keys(E.SLOT_HOUR).map((s) => `<button type="button" data-slot="${s}" aria-pressed="${s === ui.slot}">${E.LABELS.time[s].replace(/\(.*\)/, '')}</button>`).join('');
    const sel = (key, labels) => `<select data-ov="${key}"><option value="">자동</option>${Object.keys(labels).map((k) => `<option value="${k}"${overrides[key] === k ? ' selected' : ''}>${labels[k]}</option>`).join('')}</select>`;
    return `
      <section class="card">
        <div class="controls">
          <label class="full">어디로 가세요?<select id="fieldSel"${lock}>${fieldOpts}</select></label>
          <label>언제?<select id="daySel"${lock}>${dayOpts}</select></label>
          <label>시간대<div class="seg" id="slotSeg">${slots}</div></label>
        </div>
        <details class="adjust">
          <summary>현장 조건 직접 조정</summary>
          <div class="adjust-grid">
            <label>수온(°C)<input type="number" step="0.5" data-ov="waterTemp" placeholder="자동 추정" value="${esc(overrides.waterTemp == null ? '' : overrides.waterTemp)}"></label>
            <label>하늘${sel('sky', E.LABELS.sky)}</label>
            <label>바람${sel('wind', E.LABELS.wind)}</label>
            <label>기압${sel('pressure', E.LABELS.pressure)}</label>
            <label>물색${sel('clarity', E.LABELS.clarity)}</label>
          </div>
          <p class="notice">현장에서 본 물색·수온을 넣으면 추천이 바로 바뀝니다. 비워두면 날씨로 자동 추정해요.</p>
        </details>
      </section>
      <div id="todayResult"><div class="loading">날씨 불러오는 중…</div></div>`;
  }

  function bindToday() {
    const fs = $('#fieldSel');
    if (!fs) return;
    fs.addEventListener('change', () => { ui.fieldId = fs.value; saveUi(); updateToday(); });
    $('#daySel').addEventListener('change', (e) => { ui.dayOffset = Number(e.target.value); saveUi(); updateToday(); });
    $('#slotSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-slot]');
      if (!b) return;
      ui.slot = b.dataset.slot; saveUi();
      $('#slotSeg').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      updateToday();
    });
    document.querySelectorAll('[data-ov]').forEach((el) => {
      el.addEventListener('change', () => {
        const k = el.dataset.ov;
        if (el.value === '') delete overrides[k]; else overrides[k] = el.value;
        updateToday();
      });
    });
  }

  async function fetchWeather(field) {
    if (field.lat == null || field.lon == null || field.lat === '' || field.lon === '') return null;
    const key = `${field.lat},${field.lon}`;
    const hit = weatherCache[key];
    if (hit && Date.now() - hit.ts < 30 * 60 * 1000) return hit.data;
    const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: field.lat, longitude: field.lon,
      hourly: 'temperature_2m,weather_code,cloud_cover,wind_speed_10m,pressure_msl,precipitation',
      daily: 'temperature_2m_mean,precipitation_sum',
      wind_speed_unit: 'ms', timezone: 'Asia/Seoul', past_days: 7, forecast_days: 7,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    weatherCache[key] = { ts: Date.now(), data: json };
    return json;
  }

  let updateSeq = 0;
  async function updateToday() {
    const seq = ++updateSeq;
    const field = data.fields.find((f) => f.id === ui.fieldId);
    const out = $('#todayResult');
    if (!field || !out) return;
    let weather = null;
    let err = null;
    try { weather = await fetchWeather(field); } catch (e) { err = e; }
    if (seq !== updateSeq) return; // 더 최신 요청이 있음
    const cond = E.deriveConditions(weather, dateStr(ui.dayOffset), ui.slot, field, overrides);
    const rec = E.recommend(data, cond, field.id, 3, { bonus: E.historyBonus(log, field.id, cond.season) });
    const steps = E.buildRotation(rec.combos.concat(rec.others), session);
    $('#todayResult').innerHTML = renderResult(cond, rec, field, err, steps);
  }

  function condBox(k, v) { return `<div class="cond"><div class="k">${k}</div><div class="v">${v}</div></div>`; }

  function renderResult(c, rec, field, err, steps) {
    const L = E.LABELS;
    const skyIcon = { sunny: '☀️', cloudy: '☁️', rain: '🌧️' }[c.sky];
    let html = '<section class="card">';
    html += `<div class="section-title" style="margin-top:0"><h2>${esc(field.name)} · ${dateLabel(ui.dayOffset)} ${L.time[c.slot]}</h2></div>`;
    html += '<div class="cond-grid">';
    html += condBox('계절', L.season[c.season]);
    html += condBox(c.waterTempEstimated ? '수온(추정)' : '수온', `${c.waterTemp}°C`);
    if (c.airTemp != null) html += condBox('기온', `${Math.round(c.airTemp)}°C`);
    html += condBox('하늘', `${skyIcon} ${L.sky[c.sky]}`);
    html += condBox('바람', c.windMs != null ? `${L.wind[c.wind]} ${c.windMs.toFixed(1)}m/s` : L.wind[c.wind]);
    html += condBox('기압', c.pressureDiff != null ? `${L.pressure[c.pressure]} (${c.pressureDiff > 0 ? '+' : ''}${c.pressureDiff})` : L.pressure[c.pressure]);
    html += condBox('물색', L.clarity[c.clarity]);
    if (c.rain2d) html += condBox('최근 3일 비', `${c.rain2d}mm`);
    html += '</div>';
    if (rec.notes.length) html += `<ul class="notes small">${rec.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
    html += `<p class="notice">🎨 컬러: ${esc(rec.colorAdvice.text)}</p>`;
    if (err) html += `<p class="notice warn">날씨를 불러오지 못해 계절 평균값으로 계산했어요. (${esc(err.message)}) 위의 '현장 조건 직접 조정'으로 보정하세요.</p>`;
    else if (c.source === 'season') html += '<p class="notice">이 필드에 좌표가 없어 계절 평균값으로 계산했어요. 필드 탭에서 위도·경도를 넣으면 실제 날씨를 반영합니다.</p>';
    html += '</section>';

    if (!rec.combos.length) {
      html += '<div class="card empty">추천할 루어가 없어요. <b>루어</b> 탭에서 루어를 등록하세요.</div>';
      return html;
    }

    html += session ? renderLive(steps, field) : renderRotation(steps);

    html += '<div class="section-title"><h2>오늘의 태클 조합</h2><span class="muted small">점수 = 조건 적합도</span></div>';
    const rankName = ['메인', '서브', '비장의 카드'];
    rec.combos.forEach((cb, i) => { html += renderCombo(cb, i, rankName[i]); });

    if (rec.missing.length) {
      html += `<div class="card small"><b>💡 장비 보강 힌트</b><br>오늘은 ${rec.missing.map((m) => `<b>${esc(E.CATEGORIES[m.id].label)}</b>(${m.score}점)`).join(', ')}도 잘 맞는 날인데 등록된 루어가 없어요.</div>`;
    }

    html += renderPacking(rec);

    if (rec.others.length) {
      html += `<details class="card others"><summary><b>나머지 조합 순위</b> <span class="muted small">(${rec.others.length})</span></summary><ul>` +
        rec.others.map((cb) => `<li><span>${esc(cb.categoryLabel)} — ${esc(cb.lures.map((x) => x.lure.name).join(', '))}</span><b class="${cb.score >= 0 ? 'pos' : 'warn'}">${cb.score}</b></li>`).join('') +
        '</ul></details>';
    }
    return html;
  }

  // ---------- 로테이션 & 현장 모드 ----------
  const CIRCLED = ['①', '②', '③', '④', '⑤'];
  const EVENT_LABEL = { nobite: '🙅 입질 없음', bite: '👀 입질', catch: '🎣 잡았다' };
  const hhmm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const minutesSince = (t) => Math.max(0, Math.floor((Date.now() - t) / 60000));

  function stepSpot(step, round) {
    const spots = step.combo.spots;
    return spots.length ? spots[round % spots.length] : null;
  }

  function stepLine(step, i, round) {
    const sp = stepSpot(step, round);
    return `<b>${CIRCLED[i]} ${esc(step.label)} · ${step.minutes}분</b> — ${esc(E.CATEGORIES[step.combo.category].short)}
      <span class="small">(${esc(step.combo.lures.map((x) => x.lure.name).join(', '))}${sp ? ` @ ${esc(sp.name)}` : ''})</span>`;
  }

  function renderRotation(steps) {
    if (!steps.length) return '';
    const startBtn = ui.dayOffset === 0
      ? '<button class="btn primary big" data-action="start-session">▶ 현장 모드 시작</button>'
      : '<p class="muted small">현장 모드는 출조 당일에 시작할 수 있어요.</p>';
    return `<section class="card rotation">
      <div class="section-title" style="margin-top:0"><h2>🔁 오늘의 로테이션</h2></div>
      <ol class="rot">${steps.map((s, i) => `<li>${stepLine(s, i, 0)}<div class="muted small">${esc(s.tip)}</div></li>`).join('')}</ol>
      <p class="muted small">현장 모드에서 입질 여부를 누르면 다음에 던질 루어를 바로 바꿔드려요.</p>
      ${startBtn}
    </section>`;
  }

  function lureChoices(cat, step) {
    const all = data.lures.filter((l) => l.category === cat)
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    if (!activeLure[cat] || !all.some((l) => l.id === activeLure[cat])) {
      activeLure[cat] = step.combo.lures[0] ? step.combo.lures[0].lure.id : (all[0] && all[0].id);
    }
    return all;
  }

  function renderLive(steps, field) {
    const round = session.round || 0;
    const cur = E.currentStep(steps, session);
    const catches = session.events.filter((e) => e.type === 'catch').length;
    const bites = session.events.filter((e) => e.type === 'bite').length;
    const lastAt = session.events.length ? session.events[session.events.length - 1].t : session.startedAt;
    let html = `<section class="card live">
      <div class="live-head"><span class="dot" aria-hidden="true"></span><b>현장 모드</b>
        <span class="muted small">${esc(field.name)} · ${hhmm(session.startedAt)} 시작${round ? ` · ${round + 1}번째 포인트` : ''}</span>
        <span class="tally">🎣 ${catches} · 👀 ${bites}</span></div>`;

    if (cur.exhausted) {
      html += `<div class="now"><h3>세 단계 모두 반응이 없었어요</h3>
        <p class="small">이 포인트는 배스가 없거나 꺼져 있을 가능성이 커요. 포인트를 옮겨서 로테이션을 다시 돌려보세요.</p>
        <button class="btn primary big" data-action="next-round">📍 다음 포인트로 이동</button></div>`;
    } else {
      const step = steps[cur.index];
      const cb = step.combo;
      const lures = lureChoices(cb.category, step);
      const sp = stepSpot(step, round);
      const s = cb.setup;
      const since = minutesSince(lastAt);
      const holdTip = cur.hold
        ? (cur.last.type === 'catch'
          ? '🎣 잡았어요! 같은 패턴 반복 — 비슷한 구조물·수심을 이어서 공략하세요.'
          : '👀 입질 확인! 같은 코스·수심으로 몇 번 더. 그래도 안 물면 사이즈·컬러를 한 단계 다운.')
        : esc(step.tip);
      const memo = (data.lures.find((l) => l.id === activeLure[cb.category]) || {}).memo;
      html += `<div class="now">
        <div class="now-label">${cur.hold ? '패턴 유지' : `지금 던질 것 · ${CIRCLED[cur.index]} ${esc(step.label)}`}</div>
        <h3>${esc(cb.categoryLabel)}</h3>
        <div class="chips lure-pick">${lures.map((l) => `<button type="button" class="chip pick" data-action="pick-lure" data-cat="${esc(cb.category)}" data-lure="${esc(l.id)}" aria-pressed="${l.id === activeLure[cb.category]}">${l.favorite ? '★ ' : ''}${esc(l.name)}</button>`).join('')}</div>
        <dl class="kv">
          <dt>태클</dt><dd>${s ? `<b>${esc(s.name)}</b> <span class="small muted">${esc(s.rod || '')}</span>` : '<span class="warn">담당 태클 없음</span>'}</dd>
          <dt>포인트</dt><dd>${sp ? `<b>${esc(sp.name)}</b>` : `<span class="small muted">${E.CATEGORIES[cb.category].spots.map((t) => E.STRUCTURES[t]).join(', ')}</span>`}</dd>
          <dt>액션</dt><dd>${esc(cb.action)}${memo ? `<br><span class="small">📝 ${esc(memo)}</span>` : ''}</dd>
        </dl>
        <p class="hold-tip">${holdTip}</p>
        <p class="timer small${since >= step.minutes ? ' over' : ''}" id="liveTimer" data-since="${lastAt}" data-minutes="${step.minutes}">${timerText(lastAt, step.minutes)}</p>
        <div class="event-btns">
          <button class="btn ev nobite" data-action="event" data-type="nobite" data-cat="${esc(cb.category)}">🙅<span>입질 없음</span><small>다음 루어로</small></button>
          <button class="btn ev bite" data-action="event" data-type="bite" data-cat="${esc(cb.category)}">👀<span>입질</span><small>패턴 유지</small></button>
          <button class="btn ev catch" data-action="event" data-type="catch" data-cat="${esc(cb.category)}">🎣<span>잡았다!</span><small>조과 기록</small></button>
        </div>
      </div>`;
    }

    html += `<details class="plan"><summary class="small">로테이션 전체 보기</summary><ol class="rot">${steps.map((st, i) => {
      const mark = i === cur.index ? '▶' : (cur.tried && cur.tried.has(st.combo.category)) ? '✓' : '';
      return `<li class="${mark === '✓' ? 'done' : ''}">${mark ? `<span class="mark">${mark}</span> ` : ''}${stepLine(st, i, round)}</li>`;
    }).join('')}</ol></details>`;

    if (session.events.length) {
      html += `<ul class="timeline small">${session.events.slice(-6).reverse().map((e) => {
        const lure = data.lures.find((l) => l.id === e.lureId);
        return `<li><span class="muted">${hhmm(e.t)}</span> ${EVENT_LABEL[e.type]} · ${esc(lure ? lure.name : catLabel(e.cat))}</li>`;
      }).join('')}</ul>`;
    }
    html += `<div class="btn-row live-foot">
      ${session.events.length ? '<button class="btn ghost sm" data-action="undo-event">↩ 마지막 기록 취소</button>' : ''}
      <button class="btn danger sm" data-action="end-session">🏁 출조 종료</button>
    </div></section>`;
    return html;
  }

  function timerText(since, minutes) {
    const m = minutesSince(since);
    return m >= minutes
      ? `⏱ 마지막 기록 후 ${m}분 — 권장 ${minutes}분 지남, 반응 없으면 '입질 없음'으로 넘기세요`
      : `⏱ 마지막 기록 후 ${m}분 / 권장 ${minutes}분`;
  }

  setInterval(() => {
    const el = document.getElementById('liveTimer');
    if (!el) return;
    const since = Number(el.dataset.since);
    const minutes = Number(el.dataset.minutes);
    el.textContent = timerText(since, minutes);
    el.classList.toggle('over', minutesSince(since) >= minutes);
  }, 30000);

  function endSession() {
    if (session.events.length) {
      const field = data.fields.find((f) => f.id === session.fieldId);
      log.unshift({
        id: session.id,
        fieldId: session.fieldId,
        fieldName: field ? field.name : '',
        date: session.date,
        startedAt: session.startedAt,
        endedAt: Date.now(),
        events: session.events,
        catches: session.events.filter((e) => e.type === 'catch').map((e) => {
          const l = data.lures.find((x) => x.id === e.lureId);
          return { cat: e.cat, lureId: e.lureId, lureName: l ? l.name : '', t: e.t };
        }),
      });
      saveLog();
    }
    session = null;
    saveSession();
  }

  function renderCombo(cb, i, rank) {
    const s = cb.setup;
    const setupHtml = s
      ? `<span class="setup-name">${esc(s.name)}</span><br><span class="small">${esc([s.rod, s.reel, s.line].filter(Boolean).join(' + '))}</span>`
      : '<span class="warn">이 카테고리를 담당하는 태클이 없어요. 태클 탭에서 "담당 카테고리"를 지정하세요.</span>';
    const lures = cb.lures.map((x) => {
      const l = x.lure;
      const colors = x.colors.length ? `<div class="chips" style="margin-top:4px">${x.colors.map((cl) => `<span class="chip${cl.hit ? ' hit' : ''}">${esc(cl.name)}</span>`).join('')}</div>` : '';
      return `<div class="lure-line"><span class="lure-name">${l.favorite ? '<span class="star">★</span> ' : ''}${esc(l.name)}</span> <span class="muted small">${esc([l.brand, l.size].filter(Boolean).join(' · '))}</span>${colors}</div>`;
    }).join('');
    const spots = cb.spots.length
      ? cb.spots.map((sp) => `<b>${esc(sp.name)}</b> <span class="muted small">(${(sp.tags || []).map((t) => esc(E.STRUCTURES[t] || t)).join(', ')})</span>`).join('<br>')
      : `<span class="muted small">추천 구조물: ${E.CATEGORIES[cb.category].spots.map((t) => E.STRUCTURES[t]).join(', ')}</span>`;
    const memos = cb.lures.map((x) => x.lure.memo).filter(Boolean);
    const action = esc(cb.action) + (memos.length ? `<br><span class="small">📝 ${esc(memos.join(' / '))}</span>` : '');
    const factors = cb.factors.map((f) => `<span class="chip ${f.v > 0 ? 'pos' : 'neg'}">${esc(f.label)} ${f.v > 0 ? '+' : ''}${f.v}</span>`).join('');
    return `
      <article class="card combo r${i + 1}">
        <header><span class="rank">${rank}</span><h3>${esc(cb.categoryLabel)}</h3><span class="score">${cb.score}점</span></header>
        <dl class="kv">
          <dt>태클</dt><dd>${setupHtml}</dd>
          <dt>루어</dt><dd>${lures}</dd>
          <dt>포인트</dt><dd>${spots}</dd>
          <dt>액션</dt><dd>${action}</dd>
        </dl>
        <div class="factors chips">${factors}</div>
      </article>`;
  }

  function renderPacking(rec) {
    const packKey = `${ui.fieldId}|${dateStr(ui.dayOffset)}`;
    const checked = (readJSON(PACK_KEY, {})[packKey]) || [];
    const row = (id, label) => `<label><input type="checkbox" data-pack="${esc(packKey)}" value="${esc(id)}"${checked.includes(id) ? ' checked' : ''}> ${label}</label>`;
    const setups = rec.packing.setups.map((s) => row(s.id, `<b>${esc(s.name)}</b> <span class="muted small">${esc(s.rod || '')}</span>`)).join('');
    const lures = rec.packing.lures.map((l) => row(l.id, esc(l.name))).join('');
    return `<section class="card pack"><div class="section-title" style="margin-top:0"><h2>🎒 패킹 체크리스트</h2></div>
      <div class="muted small">로드 ${rec.packing.setups.length}대</div>${setups}
      <div class="muted small" style="margin-top:8px">루어 ${rec.packing.lures.length}개</div>${lures}</section>`;
  }

  document.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-pack]');
    if (!cb) return;
    const all = readJSON(PACK_KEY, {});
    const key = cb.dataset.pack;
    const set = new Set(all[key] || []);
    if (cb.checked) set.add(cb.value); else set.delete(cb.value);
    all[key] = Array.from(set);
    writeJSON(PACK_KEY, all);
  });

  // ---------- 태클 ----------
  function renderSetups() {
    let html = `<div class="section-title"><h2>내 태클 세팅</h2><div class="btn-row">${photoBtn('setup')}<button class="btn primary sm" data-action="add" data-kind="setup">+ 세팅 추가</button></div></div>`;
    html += '<p class="muted small">로드 + 릴 + 라인 조합 단위로 저장하고, 이 세팅으로 쓰는 루어 카테고리를 지정하세요.</p>';
    if (!data.setups.length) return html + '<div class="card empty">등록된 태클이 없어요.</div>';
    data.setups.forEach((s) => {
      html += `<div class="card item"><div class="body">
        <h3>${s.favorite ? '<span class="star">★</span> ' : ''}${esc(s.name)} <span class="badge">${esc(TYPE_LABEL[s.type] || s.type)} ${esc(s.power || '')}</span></h3>
        <p>${esc([s.rod, s.reel, s.line].filter(Boolean).join(' + '))}</p>
        <div class="chips" style="margin-top:6px">${(s.categories || []).map((c) => `<span class="chip">${esc(catLabel(c))}</span>`).join('')}</div>
        ${s.memo ? `<p>${esc(s.memo)}</p>` : ''}
      </div>${itemActions('setup', s.id)}</div>`;
    });
    return html;
  }

  // ---------- 루어 ----------
  function renderLures() {
    const cats = Object.keys(E.CATEGORIES);
    let html = `<div class="section-title"><h2>내 루어</h2><div class="btn-row">${photoBtn('lure')}<button class="btn primary sm" data-action="add" data-kind="lure">+ 루어 추가</button></div></div>`;
    html += `<select class="filter" id="lureFilter"><option value="">전체 카테고리 (${data.lures.length})</option>${cats.map((c) => {
      const n = data.lures.filter((l) => l.category === c).length;
      return `<option value="${c}"${ui.lureFilter === c ? ' selected' : ''}>${esc(E.CATEGORIES[c].label)} (${n})</option>`;
    }).join('')}</select>`;
    const list = data.lures.filter((l) => !ui.lureFilter || l.category === ui.lureFilter);
    if (!list.length) return html + '<div class="card empty">등록된 루어가 없어요.</div>';
    list.forEach((l) => {
      html += `<div class="card item"><div class="body">
        <h3>${l.favorite ? '<span class="star">★</span> ' : ''}${esc(l.name)} <span class="badge">${esc(catLabel(l.category))}</span></h3>
        <p>${esc([l.brand, l.size].filter(Boolean).join(' · '))}</p>
        ${(l.colors || []).length ? `<div class="chips" style="margin-top:6px">${l.colors.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
        ${l.memo ? `<p>📝 ${esc(l.memo)}</p>` : ''}
      </div>${itemActions('lure', l.id)}</div>`;
    });
    return html;
  }

  document.addEventListener('change', (e) => {
    if (e.target.id === 'lureFilter') { ui.lureFilter = e.target.value; saveUi(); render(); }
  });

  // ---------- 필드 ----------
  function renderFields() {
    let html = '<div class="section-title"><h2>내 필드</h2><button class="btn primary sm" data-action="add" data-kind="field">+ 필드 추가</button></div>';
    html += '<p class="muted small">좌표는 날씨 조회에 쓰여요. 포인트마다 구조물 태그를 달면 루어별 최적 포인트를 골라드립니다.</p>';
    if (!data.fields.length) return html + '<div class="card empty">등록된 필드가 없어요.</div>';
    data.fields.forEach((f) => {
      html += `<div class="card item"><div class="body">
        <h3>${esc(f.name)} <span class="badge">${esc(E.LABELS.field[f.type] || f.type)}</span></h3>
        <p>${esc(f.region || '')}${f.lat != null && f.lat !== '' ? ` · ${esc(f.lat)}, ${esc(f.lon)}` : ' · 좌표 없음'} · 평소 ${esc(E.LABELS.clarity[f.clarity] || '')}</p>
        <div class="chips" style="margin-top:6px">${(f.spots || []).map((s) => `<span class="chip">${esc(s.name)}</span>`).join('')}</div>
      </div>${itemActions('field', f.id)}</div>`;
    });
    return html;
  }

  function itemActions(kind, id) {
    return `<div class="actions"><button class="icon-btn" data-action="edit" data-kind="${kind}" data-id="${esc(id)}" aria-label="수정">✏️</button><button class="icon-btn" data-action="delete" data-kind="${kind}" data-id="${esc(id)}" aria-label="삭제">🗑️</button></div>`;
  }

  // ---------- 기록 & 백업 ----------
  function renderLog() {
    let html = '<div class="section-title"><h2>출조 기록</h2></div>';
    if (!log.length) {
      return html + '<div class="card empty small">아직 기록이 없어요. 오늘 탭에서 <b>현장 모드</b>를 시작하고 입질·조과를 눌러보세요.<br>쌓인 조과는 같은 필드·같은 계절 추천에 반영됩니다.</div>';
    }
    const total = log.reduce((a, s) => a + s.catches.length, 0);
    const byLure = {};
    log.forEach((s) => s.catches.forEach((c) => { const k = c.lureName || catLabel(c.cat); byLure[k] = (byLure[k] || 0) + 1; }));
    const best = Object.keys(byLure).sort((a, b) => byLure[b] - byLure[a]).slice(0, 3);
    html += `<div class="card small">총 ${log.length}회 출조 · 🎣 ${total}마리${best.length ? `<br>베스트 루어: ${best.map((k) => `<b>${esc(k)}</b> ${byLure[k]}마리`).join(', ')}` : ''}</div>`;
    log.forEach((s) => {
      const mins = Math.round((s.endedAt - s.startedAt) / 60000);
      const dur = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
      const counts = {};
      s.catches.forEach((c) => { const k = c.lureName || catLabel(c.cat); counts[k] = (counts[k] || 0) + 1; });
      const bites = (s.events || []).filter((e) => e.type === 'bite').length;
      html += `<div class="card item"><div class="body">
        <h3>${esc(s.date)} · ${esc(s.fieldName)} <span class="badge">🎣 ${s.catches.length}</span></h3>
        <p>${hhmm(s.startedAt)}~${hhmm(s.endedAt)} (${dur}) · 입질 ${bites}회</p>
        ${Object.keys(counts).length ? `<div class="chips" style="margin-top:6px">${Object.keys(counts).map((k) => `<span class="chip">${esc(k)} ×${counts[k]}</span>`).join('')}</div>` : ''}
      </div><div class="actions"><button class="icon-btn" data-action="delete-log" data-id="${esc(s.id)}" aria-label="기록 삭제">🗑️</button></div></div>`;
    });
    return html;
  }

  function renderBackup() {
    return renderLog() + renderApiKey() + `<div class="section-title"><h2>데이터 백업</h2></div>
      <div class="card">
        <p class="small">데이터는 이 브라우저(기기)에만 저장돼요. 기기를 바꾸거나 다른 폰에서 쓰려면 내보내기 → 가져오기를 하세요.</p>
        <div class="btn-row">
          <button class="btn primary" data-action="export">JSON 내보내기</button>
          <label class="btn ghost">JSON 가져오기<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        </div>
      </div>
      <div class="card">
        <p class="small">현재 태클 ${data.setups.length}개 · 루어 ${data.lures.length}개 · 필드 ${data.fields.length}곳</p>
        <button class="btn danger" data-action="reset">기본 데이터로 초기화</button>
      </div>`;
  }

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'importFile' || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!Array.isArray(obj.setups) || !Array.isArray(obj.lures) || !Array.isArray(obj.fields)) throw new Error('형식이 맞지 않아요');
        if (Array.isArray(obj.log)) { log = obj.log; saveLog(); }
        delete obj.log;
        data = obj; save(); render();
        alert('가져오기 완료!');
      } catch (err) { alert('가져오기 실패: ' + err.message); }
    };
    reader.readAsText(e.target.files[0]);
  });

  // ---------- 공통 액션 ----------
  const COLL = { setup: 'setups', lure: 'lures', field: 'fields' };

  document.addEventListener('click', (e) => {
    const tag = e.target.closest('.chip.tag');
    if (tag) { tag.setAttribute('aria-pressed', String(tag.getAttribute('aria-pressed') !== 'true')); return; }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const { action, kind, id } = b.dataset;
    if (action === 'start-session') {
      session = { id: uid('t'), fieldId: ui.fieldId, date: dateStr(0), startedAt: Date.now(), round: 0, events: [] };
      saveSession(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'event' && session) {
      const cat = b.dataset.cat;
      session.events.push({ t: Date.now(), type: b.dataset.type, cat, lureId: activeLure[cat] || null, round: session.round || 0 });
      saveSession(); updateToday();
      if (navigator.vibrate) navigator.vibrate(b.dataset.type === 'catch' ? [60, 40, 60] : 30);
    } else if (action === 'undo-event' && session) {
      session.events.pop(); saveSession(); updateToday();
    } else if (action === 'next-round' && session) {
      session.round = (session.round || 0) + 1; saveSession(); updateToday();
    } else if (action === 'pick-lure') {
      activeLure[b.dataset.cat] = b.dataset.lure;
      if (session) { session.lures = Object.assign({}, activeLure); saveSession(); }
      b.parentElement.querySelectorAll('.pick').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } else if (action === 'end-session' && session) {
      const n = session.events.filter((ev) => ev.type === 'catch').length;
      if (confirm(session.events.length ? `출조를 종료하고 기록을 저장할까요? (🎣 ${n}마리)` : '기록 없이 현장 모드를 종료할까요?')) {
        endSession(); render();
      }
    } else if (action === 'delete-log') {
      if (confirm('이 출조 기록을 삭제할까요?')) { log = log.filter((s) => s.id !== id); saveLog(); render(); }
    } else if (action === 'save-key') {
      const v = $('#apiKeyInput').value.trim();
      if (!/^sk-ant-/.test(v)) { alert('sk-ant- 로 시작하는 키를 넣어주세요.'); return; }
      try { localStorage.setItem(APIKEY_KEY, v); } catch (err) { alert('이 브라우저에서는 키를 저장할 수 없어요.'); }
      render();
    } else if (action === 'del-key') {
      if (confirm('API 키를 이 기기에서 삭제할까요?')) { try { localStorage.removeItem(APIKEY_KEY); } catch (err) { /* noop */ } render(); }
    } else if (action === 'close-review') $('#review').close();
    else if (action === 'goto-key') {
      $('#review').close(); ui.tab = 'backup'; saveUi(); render();
      setTimeout(() => { const el = $('#apiKeyInput'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 50);
    } else if (action === 'add-reviewed') addReviewed(kind);
    else if (action === 'add') openEditor(kind, null);
    else if (action === 'edit') openEditor(kind, data[COLL[kind]].find((x) => x.id === id));
    else if (action === 'delete') {
      const item = data[COLL[kind]].find((x) => x.id === id);
      if (item && confirm(`'${item.name}'을(를) 삭제할까요?`)) {
        data[COLL[kind]] = data[COLL[kind]].filter((x) => x.id !== id);
        save(); render();
      }
    } else if (action === 'export') {
      const blob = new Blob([JSON.stringify(Object.assign({}, data, { log }), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tackle-combo-${dateStr(0)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (action === 'reset') {
      if (confirm('내 태클·루어·필드가 모두 기본 데이터로 바뀝니다. 계속할까요?')) {
        data = clone(window.TACKLE_SEED); save(); render();
      }
    } else if (action === 'close-editor') $('#editor').close();
    else if (action === 'add-spot') $('#spotList').insertAdjacentHTML('beforeend', spotRow({ name: '', tags: [] }));
    else if (action === 'del-spot') b.closest('.spot-row').remove();
    else if (action === 'geo') {
      if (!navigator.geolocation) return alert('이 브라우저는 위치를 지원하지 않아요.');
      navigator.geolocation.getCurrentPosition(
        (p) => { $('[name=lat]').value = p.coords.latitude.toFixed(4); $('[name=lon]').value = p.coords.longitude.toFixed(4); },
        () => alert('위치를 가져오지 못했어요.'),
      );
    }
  });

  // ---------- 사진 인식 ----------
  const V = window.TackleVision;
  const getKey = () => { try { return localStorage.getItem(APIKEY_KEY) || ''; } catch (e) { return ''; } };

  function photoBtn(kind) {
    return `<label class="btn ghost sm photo-btn">📷 사진으로 추가<input type="file" accept="image/*" multiple hidden data-photo="${kind}"></label>`;
  }

  function renderApiKey() {
    const key = getKey();
    return `<div class="section-title"><h2>📷 사진 인식 설정</h2></div>
      <div class="card small">
        <p style="margin-top:0">태클·루어 탭의 "📷 사진으로 추가"는 Claude AI가 사진 속 장비를 알아봐서 자동으로 채워줍니다.
        본인의 Anthropic API 키가 필요하고, 사진 1장에 대략 30~60원 정도 듭니다.</p>
        ${key
          ? `<p>✅ 등록됨 <code>${esc(key.slice(0, 10))}…${esc(key.slice(-4))}</code></p>
             <button class="btn ghost sm" data-action="del-key">키 삭제</button>`
          : `<div class="btn-row"><input type="password" id="apiKeyInput" placeholder="sk-ant-..." autocomplete="off" style="flex:1;min-width:180px">
             <button class="btn primary sm" data-action="save-key">저장</button></div>
             <p class="muted">키 발급: console.anthropic.com → API Keys. 키는 이 기기에만 저장되고 Anthropic 서버 외에는 어디에도 전송되지 않아요.</p>`}
      </div>`;
  }

  const CONF_LABEL = { high: '', medium: '', low: '<span class="warn">⚠ 확인 필요</span>' };
  let reviewItems = [];

  function openReview(title, body, actions) {
    $('#reviewTitle').textContent = title;
    $('#reviewBody').innerHTML = body;
    $('#reviewActions').innerHTML = actions;
    if (!$('#review').open) $('#review').showModal();
  }

  function isDuplicate(kind, item) {
    // 괄호 속 영문 표기·공백·따옴표 차이는 무시하고, 한쪽 이름이 다른 쪽을 포함하면 같은 장비로 본다
    const norm = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/[\s"'”″]/g, '').toLowerCase();
    const same = (a, b) => a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
    if (kind === 'lure') return data.lures.some((x) => same(norm(x.name), norm(item.name)));
    return data.setups.some((x) => same(norm(x.rod), norm(item.rod)) && same(norm(x.reel), norm(item.reel)));
  }

  async function handlePhotos(kind, files) {
    if (!getKey()) {
      openReview('API 키가 필요해요', '<p class="small">사진 인식을 쓰려면 먼저 <b>기록</b> 탭에서 Claude API 키를 등록하세요.</p>',
        '<button type="button" class="btn ghost" data-action="close-review">닫기</button><button type="button" class="btn primary" data-action="goto-key">키 등록하러 가기</button>');
      return;
    }
    openReview('사진 분석 중…', `<div class="loading">🔍 ${files.length}장의 사진에서 ${kind === 'lure' ? '루어' : '태클'}를 찾고 있어요.<br><span class="small">보통 10~30초 걸려요.</span></div>`, '');
    try {
      const res = await V.recognize(files, kind, getKey(), E.CATEGORIES);
      const items = kind === 'lure' ? res.lures : res.setups;
      reviewItems = items.map((it) => ({ item: it, dup: isDuplicate(kind, it) }));
      if (!items.length) {
        openReview('찾은 장비가 없어요', `<p class="small">${esc(res.note || '사진에서 장비를 알아보지 못했어요.')}</p><p class="small muted">장비가 크게, 글자가 잘 보이게 찍으면 정확해져요.</p>`,
          '<button type="button" class="btn primary" data-action="close-review">닫기</button>');
        return;
      }
      const rows = reviewItems.map((r, i) => {
        const it = r.item;
        const sub = kind === 'lure'
          ? [it.brand, catLabel(it.category), it.size].filter(Boolean).join(' · ') + (it.colors.length ? `<br>🎨 ${it.colors.map(esc).join(', ')}` : '')
          : [it.rod, it.reel, it.line].filter(Boolean).map(esc).join(' + ') + `<br>${esc(TYPE_LABEL[it.type] || '')} ${esc(it.power)} · ${it.categories.map(catLabel).join(', ')}`;
        return `<div class="review-row">
          <label class="check"><input type="checkbox" data-review="${i}"${r.dup ? '' : ' checked'}></label>
          <div class="body"><input type="text" data-review-name="${i}" value="${esc(it.name)}">
          <div class="small muted">${sub}</div>
          <div class="small">${CONF_LABEL[it.confidence] || ''}${r.dup ? ' <span class="badge">이미 있음</span>' : ''}</div></div></div>`;
      }).join('');
      openReview(`${items.length}개를 찾았어요`,
        `${res.note ? `<p class="small muted">💬 ${esc(res.note)}</p>` : ''}<div class="review-list">${rows}</div>
         <p class="small muted">이름은 여기서 바로 고칠 수 있고, 나머지는 추가한 뒤 ✏️로 수정하세요.</p>`,
        `<button type="button" class="btn ghost" data-action="close-review">취소</button><button type="button" class="btn primary" data-action="add-reviewed" data-kind="${kind}">선택 항목 추가</button>`);
    } catch (err) {
      openReview('인식 실패', `<p class="small warn">${esc(err.message)}</p>`, '<button type="button" class="btn primary" data-action="close-review">닫기</button>');
    }
  }

  function addReviewed(kind) {
    let n = 0;
    reviewItems.forEach((r, i) => {
      if (!document.querySelector(`[data-review="${i}"]`).checked) return;
      const it = r.item;
      const name = document.querySelector(`[data-review-name="${i}"]`).value.trim() || it.name;
      if (kind === 'lure') {
        data.lures.push({ id: uid('l'), name, brand: it.brand, category: it.category, size: it.size, colors: it.colors, favorite: false, memo: it.memo });
      } else {
        data.setups.push({ id: uid('s'), name, rod: it.rod, reel: it.reel, line: it.line, type: it.type, power: it.power, categories: it.categories, favorite: false, memo: '' });
      }
      n++;
    });
    save();
    $('#review').close();
    render();
    if (n) alert(`${n}개를 추가했어요! 오늘 추천에 바로 반영됩니다.`);
  }

  document.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-photo]');
    if (!input || !input.files.length) return;
    const files = Array.from(input.files).slice(0, 5);
    input.value = '';
    handlePhotos(input.dataset.photo, files);
  });

  // ---------- 편집기 ----------
  let editing = null;

  const text = (name, label, v, ph) => `<label>${label}<input type="text" name="${name}" value="${esc(v || '')}" placeholder="${esc(ph || '')}"></label>`;
  const selectF = (name, label, v, opts) => `<label>${label}<select name="${name}">${Object.keys(opts).map((k) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(opts[k])}</option>`).join('')}</select></label>`;
  const check = (name, label, v) => `<label class="check"><input type="checkbox" name="${name}"${v ? ' checked' : ''}> ${label}</label>`;
  const area = (name, label, v, ph) => `<label>${label}<textarea name="${name}" placeholder="${esc(ph || '')}">${esc(v || '')}</textarea></label>`;
  const catOpts = () => Object.fromEntries(Object.keys(E.CATEGORIES).map((k) => [k, E.CATEGORIES[k].label]));

  function spotRow(s) {
    const tags = Object.keys(E.STRUCTURES).map((t) => `<button type="button" class="chip tag" data-tag="${t}" aria-pressed="${(s.tags || []).includes(t)}">${E.STRUCTURES[t]}</button>`).join('');
    return `<div class="spot-row"><div class="top"><input type="text" class="spot-name" value="${esc(s.name)}" placeholder="포인트 이름 (예: 송전교 다리 밑)"><button type="button" class="icon-btn" data-action="del-spot" aria-label="포인트 삭제">✕</button></div><div class="chips">${tags}</div></div>`;
  }

  function openEditor(kind, item) {
    editing = { kind, id: item ? item.id : null };
    const it = item || {};
    let body = '';
    if (kind === 'setup') {
      $('#editorTitle').textContent = item ? '태클 세팅 수정' : '태클 세팅 추가';
      const cats = Object.keys(E.CATEGORIES).map((c) => `<button type="button" class="chip tag" data-tag="${c}" aria-pressed="${(it.categories || []).includes(c)}">${esc(E.CATEGORIES[c].short)}</button>`).join('');
      body = text('name', '세팅 별칭', it.name, '예: 빅 탑워터') +
        text('rod', '로드', it.rod, '예: 리벨리온 69MH') +
        text('reel', '릴', it.reel, '예: 15 메타늄 DC') +
        text('line', '라인', it.line, '예: 카본 16lb') +
        `<div class="two">${selectF('type', '타입', it.type || 'bait', TYPE_LABEL)}${selectF('power', '파워', it.power || 'M', Object.fromEntries(POWERS.map((p) => [p, p])))}</div>` +
        `<label>담당 루어 카테고리<div class="chips" id="catTags">${cats}</div></label>` +
        check('favorite', '주력 세팅', it.favorite) +
        area('memo', '메모', it.memo);
    } else if (kind === 'lure') {
      $('#editorTitle').textContent = item ? '루어 수정' : '루어 추가';
      body = text('name', '루어 이름', it.name, '예: 비전 원텐') +
        `<div class="two">${text('brand', '브랜드', it.brand, '예: 메가배스')}${text('size', '사이즈/무게', it.size, '예: 3/8oz')}</div>` +
        selectF('category', '카테고리', it.category || 'bottom', catOpts()) +
        text('colors', '보유 컬러 (쉼표로 구분)', (it.colors || []).join(', '), '예: 고스트 와카사기, 차트 백') +
        check('favorite', '자신 있는 루어 (우선 추천)', it.favorite) +
        area('memo', '나만의 운용법', it.memo, '예: 저킹 후 3~5초 스테이');
    } else {
      $('#editorTitle').textContent = item ? '필드 수정' : '필드 추가';
      body = text('name', '이름', it.name, '예: 이동저수지') +
        text('region', '지역', it.region, '예: 용인 처인구') +
        `<div class="two">${selectF('type', '유형', it.type || 'large', E.LABELS.field)}${selectF('clarity', '평소 물색', it.clarity || 'stained', E.LABELS.clarity)}</div>` +
        `<div class="two"><label>위도<input type="number" step="any" name="lat" value="${esc(it.lat == null ? '' : it.lat)}"></label><label>경도<input type="number" step="any" name="lon" value="${esc(it.lon == null ? '' : it.lon)}"></label></div>` +
        '<button type="button" class="btn ghost sm" data-action="geo">📍 지금 위치로 좌표 채우기</button>' +
        `<label>포인트</label><div id="spotList" style="display:grid;gap:8px">${(it.spots || []).map(spotRow).join('')}</div>` +
        '<button type="button" class="btn ghost sm" data-action="add-spot">+ 포인트 추가</button>';
    }
    $('#editorBody').innerHTML = body;
    $('#editor').showModal();
  }

  $('#editorForm').addEventListener('submit', (e) => {
    const f = e.target;
    const v = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
    const { kind, id } = editing;
    if (!v('name')) { e.preventDefault(); alert('이름을 입력하세요.'); return; }
    let obj;
    if (kind === 'setup') {
      obj = {
        name: v('name'), rod: v('rod'), reel: v('reel'), line: v('line'), type: v('type'), power: v('power'),
        categories: Array.from(document.querySelectorAll('#catTags .tag[aria-pressed="true"]')).map((b) => b.dataset.tag),
        favorite: f.elements.favorite.checked, memo: v('memo'),
      };
    } else if (kind === 'lure') {
      obj = {
        name: v('name'), brand: v('brand'), size: v('size'), category: v('category'),
        colors: v('colors').split(',').map((s) => s.trim()).filter(Boolean),
        favorite: f.elements.favorite.checked, memo: v('memo'),
      };
    } else {
      const num = (n) => (v(n) === '' ? null : Number(v(n)));
      obj = {
        name: v('name'), region: v('region'), type: v('type'), clarity: v('clarity'), lat: num('lat'), lon: num('lon'),
        spots: Array.from(document.querySelectorAll('#spotList .spot-row')).map((r) => ({
          name: r.querySelector('.spot-name').value.trim(),
          tags: Array.from(r.querySelectorAll('.tag[aria-pressed="true"]')).map((b) => b.dataset.tag),
        })).filter((s) => s.name),
      };
    }
    const coll = data[COLL[kind]];
    if (id) Object.assign(coll.find((x) => x.id === id), obj);
    else coll.push(Object.assign({ id: uid(kind[0]) }, obj));
    save();
    render();
  });

  // ---------- 시작 ----------
  const now = new Date();
  $('#todayLabel').textContent = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()} · 내 장비로 짜는 오늘의 작전`;
  // 날짜·시간대는 실행할 때마다 '지금' 기준으로
  ui.slot = defaultSlot();
  ui.dayOffset = 0;
  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
