// kline.js — Canvas 绘制 K线 + 缠论叠加（笔/段/中枢/买卖点）
// 中国习惯：红涨绿跌

function drawKline(canvas, klines, analysis) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);
  if (!klines || klines.length < 2) {
    ctx.fillStyle = '#888'; ctx.font = '14px sans-serif';
    ctx.fillText('K线数据不足', 16, 40); return;
  }
  const padL = 6, padR = 56, padT = 6, padB = 46;
  const volH = Math.round(H * 0.22);
  const mainTop = padT, mainBot = H - padB - volH;
  const mainH = mainBot - mainTop;

  // 价格范围（扩展包含笔/段/中枢/买卖点）
  let mn = Infinity, mx = -Infinity;
  const consider = p => { if (p < mn) mn = p; if (p > mx) mx = p; };
  klines.forEach(k => { consider(k.l); consider(k.h); });
  if (analysis) {
    (analysis.strokes || []).forEach(s => { consider(s.fromP); consider(s.toP); });
    (analysis.segments || []).forEach(s => { consider(s.fromP); consider(s.toP); });
    (analysis.pivots || []).forEach(p => { consider(p.zg); consider(p.zd); });
    (analysis.points || []).forEach(p => { consider(p.price); });
  }
  const range = (mx - mn) || 1;
  mn -= range * 0.06; mx += range * 0.06;
  const yOf = p => mainTop + (mx - p) / (mx - mn) * mainH;

  const N = klines.length;
  const plotW = W - padL - padR;
  const cw = plotW / N;
  const xOf = i => padL + i * cw + cw / 2;

  // 网格 + 价格刻度
  ctx.strokeStyle = 'rgba(120,130,150,0.13)'; ctx.fillStyle = '#7d8590';
  ctx.font = '10px sans-serif'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const p = mx - (mx - mn) * g / 4, y = yOf(p);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(p.toFixed(klines[0].c > 1000 ? 0 : 1), W - padR + 3, y + 3);
  }

  // 蜡烛
  for (let i = 0; i < N; i++) {
    const k = klines[i], up = k.c >= k.o;
    ctx.strokeStyle = up ? '#ef232a' : '#14b143';
    ctx.fillStyle = up ? '#ef232a' : '#14b143';
    const x = xOf(i);
    ctx.beginPath(); ctx.moveTo(x, yOf(k.h)); ctx.lineTo(x, yOf(k.l)); ctx.stroke();
    const yo = yOf(k.o), yc = yOf(k.c), top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yc - yo));
    ctx.fillRect(x - cw * 0.35, top, cw * 0.7, hgt);
  }

  // 成交量
  let vmax = 0; klines.forEach(k => { if (k.v > vmax) vmax = k.v; });
  const volTop = mainBot + 8, volBot = H - padB + 6, volH2 = volBot - volTop;
  for (let i = 0; i < N; i++) {
    const k = klines[i], up = k.c >= k.o;
    ctx.fillStyle = up ? 'rgba(239,35,42,0.45)' : 'rgba(20,177,67,0.45)';
    const h = vmax ? (k.v / vmax) * volH2 : 0;
    ctx.fillRect(xOf(i) - cw * 0.35, volBot - h, cw * 0.7, h);
  }

  // 时间轴
  ctx.fillStyle = '#7d8590'; ctx.font = '9px sans-serif';
  const step = Math.max(1, Math.floor(N / 6));
  for (let i = 0; i < N; i += step) {
    const t = (klines[i].t || '').toString().replace(/-/g, '/').slice(5, 16);
    ctx.fillText(t, xOf(i) - 16, H - 4);
  }

  // 笔（橙）
  if (analysis && analysis.strokes && analysis.strokes.length) {
    ctx.strokeStyle = '#ff9500'; ctx.lineWidth = 1.6; ctx.fillStyle = '#ff9500';
    ctx.beginPath();
    analysis.strokes.forEach(s => { ctx.moveTo(xOf(s.startOrig), yOf(s.fromP)); ctx.lineTo(xOf(s.endOrig), yOf(s.toP)); });
    ctx.stroke();
    analysis.strokes.forEach(s => { dot(ctx, xOf(s.startOrig), yOf(s.fromP), 2.5); dot(ctx, xOf(s.endOrig), yOf(s.toP), 2.5); });
  }
  // 段（紫虚线）
  if (analysis && analysis.segments && analysis.segments.length) {
    ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    analysis.segments.forEach(s => {
      ctx.beginPath(); ctx.moveTo(xOf(s.startOrig), yOf(s.fromP)); ctx.lineTo(xOf(s.endOrig), yOf(s.toP)); ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  // 中枢（灰框）
  if (analysis && analysis.pivots && analysis.pivots.length) {
    ctx.fillStyle = 'rgba(150,150,170,0.16)'; ctx.strokeStyle = 'rgba(175,175,195,0.6)'; ctx.lineWidth = 1;
    analysis.pivots.forEach(p => {
      const x1 = xOf(p.startOrig), x2 = xOf(p.endOrig);
      const x = Math.min(x1, x2), w = Math.abs(x2 - x1);
      const y1 = yOf(p.zg), y2 = yOf(p.zd), y = Math.min(y1, y2), h = Math.abs(y2 - y1);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    });
  }
  // 买卖点
  if (analysis && analysis.points && analysis.points.length) {
    analysis.points.forEach(pt => {
      const x = xOf(pt.idx), y = yOf(pt.price), buy = pt.dir === 1;
      ctx.fillStyle = buy ? '#ff3b30' : '#34c759';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = buy ? '#ff3b30' : '#34c759';
      const map = { T1: '一买', T2: '二买', T3: '三买', T1S: '一卖', T2S: '二卖', T3S: '三卖' };
      const lbl = map[pt.type] || (buy ? '买' : '卖');
      ctx.fillText(lbl, x + 6, y - 6);
    });
  }
}
function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
