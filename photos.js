// 태클·루어 사진 저장소 — 기기 안(IndexedDB)에만 저장, 네트워크 전송 없음
(function (root) {
  'use strict';

  const DB = 'tackle-combo-photos';
  const STORE = 'photos';
  const MAX_SIDE = 900; // 폰 화면에서 보기 충분하고 용량은 작게 (장당 100KB 안팎)
  let dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }

  function write(fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite');
      fn(t.objectStore(STORE));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    }));
  }

  const put = (id, dataUrl) => write((s) => s.put(dataUrl, id));
  const del = (id) => write((s) => s.delete(id));
  const clear = () => write((s) => s.clear());
  const putAll = (map) => write((s) => Object.keys(map).forEach((id) => s.put(map[id], id)));

  function all() {
    return open().then((db) => new Promise((resolve, reject) => {
      const out = {};
      const req = db.transaction(STORE).objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { out[c.key] = c.value; c.continue(); } else resolve(out);
      };
      req.onerror = () => reject(req.error);
    }));
  }

  /** 카메라/앨범 사진 → 긴 변 MAX_SIDE 이하 JPEG data URL */
  function resize(file) {
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요.')); };
      img.src = url;
    });
  }

  // 브라우저가 저장 공간이 부족할 때 사진을 임의로 지우지 않도록 요청
  function persist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* noop */ }
  }

  root.TacklePhotos = { put, del, clear, putAll, all, resize, persist };
})(window);
