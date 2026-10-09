// 처음 실행 시 들어가는 기본 데이터 (출조 작전 마스터 테이블 기반)
// 필드 좌표는 날씨 조회용 대략값입니다. '필드' 탭에서 정확히 수정하세요.
(function (root) {
  'use strict';

  const SEED = {
    version: 1,
    setups: [
      { id: 's1', name: '빅 탑워터·커버', type: 'bait', power: 'MH', rod: '리벨리온 69MH', reel: '15 메타늄 DC', line: '카본 16~20lb', categories: ['topwater', 'cover'], memo: '헤비커버 주변 탑워터 전용' },
      { id: 's2', name: '초장타 웜', type: 'bait', power: 'MH', rod: '19 아드레나 173MH', reel: '19 안타레스 HG', line: '카본 12lb', categories: ['bottom'], memo: '감도 위주 12lb 세팅' },
      { id: 's3', name: '미노우 저킹', type: 'bait', power: 'M', rod: '원텐스틱', reel: '21 질리언 SV TW', line: '카본 12lb (or 모노 14lb)', categories: ['minnow', 'crank'], memo: '' },
      { id: 's4', name: '하드베이트 범용', type: 'bait', power: 'ML', rod: '그레블코드', reel: '알파스 BFS', line: '카본 10lb', categories: ['moving', 'crank'], memo: 'ML 팁의 쿠션감으로 섀로우 공략' },
      { id: 's5', name: '수직 피네스', type: 'spinning', power: 'UL', rod: '리벨리온 642ULXS-ST', reel: '레보 MGX 세타', line: '카본 5lb', categories: ['vertical'], memo: '솔리드 팁(ST)' },
      { id: 's6', name: '중층 피네스', type: 'spinning', power: 'L', rod: '오로치 F1 (스피닝)', reel: '다이와 타튤라', line: '카본 4lb', categories: ['midstroll'], memo: '' },
      { id: 's7', name: '하드 피네스', type: 'bait', power: 'L', rod: '팝엑스 스틱', reel: '알파스 스트림커스텀', line: '모노 4.5lb', categories: ['popper'], memo: '물에 뜨는 모노 라인' },
      { id: 's8', name: '구조물 BFS', type: 'bfs', power: 'L', rod: '조디아스 BFS', reel: '아부 REVO LTX-BF8', line: '카본 8lb', categories: ['bfs'], memo: '' },
    ],
    lures: [
      { id: 'l1', name: '다지 (DODGE)', brand: '레이드재팬', category: 'topwater', size: '', colors: [], favorite: true, memo: '데드슬로우 리트리브 — 날개가 물을 쥐어짜듯 파닥이게, 스테이 위주.' },
      { id: 'l2', name: '센코 5"', brand: '게리야마모토', category: 'bottom', size: '5인치', colors: [], favorite: true, memo: '초장타 후 바닥 크롤링.' },
      { id: 'l3', name: '뎁스 불플랫 3.8"', brand: '뎁스', category: 'bottom', size: '3.8인치', colors: [], favorite: false, memo: '먼 거리 돌바닥 촉감 캐치.' },
      { id: 'l4', name: '비전 원텐 (ONETEN)', brand: '메가배스', category: 'minnow', size: '110mm', colors: [], favorite: true, memo: '저킹 후 3~5초 확실하게 멈춰 리액션 바이트.' },
      { id: 'l5', name: '하이피처 3/8oz', brand: 'O.S.P', category: 'moving', size: '3/8oz', colors: [], favorite: true, memo: '스피디한 권사.' },
      { id: 'l6', name: '레벨 바이브', brand: '레이드재팬', category: 'moving', size: '', colors: [], favorite: false, memo: '' },
      { id: 'l7', name: '레그웜 2.5"', brand: '게리야마모토', category: 'vertical', size: '2.5인치', colors: [], favorite: true, memo: '솔리드 팁을 흔들어 자동 훅셋.' },
      { id: 'l8', name: '돌라이브스틱 3"', brand: 'O.S.P', category: 'vertical', size: '3인치', colors: [], favorite: false, memo: '' },
      { id: 'l9', name: '플래시 J (0.9~1.3g)', brand: '피쉬애로우', category: 'midstroll', size: '0.9~1.3g', colors: [], favorite: true, memo: '4lb 은폐성으로 사이트 피싱.' },
      { id: 'l10', name: 'POPX', brand: '메가배스', category: 'popper', size: '', colors: [], favorite: true, memo: '네치네치 — 조밀한 팝음과 롤링.' },
      { id: 'l11', name: '돌라이브쉬림프 3"', brand: 'O.S.P', category: 'bfs', size: '3인치', colors: [], favorite: true, memo: '' },
      { id: 'l12', name: '컷테일 4"', brand: '게리야마모토', category: 'bfs', size: '4인치', colors: [], favorite: false, memo: '' },
    ],
    fields: [
      {
        id: 'f1', name: '이동저수지', region: '용인 처인구 이동읍', type: 'large', clarity: 'stained', lat: 37.14, lon: 127.205,
        spots: [
          { name: '연안 버드나무 군락', tags: ['cover', 'overhang', 'shallow'] },
          { name: '송전교 다리 밑', tags: ['bridge', 'breakline'] },
          { name: '수문 브레이크', tags: ['dam', 'breakline'] },
          { name: '새물유입구', tags: ['inflow', 'shallow'] },
          { name: '연안 석축 경사면', tags: ['riprap', 'breakline'] },
          { name: '원거리 수중 험프', tags: ['hump', 'open'] },
        ],
      },
      {
        id: 'f2', name: '고삼저수지', region: '안성 고삼면', type: 'large', clarity: 'stained', lat: 37.08, lon: 127.28,
        spots: [
          { name: '수초 그늘 헤비커버', tags: ['cover', 'weed', 'overhang'] },
          { name: '수중 험프', tags: ['hump', 'open'] },
          { name: '새물유입구', tags: ['inflow', 'shallow'] },
          { name: '제방권', tags: ['dam', 'riprap'] },
          { name: '중류권 오픈워터', tags: ['open', 'breakline'] },
          { name: '연안 섀로우 석축', tags: ['riprap', 'shallow'] },
        ],
      },
      {
        id: 'f3', name: '미산저수지', region: '안성', type: 'large', clarity: 'clear', lat: 37.05, lon: 127.3,
        spots: [
          { name: '제방권', tags: ['dam', 'riprap'] },
          { name: '중류권 오픈워터', tags: ['open'] },
          { name: '상류 새물유입구', tags: ['inflow', 'shallow'] },
          { name: '카페 앞 브레이크 라인', tags: ['breakline'] },
        ],
      },
      {
        id: 'f4', name: '신원지', region: '용인', type: 'paid', clarity: 'clear', lat: 37.2, lon: 127.2,
        spots: [
          { name: '붕어 좌대 사이', tags: ['pier'] },
          { name: '부교(잔교) 밑 그늘', tags: ['pier', 'overhang'] },
          { name: '상류 새물유입구', tags: ['inflow'] },
          { name: '오버행 나무 그늘', tags: ['overhang', 'shallow'] },
          { name: '맑은 물 브레이크 라인', tags: ['breakline'] },
        ],
      },
      {
        id: 'f5', name: '신기지', region: '안성', type: 'paid', clarity: 'clear', lat: 37.1, lon: 127.25,
        spots: [
          { name: '좌대 사이', tags: ['pier'] },
          { name: '연안 잔교 주변', tags: ['pier', 'riprap'] },
          { name: '오버행 나무 그늘', tags: ['overhang', 'shallow'] },
          { name: '연안 석축 경사면', tags: ['riprap'] },
        ],
      },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SEED;
  else root.TACKLE_SEED = SEED;
})(typeof window !== 'undefined' ? window : globalThis);
