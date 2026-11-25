const CFG = window.APP_CONFIG;
const MAX_MB = 50;               // ліміт безкоштовного Supabase на один файл
const MAX_SECONDS = 15 * 60;     // 15 хвилин
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = (b) => b > 1e9 ? (b / 1e9).toFixed(2) + ' ГБ' : b > 1e6 ? (b / 1e6).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1e3)) + ' КБ';
const fmtDur = (s) => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const DROP_TEXT = `Натисніть або перетягніть фото / відео (до 15 хв, до ${MAX_MB} МБ)`;

if (!CFG || /XXXXXXXX/.test(CFG.SUPABASE_URL)) {
  $('cfgErr').hidden = false;
  $('cfgErr').textContent = 'Спочатку заповніть файл config.js (адреса і ключ Supabase) — див. інструкцію.';
  throw new Error('config.js не заповнено');
}
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

// Адреса сторінки подарунка = та ж папка, де лежить admin.html
const siteBase = new URL('./', location.href).href;
const giftUrl = (token) => `${siteBase}?g=${token}`;
const newToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_');
};
const TR = { а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',ы:'y',э:'e',ё:'io',ъ:'' };
const safeName = (s) => ([...String(s || 'podarunok').toLowerCase()].map((c) => TR[c] ?? c).join('')
  .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'podarunok');

// ---------- Вхід ----------
async function showApp() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('loginView').hidden = false; $('appView').hidden = true; return; }
  const { data: ok } = await sb.rpc('is_admin');
  if (!ok) {
    await sb.auth.signOut();
    $('loginView').hidden = false; $('appView').hidden = true;
    $('loginErr').textContent = 'Цей користувач не є адміністратором.';
    $('loginErr').hidden = false;
    return;
  }
  $('loginView').hidden = true; $('appView').hidden = false;
  load();
}
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginErr').hidden = true;
  const f = new FormData(e.target);
  const login = String(f.get('login')).trim().toLowerCase();
  const email = login.includes('@') ? login : `${login}@podarunok.local`; // логін → службова адреса
  const { error } = await sb.auth.signInWithPassword({ email, password: f.get('password') });
  if (error) { $('loginErr').textContent = 'Невірний логін або пароль'; $('loginErr').hidden = false; return; }
  showApp();
});
$('logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

// ---------- Вибір файлу ----------
const form = $('form'), fileIn = $('file'), err = $('err');
const showErr = (m) => { err.textContent = m; err.hidden = !m; };
let picked = { ok: false, duration: null };
$('dropText').textContent = DROP_TEXT;

function kindOf(f) {
  const n = f.name.toLowerCase();
  if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/.test(n)) return 'video';
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(n)) return 'image';
  return null;
}

fileIn.addEventListener('change', () => {
  showErr('');
  const f = fileIn.files[0];
  const prev = $('preview');
  prev.innerHTML = '';
  picked = { ok: false, duration: null };
  if (!f) { $('dropText').textContent = DROP_TEXT; return; }
  const kind = kindOf(f);
  $('dropText').textContent = `${f.name} · ${fmtSize(f.size)}`;
  if (!kind) return showErr('Підтримуються фото (JPG, PNG, WEBP, GIF) і відео (MP4, MOV, WEBM).');
  if (f.size > MAX_MB * 1024 * 1024) return showErr(`Файл ${fmtSize(f.size)} — більше ${MAX_MB} МБ. Стисніть відео (див. інструкцію) або перейдіть на Supabase Pro.`);
  const url = URL.createObjectURL(f);
  if (kind === 'video') {
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.preload = 'metadata'; v.controls = true;
    v.onloadedmetadata = () => {
      picked.duration = v.duration;
      $('dropText').textContent = `${f.name} · ${fmtSize(f.size)} · ${fmtDur(v.duration)}`;
      if (v.duration > MAX_SECONDS + 1) { picked.ok = false; showErr(`Відео триває ${fmtDur(v.duration)} — це більше 15 хвилин.`); }
    };
    prev.appendChild(v);
  } else {
    const i = document.createElement('img'); i.src = url; prev.appendChild(i);
  }
  picked.ok = true;
});

['dragover', 'dragenter'].forEach((e) => $('drop').addEventListener(e, (ev) => { ev.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach((e) => $('drop').addEventListener(e, () => $('drop').classList.remove('over')));
$('drop').addEventListener('drop', (ev) => {
  ev.preventDefault();
  if (ev.dataTransfer.files.length) { fileIn.files = ev.dataTransfer.files; fileIn.dispatchEvent(new Event('change')); }
});

// ---------- Завантаження ----------
function uploadWithProgress(path, file, contentType, accessToken) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${CFG.SUPABASE_URL}/storage/v1/object/gifts/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', CFG.SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const p = Math.round((ev.loaded / ev.total) * 100);
      $('bar').style.width = p + '%';
      $('pct').textContent = p < 100 ? `${p}%` : 'Збереження…';
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let m = xhr.responseText; try { m = JSON.parse(m).message || m; } catch {}
      reject(new Error(/maximum allowed size|too large|413/i.test(m + xhr.status) ? `Файл завеликий для Supabase (ліміт ${MAX_MB} МБ)` : m));
    };
    xhr.onerror = () => reject(new Error('Немає зʼєднання'));
    xhr.send(file);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = fileIn.files[0];
  if (!f) return showErr('Оберіть файл');
  if (!picked.ok) return; // помилку вже показано
  showErr('');
  $('progress').hidden = false; $('submit').disabled = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return location.reload();
    const kind = kindOf(f);
    const token = newToken();
    let ext = (f.name.split('.').pop() || '').toLowerCase();
    let mime = f.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
    // MOV з iPhone (H.264) віддаємо як MP4 — так він грає і на Android
    if (kind === 'video' && (ext === 'mov' || ext === 'm4v' || mime === 'video/quicktime')) { ext = 'mp4'; mime = 'video/mp4'; }
    if (ext === 'jpeg') ext = 'jpg';
    const path = `${token}.${ext}`;
    await uploadWithProgress(path, f, mime, session.access_token);
    const row = {
      token, kind, file_path: path, mime, original_name: f.name, size: f.size,
      duration: picked.duration, title: form.title.value.trim(),
    };
    const { error } = await sb.from('gifts').insert(row);
    if (error) { await sb.storage.from('gifts').remove([path]); throw error; }
    form.reset(); $('preview').innerHTML = ''; $('dropText').textContent = DROP_TEXT;
    showResult(row);
    load();
  } catch (ex) {
    showErr('Помилка: ' + (ex.message || ex));
  } finally {
    $('progress').hidden = true; $('submit').disabled = false; $('bar').style.width = '0';
  }
});

