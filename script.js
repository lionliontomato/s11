
'use strict';

/**
 * 蘇菲の歌單｜Google 試算表即時連動
 * A：歌名、B：歌手、C：分類
 * D：字數、F：篩選標籤
 * H：設定名稱、I：設定值
 *
 * 不使用瀏覽器本機儲存歌單。
 * 每次讀取 Google Sheets 都加入唯一參數。
 */

const SHEET_ID = '14yDYJOUYt0TU0DE8Pr-bUxGAazjDrk4HJ1zRZjNvl28';
const SHEET_GID = '0';
const RECHECK_MS = 45_000;
const SHEET_TIMEOUT_MS = 15_000;

const FISH_ICON_URL =
  './assets/sophie-ornament.svg?v=20261107-sophie1';

const palette = [
  ['#8e6ab5','#f0e7fa'],
  ['#9b79c2','#f2eafa'],
  ['#79549f','#eee4f7'],
  ['#a184c5','#f4edf9'],
  ['#76508e','#eee4f2'],
  ['#aa8bc8','#f5eef9'],
  ['#8965aa','#f0e8f6'],
  ['#b094ce','#f6f0fa'],
  ['#6f4b91','#ece2f3'],
  ['#9a78b7','#f3eaf7'],
  ['#8060a0','#eee7f5'],
  ['#ad91c7','#f5eff8'],
  ['#765b9a','#eee8f5'],
  ['#9e83bd','#f3edf8'],
  ['#875fa8','#f0e7f6']
];

let songs = [];
let tags = [];
let activeTag = null;
let query = '';
let loadedAt = 0;
let requestSerial = 0;
let activeRequest = null;
let lastRenderedFingerprint = '';

// 記錄隨機抽到的歌曲
let currentPickedSong = null;

const el = (id) => document.getElementById(id);

const clean = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();

function cell(row, index) {
  const c = row && Array.isArray(row.c)
    ? row.c[index]
    : null;

  if (!c) return '';

  return clean(
    c.f !== undefined && c.f !== null ? c.f : c.v
  );
}

function parseTags(value) {
  return clean(value)
    .replace(/[｜|／\/;；、，\n\r]/g, ',')
    .split(',')
    .map(clean)
    .filter(
      (tag) => tag && !['-', '—', '標籤'].includes(tag)
    );
}

function settingsFromRows(rows) {
  const settings = {};

  const settingNames = [
    '網站小標題',
    '抽歌視窗標題',
    '關閉按鈕文字',
    '網站標題'
  ];

  const normalizeKey = (value) =>
    clean(value)
      .replace(/[：:：\s　]/g, '')
      .replace(/[「」『』【】［］\[\]()（）]/g, '')
      .toLowerCase();

  // Keep the spreadsheet's wording intact. The sheet is the source of truth
  // for all four visible text settings.
  const assign = (rawKey, rawValue) => {
    const key = normalizeKey(rawKey);
    const value = clean(rawValue);
    if (!key || !value) return;

    // Match longer keys first so "網站小標題" is never mistaken for
    // "網站標題".
    const matched = settingNames
      .slice()
      .sort((a, b) => normalizeKey(b).length - normalizeKey(a).length)
      .find((name) => key === normalizeKey(name) ||
        key.includes(normalizeKey(name)));

    if (matched) settings[matched] = value;
  };

  for (const row of rows) {
    if (!row || !Array.isArray(row.c)) continue;

    const values = row.c.map((_, index) => cell(row, index));

    for (let i = 0; i < values.length; i++) {
      const current = values[i];
      if (!current) continue;

      // Inline form: "網站標題：蘇菲の歌單".
      const inline = current.match(
        /^\s*(網站小標題|抽歌視窗標題|關閉按鈕文字|網站標題)\s*[：:]\s*(.+?)\s*$/
      );

      if (inline) {
        assign(inline[1], inline[2]);
        continue;
      }

      // Two-cell form: setting name in one cell and its value in the
      // immediately following non-empty cell (commonly columns H and I).
      const key = normalizeKey(current);
      const isSettingKey = settingNames.some((name) =>
        key === normalizeKey(name) ||
        key.includes(normalizeKey(name))
      );

      if (!isSettingKey) continue;

      let value = '';
      for (let j = i + 1; j < values.length; j++) {
        if (values[j]) {
          value = values[j];
          break;
        }
      }

      if (value) assign(current, value);
    }
  }

  return {
    title: settings['網站標題'] || '蘇菲の歌單',
    subtitle: settings['網站小標題'] || '把喜歡的旋律，收藏在這裡',
    modalTitle: settings['抽歌視窗標題'] || '࿐ 蘇菲推薦',
    closeText: settings['關閉按鈕文字'] || '就這個了!'
  };
}

