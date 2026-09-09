// app.js — 期货实时雷达 主逻辑（纯静态 / 读同域 data.json）
const PERIODS = [
  { k: 'day', label: '日线' },
  { k: '60', label: '60分' },
  { k: '30', label: '30分' },
  { k: '15', label: '15分' },
  { k: '5', label: '5分' },
  { k: '1', label: '1分' },
];
const TNAME = { T1: '一买', T2: '二买', T3: '三买', T1S: '一卖', T2S: '二卖', T3S: '三卖' };

const state = { data: null, openCard: null, openPeriod: '15', lastKeys: {}, firstLoad: true };

function $(id) { return document.getElementById(id); }
function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

async function init() {
  try {
    state.data = await (await fetch('data.json', { cache: 'no-store' })).json();
  } catch (e) {
    $('ts').textContent = '数据加载失败(请稍后刷新)';
    return;
  }
  renderAll();
  state.firstLoad = false;
  setInterval(async () => {
    try {
      const d = await (await fetch('data.json', { cache: 'no-store' })).json();
      state.data = d; renderAll();
    } catch (e) {}
  }, 30000);
}

function renderAll() {
  const d = state.data;
  if (!d) return;
  $('ts').textContent = d.ts;
  $('dot').className = 'dot ' + (d.trading ? 'on' : 'off');
  $('stat').textContent = d.trading ? '交易时段 · 实时快照(每5分钟更新)' : '非交易时段 · 收盘前快照';
  $('univ').textContent = (d.symbols || []).length;
  renderMovers(); renderNews(); renderCards(); scanAlerts();
}

function renderMovers() {
  const q = state.data.quotes || {};
  const arr = Object.entries(q).map(([c, v]) => Object.assign({ code: c }, v));
  const up = arr.filter(x => x.chgPct > 0).sort((a, b) => b.chgPct - a.chgPct).slice(0, 6);
  const dn = arr.filter(x => x.chgPct < 0).sort((a, b) => a.chgPct - b.chgPct).slice(0, 6);
  const fmt = x => `<div class="mv"><span class="nm">${x.name}</span><span class="px">${x.last ? x.last.toFixed(1) : '-'}</span><span class="${x.chgPct >= 0 ? 'up' : 'dn'}">${x.chgPct >= 0 ? '+' : ''}${x.chgPct.toFixed(2)}%</span></div>`;
  $('upList').innerHTML = up.map(fmt).join('') || '<div class="mv">—</div>';
  $('dnList').innerHTML = dn.map(fmt).join('') || '<div class="mv">—</div>';
}

function renderNews() {
  const el = $('newsList');
  const ns = state.data.news || [];
  if (!ns.length) { el.innerHTML = '<div class="nv">暂无快讯</div>'; return; }
  el.innerHTML = ns.slice(0, 20).map(n => `<div class="nv"><span class="nt">${(n.time || '').slice(5, 16)}</span>${escapeHtml(n.text)}</div>`).join('');
}

function dayAna(code) {
  const kl = (state.data.klines[code] || {}).day || [];
  return kl.length >= 10 ? Chan.analyze(kl) : { ok: false };
}

function macdState(an) {
  if (!an || !an.ok || !an.macd) return '';
  const m = an.macd, n = m.dif.length; if (n < 2) return '';
  const d = m.dif[n - 1] - m.dea[n - 1], pd = m.dif[n - 2] - m.dea[n - 2];
  if (d > 0 && pd <= 0) return '金叉';
  if (d < 0 && pd >= 0) return '死叉';
  return d > 0 ? '红柱' : '绿柱';
}