// ---------- Результат і список ----------
let gifts = [];
const byToken = (t) => gifts.find((g) => g.token === t);

function showResult(g) {
  const r = $('result');
  const url = giftUrl(g.token);
  r.hidden = false;
  r.innerHTML = `
    <h2>✅ Готово! QR-код${g.title ? ` для «${esc(g.title)}»` : ''}</h2>
    <div class="result-body">
      <div id="qrBig"></div>
      <div>
        <p>Роздрукуйте PDF і покладіть у листівку або на подарунок. Хто відсканує — побачить тільки це ${g.kind === 'video' ? 'відео' : 'фото'}.</p>
        <p class="link"><a href="${url}" target="_blank" rel="noopener">${url}</a></p>
        <div class="row">
          <button class="btn primary" data-pdf="${g.token}">Завантажити PDF для друку</button>
          <button class="btn" data-png="${g.token}">QR (PNG)</button>
          <button class="btn" data-copy="${url}">Копіювати посилання</button>
        </div>
      </div>
    </div>`;
  gifts.unshift(g);
  const c = Card.qrCanvas(url, 600); c.className = 'qr-big'; $('qrBig').appendChild(c);
  r.scrollIntoView({ behavior: 'smooth' });
}

async function load() {
  const { data, error } = await sb.from('gifts').select('*').order('created_at', { ascending: false });
  if (error) { $('list').innerHTML = `<p class="err">${esc(error.message)}</p>`; return; }
  gifts = data;
  $('count').textContent = data.length ? `(${data.length})` : '';
  $('list').innerHTML = data.length ? data.map((g) => `
    <article class="item">
      <canvas class="qr" data-qr="${g.token}"></canvas>
      <div class="info">
        <strong>${esc(g.title || g.original_name)}</strong>
        <span class="muted">${g.kind === 'video' ? '🎬 Відео' : '🖼 Фото'} · ${fmtSize(g.size)}${g.duration ? ' · ' + fmtDur(g.duration) : ''} · ${new Date(g.created_at).toLocaleDateString('uk-UA')}</span>
        <span class="muted">Переглядів: ${g.views}</span>
        <div class="row">
          <a class="btn sm" href="${giftUrl(g.token)}" target="_blank" rel="noopener">Відкрити</a>
          <button class="btn sm" data-pdf="${g.token}">PDF</button>
          <button class="btn sm" data-png="${g.token}">QR PNG</button>
          <button class="btn sm" data-copy="${giftUrl(g.token)}">Копіювати</button>
          <button class="btn sm" data-title="${g.token}">Підпис</button>
          <button class="btn sm danger" data-del="${g.token}">Видалити</button>
        </div>
      </div>
    </article>`).join('') : '<p class="muted">Ще немає жодного подарунка.</p>';
  document.querySelectorAll('canvas[data-qr]').forEach((cv) => {
    const src = Card.qrCanvas(giftUrl(cv.dataset.qr), 240);
    cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
  });
}

document.addEventListener('click', async (e) => {
  const t = (a) => e.target.closest(`[data-${a}]`);
  if (t('pdf')) { const g = byToken(t('pdf').dataset.pdf); Card.savePdf(g, giftUrl(g.token), `podarunok-${safeName(g.title)}.pdf`); }
  if (t('png')) { const g = byToken(t('png').dataset.png); Card.savePng(giftUrl(g.token), `qr-${safeName(g.title)}.png`); }
  const copy = t('copy');
  if (copy) {
    await navigator.clipboard.writeText(copy.dataset.copy).catch(() => prompt('Скопіюйте посилання:', copy.dataset.copy));
    const old = copy.textContent; copy.textContent = 'Скопійовано ✓'; setTimeout(() => (copy.textContent = old), 1500);
  }
  const ttl = t('title');
  if (ttl) {
    const g = byToken(ttl.dataset.title);
    const v = prompt('Підпис, який людина побачить зверху (можна залишити порожнім):', g.title || '');
    if (v !== null) {
      const { error } = await sb.from('gifts').update({ title: v.trim().slice(0, 120) }).eq('token', g.token);
      if (error) alert('Не вдалося зберегти: ' + error.message); else load();
    }
  }
  const del = t('del');
  if (del && confirm('Видалити подарунок? QR-код перестане працювати.')) {
    const g = byToken(del.dataset.del);
    await sb.storage.from('gifts').remove([g.file_path]);
    await sb.from('gifts').delete().eq('token', g.token);
    $('result').hidden = true;
    load();
  }
});

showApp();