function applySettings(settings) {
  el('siteTitle').textContent = settings.title;
  el('siteSubtitle').textContent = settings.subtitle;
  el('modalTitle').textContent = settings.modalTitle;
  el('closeModal').textContent = settings.closeText;

  document.title = settings.title;

  document.body.classList.remove('settings-pending');
}

function parseSheet(response) {
  if (
    !response ||
    response.status !== 'ok' ||
    !response.table ||
    !Array.isArray(response.table.rows)
  ) {
    throw new Error(
      '試算表沒有提供可讀取的資料，請確認共用權限。'
    );
  }

  const rows = response.table.rows;
  const nextSongs = [];
  const masterTags = [];

  for (const row of rows) {
    const title = cell(row, 0);
    const artist = cell(row, 1);
    const category = cell(row, 2);
    const colD = cell(row, 3);
    const masterTagCell = cell(row, 5);

    masterTags.push(...parseTags(masterTagCell));

    const looksLikeHeader = [
      '歌名',
      '歌曲',
      '曲名',
      'title'
    ].includes(title.toLowerCase());

    if (title && !looksLikeHeader) {
      nextSongs.push({
        title: title,
        artist: artist || '未填歌手',
        category: category || '未分類',
        link: /^https?:\/\//i.test(colD) ? colD : ''
      });
    }
  }

  const inferred = nextSongs.flatMap(
    (song) => parseTags(song.category)
  );

  return {
    nextSongs: nextSongs,
    nextTags: Array.from(
      new Set(
        masterTags.length ? masterTags : inferred
      )
    ),
    settings: settingsFromRows(rows)
  };
}

function setBusy(isBusy, initial) {
  if (initial) {
    el('randomBtn').disabled = true;
  }

  el('grid').setAttribute(
    'aria-busy',
    isBusy ? 'true' : 'false'
  );
}

function discardActiveRequest() {
  if (!activeRequest) return;

  const req = activeRequest;
  activeRequest = null;

  clearTimeout(req.timeout);
  req.script.remove();

  try {
    delete window[req.callbackName];
  } catch (_) {
    window[req.callbackName] = undefined;
  }
}

