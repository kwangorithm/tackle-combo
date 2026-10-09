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
      .slice(0, 2)
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
  function recommend(state, c, fieldId, n) {
    n = n || 3;
    const field = (state.fields || []).find((f) => f.id === fieldId) || null;
    const advice = colorAdvice(c);
    const catScores = Object.keys(CATEGORIES)
      .map((id) => Object.assign({ id }, scoreCategory(id, c)))
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

  const api = {
    STRUCTURES, CATEGORIES, LABELS, SLOT_HOUR,
    seasonOf, windClass, skyClass, shiftClarity,
    deriveConditions, scoreCategory, bestSpots, pickSetup,
    colorAdvice, recommend,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TackleEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
