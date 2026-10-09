// 오늘의 태클 조합 — UI
(function () {
  'use strict';

  const E = window.TackleEngine;
  const STORE_KEY = 'tackle-combo-v1';
  const UI_KEY = 'tackle-combo-ui-v1';
  const PACK_KEY = 'tackle-combo-pack-v1';

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
    if (!data.fields.some((f) => f.id === ui.fieldId)) ui.fieldId = data.fields[0].id;
    if (!ui.slot) ui.slot = defaultSlot();
    const fieldOpts = data.fields.map((f) => `<option value="${esc(f.id)}"${f.id === ui.fieldId ? ' selected' : ''}>${esc(f.name)} · ${E.LABELS.field[f.type] || ''}</option>`).join('');
    const dayOpts = [0, 1, 2, 3, 4, 5, 6].map((o) => `<option value="${o}"${o === ui.dayOffset ? ' selected' : ''}>${dateLabel(o)}</option>`).join('');
    const slots = Object.keys(E.SLOT_HOUR).map((s) => `<button type="button" data-slot="${s}" aria-pressed="${s === ui.slot}">${E.LABELS.time[s].replace(/\(.*\)/, '')}</button>`).join('');
    const sel = (key, labels) => `<select data-ov="${key}"><option value="">자동</option>${Object.keys(labels).map((k) => `<option value="${k}"${overrides[key] === k ? ' selected' : ''}>${labels[k]}</option>`).join('')}</select>`;
    return `
      <section class="card">
        <div class="controls">
          <label class="full">어디로 가세요?<select id="fieldSel">${fieldOpts}</select></label>
          <label>언제?<select id="daySel">${dayOpts}</select></label>
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
    const rec = E.recommend(data, cond, field.id, 3);
    $('#todayResult').innerHTML = renderResult(cond, rec, field, err);
  }

  function condBox(k, v) { return `<div class="cond"><div class="k">${k}</div><div class="v">${v}</div></div>`; }

  function renderResult(c, rec, field, err) {
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
    let html = '<div class="section-title"><h2>내 태클 세팅</h2><button class="btn primary sm" data-action="add" data-kind="setup">+ 세팅 추가</button></div>';
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
    let html = '<div class="section-title"><h2>내 루어</h2><button class="btn primary sm" data-action="add" data-kind="lure">+ 루어 추가</button></div>';
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

  // ---------- 백업 ----------
  function renderBackup() {
    return `<div class="section-title"><h2>데이터 백업</h2></div>
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
    if (action === 'add') openEditor(kind, null);
    else if (action === 'edit') openEditor(kind, data[COLL[kind]].find((x) => x.id === id));
    else if (action === 'delete') {
      const item = data[COLL[kind]].find((x) => x.id === id);
      if (item && confirm(`'${item.name}'을(를) 삭제할까요?`)) {
        data[COLL[kind]] = data[COLL[kind]].filter((x) => x.id !== id);
        save(); render();
      }
    } else if (action === 'export') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
