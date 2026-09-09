// app.js — 期货实时雷达 主逻辑（纯静态 / JSONP）
const PERIODS = [
  { k: 'day', label: '日线', type: null },
  { k: '60', label: '60分', type: 60 },
  { k: '30', label: '30分', type: 30 },
  { k: '15', label: '15分', type: 15 },
  { k: '5', label: '5分', type: 5 },
  { k: '1', label: '1分', type: 1 },
];
const TNAME = { T1: '一买', T2: '二买', T3: '三买', T1S: '一卖', T2S: '二卖', T3S: '三卖' };
const TFULL = { T1: '一买', T2: '二买', T3: '三买' };

const state = {
  symbols: [], universe: {}, top: [], news: [],
  openCard: null, openPeriod: '15', lastDayPoints: {},
};

async function batch(tasks, size = 6) {
  const out = [];
  for (let i = 0; i < tasks.length; i += size) {
    const grp = tasks.slice(i, i + size);
    const r = await Promise.allSettled(grp.map(t => t()));
    r.forEach(x => out.push(x.status === 'fulfilled' ? x.value : null));
  }
  return out;
}

function macdState(an) {
  if (!an || !an.ok || !an.macd) return '';
  const m = an.macd, n = m.dif.length;
  if (n < 2) return '';
  const d = m.dif[n - 1] - m.dea[n - 1], pd = m.dif[n - 2] - m.dea[n - 2];
  if (d > 0 && pd <= 0) return '金叉';
  if (d < 0 && pd >= 0) return '死叉';
  return d > 0 ? '红柱' : '绿柱';
}

async function refreshUniverse() {
  const tasks = state.symbols.map(s => () => Data.loadKline(s.contract, null).then(k => [s, k]).catch(() => [s, null]));
  const res = await batch(tasks, 6);
  const prev = state.lastDayPoints, newAlerts = [];
  for (const [s, k] of res) {
    if (!k || k.length < 2) continue;
    const last = k[k.length - 1], prevK = k[k.length - 2];
    const chg = prevK.c ? (last.c - prevK.c) / prevK.c * 100 : 0;
    const act = Data.activity(k, s.mult);
    const an = Chan.analyze(k);
    const sig = an.ok ? (an.points.length ? (TNAME[an.points[an.points.length - 1].type] || '信号') : '无信号') : '—';
    if (an.ok && an.points.length) {
      an.points.forEach(pt => {
        const key = s.code + '|day|' + pt.type + '|' + pt.idx;
        if (!prev[key]) newAlerts.push({ name: s.name, code: s.code, period: '日线', type: pt.type, dir: pt.dir, price: pt.price });
      });
    }
    state.universe[s.code] = { ...s, day: k, chg, activity: act, trend: an.ok ? an.trend : '—', daySignal: sig, lastPrice: last.c, dayAnalysis: an };
  }
  state.lastDayPoints = {};
  Object.values(state.universe).forEach(u => {
    if (u.dayAnalysis && u.dayAnalysis.points) u.dayAnalysis.points.forEach(pt => { state.lastDayPoints[u.code + '|day|' + pt.type + '|' + pt.idx] = 1; });
  });
  state.top = Object.values(state.universe).sort((a, b) => b.activity - a.activity).slice(0, 8);
  renderMovers(); renderTopCards();
  newAlerts.forEach(showAlert);
  const now = new Date();
  const ts = now.toLocaleString('zh-CN', { hour12: false });
  document.getElementById('ts').textContent = ts;
  document.getElementById('univ').textContent = Object.keys(state.universe).length;
}

function renderMovers() {
  const all = Object.values(state.universe);
  const up = all.filter(x => x.chg > 0).sort((a, b) => b.chg - a.chg).slice(0, 5);
  const dn = all.filter(x => x.chg < 0).sort((a, b) => a.chg - b.chg).slice(0, 5);
  const fmt = x => `<div class="mv"><span class="nm">${x.name}</span><span class="px">${x.lastPrice.toFixed(1)}</span><span class="${x.chg >= 0 ? 'up' : 'dn'}">${x.chg >= 0 ? '+' : ''}${x.chg.toFixed(2)}%</span></div>`;
  document.getElementById('upList').innerHTML = up.map(fmt).join('') || '<div class="mv">—</div>';
  document.getElementById('dnList').innerHTML = dn.map(fmt).join('') || '<div class="mv">—</div>';
}

