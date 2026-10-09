// 오늘의 태클 조합 — 추천 엔진 (브라우저/Node 공용, 외부 의존성 없음)
(function (root) {
  'use strict';

  // 포인트(구조물) 태그
  const STRUCTURES = {
    cover: '수초·헤비커버',
    weed: '수초대',
    overhang: '오버행 그늘',
    shallow: '섀로우',
    bridge: '다리·교각',
    inflow: '새물유입구',
    riprap: '석축',
    dam: '제방',
    open: '오픈워터',
    breakline: '브레이크라인',
    hump: '수중 험프',
    pier: '잔교·좌대',
  };

  // 루어 카테고리별 조건 선호 프로파일
  // temp: 이상 수온, tempOk: 가능 수온 / 나머지는 조건별 가중치
  const CATEGORIES = {
    topwater: {
      label: '탑워터 (크롤러·프롭)', short: '탑워터',
      temp: [18, 27], tempOk: [14, 30],
      sky: { sunny: -1, cloudy: 2, rain: 1 },
      wind: { calm: 2, breeze: 0, strong: -3 },
      pressure: { falling: 2, steady: 0, rising: -1 },
      time: { dawn: 3, day: -1, dusk: 3, night: 1 },
      clarity: { clear: 1, stained: 1, muddy: -1 },
      field: { large: 1, paid: 0 },
      spots: ['cover', 'overhang', 'weed', 'shallow'],
      action: '데드슬로우 리트리브 + 커버 옆 스테이. 바이트 후 한 박자 늦게 챔질.',
    },
    popper: {
      label: '하드 피네스 (팝퍼·펜슬)', short: '팝퍼',
      temp: [17, 28], tempOk: [13, 30],
      sky: { sunny: 1, cloudy: 1, rain: 0 },
      wind: { calm: 3, breeze: -1, strong: -3 },
      pressure: { falling: 1, steady: 1, rising: 0 },
      time: { dawn: 2, day: 1, dusk: 2, night: 0 },
      clarity: { clear: 2, stained: 0, muddy: -2 },
      field: { large: 0, paid: 2 },
      spots: ['overhang', 'pier', 'shallow', 'cover'],
      action: '네치네치(제자리 턴) — 그늘 속에 오래 머물게 하며 조밀한 팝음.',
    },
    minnow: {
      label: '미노우·저크베이트', short: '미노우',
      temp: [8, 16], tempOk: [5, 21],
      sky: { sunny: 0, cloudy: 2, rain: 1 },
      wind: { calm: 0, breeze: 2, strong: 1 },
      pressure: { falling: 1, steady: 1, rising: 0 },
      time: { dawn: 1, day: 1, dusk: 1, night: -1 },
      clarity: { clear: 2, stained: 1, muddy: -2 },
      field: { large: 2, paid: 0 },
      spots: ['inflow', 'riprap', 'shallow', 'breakline'],
      action: '탁·탁 강한 저킹 후 3~5초 확실한 스테이로 리액션 바이트 유도. 수온 낮을수록 스테이 길게.',
    },
    moving: {
      label: '무빙 (스피너베이트·바이브)', short: '무빙',
      temp: [10, 22], tempOk: [6, 28],
      sky: { sunny: -1, cloudy: 2, rain: 2 },
      wind: { calm: -1, breeze: 3, strong: 2 },
      pressure: { falling: 3, steady: 0, rising: -1 },
      time: { dawn: 1, day: 1, dusk: 1, night: -1 },
      clarity: { clear: -1, stained: 2, muddy: 2 },
      field: { large: 2, paid: -1 },
      spots: ['dam', 'open', 'riprap', 'shallow', 'inflow'],
      action: '바람 맞는 연안 위주로 스피디하게 권사하며 넓게 탐색. 활성 개체 선별.',
    },
    crank: {
      label: '크랭크·섀드', short: '크랭크',
      temp: [12, 25], tempOk: [8, 29],
      sky: { sunny: 0, cloudy: 2, rain: 1 },
      wind: { calm: 0, breeze: 2, strong: 1 },
      pressure: { falling: 2, steady: 1, rising: -1 },
      time: { dawn: 1, day: 1, dusk: 1, night: -1 },
      clarity: { clear: 0, stained: 2, muddy: 1 },
      field: { large: 2, paid: 0 },
      spots: ['riprap', 'dam', 'breakline'],
      action: '석축·바닥에 립을 부딪쳐 불규칙 액션(디플렉션) 만들기.',
    },
    bottom: {
      label: '바닥 웜 (텍사스·노싱커·장타)', short: '바닥 웜',
      temp: [10, 30], tempOk: [4, 33],
      sky: { sunny: 2, cloudy: 1, rain: 0 },
      wind: { calm: 1, breeze: 1, strong: -1 },
      pressure: { falling: 0, steady: 1, rising: 2 },
      time: { dawn: 0, day: 2, dusk: 1, night: 1 },
      clarity: { clear: 1, stained: 1, muddy: 0 },
      field: { large: 2, paid: 0 },
      spots: ['bridge', 'hump', 'breakline', 'dam'],
      action: '원투 후 바닥 크롤링 — 돌·험프 촉감을 손목으로 읽고 걸리면 잠깐 스테이.',
    },
    cover: {
      label: '헤비커버 (펀칭·러버지그)', short: '커버',
      temp: [15, 30], tempOk: [8, 33],
      sky: { sunny: 3, cloudy: 0, rain: -1 },
      wind: { calm: 1, breeze: 1, strong: 0 },
      pressure: { falling: -1, steady: 1, rising: 2 },
      time: { dawn: 0, day: 2, dusk: 1, night: 0 },
      clarity: { clear: 1, stained: 1, muddy: 1 },
      field: { large: 2, paid: -1 },
      spots: ['cover', 'weed', 'overhang'],
      action: '쨍한 날 그늘 속으로 숨은 배스를 커버 속 수직 낙하로 직접 공략.',
    },
    vertical: {
      label: '수직 피네스 (다운샷·네꼬)', short: '수직 피네스',
      temp: [4, 14], tempOk: [2, 33],
      sky: { sunny: 2, cloudy: 0, rain: -1 },
      wind: { calm: 2, breeze: 0, strong: -2 },
      pressure: { falling: -1, steady: 1, rising: 3 },
      time: { dawn: 0, day: 2, dusk: 0, night: 0 },
      clarity: { clear: 2, stained: 0, muddy: -2 },
      field: { large: 0, paid: 3 },
      spots: ['pier', 'bridge', 'overhang', 'breakline'],
      action: '제자리 초미세 셰이킹 — 싱커는 바닥에 고정, 웜만 떨게.',
    },
    midstroll: {
      label: '중층 피네스 (미드스트롤링)', short: '미드스트롤링',
      temp: [6, 16], tempOk: [3, 24],
      sky: { sunny: 2, cloudy: 1, rain: -1 },
      wind: { calm: 2, breeze: 1, strong: -2 },
      pressure: { falling: 0, steady: 1, rising: 2 },
      time: { dawn: 0, day: 2, dusk: 0, night: -2 },
      clarity: { clear: 3, stained: 0, muddy: -3 },
      field: { large: 0, paid: 2 },
      spots: ['inflow', 'breakline', 'open'],
      action: '로드를 잘게 떨며 일정 수심을 수평 유지(달달이). 서스펜드 배스 사이트 공략.',
    },
    bfs: {
      label: '구조물 BFS (경량 텍사스·노싱커)', short: 'BFS',
      temp: [10, 28], tempOk: [5, 31],
      sky: { sunny: 2, cloudy: 1, rain: 0 },
      wind: { calm: 1, breeze: 1, strong: -1 },
      pressure: { falling: 1, steady: 1, rising: 1 },
      time: { dawn: 1, day: 1, dusk: 1, night: 0 },
      clarity: { clear: 1, stained: 1, muddy: 0 },
      field: { large: 1, paid: 2 },
      spots: ['pier', 'riprap', 'overhang'],
      action: '구조물에 바짝 붙여 정밀 캐스팅 후 탈탈이. 스피닝이 쓸리는 하드 구조물에서 강점.',
    },
  };

  const LABELS = {
    sky: { sunny: '맑음', cloudy: '흐림', rain: '비' },
    wind: { calm: '바람 약함', breeze: '적당한 바람', strong: '강풍' },
    pressure: { falling: '기압 하강', steady: '기압 안정', rising: '기압 상승' },
    time: { dawn: '새벽(피딩)', day: '한낮', dusk: '저녁(피딩)', night: '야간' },
    clarity: { clear: '맑은 물', stained: '약간 탁함', muddy: '흙탕물' },
    field: { large: '대형지', paid: '유료터' },
    season: { spring: '봄', summer: '여름', fall: '가을', winter: '겨울' },
  };

  const SLOT_HOUR = { dawn: 6, day: 12, dusk: 17, night: 21 };

  function seasonOf(month) {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }

  function windClass(ms) {
    if (ms < 2) return 'calm';
    if (ms <= 5) return 'breeze';
    return 'strong';
  }

  function skyClass(code, cloud, precip) {
    if (code >= 51 || precip >= 0.3) return 'rain';
    if (cloud >= 60 || code === 3 || code === 45 || code === 48) return 'cloudy';
    return 'sunny';
  }

  // 날씨 정보가 없을 때 쓰는 계절 평균 수온 (중부지방 저수지 대략값)
  const SEASONAL_WATER = [4, 5, 8, 12, 17, 22, 26, 27, 24, 18, 12, 7];

  function shiftClarity(base, rain2d) {
    const order = ['clear', 'stained', 'muddy'];
    let i = Math.max(0, order.indexOf(base));
    if (rain2d >= 30) i += 2; else if (rain2d >= 10) i += 1;
    return order[Math.min(i, 2)];
  }

  /**
   * Open-Meteo 응답 + 날짜/시간대 + 필드 → 조건 객체
   * weather가 없으면 계절 기본값을 사용. overrides의 값이 있으면 우선 적용.
   */
  function deriveConditions(weather, dateStr, slot, field, overrides) {
    overrides = overrides || {};
    const month = Number(dateStr.slice(5, 7));
    const season = seasonOf(month);
    const c = {
      date: dateStr, slot, month, season,
      fieldType: (field && field.type) || 'large',
      airTemp: null, windMs: null, pressureDiff: null, rain2d: 0,
      sky: 'cloudy', wind: 'breeze', pressure: 'steady',
      waterTemp: SEASONAL_WATER[month - 1], waterTempEstimated: true,
      clarity: (field && field.clarity) || 'stained',
      source: 'season',
    };

    if (weather && weather.hourly && weather.daily) {
      const h = weather.hourly;
      const key = dateStr + 'T' + String(SLOT_HOUR[slot] || 12).padStart(2, '0') + ':00';
      const i = h.time.indexOf(key);
      if (i >= 0) {
        c.source = 'weather';
        c.airTemp = h.temperature_2m[i];
        c.windMs = h.wind_speed_10m[i];
        c.wind = windClass(c.windMs);
        c.sky = skyClass(h.weather_code[i], h.cloud_cover[i], h.precipitation[i]);
        if (i >= 24 && h.pressure_msl[i - 24] != null) {
          c.pressureDiff = Math.round((h.pressure_msl[i] - h.pressure_msl[i - 24]) * 10) / 10;
          c.pressure = c.pressureDiff >= 2 ? 'rising' : c.pressureDiff <= -2 ? 'falling' : 'steady';
        }
      }
      const d = weather.daily;
      const di = d.time.indexOf(dateStr);
      if (di >= 0) {
        const past = d.temperature_2m_mean.slice(Math.max(0, di - 7), di).filter((v) => v != null);
        if (past.length >= 3) {
          const mean = past.reduce((a, b) => a + b, 0) / past.length;
          // 저수지 수온은 기온보다 늦게 따라감: 가을·여름엔 기온보다 높고, 봄엔 낮다.
          const lag = { spring: -1.5, summer: 1, fall: 2.5, winter: 1.5 }[season];
          c.waterTemp = Math.round(Math.max(2, mean + lag) * 10) / 10;
        }
        const rains = d.precipitation_sum.slice(Math.max(0, di - 2), di + 1).filter((v) => v != null);
        c.rain2d = Math.round(rains.reduce((a, b) => a + b, 0) * 10) / 10;
        c.clarity = shiftClarity(c.clarity, c.rain2d);
      }
    }

    if (overrides.waterTemp !== undefined && overrides.waterTemp !== '' && overrides.waterTemp !== null) {
      c.waterTemp = Number(overrides.waterTemp);
      c.waterTempEstimated = false;
    }
    ['sky', 'wind', 'pressure', 'clarity'].forEach((k) => {
      if (overrides[k]) c[k] = overrides[k];
    });
    return c;
  }

  function scoreCategory(catId, c) {
    const p = CATEGORIES[catId];
    if (!p) return { score: -99, factors: [] };
    const factors = [];
    const t = c.waterTemp;
    let tv;
    if (t >= p.temp[0] && t <= p.temp[1]) tv = 4;
    else if (t >= p.tempOk[0] && t <= p.tempOk[1]) tv = 1;
    else tv = -4;
    const tLabel = tv === 4 ? '적정' : tv === 1 ? '가능' : '부적합';
    factors.push({ label: `수온 ${t}°C ${tLabel}`, v: tv });

    const add = (key, val) => {
      const v = (p[key] && p[key][val]) || 0;
      if (v !== 0) factors.push({ label: LABELS[key][val], v });
    };
    add('sky', c.sky);
    add('wind', c.wind);
    add('pressure', c.pressure);
    add('time', c.slot);
    add('clarity', c.clarity);
    add('field', c.fieldType);

    const score = factors.reduce((a, f) => a + f.v, 0);
    factors.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    return { score, factors };
  }

  function bestSpots(catId, field) {
    if (!field || !field.spots || !field.spots.length) return [];
    const pref = CATEGORIES[catId].spots;
    return field.spots
      .map((s) => {
        let m = 0;
        (s.tags || []).forEach((tg) => {
          const k = pref.indexOf(tg);
          if (k >= 0) m += pref.length - k; // 앞쪽 선호 태그일수록 가중
        });
        return { spot: s, m };
      })
      .filter((x) => x.m > 0)
      .sort((a, b) => b.m - a.m)
      .slice(0, 3)
      .map((x) => x.spot);
  }

  function pickSetup(catId, setups) {
    const cands = setups.filter((s) => (s.categories || []).includes(catId));
    // 전문 세팅(담당 카테고리가 적은 것)을 우선
    cands.sort((a, b) => (a.categories.length - b.categories.length) || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    return cands[0] || null;
  }

  const COLOR_GROUPS = {
    natural: ['고스트', '와카사기', '내추럴', '그린펌킨', '워터멜론', '스모크', '아유', '섀드', '실버', '쉐드'],
    bright: ['차트', '화이트', '펄', '라임', '핫', '골드', '오렌지'],
    dark: ['블랙', '준코', '블루', '다크', '레드'],
  };

  function colorAdvice(c) {
    let group, text;
    if (c.clarity === 'muddy') {
      group = 'dark';
      text = '흙탕물 → 실루엣이 강한 블랙·준코 또는 차트 계열';
    } else if (c.clarity === 'stained' || c.sky === 'rain') {
      group = 'bright';
      text = '탁한 물·저조도 → 차트·펄화이트 등 어필 강한 컬러';
    } else if (c.sky === 'sunny') {
      group = 'natural';
      text = '맑은 물 + 쨍한 날 → 고스트·와카사기·워터멜론 등 내추럴 컬러';
    } else {
      group = 'natural';
      text = '맑은 물 + 흐림 → 은은한 펄·실버 내추럴 컬러';
    }
    return { group, text, keywords: COLOR_GROUPS[group] };
  }

  function matchColors(lure, advice) {
    const colors = lure.colors || [];
    return colors.map((name) => ({
      name,
      hit: advice.keywords.some((k) => name.includes(k)),
    }));
  }

  function briefing(c) {
    const notes = [];
    if (c.season === 'spring' && c.waterTemp >= 14 && c.waterTemp <= 19) notes.push('산란 시즌 — 섀로우 베드 주변은 신중하게, 캐치 앤 릴리즈 권장.');
    if (c.season === 'fall' && c.waterTemp >= 15 && c.waterTemp <= 22) notes.push('가을 베이트피시 시즌 — 새물유입구·바람 맞는 연안에 배스가 몰립니다.');
    if (c.pressure === 'rising' && c.sky === 'sunny') notes.push('한랭전선 통과 후 쨍한 날 — 활성도 저하, 피네스와 그늘 위주로.');
    if (c.pressure === 'falling') notes.push('기압 하강 중 — 활성도 상승 타이밍, 빠른 탐색형 루어를 먼저.');
    if (c.rain2d >= 10) notes.push(`최근 강수 ${c.rain2d}mm — 새물유입구에 주목, 물색이 탁해졌을 가능성.`);
    if (c.wind === 'strong') notes.push('강풍 — 바람 맞는 쪽 연안은 베이트가 몰리지만 경량 채비는 불리합니다.');
    if (c.waterTemp <= 8) notes.push('저수온기 — 느리게, 깊게, 오래 머물게.');
    if (c.waterTemp >= 28) notes.push('고수온기 — 그늘·새물·수심 있는 곳, 아침저녁 피딩 타임 집중.');
    return notes;
  }

  /**
   * state: { setups, lures, fields }
   * 반환: { combos(상위 n), others, missing(보유 루어 없는 상위 카테고리), packing, colorAdvice, notes }
   */
  function recommend(state, c, fieldId, n, opts) {
    n = n || 3;
    const bonus = (opts && opts.bonus) || {};
    const field = (state.fields || []).find((f) => f.id === fieldId) || null;
    const advice = colorAdvice(c);
    const catScores = Object.keys(CATEGORIES)
      .map((id) => {
        const s = scoreCategory(id, c);
        if (bonus[id]) {
          s.score += bonus[id].v;
          s.factors.unshift({ label: bonus[id].label, v: bonus[id].v });
        }
        return Object.assign({ id }, s);
      })
      .sort((a, b) => b.score - a.score);

    const combos = [];
    const missing = [];
    catScores.forEach((cs) => {
      const lures = (state.lures || [])
        .filter((l) => l.category === cs.id)
        .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
      if (!lures.length) {
        if (combos.length < n && cs.score > 0) missing.push(cs);
        return;
      }
      const setup = pickSetup(cs.id, state.setups || []);
      combos.push({
        category: cs.id,
        categoryLabel: CATEGORIES[cs.id].label,
        score: cs.score,
        factors: cs.factors,
        setup,
        lures: lures.slice(0, 2).map((l) => ({ lure: l, colors: matchColors(l, advice) })),
        spots: bestSpots(cs.id, field),
        action: CATEGORIES[cs.id].action,
      });
    });

    const top = combos.slice(0, n);
    const packing = { setups: [], lures: [] };
    top.forEach((cb) => {
      if (cb.setup && !packing.setups.includes(cb.setup)) packing.setups.push(cb.setup);
      cb.lures.forEach((x) => { if (!packing.lures.includes(x.lure)) packing.lures.push(x.lure); });
    });

    return {
      field,
      combos: top,
      others: combos.slice(n),
      missing,
      packing,
      colorAdvice: advice,
      notes: briefing(c),
    };
  }

  // ---------- 로테이션 & 현장 모드 ----------

  // 카테고리 → 로테이션 역할 (탐색 → 확인 → 짜내기)
  const ROLES = {
    topwater: 'search', moving: 'search', crank: 'search', minnow: 'search',
    bottom: 'mid', cover: 'mid', bfs: 'mid',
    vertical: 'finesse', midstroll: 'finesse', popper: 'finesse',
  };
  const ROLE_ORDER = ['search', 'mid', 'finesse'];
  const STEPS = {
    search: { label: '탐색', minutes: 20, tip: '넓고 빠르게 — 활성 배스가 있는지 먼저 확인' },
    mid: { label: '확인', minutes: 30, tip: '구조물·바닥을 천천히 — 반응 본 수심에 집중' },
    finesse: { label: '짜내기', minutes: 30, tip: '예민한 배스를 제자리에서 오래 — 사이즈·컬러 다운' },
  };
  // 현장 기록이 그 출조 동안 카테고리 점수에 주는 영향
  const EVENT_SCORE = { nobite: -2, bite: 1, catch: 3 };

  function sessionAdjust(session) {
    const adj = {};
    ((session && session.events) || []).forEach((e) => {
      adj[e.cat] = (adj[e.cat] || 0) + (EVENT_SCORE[e.type] || 0);
    });
    return adj;
  }

  /** 추천 조합들 → 탐색/확인/짜내기 순서의 로테이션 (현장 기록 반영) */
  function buildRotation(combos, session) {
    const adj = sessionAdjust(session);
    const scored = combos.map((cb) => Object.assign({}, cb, {
      adjScore: cb.score + (adj[cb.category] || 0),
      role: ROLES[cb.category] || 'mid',
    }));
    const byScore = (a, b) => b.adjScore - a.adjScore;
    let usable = scored.filter((x) => x.adjScore > -2).sort(byScore);
    // 하루 종일 꽝이라 다 감점돼도 다음 포인트에서 던질 건 있어야 함
    if (usable.length < 3) usable = scored.slice().sort(byScore).slice(0, Math.max(3, usable.length));
    const steps = [];
    ROLE_ORDER.forEach((role) => {
      const best = usable.find((x) => x.role === role);
      if (best) steps.push(best);
    });
    // 비어 있는 역할은 남은 상위 조합으로 채워 3단계 확보
    usable.forEach((x) => { if (steps.length < 3 && !steps.includes(x)) steps.push(x); });
    steps.sort((a, b) => (ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)) || byScore(a, b));
    // 조건이 한쪽으로 크게 기울면(5점 이상) 가장 유리한 단계부터
    const top = steps.slice().sort(byScore)[0];
    if (top && steps[0] !== top && top.adjScore - steps[0].adjScore >= 5) {
      steps.splice(steps.indexOf(top), 1);
      steps.unshift(top);
    }
    return steps.map((cb) => Object.assign({ role: cb.role, combo: cb }, STEPS[cb.role]));
  }

  /** 지금 던질 단계: 입질·조과가 있으면 그 패턴 유지, '입질 없음'은 다음 단계로 */
  function currentStep(steps, session) {
    const round = (session && session.round) || 0;
    const evs = ((session && session.events) || []).filter((e) => (e.round || 0) === round);
    const last = evs[evs.length - 1] || null;
    if (last && last.type !== 'nobite') {
      const i = steps.findIndex((s) => s.combo.category === last.cat);
      if (i >= 0) return { index: i, hold: true, exhausted: false, last };
    }
    const tried = new Set(evs.filter((e) => e.type === 'nobite').map((e) => e.cat));
    const i = steps.findIndex((s) => !tried.has(s.combo.category));
    if (i < 0) return { index: -1, hold: false, exhausted: true, last, tried };
    return { index: i, hold: false, exhausted: false, last, tried };
  }

  /** 지난 출조 기록 중 같은 필드·같은 계절의 조과 → 카테고리 보너스(최대 +3) */
  function historyBonus(log, fieldId, season) {
    const n = {};
    (log || [])
      .filter((s) => s.fieldId === fieldId && (!season || seasonOf(Number(String(s.date).slice(5, 7))) === season))
      .forEach((s) => (s.catches || []).forEach((c) => { n[c.cat] = (n[c.cat] || 0) + 1; }));
    const out = {};
    Object.keys(n).forEach((k) => { out[k] = { v: Math.min(3, n[k]), label: `내 조과 ${n[k]}마리` }; });
    return out;
  }

  // ---------- 출조 기록 정리 ----------
  const pad2 = (n) => String(n).padStart(2, '0');
  const hm = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  function durLabel(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;
  }
  const EVENT_ICON = { nobite: '🙅', bite: '👀', catch: '🎣' };

  /** 출조 기록의 이벤트 → 루어별 구간(무엇을, 어디서, 언제부터 얼마나, 결과) */
  function tripSegments(entry) {
    const segs = [];
    const roundStarts = entry.roundStarts || {};
    let prevT = entry.startedAt;
    let prevRound = 0;
    (entry.events || []).forEach((e) => {
      const round = e.round || 0;
      const key = `${round}|${e.cat}|${e.lureId || ''}`;
      let seg = segs[segs.length - 1];
      if (!seg || seg.key !== key) {
        const start = round !== prevRound && roundStarts[round] ? roundStarts[round] : prevT;
        seg = { key, round, cat: e.cat, lureId: e.lureId || null, spot: e.spot || '', start, end: e.t, events: [] };
        segs.push(seg);
      }
      seg.events.push(e.type);
      seg.end = e.t;
      if (!seg.spot && e.spot) seg.spot = e.spot;
      prevT = e.t;
      prevRound = round;
    });
    return segs;
  }

  function tripStats(entry) {
    const evs = entry.events || [];
    const segs = tripSegments(entry);
    const rounds = Math.max(entry.rounds || 1, ...evs.map((e) => (e.round || 0) + 1), 1);
    return {
      segs,
      catches: evs.filter((e) => e.type === 'catch').length,
      bites: evs.filter((e) => e.type === 'bite').length,
      switches: Math.max(0, segs.length - 1),
      rounds,
      duration: (entry.endedAt || entry.startedAt) - entry.startedAt,
    };
  }

  function condLine(cond) {
    if (!cond) return '';
    const parts = [LABELS.season[cond.season], `수온 ${cond.waterTemp}°C${cond.waterTempEstimated ? '(추정)' : ''}`];
    if (cond.airTemp != null) parts.push(`기온 ${Math.round(cond.airTemp)}°C`);
    parts.push(LABELS.sky[cond.sky]);
    parts.push(cond.windMs != null ? `바람 ${Number(cond.windMs).toFixed(1)}m/s` : LABELS.wind[cond.wind]);
    parts.push(LABELS.pressure[cond.pressure], `물색 ${LABELS.clarity[cond.clarity]}`);
    return parts.filter(Boolean).join(' · ');
  }

  /** 캘린더 등에 붙여넣을 텍스트. lureName(id) → 이름 */
  function tripReport(entry, lureName) {
    const st = tripStats(entry);
    const d = new Date(`${entry.date}T00:00:00`);
    const wd = '일월화수목금토'[d.getDay()];
    const name = (seg) => (seg.lureId && lureName(seg.lureId)) || (CATEGORIES[seg.cat] ? CATEGORIES[seg.cat].short : seg.cat);
    const lines = [];
    lines.push(`🎣 ${entry.fieldName || '출조'} 배스 낚시 — ${st.catches ? `${st.catches}마리` : '꽝'}`);
    lines.push(`${entry.date} (${wd}) ${hm(entry.startedAt)}~${hm(entry.endedAt || entry.startedAt)} (${durLabel(st.duration)})`);
    lines.push('');
    if (entry.cond) lines.push(`[조건] ${condLine(entry.cond)}`);
    lines.push(`[결과] 🎣 ${st.catches}마리 · 👀 입질 ${st.bites}회 · 루어 교체 ${st.switches}회 · 포인트 ${st.rounds}곳`);
    const byLure = {};
    st.segs.forEach((s) => s.events.forEach((t) => { if (t === 'catch') byLure[name(s)] = (byLure[name(s)] || 0) + 1; }));
    const best = Object.keys(byLure).sort((a, b) => byLure[b] - byLure[a]);
    if (best.length) lines.push(`[히트 루어] ${best.map((k) => `${k} ${byLure[k]}마리`).join(', ')}`);
    if (entry.memo) lines.push(`[메모] ${entry.memo}`);
    if (st.segs.length) {
      lines.push('');
      lines.push('[로테이션]');
      let round = 0;
      st.segs.forEach((s, i) => {
        if (s.round !== round) { round = s.round; lines.push(`📍 포인트 이동 (${round + 1}번째)`); }
        const cat = CATEGORIES[s.cat] ? CATEGORIES[s.cat].short : s.cat;
        const label = s.lureId && lureName(s.lureId) ? `${lureName(s.lureId)} (${cat})` : cat;
        lines.push(`${i + 1}. ${hm(s.start)} ${label}${s.spot ? ` @ ${s.spot}` : ''} — ${durLabel(s.end - s.start)} ${s.events.map((t) => EVENT_ICON[t]).join('')}`);
      });
    }
    return lines.join('\n');
  }

  const api = {
    STRUCTURES, CATEGORIES, LABELS, SLOT_HOUR, ROLES, STEPS, EVENT_SCORE,
    tripSegments, tripStats, tripReport, condLine, durLabel,
    seasonOf, windClass, skyClass, shiftClarity,
    deriveConditions, scoreCategory, bestSpots, pickSetup,
    colorAdvice, recommend,
    sessionAdjust, buildRotation, currentStep, historyBonus,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TackleEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
