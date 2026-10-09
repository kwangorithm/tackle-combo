// 실행: node --test engine.test.js
const test = require('node:test');
const assert = require('node:assert');
const E = require('./engine.js');
const SEED = require('./seed.js');

function cond(over) {
  return Object.assign(E.deriveConditions(null, '2026-10-09', 'day', SEED.fields[0], {}), over);
}

test('계절 기본값으로 조건을 만든다', () => {
  const c = E.deriveConditions(null, '2026-01-15', 'dawn', SEED.fields[3], {});
  assert.strictEqual(c.season, 'winter');
  assert.strictEqual(c.fieldType, 'paid');
  assert.strictEqual(c.source, 'season');
});

test('Open-Meteo 응답에서 수온·기압 추세·물색을 계산한다', () => {
  const days = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
  const hourly = { time: [], temperature_2m: [], weather_code: [], cloud_cover: [], wind_speed_10m: [], pressure_msl: [], precipitation: [] };
  days.forEach((d, di) => {
    for (let h = 0; h < 24; h++) {
      hourly.time.push(`${d}T${String(h).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(18);
      hourly.weather_code.push(3);
      hourly.cloud_cover.push(80);
      hourly.wind_speed_10m.push(4);
      hourly.pressure_msl.push(di === 7 ? 1008 : 1013); // 마지막 날 기압 하강
      hourly.precipitation.push(0);
    }
  });
  const daily = { time: days, temperature_2m_mean: days.map(() => 16), precipitation_sum: [0, 0, 0, 0, 0, 0, 15, 5] };
  const c = E.deriveConditions({ hourly, daily }, '2026-10-09', 'dusk', SEED.fields[2], {});
  assert.strictEqual(c.source, 'weather');
  assert.strictEqual(c.sky, 'cloudy');
  assert.strictEqual(c.wind, 'breeze');
  assert.strictEqual(c.pressure, 'falling');
  assert.strictEqual(c.waterTemp, 18.5); // 가을: 7일 평균 16 + 2.5
  assert.strictEqual(c.clarity, 'stained'); // 맑음 + 20mm → 약간 탁함
});

test('사용자 보정값이 자동값보다 우선한다', () => {
  const c = E.deriveConditions(null, '2026-10-09', 'day', SEED.fields[0], { waterTemp: '9', clarity: 'clear' });
  assert.strictEqual(c.waterTemp, 9);
  assert.strictEqual(c.clarity, 'clear');
});

test('흐리고 바람 부는 기압 하강 날엔 무빙 계열이 탑워터보다 높다', () => {
  const c = cond({ waterTemp: 16, sky: 'cloudy', wind: 'strong', pressure: 'falling', clarity: 'stained' });
  assert.ok(E.scoreCategory('moving', c).score > E.scoreCategory('topwater', c).score);
});

test('저수온·맑은 물·유료터 한낮엔 피네스가 1순위', () => {
  const c = E.deriveConditions(null, '2026-01-10', 'day', SEED.fields[3], { sky: 'sunny', wind: 'calm', pressure: 'rising', clarity: 'clear' });
  const rec = E.recommend(SEED, c, 'f4', 3);
  assert.ok(['vertical', 'midstroll'].includes(rec.combos[0].category), rec.combos[0].category);
  assert.strictEqual(rec.combos[0].setup.id, rec.combos[0].category === 'vertical' ? 's5' : 's6');
});

test('여름 새벽 흐린 날 대형지엔 탑워터가 추천되고 커버 포인트가 매칭된다', () => {
  const c = E.deriveConditions(null, '2026-07-15', 'dawn', SEED.fields[0], { sky: 'cloudy', wind: 'calm', pressure: 'steady' });
  const rec = E.recommend(SEED, c, 'f1', 3);
  assert.strictEqual(rec.combos[0].category, 'topwater');
  assert.strictEqual(rec.combos[0].spots[0].name, '연안 버드나무 군락');
  assert.strictEqual(rec.combos[0].setup.id, 's1');
});

test('보유 루어 없는 상위 카테고리는 장비 보강 힌트로 알려준다', () => {
  const c = cond({ waterTemp: 18, sky: 'cloudy', wind: 'breeze', pressure: 'falling', clarity: 'stained' });
  const rec = E.recommend(SEED, c, 'f1', 3);
  assert.ok(rec.missing.some((m) => m.id === 'crank'));
  const ids = rec.combos.map((x) => x.category);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('패킹 리스트는 중복 없이 상위 조합 장비를 모은다', () => {
  const rec = E.recommend(SEED, cond({}), 'f1', 3);
  assert.strictEqual(new Set(rec.packing.setups).size, rec.packing.setups.length);
  assert.ok(rec.packing.lures.length >= rec.combos.length);
});
