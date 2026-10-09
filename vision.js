// 사진 → 태클·루어 인식 (Claude API, 사용자 본인 API 키로 브라우저에서 직접 호출)
(function (root) {
  'use strict';

  const MODEL = 'claude-opus-5-5';
  const MAX_SIDE = 1568; // 이보다 크면 API가 어차피 축소하므로 미리 줄여 전송량·비용 절약

  function schema(categoryIds) {
    const str = { type: 'string' };
    return {
      type: 'object',
      additionalProperties: false,
      required: ['lures', 'setups', 'note'],
      properties: {
        lures: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'brand', 'category', 'size', 'colors', 'memo', 'confidence'],
            properties: {
              name: str, brand: str, size: str, memo: str,
              category: { type: 'string', enum: categoryIds },
              colors: { type: 'array', items: str },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
        setups: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'rod', 'reel', 'line', 'type', 'power', 'categories', 'confidence'],
            properties: {
              name: str, rod: str, reel: str, line: str,
              type: { type: 'string', enum: ['bait', 'spinning', 'bfs'] },
              power: { type: 'string', enum: ['UL', 'L', 'ML', 'M', 'MH', 'H', 'XH'] },
              categories: { type: 'array', items: { type: 'string', enum: categoryIds } },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
        note: str,
      },
    };
  }

  function prompt(kind, categories) {
    const cats = Object.keys(categories).map((k) => `- ${k}: ${categories[k].label}`).join('\n');
    const focus = kind === 'setup'
      ? '사진 속 낚싯대·릴(및 보이는 라인 정보)을 태클 세팅으로 정리해 setups에 넣으세요. 로드와 릴이 함께 있으면 한 세팅으로 묶습니다. lures는 빈 배열.'
      : '사진 속 배스 루어를 하나하나 찾아 lures에 넣으세요. 같은 모델의 다른 컬러는 하나로 묶고 colors에 모두 적습니다. setups는 빈 배열.';
    return `배스 낚시인이 자기 장비를 앱에 등록하려고 찍은 사진입니다. ${focus}

규칙:
- name은 한국 배스 낚시인이 부르는 이름(예: "비전 원텐", "센코 5\\"", "하이피처 3/8oz")으로, 모델명·사이즈를 포함해 한국어로.
- brand는 한국에서 통용되는 표기(예: 메가배스, 게리야마모토, O.S.P, 다이와, 시마노).
- 패키지·본체 글자가 보이면 그걸 우선하세요. 확실하지 않으면 추측한 이름을 쓰고 confidence를 low로.
- size는 길이/무게(예: "110mm", "3/8oz"), 모르면 빈 문자열.
- colors는 보이는 컬러를 한국 낚시인 표현으로(예: "고스트 와카사기", "그린펌킨", "차트 백").
- memo는 이 루어/세팅의 대표 운용법 한 줄.
- category는 아래 중 가장 맞는 것 하나 (세팅의 categories는 그 세팅으로 주로 쓸 카테고리들):
${cats}
- 낚시 장비가 아니거나 알아볼 수 없으면 배열을 비우고 note에 이유를 적으세요. note에는 그 밖에 사용자에게 알릴 점을 한 줄로.`;
  }

  /** 이미지 파일 → 긴 변 MAX_SIDE 이하 JPEG base64 */
  function toJpegBase64(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요.')); };
      img.src = url;
    });
  }

  function friendlyError(status, body) {
    const msg = (body && body.error && body.error.message) || '';
    if (status === 401) return 'API 키가 올바르지 않아요. 기록 탭에서 키를 다시 확인하세요.';
    if (status === 403) return 'API 키에 권한이 없어요. (' + msg + ')';
    if (status === 429) return '요청이 많아 잠시 막혔어요. 1분 뒤 다시 시도하세요.';
    if (status === 400 && /credit|balance/i.test(msg)) return 'API 크레딧이 부족해요. console.anthropic.com에서 충전하세요.';
    if (status >= 500) return 'Claude 서버가 잠시 불안정해요. 잠시 뒤 다시 시도하세요.';
    return `인식 실패 (${status}) ${msg}`;
  }

  /**
   * files: 이미지 File 배열, kind: 'lure' | 'setup'
   * 반환: { lures, setups, note }
   */
  async function recognize(files, kind, apiKey, categories) {
    if (!apiKey) throw new Error('먼저 기록 탭에서 Claude API 키를 등록하세요.');
    const images = await Promise.all(Array.from(files).map(toJpegBase64));
    const content = images.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
    content.push({ type: 'text', text: prompt(kind, categories) });

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16000,
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema(Object.keys(categories)) } },
          messages: [{ role: 'user', content }],
        }),
      });
    } catch (e) {
      throw new Error('인터넷 연결을 확인하세요.');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(friendlyError(res.status, body));
    if (body.stop_reason === 'refusal') throw new Error('이 사진은 인식을 거절당했어요. 다른 사진으로 시도해 주세요.');
    if (body.stop_reason === 'max_tokens') throw new Error('사진 속 장비가 너무 많아요. 몇 개씩 나눠 찍어주세요.');
    const text = (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    let out;
    try { out = JSON.parse(text); } catch (e) { throw new Error('인식 결과를 해석하지 못했어요. 다시 시도해 주세요.'); }
    return { lures: out.lures || [], setups: out.setups || [], note: out.note || '' };
  }

  const api = { recognize, schema, prompt, MODEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TackleVision = api;
})(typeof window !== 'undefined' ? window : globalThis);