function loadSheet(options = {}) {
  if (
    document.visibilityState === 'hidden' &&
    !options.force
  ) {
    return;
  }

  const initial = loadedAt === 0;

  discardActiveRequest();

  const serial = ++requestSerial;

  const callbackName =
    `sophieSheetCallback_${serial}_${Date.now()}`;

  const script = document.createElement('script');

  const params = new URLSearchParams({
    gid: SHEET_GID,
    headers: '0',
    tqx: `out:json;responseHandler:${callbackName}`,
    _fresh:
      `${Date.now()}_${serial}_${Math.random().toString(36).slice(2)}`
  });

  script.src =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`;

  script.async = true;
  script.referrerPolicy = 'no-referrer';

  setBusy(true, initial);

  if (initial) {
    el('count').textContent = '讀取最新歌單中…';
    el('empty').style.display = 'none';
  }

  const isCurrent = () =>
    activeRequest &&
    activeRequest.serial === serial;

  const fail = (message) => {
    if (!isCurrent()) return;

    discardActiveRequest();

    songs = [];
    tags = [];
    activeTag = null;
    loadedAt = 0;
    lastRenderedFingerprint = '';

    el('randomBtn').disabled = true;
    el('count').textContent = '目前無法確認最新歌單';

    if (initial) {
      el('siteTitle').textContent =
        '暫時無法取得最新標題';

      el('siteSubtitle').textContent =
        '請稍後重新整理再試一次';

      document.title = '蘇菲の歌單｜載入失敗';

      document.body.classList.remove(
        'settings-pending'
      );
    }

    el('grid').replaceChildren();

    el('grid').setAttribute(
      'aria-busy',
      'false'
    );

    el('tags').replaceChildren();

    el('empty').textContent =
      `無法取得最新歌單（${message}），請重新整理頁面再試一次。`;

    el('empty').style.display = 'block';
  };

  window[callbackName] = (response) => {
    if (!isCurrent()) return;

    let parsed;

    try {
      parsed = parseSheet(response);
    } catch (error) {
      console.error(
        '蘇菲歌單讀取失敗：',
        error
      );

      fail('試算表讀取失敗，請檢查分享權限');
      return;
    }

    discardActiveRequest();

    const fingerprint = JSON.stringify([
      parsed.nextSongs,
      parsed.nextTags,
      parsed.settings
    ]);

    songs = parsed.nextSongs;
    tags = parsed.nextTags;

    if (
      activeTag !== null &&
      !tags.includes(activeTag)
    ) {
      activeTag = null;
    }

    applySettings(parsed.settings);

    if (fingerprint !== lastRenderedFingerprint) {
      lastRenderedFingerprint = fingerprint;

      renderTags();
      renderSongs();
    } else {
      updateCount();
    }

    el('empty').textContent =
      '沒有找到符合條件的歌曲';

    loadedAt = Date.now();

    el('randomBtn').disabled =
      songs.length === 0;

    el('grid').setAttribute(
      'aria-busy',
      'false'
    );
  };

  script.onerror = () =>
    fail('連線失敗，無法讀取最新歌單');

  const timeout = setTimeout(
    () => fail('讀取逾時'),
    SHEET_TIMEOUT_MS
  );

  activeRequest = {
    serial,
    callbackName,
    script,
    timeout
  };

  document.head.appendChild(script);
}

function renderTags() {
  const container = el('tags');

  container.replaceChildren();

  tags.forEach((tag, index) => {
    const colors = palette[index % palette.length];

    const button = document.createElement('button');

    button.type = 'button';

    button.className =
      'tag' + (activeTag === tag ? ' active' : '');

    button.textContent = tag;

    button.style.setProperty(
      '--tag',
      colors[0]
    );

    button.style.setProperty(
      '--tagLight',
      colors[1]
    );

    button.setAttribute(
      'aria-pressed',
      String(activeTag === tag)
    );

    button.addEventListener('click', () => {
      activeTag =
        activeTag === tag ? null : tag;

      renderTags();
      renderSongs();
    });

    container.appendChild(button);
  });
}

function matchSong(song) {
  const text =
    `${song.title} ${song.artist} ${song.category}`
      .toLocaleLowerCase();

  const matchesSearch =
    !query ||
    text.includes(query.toLocaleLowerCase());

  const cats = parseTags(song.category);

  const matchesTag =
    !activeTag ||
    cats.includes(activeTag) ||
    song.artist === activeTag ||
    song.category.includes(activeTag);

  return matchesSearch && matchesTag;
}

function updateCount() {
  const count = songs.filter(matchSong).length;

  el('count').textContent =
    `共 ${count} 首 / 全部 ${songs.length} 首`;

  el('empty').style.display =
    count ? 'none' : 'block';
}

/**
 * 共用複製功能
 * 歌曲卡片與隨機抽歌使用相同格式。
 */
function copySongText(text, button) {
  if (!button || !text) return;

  const original =
    button.dataset.originalText ||
    button.textContent;

  button.dataset.originalText = original;

  if (button.copyResetTimer) {
    clearTimeout(button.copyResetTimer);
  }

  async function copy() {
    try {
      if (
        !navigator.clipboard ||
        !navigator.clipboard.writeText
      ) {
        throw new Error(
          'clipboard unavailable'
        );
      }

      await navigator.clipboard.writeText(text);
    } catch (_) {
      const temp =
        document.createElement('textarea');

      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';

      document.body.appendChild(temp);

      temp.select();

      const succeeded =
        document.execCommand('copy');

      temp.remove();

      if (!succeeded) {
        throw new Error('無法複製');
      }
    }
  }

  copy()
    .then(() => {
      button.textContent = '✓ 已複製';

      button.classList.add('done');

      button.copyResetTimer = setTimeout(() => {
        if (button.isConnected) {
          button.textContent = original;
          button.classList.remove('done');
        }
      }, 1300);
    })
    .catch(() => {
      button.textContent = '複製失敗';

      button.classList.remove('done');

      button.copyResetTimer = setTimeout(() => {
        if (button.isConnected) {
          button.textContent = original;
        }
      }, 1600);
    });
}

function renderSongs() {
  const grid = el('grid');

  const visible = songs.filter(matchSong);

  const fragment =
    document.createDocumentFragment();

  visible.forEach((song) => {
    const card =
      document.createElement('article');

    card.className = 'card';

    const decor =
      document.createElement('img');

    decor.className = 'decor-fish';
    decor.src = FISH_ICON_URL;
    decor.alt = '';

    decor.setAttribute(
      'aria-hidden',
      'true'
    );

    const title =
      document.createElement('h3');

    title.className = 'song';
    title.textContent = song.title;

    const artist =
      document.createElement('div');

    artist.className = 'artist';
    artist.textContent = song.artist;

    const cat =
      document.createElement('span');

    cat.className = 'cat';

    cat.textContent =
      parseTags(song.category).join(' ') ||
      '未分類';

    const copy =
      document.createElement('button');

    copy.className = 'copy';
    copy.type = 'button';
    copy.textContent = '複製';

    copy.setAttribute(
      'aria-label',
      `複製歌曲 ${song.title} - ${song.artist}`
    );

    copy.addEventListener('click', () => {
      copySongText(
        `${song.title} - ${song.artist}`,
        copy
      );
    });

    card.append(
      decor,
      title,
      artist,
      cat,
      copy
    );

    if (song.link) {
      card.title = '雙擊開啟歌曲連結';

      card.addEventListener('dblclick', () => {
        window.open(
          song.link,
          '_blank',
          'noopener,noreferrer'
        );
      });
    }

    fragment.appendChild(card);
  });

  grid.replaceChildren(fragment);

  updateCount();
}

/**
 * 隨機抽歌
 */
function openModal() {
  const filtered = songs.filter(matchSong);

  if (!filtered.length) return;

  const picked = filtered[
    Math.floor(Math.random() * filtered.length)
  ];

  // 儲存抽到的歌曲
  currentPickedSong = picked;

  el('pickSong').textContent = picked.title;

  el('pickArtist').textContent =
    `${picked.artist}｜${parseTags(picked.category).join(' ') || '未分類'}`;

  // 重設抽歌複製按鈕
  const copyButton = el('copyPickBtn');

  if (copyButton) {
    if (copyButton.copyResetTimer) {
      clearTimeout(copyButton.copyResetTimer);
    }

    copyButton.textContent =
      '📋 複製歌曲名稱與歌手';

    copyButton.dataset.originalText =
      '📋 複製歌曲名稱與歌手';

    copyButton.classList.remove('done');

    copyButton.setAttribute(
      'aria-label',
      `複製歌曲 ${picked.title} - ${picked.artist}`
    );
  }

  el('modal').classList.add('show');

  el('modal').setAttribute(
    'aria-hidden',
    'false'
  );

  el('closeModal').focus();
}

/**
 * 複製隨機抽歌結果
 * 格式：歌名 - 歌手
 */
function copyPickedSong() {
  if (!currentPickedSong) return;

  const button = el('copyPickBtn');

  if (!button) return;

  const text =
    `${currentPickedSong.title} - ${currentPickedSong.artist}`;

  copySongText(text, button);
}

function closeModal() {
  el('modal').classList.remove('show');

  el('modal').setAttribute(
    'aria-hidden',
    'true'
  );

  el('randomBtn').focus();
}

function initFloats() {
  const symbols = [
    '♪',
    '♫',
    '✦',
    '♬',
    '✧'
  ];

  const layer = el('floatLayer');

  for (let i = 0; i < 22; i++) {
    const symbol =
      document.createElement('span');

    symbol.className = 'float';

    symbol.textContent =
      symbols[i % symbols.length];

    symbol.style.setProperty(
      '--left',
      `${Math.random() * 100}%`
    );

    symbol.style.setProperty(
      '--dur',
      `${10 + Math.random() * 14}s`
    );

    symbol.style.setProperty(
      '--delay',
      `${-Math.random() * 16}s`
    );

    layer.appendChild(symbol);
  }
}

function clearLegacyCaches() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => {
        const scopePath = location.pathname.replace(
          /[^/]*$/,
          ''
        );

        regs
          .filter((reg) =>
            reg.scope.includes(scopePath)
          )
          .forEach((reg) =>
            reg.unregister()
          );
      })
      .catch(() => {});
  }

  if ('caches' in window) {
    caches.keys()
      .then((keys) => {
        const oldKeys = keys.filter(
          (key) =>
            /^(fang-fang|nian-nian|playlist)-/i.test(key)
        );

        return Promise.all(
          oldKeys.map(
            (key) => caches.delete(key)
          )
        );
      })
      .catch(() => {});
  }
}

function boot() {
  el('search').addEventListener(
    'input',
    (event) => {
      query = event.target.value.trim();

      renderSongs();
    }
  );

  el('randomBtn').addEventListener(
    'click',
    openModal
  );

  // 新增：隨機抽歌複製按鈕
  const copyPickButton = el('copyPickBtn');

  if (copyPickButton) {
    copyPickButton.addEventListener(
      'click',
      copyPickedSong
    );
  }

  el('closeModal').addEventListener(
    'click',
    closeModal
  );

  el('modal').addEventListener(
    'click',
    (event) => {
      if (event.target === el('modal')) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape' &&
        el('modal').classList.contains('show')
      ) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'visible') {
        loadSheet({ force: true });
      }
    }
  );

  window.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) {
        loadSheet({ force: true });
      }
    }
  );

  window.addEventListener(
    'focus',
    () => {
      if (
        loadedAt &&
        Date.now() - loadedAt > 15_000
      ) {
        loadSheet({ force: true });
      }
    }
  );

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      loadSheet();
    }
  }, RECHECK_MS);

  initFloats();
  clearLegacyCaches();
  loadSheet({ force: true });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    boot,
    { once: true }
  );
} else {
  boot();
}