function renderCards() {
  const wrap = $('topCards');
  wrap.innerHTML = '';
  const top = state.data.top || [];
  top.forEach((code, i) => {
    const q = state.data.quotes[code] || {};
    const an = dayAna(code);
    const trend = an.ok ? an.trend : '—';
    const sig = an.ok && an.points.length ? (TNAME[an.points[an.points.length - 1].type] || '信号') : '无信号';
    const mst = macdState(an);
    const card = document.createElement('div');
    card.className = 'card' + (state.openCard === code ? ' open' : '');
    card.innerHTML = `
      <div class="chead" data-code="${code}">
        <span class="rank">${i + 1}</span>
        <span class="cname">${q.name || code}<small>${code}0</small></span>
        <span class="cprice">${q.last ? q.last.toFixed(1) : '-'}</span>
        <span class="cchg ${q.chgPct >= 0 ? 'up' : 'dn'}">${q.chgPct >= 0 ? '+' : ''}${(q.chgPct || 0).toFixed(2)}%</span>
        <span class="ctrend ${trend === '多头' ? 'up' : trend === '空头' ? 'dn' : ''}">${trend}</span>
        <span class="csig">${sig}</span>
        <span class="cmacd">${mst}</span>
      </div>`;
    if (state.openCard === code) {
      const body = document.createElement('div');
      body.className = 'cbody';
      body.innerHTML = `<div class="tabs">${PERIODS.map(p => `<span class="tab ${state.openPeriod === p.k ? 'on' : ''}" data-p="${p.k}">${p.label}</span>`).join('')}</div><canvas class="kcanvas"></canvas><div class="kstate"></div>`;
      card.appendChild(body);
    }
    wrap.appendChild(card);
    const head = card.querySelector('.chead');
    head.onclick = () => {
      if (state.openCard === code) { state.openCard = null; }
      else { state.openCard = code; state.openPeriod = '15'; }
      renderCards();
      if (state.openCard === code) drawCard(code);
    };
    if (state.openCard === code) {
      card.querySelectorAll('.tab').forEach(tab => {
        tab.onclick = (e) => {
          e.stopPropagation();
          state.openPeriod = tab.dataset.p;
          card.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t === tab));
          drawCard(code);
        };
      });
    }
  });
}

function drawCard(code) {
  const canvas = document.querySelector('.card.open .kcanvas');
  if (!canvas) return;
  const per = PERIODS.find(p => p.k === state.openPeriod);
  const kl = (state.data.klines[code] || {})[per.k] || [];
  canvas.width = canvas.clientWidth || 760; canvas.height = 300;
  const st = canvas.parentElement.querySelector('.kstate');
  if (!kl || kl.length < 5) { st.textContent = 'K线不足'; return; }
  const an = Chan.analyze(kl);
  drawKline(canvas, kl, an);
  if (an.ok) {
    const pts = an.points.map(p => (TNAME[p.type] || (p.dir === 1 ? '买' : '卖')) + '@' + p.price.toFixed(0)).join('  ');
    st.innerHTML = `趋势:<b class="${an.trend === '多头' ? 'up' : an.trend === '空头' ? 'dn' : ''}">${an.trend}</b> · 笔${an.strokes.length} 段${an.segments.length} 中枢${an.pivots.length} · MACD ${macdState(an)} · 信号:${pts || '无'}`;
  } else st.textContent = '缠论:' + (an.msg || '无');
}

function scanAlerts() {
  const top = state.data.top || [];
  top.forEach(code => {
    const kls = state.data.klines[code] || {};
    PERIODS.forEach(p => {
      const kl = kls[p.k]; if (!kl || kl.length < 10) return;
      const an = Chan.analyze(kl);
      if (!an.ok) return;
      an.points.forEach(pt => {
        const key = code + '|' + p.k + '|' + pt.type + '|' + pt.idx;
        if (state.firstLoad) { state.lastKeys[key] = 1; return; }   // 首屏只记录不弹
        if (!state.lastKeys[key]) {
          state.lastKeys[key] = 1;
          showAlert({ name: (state.data.quotes[code] || {}).name || code, period: p.label, type: pt.type, dir: pt.dir, price: pt.price });
        }
      });
    });
  });
}

function showAlert(a) {
  const buy = a.dir === 1;
  const div = document.createElement('div');
  div.className = 'alert ' + (buy ? 'buy' : 'sell');
  div.innerHTML = `<div class="at">⚡ 缠论信号</div><div class="am">${a.name} · ${a.period} · <b>${TNAME[a.type] || (buy ? '买点' : '卖点')}</b></div><div class="ap">参考价 ${a.price.toFixed(1)}</div><div class="ac">点击关闭</div>`;
  div.onclick = () => div.remove();
  $('alerts').appendChild(div);
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

window.addEventListener('DOMContentLoaded', init);
