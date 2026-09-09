// data.js — 纯前端数据层（JSONP 直连新浪，无后端）
// 行情/新闻全部走新浪 JSONP，绕过 CORS，纯静态托管也能实时刷新

const SINA_DAY = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20cb=/InnerFuturesNewService.getDailyKLine?symbol=';
const SINA_MIN = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20cb=/InnerFuturesNewService.getFewMinLine?symbol=';
const SINA_NEWS = 'https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=25&zhibo_id=152&tag_id=0&dire=f&dpc=1&callback=';

// ---- 新浪 K线 格式：var cb=([{d,o,h,l,c,v,p}]) ----
function sinaVarJsonp(url) {
  return new Promise((resolve, reject) => {
    const name = 'jp' + Date.now().toString(36) + Math.floor(Math.random() * 99999).toString(36);
    const u = url.replace('var%20cb=', 'var%20' + name + '=');
    const s = document.createElement('script');
    let done = false;
    const cleanup = () => { delete window[name]; if (s.parentNode) s.parentNode.removeChild(s); };
    s.onload = () => { if (done) return; done = true; const d = window[name]; cleanup(); resolve(d); };
    s.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('K线加载失败')); };
    s.src = u;
    document.head.appendChild(s);
    setTimeout(() => { if (!done) { done = true; cleanup(); reject(new Error('K线超时')); } }, 13000);
  });
}

// ---- 新浪 7x24 格式：try{cb({...})} ----
function sinaCbJsonp(url) {
  return new Promise((resolve, reject) => {
    const name = 'jpcb' + Date.now().toString(36) + Math.floor(Math.random() * 99999).toString(36);
    const s = document.createElement('script');
    let done = false;
    const cleanup = () => { delete window[name]; if (s.parentNode) s.parentNode.removeChild(s); };
    window[name] = (d) => { if (done) return; done = true; cleanup(); resolve(d); };
    s.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('新闻加载失败')); };
    s.src = url + name;
    document.head.appendChild(s);
    setTimeout(() => { if (!done) { done = true; cleanup(); reject(new Error('新闻超时')); } }, 13000);
  });
}

function parseKline(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(r => ({ t: r.d, o: +r.o, h: +r.h, l: +r.l, c: +r.c, v: +r.v || 0 }));
}

// type: null=日线, 1/5/15/30/60=分钟
async function loadKline(symbol, type) {
  const url = type ? (SINA_MIN + symbol + '&type=' + type) : (SINA_DAY + symbol);
  const raw = await sinaVarJsonp(url);
  return parseKline(raw);
}

async function loadNews() {
  const raw = await sinaCbJsonp(SINA_NEWS);
  const list = (raw && raw.result && raw.result.data && raw.result.data.feed && raw.result.data.feed.list) || [];
  return list.map(x => ({
    time: (x.create_time || '').replace(/\s/, ' ').slice(5, 16),
    text: (x.rich_text || x.text || x.digest || '').replace(/<[^>]+>/g, '')
  })).filter(x => x.text.length > 4);
}

async function loadSymbols() {
  const r = await fetch('contracts.json', { cache: 'no-store' });
  const d = await r.json();
  return d.symbols || [];
}

// 品种活跃度（用日K近N根成交额估算，公网无tick持仓）
function activity(klines, mult) {
  if (!klines || klines.length < 5) return 0;
  const tail = klines.slice(-Math.min(20, klines.length));
  let sum = 0;
  for (const k of tail) sum += k.c * k.v * mult;
  return sum;
}

window.Data = { loadKline, loadNews, loadSymbols, activity, SINA_DAY, SINA_MIN };