function renderNews() {
  const el = document.getElementById('newsList');
  if (!state.news.length) { el.innerHTML = '<div class="nv">暂无快讯</div>'; return; }
  el.innerHTML = state.news.slice(0, 18).map(n => `<div class="nv"><span class="nt">${n.time}</span>${escapeHtml(n.text)}</div>`).join('');
}
function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderTopCards() {
  const wrap = document.getElementById('topCards');
  wrap.innerHTML = '';
  state.top.forEach((it, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (state.openCard === it.code ? ' open' : '');
    const mst = macdState(it.dayAnalysis);
    card.innerHTML = `
      <div class="chead" data-code="${it.code}">
        <span class="rank">${i + 1}</span>
        <span class="cname">${it.name}<small>${it.contract}</small></span>
        <span class="cprice">${it.lastPrice.toFixed(1)}</span>
        <span class="cchg ${it.chg >= 0 ? 'up' : 'dn'}">${it.chg >= 0 ? '+' : ''}${it.chg.toFixed(2)}%</span>
        <span class="ctrend ${trendCls(it.trend)}">${it.trend}</span>
        <span class="csig">${it.daySignal}</span>
        <span class="cmacd">${mst}</span>
      </div>`;
    if (state.openCard === it.code) {
      const body = document.createElement('div');
      body.className = 'cbody';
      body.innerHTML = `<div class="tabs">${PERIODS.map(p => `<span class="tab ${state.openPeriod === p.k ? 'on' : ''}" data-p="${p.k}">${p.label}</span>`).join('')}</div><canvas class="kcanvas"></canvas><div class="kstate"></div>`;
      card.appendChild(body);
      wrap.appendChild(card);
      bindCard(card, it);
      drawCard(it);
    } else {
      wrap.appendChild(card);
      card.querySelector('.chead').onclick = () => {
        state.openCard = state.openCard === it.code ? null : it.code;
        renderTopCards();
      };
    }
  });
}
function trendCls(t) { return t === '多头' ? 'up' : t === '空头' ? 'dn' : ''; }

function bindCard(card, it) {
  card.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = (e) => {
      e.stopPropagation();
      state.openPeriod = tab.dataset.p;
      card.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t === tab));
      drawCard(it);
    };
  });
  card.querySelector('.chead').onclick = () => { state.openCard = null; renderTopCards(); };
}

async function drawCard(it) {
  const canvas = document.querySelector(`.card.open[data-x] .kcanvas`) || document.querySelector('.kcanvas');
  if (!canvas) return;
  const per = PERIODS.find(p => p.k === state.openPeriod);
  const stateEl = canvas.parentElement.querySelector('.kstate');
  canvas.width = canvas.clientWidth || 760;
  canvas.height = 300;
  stateEl.textContent = '加载中…';
  try {
    const k = await Data.loadKline(it.contract, per.type);
    if (!k || k.length < 5) { stateEl.textContent = 'K线不足'; return; }
    const an = Chan.analyze(k);
    drawKline(canvas, k, an);
    if (an.ok) {
      const pts = an.points.map(p => (TNAME[p.type] || (p.dir === 1 ? '买' : '卖')) + '@' + p.price.toFixed(0)).join('  ');
      stateEl.innerHTML = `趋势:<b class="${trendCls(an.trend)}">${an.trend}</b> · 笔${an.strokes.length} 段${an.segments.length} 中枢${an.pivots.length} · MACD ${macdState(an)} · 信号:${pts || '无'}`;
    } else stateEl.textContent = '缠论: ' + (an.msg || '无');
  } catch (e) { stateEl.textContent = '加载失败:' + e.message; }
}

function showAlert(a) {
  const buy = a.dir === 1;
  const div = document.createElement('div');
  div.className = 'alert ' + (buy ? 'buy' : 'sell');
  div.innerHTML = `<div class="at">⚡ 缠论信号</div><div class="am">${a.name} · ${a.period} · <b>${TNAME[a.type] || (buy ? '买点' : '卖点')}</b></div><div class="ap">参考价 ${a.price.toFixed(1)}</div><div class="ac">点击关闭</div>`;
  div.onclick = () => div.remove();
  document.getElementById('alerts').appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 12000);
  beep(buy);
}
function beep(buy) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = buy ? 880 : 520; o.type = 'sine';
    g.gain.setValueAtTime(0.18, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    o.start(); o.stop(ac.currentTime + 0.5);
  } catch (e) {}
}

async function refreshNews() { try { state.news = await Data.loadNews(); renderNews(); } catch (e) {} }

async function init() {
  try {
    state.symbols = await Data.loadSymbols();
  } catch (e) {
    document.getElementById('ts').textContent = '合约映射加载失败';
    return;
  }
  await refreshUniverse();
  await refreshNews();
  setInterval(() => { refreshUniverse(); refreshNews(); }, 45000);
  setInterval(() => { if (state.openCard) { const it = state.top.find(x => x.code === state.openCard); if (it) drawCard(it); } }, 20000);
}
window.addEventListener('DOMContentLoaded', init);
