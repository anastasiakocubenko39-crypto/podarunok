(async () => {
  const stage = document.getElementById('stage');
  const note = (t) => { stage.innerHTML = `<p class="note">${t}</p>`; };
  const token = new URLSearchParams(location.search).get('g');
  // Без коду подарунка головна адреса веде в адмінку
  if (!token) return location.replace('admin.html');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return note('Такого подарунка не існує.');

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('open_gift', { p_token: token });
  if (error) return note('Не вдалося відкрити. Спробуйте ще раз за хвилину.');
  const g = data && data[0];
  if (!g) return note('Такого подарунка не існує.');

  const src = `${SUPABASE_URL}/storage/v1/object/public/gifts/${g.file_path}`;
  const ext = g.file_path.split('.').pop();
  const isVideo = g.kind === 'video';
  const media = document.createElement(isVideo ? 'video' : 'img');
  media.src = src;
  if (isVideo) { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
  stage.replaceChildren(media);

  const a = document.createElement('a');
  a.className = 'save';
  a.href = `${src}?download=${encodeURIComponent('podarunok.' + ext)}`;
  a.textContent = '⬇ Зберегти';
  document.body.appendChild(a);
})();
