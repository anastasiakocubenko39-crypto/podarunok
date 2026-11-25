// Малює QR-код і листівку A5 на canvas, робить PDF (без серверу)
window.Card = (() => {
  function qrMatrix(text) {
    const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount();
    return { n, dark: (r, c) => q.isDark(r, c) };
  }
  function drawQR(ctx, text, x, y, size, color = '#0b1d3a') {
    const { n, dark } = qrMatrix(text);
    ctx.save();
    const m = size / n;
    ctx.fillStyle = color;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (dark(r, c)) ctx.fillRect(Math.floor(x + c * m), Math.floor(y + r * m), Math.ceil(m), Math.ceil(m));
    ctx.restore();
  }
  function qrCanvas(text, px = 1024) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
    const pad = Math.round(px * 0.06);
    drawQR(ctx, text, pad, pad, px - pad * 2);
    return cv;
  }
  // Проста біла листівка A5 при 300 dpi: напис + великий QR-код
  function cardCanvas(g, url) {
    const W = 1748, H = 2480, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const sans = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#111';
    ctx.font = `700 120px ${sans}`;
    ctx.fillText('З Новим роком!', W / 2, 330);
    const qs = 1200, qx = (W - qs) / 2, qy = 640;
    drawQR(ctx, url, qx, qy, qs, '#000');
    ctx.font = `600 64px ${sans}`;
    ctx.fillText('Відскануй QR-код камерою телефону', W / 2, qy + qs + 140);
    ctx.fillStyle = '#555'; ctx.font = `400 50px ${sans}`;
    ctx.fillText(g.kind === 'video' ? 'і подивись відео-сюрприз' : 'і подивись фото-сюрприз', W / 2, qy + qs + 240);
    return cv;
  }
  function savePdf(g, url, fileName) {
    const cv = cardCanvas(g, url);
    const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a5' });
    pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 148, 210);
    pdf.setProperties({ title: g.title || 'Новорічний подарунок' });
    download(URL.createObjectURL(pdf.output('blob')), fileName);
  }
  function download(href, fileName) {
    const a = document.createElement('a');
    a.href = href; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 30000);
  }
  function savePng(url, fileName) { download(qrCanvas(url).toDataURL('image/png'), fileName); }
  return { qrCanvas, cardCanvas, savePdf, savePng };
})();
