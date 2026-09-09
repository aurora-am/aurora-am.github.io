// 龙头战法面板 · 客户端渲染引擎（自动生成，勿手改）
var f2 = v => (Number(v) || 0).toFixed(2);
var yi = v => Math.round((Number(v) || 0) / 1e8 * 100) / 100;
var strategyText = function strategyText(emo) {
  if (!emo) return '—';
  const risk = emo.risk || 0;
  const pos = risk >= 60 ? '控仓≤3成 / 防守' : risk >= 45 ? '半仓 / 严选前排' : '7成+ / 积极试错';
  const focus = emo.oneRatio >= 0.4
    ? '回避一字加速（无换手介入点），只做前排换手龙分歧低吸'
    : '聚焦前排换手龙 + 题材确认期 2 板';
  const avoid = '回避中位股(3-4板)缩量加速、后排跟风、炸板回封无力';
  const jz = emo.jiezhi
    ? ('昨日连板晋级率 ' + (emo.jiezhi.jinjiRate != null ? emo.jiezhi.jinjiRate + '%' : 'MISS') + '，昨日涨停今日溢价 ' + (emo.jiezhi.premium != null ? emo.jiezhi.premium + '%' : 'MISS'))
    : '接力效应样本不足［MISSING］';
  const idx = emo.index
    ? ('上证 ' + (emo.index.sh > 0 ? '+' : '') + emo.index.sh + '% / 创业板 ' + (emo.index.cyb > 0 ? '+' : '') + emo.index.cyb + '%')
    : '大盘［MISSING］';
  return '仓位：' + pos + ' ｜ 聚焦：' + focus + ' ｜ 回避：' + avoid + '<br/>接力：' + jz + ' ｜ 大盘：' + idx + (emo.cycle && emo.cycle.warn ? ' ｜ ' + emo.cycle.warn : '');
};
function candleSVG(bars) {
  if (!bars || !bars.length) return '';
  const n = bars.length;
  const W = n * 8, H = 280, padB = 6;
  const pTop = 10, pBot = 150, vTop = 158, vBot = 196, mTop = 204, mBot = 262;
  let lo = Infinity, hi = -Infinity, vmax = 0;
  for (const b of bars) { if (b[3] < lo) lo = b[3]; if (b[4] > hi) hi = b[4]; if (b[5] > vmax) vmax = b[5]; }
  if (lo === hi) { lo *= 0.99; hi *= 1.01; }
  const pp = (hi - lo) * 0.06; lo -= pp; hi += pp;
  const yP = p => pTop + (hi - p) / (hi - lo) * (pBot - pTop);
  // MACD: EMA12/26 -> DIF, EMA9(DIF) -> DEA, 柱=2*(DIF-DEA)
  const close = bars.map(b => b[2]);
  const ema = (arr, N) => { const k = 2 / (N + 1); const out = []; let prev = arr[0]; out.push(prev); for (let i = 1; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out.push(prev); } return out; };
  const e12 = ema(close, 12), e26 = ema(close, 26);
  const dif = e12.map((v, i) => v - e26[i]);
  const dea = ema(dif, 9);
  const hist = dif.map((v, i) => 2 * (v - dea[i]));
  let mlo = 0, mhi = 0;
  for (const h of hist) { if (h < mlo) mlo = h; if (h > mhi) mhi = h; }
  if (mlo === mhi) { mlo -= 1; mhi += 1; }
  const yM = v => mBot - (v - mlo) / (mhi - mlo) * (mBot - mTop);
  const parts = [];
  // 价格蜡烛 + 成交量
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const up = b[2] >= b[1], col = up ? '#f85149' : '#3fb950', xi = i * 8 + 4;
    parts.push(`<line x1="${xi}" y1="${yP(b[4])}" x2="${xi}" y2="${yP(b[3])}" stroke="${col}" stroke-width="1"/>`);
    const yo = yP(b[1]), yc = yP(b[2]), top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yo - yc));
    parts.push(`<rect x="${xi - 2.5}" y="${top}" width="5" height="${hgt}" fill="${col}"/>`);
    const vh = vmax ? b[5] / vmax * (vBot - vTop) : 0;
    parts.push(`<rect x="${xi - 2.5}" y="${vBot - vh}" width="5" height="${vh}" fill="${col}" opacity="0.3"/>`);
  }
  // MACD 柱
  for (let i = 0; i < n; i++) {
    const h = hist[i] || 0, xi = i * 8 + 4, y0 = yM(0), yh = yM(h), top = Math.min(y0, yh), hgt = Math.max(1, Math.abs(y0 - yh));
    parts.push(`<rect x="${xi - 2}" y="${top}" width="4" height="${hgt}" fill="${h >= 0 ? '#f85149' : '#3fb950'}" opacity="0.6"/>`);
  }
  // DIF / DEA 线
  const line = (arr, col) => { let d = ''; for (let i = 0; i < n; i++) { const xi = i * 8 + 4; d += (i ? ' L' : 'M') + xi + ' ' + yM(arr[i] || 0); } return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1"/>`; };
  parts.push(line(dif, '#58a6ff'));
  parts.push(line(dea, '#d29922'));
  parts.push(`<line x1="0" y1="${yM(0)}" x2="${W}" y2="${yM(0)}" stroke="#30363d" stroke-width="0.5" stroke-dasharray="2 2"/>`);
  parts.push(`<text x="2" y="${mBot - 4}" fill="#8b949e" font-size="9">MACD(12,26,9) 柱红涨/绿跌 · DIF蓝 DEA黄</text>`);
  return `<svg class="candle-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
function renderHTML(data) {
  const { tradeDate, rows, themes, ladder, emotion, downNote, phase, genTime, klines = {}, secBoardList = [], sbMap = {} } = data;
  const top = rows.slice(0, 25);
  const lvCls = { buy: 'lv-buy', hold: 'lv-hold', reduce: 'lv-reduce', watch: 'lv-watch' };
  const moodCls = { 高潮: 'm-hot', 活跃: 'm-warm', 回暖: 'm-up', 平稳: 'm-flat', 低迷: 'm-down', 冰点: 'm-cold', '分歧退潮': 'm-down', '低迷/退潮': 'm-down' };

  // 龙头分评分规则说明
  const scoreRuleRows = [
    ['空间高度（35%）', '连板数越高得分越高：7板35、6板32、5板28、4板24、3板18、2板12、1板6'],
    ['封单强度（15%）', '封单金额/流通市值，比值越高越强；无市值则用封单金额对数'],
    ['上板时间（10%）', '越早越好：9:45前10分、10:30前8分、11:30前6分、14:00前4分、之后2分'],
    ['题材地位（20%）', '同题材涨停家数越多得分越高：≥8家20分、≥5家16分、≥3家12分、≥2家8分'],
    ['换手健康（10%）', '非一字且换手5-18%得10分；一字或炸板过多扣分'],
    ['市值适配（10%）', '流通市值50-250亿最适配10分；过小或过大均扣分'],
  ];
  const scoreRuleHTML = scoreRuleRows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

  // 分数阈值操作建议
  const scoreThresholdHTML = `
  <div class="st-grid">
    <div class="st-cell st-s"><b>≥70 分</b><span>无脑买</span>龙头分顶级，空间/封单/题材/换手共振，次日竞价或打板直接上仓位。</div>
    <div class="st-cell st-b"><b>55-69 分</b><span>可参与</span>龙头分优良，买点清晰，按买入区间分批参与，破止损即走。</div>
    <div class="st-cell st-w"><b>40-54 分</b><span>观察</span>龙头分一般，需次日弱转强/晋级确认后再跟随，不提前埋伏。</div>
    <div class="st-cell st-g"><b>&lt;40 分</b><span>放弃</span>龙头分偏低，多为跟风或孤立涨停，不参与。</div>
  </div>`;

  const leaderCards = top.map(r => {
    const p = r.plan;
    const volRows = p.volTable.map(v => `<tr><td>${v[0]}</td><td class="${/出货/.test(v[1]) ? 'neg' : /洗盘|一致/.test(v[1]) ? 'pos' : 'neu'}">${v[1]}</td><td>${v[2]}</td></tr>`).join('');
    const showNum = r.level === 'buy';
    return `
  <details class="lc">
    <summary>
      <div class="lc-head">
        <div class="lc-name">${r.name}<span class="lc-code">${r.code}</span></div>
        <div class="lc-lbc">${r.lbc}板</div>
      </div>
      <div class="lc-badges">${r.badges.map(b => `<span class="badge">${b}</span>`).join('') || '<span class="badge dim">无</span>'}<span class="badge ${r.score >= 70 ? 'sg-s' : r.score >= 55 ? 'sg-b' : r.score >= 40 ? 'sg-w' : 'sg-g'}">${r.score}分·${p.scoreGrade}</span></div>
      <div class="lc-meta">
        <span>涨停价 <b>${r.ztPrice ? f2(r.ztPrice) : '—'}元</b></span>
        <span>上板 <b>${r.firstTime || '—'}</b></span>
        <span>流通 <b>${r.floatCap ? (r.floatCap / 1e8).toFixed(0) + '亿' : '—'}</b></span>
        <span>换手 <b>${r.turnoverRate ? r.turnoverRate.toFixed(1) + '%' : '—'}</b></span>
      </div>
      <div class="lc-theme">题材：${r.themes.join(' / ')}</div>
    </summary>
    <div class="lc-body">
      ${klines[r.code] ? `<div class="tb-kline"><div class="tb-kline-cap">${r.name} 近90交易日日K（红涨绿跌·含MACD）</div>${candleSVG(klines[r.code])}</div>` : ''}
      ${showNum ? `
      <div class="num-grid">
        <div class="num-cell"><label>涨停价</label><b>${r.ztPrice ? f2(r.ztPrice) : '—'}</b></div>
        <div class="num-cell"><label>成本线</label><b>${p.entryMid}</b></div>
        <div class="num-cell"><label>止损位</label><b class="neg">${p.stop}</b></div>
        <div class="num-cell"><label>盈亏比</label><b class="pos">${p.rr1 === '—' ? '—' : p.rr1 + ' / ' + p.rr2}</b></div>
      </div>` : ''}
      <div class="lc-dec ${lvCls[r.level]}">
        <span class="lc-dec-tag">${r.decision}</span>
        <span class="lc-dec-reason">${r.decisionReason}</span>
      </div>
      <div class="op-sec"><b>买卖点分析与操作建议</b></div>
      <div class="op-row"><span class="op-k">买点</span><span class="op-v">${p.buyText}</span></div>
      <div class="op-row"><span class="op-k">执行</span><span class="op-v">${p.execute}</span></div>
      <div class="op-row"><span class="op-k">止损</span><span class="op-v neg">${p.stop}${p.stopPct ? '（涨停价×' + p.stopPct + '，破位即走）' : ''}</span></div>
      ${showNum ? `<div class="op-row"><span class="op-k">止盈</span><span class="op-v pos">T1 ${p.t1} 元（+10%）先减半仓；T2 ${p.t2} 元（+21%）再减；剩余仓位以 5 日线为生命线，收盘破 5 日线清仓。</span></div>` : ''}
      ${showNum ? `<div class="op-row"><span class="op-k">盈亏比</span><span class="op-v">${p.winLose}</span></div>` : ''}
      <div class="op-sec"><b>预判走势</b><p>${p.trend}</p></div>
      <div class="op-sec"><b>量能 / 换手（出货 vs 洗盘）</b>
        <table class="tb-vol"><tr><th>盘中量价情形</th><th>性质</th><th>操作</th></tr>${volRows}</table>
        <div class="tb-anchor">${p.volAnchor}</div>
      </div>
    </div>
  </details>`;
  }).join('');

  const themeCards = themes.map(t => {
    const p = t.plan;
    const open = p.actionable === 'buy' ? ' open' : '';
    const decCls = p.actionable === 'buy' ? 'tb-buy' : p.actionable === 'hold' ? 'tb-hold' : 'tb-watch';
    const decTxt = p.actionable === 'buy' ? (p.star >= 5 ? '可参与·无脑买' : '可参与') : p.actionable === 'hold' ? '持强不接力' : '观望';
    const starMark = '★'.repeat(p.star) + '☆'.repeat(5 - p.star);
    const volRows = p.vol.table.map(r => `<tr><td>${r[0]}</td><td class="${/出货/.test(r[1]) ? 'neg' : /洗盘|一致/.test(r[1]) ? 'pos' : 'neu'}">${r[1]}</td><td>${r[2]}</td></tr>`).join('');
    const backList = t.stocks.slice(1).map(s => {
      const sb = s.secBoard;
      const sbStar = sb && sb.isCandidate ? '<span class="sb-star">⭐2板候选</span>' : '';
      return `<span class="tb-back" data-code="${s.code}">${s.name}${s.lbc > 1 ? `(${s.lbc})` : ''}${sbStar}</span>`;
    }).join('') || '<span class="tb-back dim">无</span>';
    const leaderBars = klines[t.stocks[0].code];
    const leaderKline = leaderBars
      ? `<div class="tb-kline"><div class="tb-kline-cap">龙头 ${t.leader} 近90交易日日K（红涨绿跌·含MACD）</div>${candleSVG(leaderBars)}</div>`
      : `<div class="tb-kline"><div class="tb-kline-cap">龙头 ${t.leader} K线未取到［MISSING］</div></div>`;
    return `
  <details class="tb${open}">
    <summary><span class="tb-name">${t.name}</span>
      <span class="tb-stars" title="题材强度 ${p.star}/5 星">${starMark}</span>
      <span class="tb-badge ${decCls}">${decTxt}</span>
      <span class="tb-stat">${t.count}家 · ${yi(t.amount)}亿 · 最高${t.maxLbc}板 · 龙:${t.leader}</span></summary>
    <div class="tb-body">
      <div class="tb-grid">
        <div class="tb-cell"><label>决策</label><b class="${decCls}">${p.decision}</b></div>
        <div class="tb-cell"><label>买入区间</label><span>${p.buy}</span></div>
        <div class="tb-cell"><label>止损点</label><span class="neg">${p.stop}</span></div>
        <div class="tb-cell"><label>板块预计高度</label><span>${p.heightText}</span></div>
      </div>
      <div class="tb-sec"><b>预判走势</b><p>${p.trend}</p></div>
      ${leaderKline}
      <div class="tb-sec"><b>量能 / 换手（出货 vs 洗盘）</b>
        <table class="tb-vol"><tr><th>盘中量价情形</th><th>性质</th><th>操作</th></tr>${volRows}</table>
        <div class="tb-anchor">${p.vol.anchor}</div>
      </div>
      <div class="tb-sec"><b>后排跟进</b><p>${p.backRow}</p><div class="tb-backs">${backList}</div></div>
      <div class="tb-sec"><b>持续性</b><p>${p.persist}</p></div>
    </div>
  </details>`;
  }).join('');

  const sbSection = secBoardList.length ? `
  <div class="sec-t">二板潜力榜 <em>首板→2板晋级候选 · 按评分降序 · 共 ${secBoardList.length} 只 · 展示 Top10 · 名称悬浮看K线+评分</em></div>
  <div class="sb-wrap">
    ${secBoardList.slice(0, 10).map(x => `
    <div class="sb-row">
      <span><span class="sb-name" data-code="${x.code}">${x.name}</span><span class="sb-theme">${x.theme}</span><span class="sb-score ${x.score >= 70 ? 'sg-s' : x.score >= 55 ? 'sg-b' : x.score >= 45 ? 'sg-w' : 'sg-g'}">${x.score}分</span></span>
      <span class="sb-meta">涨停价 ${x.ztPrice ? f2(x.ztPrice) : '—'} 元 ｜ 上板 ${x.firstTime || '—'} ｜ 换手 ${x.turnoverRate ? x.turnoverRate.toFixed(1) + '%' : '—'} ｜ 封单 ${x.fund ? (x.fund / 1e8).toFixed(2) + '亿' : '—'}</span>
      <span class="sb-warn">次日竞价预警：弱转强≥ <b class="pos">${x.warnPrice || '—'}</b> 元 ｜ 打板 <b>${x.boardPrice || '—'}</b> 元 ｜ 跌破 <b class="neg">${x.breakPrice || '—'}</b> 元即放弃</span>
      <div class="sb-reason"><b>晋级2板理由：</b>${x.reason}</div>
    </div>`).join('')}
    ${secBoardList.length > 10 ? `<div class="sb-more">… 其余 ${secBoardList.length - 10} 只已纳入 data/leader_trade.csv（全部候选），可按需查看</div>` : ''}
  </div>` : '';

  const ladderBlocks = ladder.map(g => `
  <details class="blk">
    <summary><span class="th-name">${g.lbc}板（${g.count}只）</span>
      <span class="th-stat">${g.stocks.slice(0, 3).map(s => s.name).join('、')}${g.count > 3 ? '…' : ''}</span></summary>
    <div class="th-body">
      ${g.stocks.map(s => `<div class="th-row"><span class="th-s-name">${s.name}</span><span class="th-s-lbc">${s.lbc}板</span><span class="th-s-time">${s.firstTime}</span><span class="th-s-seal">${s.sealType || '—'}</span><span class="th-s-theme">${s.mainTheme}</span></div>`).join('')}
    </div>
  </details>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="theme-color" content="#0e1117"/>
<title>龙头战法 · 决策面板 ${tradeDate}</title>
<style>
:root{--bg:#0e1117;--panel:#161b22;--panel2:#1c2128;--line:#30363d;--text:#e6edf3;--muted:#8b949e;
--red:#f85149;--green:#3fb950;--yellow:#d29922;--blue:#58a6ff;--purple:#bc8cff;--orange:#f0883e;--teal:#39c5cf;}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;padding:12px;max-width:860px;margin:0 auto}
header{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:6px;margin-bottom:10px}
h1{font-size:19px;font-weight:700}
h1 small{color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}
.src{color:var(--muted);font-size:11px;text-align:right}
.tab{font-size:11px;color:var(--muted);margin:8px 0;line-height:1.5}
/* 情绪 */
.mood{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.mc{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 6px;text-align:center}
.mc b{display:block;font-size:22px;font-weight:700;color:var(--yellow)}
.mc span{font-size:11px;color:var(--muted)}
.mood-badge{grid-column:1/-1;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 12px;display:flex;align-items:center;gap:10px}
.mood-badge .mb{font-size:15px;font-weight:700;padding:3px 12px;border-radius:20px}
.m-hot{background:rgba(248,81,73,.18);color:var(--red)} .m-warm{background:rgba(240,136,62,.18);color:var(--orange)}
.m-up{background:rgba(63,185,80,.18);color:var(--green)} .m-flat{background:rgba(139,148,158,.18);color:var(--muted)}
.m-down{background:rgba(210,153,34,.18);color:var(--yellow)} .m-cold{background:rgba(88,166,255,.18);color:var(--blue)}
.mood-badge .md{font-size:12px;color:var(--muted)}
/* 龙头卡 */
.sec-t{font-size:13px;font-weight:700;color:var(--blue);margin:14px 2px 8px;display:flex;justify-content:space-between}
.sec-t em{font-style:normal;font-size:11px;color:var(--muted);font-weight:400}
.lc{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:9px;overflow:hidden}
.lc summary{list-style:none;cursor:pointer;padding:11px 12px}
.lc summary::-webkit-details-marker{display:none}
.lc[open] summary{border-bottom:1px solid var(--line)}
.lc-head{display:flex;justify-content:space-between;align-items:baseline}
.lc-name{font-size:16px;font-weight:700} .lc-code{font-size:11px;color:var(--muted);margin-left:6px}
.lc-lbc{font-size:15px;font-weight:700;color:var(--red)}
.lc-badges{margin:5px 0;display:flex;flex-wrap:wrap;gap:4px}
.badge{font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(188,140,255,.16);color:var(--purple);border:1px solid rgba(188,140,255,.3)}
.badge.dim{background:transparent;color:var(--muted);border-color:var(--line)}
.badge.sg-s{background:rgba(63,185,80,.22);color:var(--green);border-color:rgba(63,185,80,.4)}
.badge.sg-b{background:rgba(63,185,80,.14);color:var(--green);border-color:rgba(63,185,80,.3)}
.badge.sg-w{background:rgba(210,153,34,.16);color:var(--yellow);border-color:rgba(210,153,34,.3)}
.badge.sg-g{background:rgba(139,148,158,.16);color:var(--muted);border-color:var(--line)}
.lc-meta{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted);margin:4px 0}
.lc-meta b{color:var(--text);font-weight:600}
.lc-theme{font-size:12px;color:var(--teal);margin:2px 0 0}
.lc-body{padding:10px 12px}
.lc-dec{background:var(--panel2);border-radius:8px;padding:7px 9px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-top:8px}
.lc-dec-tag{flex:none;font-weight:700;padding:1px 7px;border-radius:5px;font-size:12px}
.lc-dec-reason{color:var(--muted);line-height:1.5}
.lv-buy .lc-dec-tag{background:rgba(63,185,80,.2);color:var(--green)}
.lv-hold .lc-dec-tag{background:rgba(139,148,158,.2);color:var(--muted)}
.lv-reduce .lc-dec-tag{background:rgba(248,81,73,.2);color:var(--red)}
.lv-watch .lc-dec-tag{background:rgba(210,153,34,.2);color:var(--yellow)}
/* 买卖点数字卡 */
.num-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 10px}
.num-cell{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 4px;text-align:center}
.num-cell label{display:block;font-size:10px;color:var(--muted);margin-bottom:2px}
.num-cell b{display:block;font-size:16px;font-weight:700;color:var(--text)}
.num-cell .neg{color:var(--red)} .num-cell .pos{color:var(--green)}
/* 买卖点分析 */
.op-sec{margin-top:10px;font-size:12px}
.op-sec>b{display:block;color:var(--blue);font-size:12px;margin-bottom:4px}
.op-sec p{color:var(--muted);line-height:1.6;margin:0}
.op-row{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);font-size:12px;align-items:baseline}
.op-row:last-child{border-bottom:none}
.op-k{flex:none;width:56px;color:var(--muted);font-size:11px}
.op-v{flex:1;color:var(--text);line-height:1.6}
.op-v.neg{color:var(--red)} .op-v.pos{color:var(--green)}
/* 分数阈值 */
.st-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.st-cell{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px}
.st-cell b{display:block;font-size:14px;margin-bottom:2px}
.st-cell span{display:inline-block;font-size:11px;padding:1px 7px;border-radius:5px;margin-right:6px}
.st-s b{color:var(--green)} .st-s span{background:rgba(63,185,80,.2);color:var(--green)}
.st-b b{color:var(--green)} .st-b span{background:rgba(63,185,80,.14);color:var(--green)}
.st-w b{color:var(--yellow)} .st-w span{background:rgba(210,153,34,.2);color:var(--yellow)}
.st-g b{color:var(--muted)} .st-g span{background:rgba(139,148,158,.2);color:var(--muted)}
/* 折叠 */
.blk{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin-bottom:7px;overflow:hidden}
.blk summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;justify-content:flex-start;align-items:center;gap:8px;text-align:left}
.blk summary::-webkit-details-marker{display:none}
.blk summary::before{content:"▸";color:var(--muted);margin-right:6px}
.blk[open] summary::before{content:"▾"}
.th-name{font-weight:700;font-size:14px;text-align:left} .th-stat{font-size:11px;color:var(--muted);text-align:right;margin-left:auto}
.th-body{padding:0 12px 8px;border-top:1px solid var(--line)}
.th-row{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);font-size:12px}
.th-row:last-child{border-bottom:none}
.th-s-name{flex:1;font-weight:600} .th-s-lbc{color:var(--red);width:34px;text-align:right}
.th-s-time{color:var(--muted);width:52px;text-align:right} .th-s-seal{color:var(--teal);width:48px;text-align:right}
.th-s-theme{color:var(--blue);width:64px;text-align:right;font-size:11px}
.note{background:var(--panel2);border-left:3px solid var(--yellow);border-radius:6px;padding:9px 12px;font-size:12px;color:var(--muted);margin-top:14px;line-height:1.7}
.note b{color:var(--text)}
/* 题材主线决策榜 */
.tb{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:9px;overflow:hidden}
.tb summary{list-style:none;cursor:pointer;padding:11px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tb summary::-webkit-details-marker{display:none}
.tb summary::before{content:"▸";color:var(--muted);margin-right:4px}
.tb[open] summary::before{content:"▾"}
.tb[open] summary{border-bottom:1px solid var(--line)}
.tb-name{font-size:15px;font-weight:700;color:var(--text)}
.tb-badge{flex:none;font-size:11px;font-weight:700;padding:2px 9px;border-radius:6px}
.tb-buy{background:rgba(63,185,80,.2);color:var(--green)}
.tb-hold{background:rgba(139,148,158,.2);color:var(--muted)}
.tb-watch{background:rgba(210,153,34,.2);color:var(--yellow)}
.tb-stars{flex:none;font-size:13px;color:#f5c542;letter-spacing:1px}.tb-stat{font-size:11px;color:var(--muted);margin-left:auto;text-align:right}
.tb-body{padding:10px 12px}
.tb-cell{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12px;align-items:baseline}
.tb-cell label{flex:none;width:68px;color:var(--muted);font-size:11px}
.tb-cell b{font-size:13px}
.tb-cell span{flex:1;color:var(--text);line-height:1.5}
.tb-sec{margin-top:10px;font-size:12px}
.tb-sec>b{display:block;color:var(--blue);font-size:12px;margin-bottom:4px}
.tb-sec p{color:var(--muted);line-height:1.6;margin:0}
.tb-vol{width:100%;border-collapse:collapse;margin:4px 0;font-size:11px}
.tb-vol th,.tb-vol td{border:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.tb-vol th{background:var(--panel2);color:var(--muted);font-weight:600}
.tb-vol .pos{color:var(--green)} .tb-vol .neg{color:var(--red)} .tb-vol .neu{color:var(--muted)}
.tb-anchor{font-size:11px;color:var(--teal);margin-top:4px}
.tb-backs{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.tb-back{font-size:11px;padding:1px 7px;border-radius:5px;background:rgba(88,166,255,.12);color:var(--blue);border:1px solid rgba(88,166,255,.25)}
.tb-back.dim{background:transparent;color:var(--muted);border-color:var(--line)}
footer{text-align:center;color:var(--muted);font-size:11px;margin:16px 0 6px}
#topbar{position:sticky;top:0;z-index:50;background:var(--bg);display:flex;align-items:center;gap:10px;padding:8px 2px;margin-bottom:6px;border-bottom:1px solid var(--line)}
#refreshBtn{background:var(--blue);color:#0e1117;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer}
#refreshBtn:disabled{opacity:.6;cursor:default}
#refreshInfo{font-size:11px;color:var(--muted)}
/* K线 */
.tb-kline{margin-top:8px}
.tb-kline-cap{font-size:11px;color:var(--muted);margin-bottom:4px}
.candle-svg{width:100%;height:auto;display:block;background:var(--panel2);border-radius:8px;border:1px solid var(--line)}
.tb-back{position:relative;cursor:help}
.tb-back.dim{cursor:default}
.sb-star{margin-left:3px;font-size:10px;color:var(--orange)}
/* 二板潜力榜 */
.sb-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:9px;padding:10px 12px}
.sb-row{padding:8px 0;border-bottom:1px solid var(--line);font-size:12px}
.sb-row:last-child{border-bottom:none}
.sb-name{font-weight:700;color:var(--text);cursor:help}
.sb-theme{color:var(--blue);margin:0 6px;font-size:11px}
.sb-meta{color:var(--muted);display:block;margin:3px 0}
.sb-warn{display:block;margin:3px 0;font-size:12px;color:var(--muted)}
.sb-warn b{font-size:13px}
.sb-warn .pos{color:var(--green)} .sb-warn .neg{color:var(--red)}
.sb-more{color:var(--muted);font-size:11px;margin-top:6px;text-align:center}
.sb-score{font-weight:700;padding:1px 8px;border-radius:6px;font-size:12px}
.sb-reason{color:var(--muted);line-height:1.6;margin-top:3px}
/* 悬浮K线popover */
.kl-pop{position:fixed;z-index:60;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px;width:320px;max-width:92vw;box-shadow:0 10px 36px rgba(0,0,0,.55);display:none}
.kl-pop .candle-svg{width:300px;max-width:88vw;height:auto}
.kl-miss{font-size:12px;color:var(--red);padding:8px}
.kl-sb{margin-top:6px;font-size:12px}
.kl-sb b{color:var(--orange)}
.kl-sb-reason{color:var(--muted);line-height:1.6}
</style></head>
<body>
<div id="topbar"><button id="refreshBtn" type="button">🔄 刷新数据</button><span id="refreshInfo">数据口径：${phase} · 生成于 ${genTime}</span></div>
<header>
  <h1>龙头战法 · 决策面板<small>${tradeDate}</small></h1>
  <div class="src">数据源：东财push2ex + 同花顺dataapi<br/>${downNote || '真实公开接口 · 取不到留空'}<br/>数据口径：<b style="color:var(--yellow)">${phase}</b> · 生成于 ${genTime}${phase === '盘前竞价' ? '<br/>⚠️ 盘前仅竞价封板样本，样本偏小、非完整盘面，盘后 15:30 更新为准' : ''}</div>
</header>
<div class="tab">本面板从当日真实涨停池识别「题材主线 → 龙头定位 → 决策评级」。题材主线决策榜置顶：每条主线给出<b>买入区间 / 止损点 / 预判走势 / 量能出货洗盘操作 / 后排跟进 / 持续性 / 板块预计高度</b>（买入止损为涨停价折算的绝对元价）。龙头分 = 空间高度35% + 封单15% + 上板时间10% + 题材地位20% + 换手健康10% + 市值适配10%。仅主板，缺失项标注［MISSING］。</div>

<div class="mood">
  <div class="mc"><b>${emotion.zt}</b><span>涨停家数</span></div>
  <div class="mc"><b>${emotion.lb}</b><span>连板家数</span></div>
  <div class="mc"><b style="color:#f85149">${emotion.maxLbc}</b><span>最高连板</span></div>
  <div class="mc"><b style="color:${emotion.down == null ? '#8b949e' : (emotion.down > emotion.zt * 0.5 ? '#f85149' : '#c9d1d9')}">${emotion.down == null ? 'MISS' : emotion.down}</b><span>跌停家数</span></div>
  <div class="mc"><b style="color:${emotion.sealRate < 50 ? '#f85149' : '#3fb950'}">${emotion.sealRate}%</b><span>封板率</span></div>
  <div class="mc"><b style="color:${emotion.oneRatio >= 0.4 ? '#f85149' : '#c9d1d9'}">${emotion.oneRatio != null ? (emotion.oneRatio * 100).toFixed(0) + '%' : '—'}</b><span>一字占比</span></div>
  <div class="mc"><b style="color:${emotion.risk >= 55 ? '#f85149' : (emotion.risk >= 40 ? '#d29922' : '#3fb950')}">${emotion.risk}</b><span>退潮风险</span></div>
  <div class="mc"><b style="color:${emotion.zddb != null ? (emotion.zddb < 1.5 ? '#f85149' : '#c9d1d9') : '#8b949e'}">${emotion.zddb != null ? emotion.zddb : 'MISS'}</b><span>涨跌停比</span></div>
  <div class="mood-badge"><span class="mb ${moodCls[emotion.mood] || 'm-flat'}">${emotion.mood}</span><span class="md">${emotion.moodDesc} ｜ 周期：${emotion.cycle ? emotion.cycle.phase : '—'} ｜ ${emotion.note}</span></div>
</div>

<div style="margin:14px 0;padding:14px 16px;border:1px solid #30363d;border-left:4px solid #58a6ff;border-radius:10px;background:#0d1117">
  <div style="font-size:14px;font-weight:500;color:#e6edf3;margin-bottom:8px">今日总策略 <span style="font-size:12px;color:#58a6ff;font-weight:400">${emotion.mood} · 退潮风险 ${emotion.risk}/100</span></div>
  <div style="font-size:13px;line-height:1.9;color:#c9d1d9">${strategyText(emotion)}</div>
</div>

<div class="sec-t">题材主线决策榜 <em>可参与优先 · 按星级/强度排序 · 五星无脑买</em></div>
${themeCards || '<div class="note">无有效题材聚类</div>'}

${sbSection}

<div class="sec-t">连板梯队 <em>按高度排序 · 点击展开</em></div>
${ladderBlocks || '<div class="note">无连板数据</div>'}

<div class="sec-t">龙头分排行 <em>全部涨停 · 按龙头分降序 · 点击展开买卖点分析</em></div>

<details class="blk">
  <summary><span class="th-name">龙头分评分规则</span><span class="th-stat">6 项加权 · 满分 100</span></summary>
  <div class="th-body">
    <table class="tb-vol"><tr><th>维度</th><th>说明</th></tr>${scoreRuleHTML}</table>
  </div>
</details>

<details class="blk" open>
  <summary><span class="th-name">分数阈值 · 操作建议</span><span class="th-stat">按分数定仓位</span></summary>
  <div class="th-body" style="padding-top:8px">
    ${scoreThresholdHTML}
  </div>
</details>

${leaderCards}

<div class="note">
<b>策略注意点 · 量能定买卖（出货 vs 洗盘）：</b><br/>
① <b>缩量封板</b>（换手&lt;5% 且不开板）= 持筹锁仓，强势不卖；未上车者不追缩量加速，等分歧。<br/>
② <b>缩量开板→快速回封</b> = 洗盘，回封即低吸买点，可打回封。<br/>
③ <b>放量不回封</b>（换手&gt;15%，尤其&gt;20%）= 出货 / 派发，减仓离场，不接飞刀。<br/>
④ <b>放量后回封</b>（充分换手再封死）= 分歧转一致，龙头质量提升，可打回封确认。<br/>
⑤ 龙头买点只在「启动确认（2-3板打板 / 竞价弱转强）」与「分歧换手回封（高位爆量后回封低吸）」；加速一字是持筹者盛宴。止损统一设涨停价-3%~-7%，破位即走。<br/>
⑥ 仅主板（沪60 / 深00），已剔除 300/688/8/4/92；一字龙 / 空间龙爆量开板回封无力即见顶。本面板为短线情绪与龙头定位参考，不构成投资建议；数据来自真实公开接口，缺失项标注［MISSING］。<br/>
⑦ <b>K线</b>：龙头日K（常显）与后排/二板候选悬浮K线均来自新浪日K（近90交易日，红涨绿跌），底部附 MACD(12,26,9) 副图——DIF 上穿 DEA 金叉、柱由绿转红为做多信号；DIF 下穿 DEA 死叉、柱由红转绿为派发信号；顶背离（价升 MACD 不升）警惕见顶。接口未取到标［MISSING］。二板潜力榜按「题材热度+上板时间+换手健康+市值适配+封单」综合打分，仅作晋级概率参考，非承诺。
</div>
<footer>龙头战法决策面板 · 自包含离线版 · 生成于 ${new Date().toISOString().slice(0, 19).replace('T', ' ')}</footer>
<script>
window.KL = ${JSON.stringify(klines)};
window.SB = ${JSON.stringify(sbMap)};
function renderKline(bars){
  if(!bars||!bars.length) return '';
  var n=bars.length, W=n*8, H=280, padB=6;
  var pTop=10, pBot=150, vTop=158, vBot=196, mTop=204, mBot=262;
  var lo=Infinity, hi=-Infinity, vmax=0, i, b;
  for(i=0;i<n;i++){ b=bars[i]; if(b[3]<lo)lo=b[3]; if(b[4]>hi)hi=b[4]; if(b[5]>vmax)vmax=b[5]; }
  if(lo===hi){ lo*=0.99; hi*=1.01; }
  var pp=(hi-lo)*0.06; lo-=pp; hi+=pp;
  function yP(p){ return pTop+(hi-p)/(hi-lo)*(pBot-pTop); }
  var close=[], ema=function(arr,N){ var k=2/(N+1), out=[], prev=arr[0]; out.push(prev); for(var j=1;j<arr.length;j++){ prev=arr[j]*k+prev*(1-k); out.push(prev);} return out; };
  for(i=0;i<n;i++) close.push(bars[i][2]);
  var e12=ema(close,12), e26=ema(close,26), dif=[], j;
  for(i=0;i<n;i++) dif.push(e12[i]-e26[i]);
  var dea=ema(dif,9), hist=[];
  for(i=0;i<n;i++) hist.push(2*(dif[i]-dea[i]));
  var mlo=0, mhi=0;
  for(i=0;i<n;i++){ if(hist[i]<mlo)mlo=hist[i]; if(hist[i]>mhi)mhi=hist[i]; }
  if(mlo===mhi){ mlo-=1; mhi+=1; }
  function yM(v){ return mBot-(v-mlo)/(mhi-mlo)*(mBot-mTop); }
  var parts=[];
  for(i=0;i<n;i++){
    b=bars[i]; var up=b[2]>=b[1], col=up?'#f85149':'#3fb950', xi=i*8+4;
    parts.push('<line x1="'+xi+'" y1="'+yP(b[4])+'" x2="'+xi+'" y2="'+yP(b[3])+'" stroke="'+col+'" stroke-width="1"/>');
    var yo=yP(b[1]), yc=yP(b[2]), top=Math.min(yo,yc), hgt=Math.max(1,Math.abs(yo-yc));
    parts.push('<rect x="'+(xi-2.5)+'" y="'+top+'" width="5" height="'+hgt+'" fill="'+col+'"/>');
    var vh=vmax? b[5]/vmax*(vBot-vTop):0;
    parts.push('<rect x="'+(xi-2.5)+'" y="'+(vBot-vh)+'" width="5" height="'+vh+'" fill="'+col+'" opacity="0.3"/>');
  }
  for(i=0;i<n;i++){
    var h=hist[i]||0, xi=i*8+4, y0=yM(0), yh=yM(h), top=Math.min(y0,yh), hgt=Math.max(1,Math.abs(y0-yh));
    parts.push('<rect x="'+(xi-2)+'" y="'+top+'" width="4" height="'+hgt+'" fill="'+(h>=0?'#f85149':'#3fb950')+'" opacity="0.6"/>');
  }
  var line=function(arr,col){ var d=''; for(var k=0;k<n;k++){ var xi=k*8+4; d+=(k?' L':'M')+xi+' '+yM(arr[k]||0); } return '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1"/>'; };
  parts.push(line(dif,'#58a6ff'));
  parts.push(line(dea,'#d29922'));
  parts.push('<line x1="0" y1="'+yM(0)+'" x2="'+W+'" y2="'+yM(0)+'" stroke="#30363d" stroke-width="0.5" stroke-dasharray="2 2"/>');
  parts.push('<text x="2" y="'+(mBot-4)+'" fill="#8b949e" font-size="9">MACD(12,26,9) 柱红涨/绿跌 · DIF蓝 DEA黄</text>');
  return '<svg class="candle-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+parts.join('')+'</svg>';
}
(function(){
  var pop=document.createElement('div'); pop.id='klpop'; pop.className='kl-pop'; document.body.appendChild(pop);
  var cur=null;
  function show(el){
    var code=el.getAttribute('data-code'); if(!code) return;
    var bars=window.KL[code], sb=window.SB[code], h='';
    if(!bars||!bars.length){ h='<div class="kl-miss">K线未取到［MISSING］</div>'; }
    else { h=renderKline(bars); }
    if(sb){ h+='<div class="kl-sb"><b>'+(sb.isCandidate?'⭐2板候选 · ':'')+'评分 '+sb.score+'</b><div class="kl-sb-reason">'+sb.reason+'</div></div>'; }
    pop.innerHTML=h; pop.style.display='block';
    var r=el.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight, left=r.left, top=r.bottom+6;
    if(left+pw>window.innerWidth-8) left=window.innerWidth-pw-8;
    if(top+ph>window.innerHeight-8) top=r.top-ph-6;
    pop.style.left=Math.max(8,left)+'px'; pop.style.top=Math.max(8,top)+'px'; cur=el;
  }
  function hide(){ pop.style.display='none'; cur=null; }
  document.addEventListener('mouseover',function(e){ var el=e.target.closest?e.target.closest('[data-code]'):null; if(el) show(el); });
  document.addEventListener('mouseout',function(e){ var el=e.target.closest?e.target.closest('[data-code]'):null; var to=e.relatedTarget; if(el && !(to&&to.closest&&to.closest('[data-code]'))) hide(); });
  document.addEventListener('click',function(e){ var el=e.target.closest?e.target.closest('[data-code]'):null; if(el){ if(cur===el) hide(); else show(el); } else hide(); });
  window.addEventListener('scroll',hide);
})();
</script>
<script src="./leader_engine.js"></script>
</body></html>`;
}
// ===== 实时刷新管线（与 node 端同源，纯函数 stringify 注入） =====
var THEME_DICT = [{"name":"机器人","kw":["机器人","减速器","伺服","人形","灵巧手"]},{"name":"华为概念","kw":["华为","鸿蒙","昇腾","海思","鲲鹏"]},{"name":"AI算力","kw":["算力","智算","数据中心","IDC","英伟达","GB200","算力租赁"]},{"name":"CPO光模块","kw":["CPO","光模块","光通信","光芯片"]},{"name":"PCB","kw":["PCB","印制电路板","覆铜板"]},{"name":"半导体","kw":["半导体","芯片","集成电路","存储","封测","光刻"]},{"name":"固态电池","kw":["固态电池","钠离子","锂电池","锂电","电池"]},{"name":"光伏","kw":["光伏","钙钛矿","HJT","BC电池","硅料"]},{"name":"储能","kw":["储能"]},{"name":"汽车链","kw":["新能源车","汽车零部件","智能驾驶","汽车","一体化压铸"]},{"name":"低空经济","kw":["低空","飞行汽车","eVTOL","通航"]},{"name":"商业航天","kw":["商业航天","卫星","火箭","星链"]},{"name":"军工","kw":["军工","国防","航空装备","中航"]},{"name":"医药","kw":["创新药","中药","CXO","医疗","医药","生物"]},{"name":"消费","kw":["白酒","零售","食品","消费","百货","免税"]},{"name":"地产链","kw":["地产","物业","城投","棚改"]},{"name":"有色金属","kw":["黄金","铜","铝","稀土","有色","金属","锂矿"]},{"name":"能源","kw":["煤炭","电力","油气","石油","天然气","核电","风电"]},{"name":"化工","kw":["化工","化学","材料","化纤","塑料"]},{"name":"金融","kw":["数字货币","跨境支付","券商","银行","期货","信托"]},{"name":"AI应用","kw":["传媒","游戏","AI应用","多模态","短剧"]},{"name":"消费电子","kw":["消费电子","MR","AR","VR","可穿戴"]},{"name":"农业","kw":["农业","种业","养殖"]},{"name":"基建","kw":["钢铁","水泥","基建","水利","装配式"]},{"name":"航运物流","kw":["航运","港口","物流","快递"]},{"name":"氢能源","kw":["氢能源","燃料电池","氢能"]},{"name":"环保","kw":["环保","可降解","绿化"]},{"name":"国产替代","kw":["国产替代","自主可控","信创"]},{"name":"数据要素","kw":["数据要素","数据确权","政务数据"]}];
var emTime = v => {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  // 10 位以上数字 = Unix 秒级时间戳（同花顺 first_limit_up_time 是时间戳，非 HHMMSS）
  if (/^\d{10,}$/.test(s)) {
    const d = new Date(Number(s) * 1000);
    const hh = String((d.getUTCHours() + 8) % 24).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  // 6 位 HHMMSS（东财 fbt/lbt）
  const t = ('000000' + s).slice(-6);
  const hh = t.slice(0, 2), mm = t.slice(2, 4), ss = t.slice(4, 6);
  if (Number(hh) > 23 || Number(mm) > 59) return '';   // 非法（如 74:..）直接空，避免误导
  return `${hh}:${mm}:${ss}`;
};
var classify = function classify(reason, industry) {
  const text = String(reason || '') + ' ' + String(industry || '');
  const hit = [];
  for (const t of THEME_DICT) if (t.kw.some(k => text.includes(k))) hit.push(t.name);
  if (hit.length) return hit;
  // 未命中词典：用行业/原因首词兜底
  const fb = String(reason || '').split(/[+、，,\s]/).filter(Boolean)[0];
  if (fb && fb.length >= 2) return [fb.slice(0, 6)];
  if (industry) return [industry.slice(0, 6)];
  return ['其他'];
};
var filterMain = function filterMain(rows) { return rows.filter(r => /^(60|000|001|002|003)/.test(r.code)); };
var scoreLeaders = function scoreLeaders(rows, maxLbc) {
  // 题材热度表
  const themeCount = {};
  for (const r of rows) {
    const themes = classify(r.reason, r.industry);
    r.themes = themes;
    r.mainTheme = themes[0];
    const t = r.mainTheme;
    themeCount[t] = (themeCount[t] || 0) + 1;
  }
  for (const r of rows) r.themeSize = themeCount[r.mainTheme] || 1;

  for (const r of rows) {
    const lbc = r.lbc;
    // 空间高度 35
    const hScore = lbc >= 7 ? 35 : lbc === 6 ? 32 : lbc === 5 ? 28 : lbc === 4 ? 24 : lbc === 3 ? 18 : lbc === 2 ? 12 : 6;
    // 封单强度 15（封单/流通市值 比值，越大越好；无市值则用绝对值对数）
    let fScore = 6;
    if (r.floatCap > 0) {
      const ratio = r.fund / r.floatCap;
      fScore = Math.min(15, Math.round(ratio * 600)); // 0.025 占比≈15分
    } else if (r.fund > 0) {
      fScore = Math.min(15, Math.round(Math.log10(r.fund) * 1.6));
    }
    // 上板时间 10（越早越好）
    let tScore = 5;
    const hh = parseInt((r.firstTime || '15:00').slice(0, 2));
    const mm = parseInt((r.firstTime || '15:00').slice(3, 5));
    const mins = hh * 60 + mm;
    if (mins > 0) {
      if (mins <= 9 * 60 + 45) tScore = 10;
      else if (mins <= 10 * 60 + 30) tScore = 8;
      else if (mins <= 11 * 60 + 30) tScore = 6;
      else if (mins <= 14 * 60) tScore = 4;
      else tScore = 2;
    }
    // 题材地位 20
    const tSizeScore = r.themeSize >= 8 ? 20 : r.themeSize >= 5 ? 16 : r.themeSize >= 3 ? 12 : r.themeSize >= 2 ? 8 : 3;
    // 换手健康 10
    let hthScore = 5;
    const turn = r.turnoverRate || 0;
    const isOne = /一字/.test(r.sealType);
    if (isOne) hthScore = 3;                       // 一字无法介入
    else if (turn >= 5 && turn <= 18) hthScore = 10;
    else if (turn > 0) hthScore = 6;
    if ((r.zbc || 0) > 0 && !isOne) hthScore = Math.max(2, hthScore - 3);
    // 市值适配 10
    let capScore = 6;
    const cap = r.floatCap || 0;
    if (cap >= 50e8 && cap <= 250e8) capScore = 10;
    else if (cap > 250e8 && cap <= 600e8) capScore = 7;
    else if (cap >= 20e8 && cap < 50e8) capScore = 7;
    else if (cap > 0 && cap < 20e8) capScore = 4;
    else if (cap > 600e8) capScore = 4;

    r.score = hScore + fScore + tScore + tSizeScore + hthScore + capScore;
    r.scoreDetail = { hScore, fScore, tScore, tSizeScore, hthScore, capScore };
  }

  // 标签
  const byTheme = {};
  for (const r of rows) (byTheme[r.mainTheme] || (byTheme[r.mainTheme] = [])).push(r);
  for (const t of Object.keys(byTheme)) byTheme[t].sort((a, b) => b.lbc - a.lbc || b.score - a.score);
  const spaceMax = maxLbc;

  for (const r of rows) {
    const badges = [];
    if (r.lbc === spaceMax && spaceMax >= 2) badges.push('空间龙');
    const tk = byTheme[r.mainTheme];
    if (tk && tk[0] === r && r.lbc >= 2 && tk.length >= 2) badges.push(r.mainTheme + '龙');
    const isOne = /一字/.test(r.sealType);
    if (isOne && r.lbc >= 2) badges.push('一字龙');
    if (!isOne && r.lbc >= 2 && (r.zbc || 0) === 0) badges.push('换手龙');
    const topOfTheme = tk && tk[0];
    if (topOfTheme && r.lbc < topOfTheme.lbc && r.lbc >= 2 && tk.length >= 2) badges.push('补涨龙');
    if (r.lbc === 1 && tk && tk.length >= 3) badges.push('首板先锋');
    r.badges = badges;
  }

  // 决策评级
  for (const r of rows) {
    const isOne = /一字/.test(r.sealType);
    const tk = byTheme[r.mainTheme] || [];
    const themeHot = tk.length >= 3;
    let decision, level, reason;
    if (r.lbc === spaceMax && spaceMax >= 2) {
      // 空间龙：市场最高板，优先于一切孤立判断
      if (isOne) {
        decision = '持强不接力'; level = 'hold';
        reason = `市场最高空间板（${r.lbc}板）连续一字加速，未持筹者无介入点，仅持筹者格局，破板即离场`;
      } else {
        decision = '分歧低吸/打高度'; level = 'buy';
        reason = `市场最高空间板（${r.lbc}板）换手充分，回封或分时均线低吸，破涨停价-3%离场，重点观察能否继续打开高度`;
      }
    } else if (tk[0] === r && r.lbc >= 2 && tk.length >= 2) {
      // 题材龙（非空间龙）：该主线最高标
      if (isOne) {
        decision = '持强不接力'; level = 'hold';
        reason = `${r.mainTheme}题材龙（${r.lbc}板）一字加速，未持筹者不接`;
      } else if (r.lbc >= 3) {
        decision = '分歧低吸/打回封'; level = 'buy';
        reason = `${r.mainTheme}题材龙（${r.lbc}板）换手确认，回封或分时均线低吸，破涨停价-3%`;
      } else {
        decision = '启动可参与'; level = 'buy';
        reason = `${r.mainTheme}题材确认期龙头（${tk.length}家涨停），竞价或打板介入，次日看晋级`;
      }
    } else if (isOne && r.lbc >= 2) {
      decision = '持强不接力'; level = 'hold';
      reason = '连续一字加速，未持筹者无介入点，仅适合持筹者格局';
    } else if (r.lbc >= 4 && (r.zbc || 0) > 0 && r.turnoverRate > 18) {
      decision = '高位爆量·控仓'; level = 'reduce';
      reason = `高度 ${r.lbc} 板且爆量烂板，去弱留强，跌破涨停价-3% 离场`;
    } else if (r.lbc >= 3 && !isOne && (r.zbc || 0) <= 1 && themeHot) {
      decision = '分歧低吸/打回封'; level = 'buy';
      reason = `高位 ${r.lbc} 板换手确认，题材仍强，回封或分时均线低吸，止损涨停价-3%`;
    } else if (r.lbc === 2 && themeHot) {
      decision = '启动可参与'; level = 'buy';
      reason = `题材确认期（${r.mainTheme} ${tk.length} 家涨停），竞价或打板介入，次日看晋级`;
    } else if (r.lbc === 1) {
      decision = '首板观察'; level = 'watch';
      reason = '首板观察，次日能弱转强/晋级再确认地位';
    } else if (tk.length < 2) {
      decision = '孤立涨停·观望'; level = 'watch';
      reason = '无题材联动支撑，独立行情持续性待验';
    } else {
      decision = '持强不接力'; level = 'hold';
      reason = '非核心前排，跟风属性，不追高';
    }
    r.decision = decision; r.level = level; r.decisionReason = reason;
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
};
var scoreSecondBoard = function scoreSecondBoard(r, theme) {
  const tSize = theme.count;
  const themeScore = tSize >= 8 ? 30 : tSize >= 5 ? 24 : tSize >= 4 ? 20 : tSize >= 3 ? 15 : 8;
  const hh = parseInt((r.firstTime || '15:00').slice(0, 2)), mm = parseInt((r.firstTime || '15:00').slice(3, 5)), mins = hh * 60 + mm;
  let timeScore = 4;
  if (mins > 0) {
    if (mins <= 9 * 60 + 45) timeScore = 20;
    else if (mins <= 10 * 60 + 30) timeScore = 16;
    else if (mins <= 11 * 60 + 30) timeScore = 12;
    else if (mins <= 14 * 60) timeScore = 8;
  }
  const turn = r.turnoverRate || 0;
  const hthScore = turn >= 5 && turn <= 18 ? 15 : (turn > 0 ? 8 : 5);
  const cap = r.floatCap || 0;
  const capScore = cap >= 50e8 && cap <= 250e8 ? 15 : (cap > 20e8 && cap < 600e8 ? 9 : 6);
  const ratio = cap > 0 ? r.fund / cap : 0;
  const fundScore = Math.min(10, Math.round(ratio * 400));
  const isOne = /一字/.test(r.sealType);
  const sealPenalty = isOne ? -6 : 0;
  const score = Math.max(0, themeScore + timeScore + hthScore + capScore + fundScore + sealPenalty);
  const reasons = [];
  reasons.push(`题材「${theme.name}」${tSize}家涨停${tSize >= 5 ? '（强）' : tSize >= 3 ? '（中）' : '（弱）'}`);
  reasons.push(`上板 ${r.firstTime || '—'}${mins > 0 && mins <= 9 * 60 + 45 ? '（早盘抢筹）' : mins > 10 * 60 + 30 ? '（午后封板·偏弱）' : ''}`);
  reasons.push(`换手 ${turn ? turn.toFixed(1) + '%' : '—'}${turn >= 5 && turn <= 18 ? '（健康）' : turn > 18 ? '（偏爆）' : '（偏低）'}`);
  reasons.push(`流通 ${cap ? (cap / 1e8).toFixed(0) + '亿' : '—'}${cap >= 50e8 && cap <= 250e8 ? '（适中）' : '（偏大/小）'}`);
  if (r.fund) reasons.push(`封单 ${(r.fund / 1e8).toFixed(2)}亿（${ratio > 0.01 ? '强' : '一般'}）`);
  if (isOne) reasons.push('一字板（未给换手介入点，次日开板换手再看）');
  const reason = reasons.join('；') + ' → 次日弱转强晋级2板' + (score >= 70 ? '概率高' : score >= 55 ? '概率中高' : score >= 45 ? '概率中等' : '需盘面配合');
  const isCandidate = score >= 50 && !isOne && tSize >= 3;
  return { score, reason, isCandidate };
};
var snapshotFromRows = function snapshotFromRows(rows, dateC) {
  const zt = rows.length;
  const maxLbc = rows.reduce((m, r) => Math.max(m, r.lbc), 0);
  const lb = rows.filter(r => r.lbc >= 2).length;
  const opened = rows.filter(r => (r.zbc || 0) > 0 || (r.firstTime && r.lastTime && r.firstTime !== r.lastTime)).length;
  const diverge = zt ? Math.round(opened / zt * 100) : 0;
  const oneCount = rows.filter(r => r.isOne).length;
  const oneRatio = zt ? +(oneCount / zt).toFixed(2) : 0;
  return {
    date: dateC, zt, lb, maxLbc, diverge, oneCount, oneRatio,
    codes: rows.map(r => ({ code: r.code, lbc: r.lbc, isOne: !!r.isOne })),
  };
};
var thsLbc = function thsLbc(highDays) {
  if (!highDays) return 1;
  const m = /(\d+)\s*板/.exec(String(highDays));
  return m ? Number(m[1]) : 1;
};
var computeJiezhi = function computeJiezhi(ySnap, todayRows, changeMap) {
  if (!ySnap) return null;
  const yCodes = ySnap.codes || [];
  const todayByCode = {}; todayRows.forEach(r => todayByCode[r.code] = r);
  const lianban = yCodes.filter(c => c.lbc >= 2);
  let up = 0;
  for (const c of lianban) { const t = todayByCode[c.code]; if (t && t.lbc >= c.lbc + 1) up++; }
  const jinjiRate = lianban.length ? +(up / lianban.length * 100).toFixed(0) : null;
  let sum = 0, n = 0;
  for (const c of yCodes) { const chg = changeMap[c.code]; if (typeof chg === 'number') { sum += chg; n++; } }
  const premium = n ? +(sum / n).toFixed(2) : null;
  return { jinjiRate, premium, sample: n, yCount: yCodes.length };
};
var detectCycle = function detectCycle(history) {
  const days = (history.days || []).slice(-6);
  if (days.length < 2) return { phase: '样本不足', dir: 0, trend: days, warn: '' };
  const last = days[days.length - 1], prev = days[days.length - 2];
  const dir = last.maxLbc > prev.maxLbc ? 1 : (last.maxLbc < prev.maxLbc ? -1 : 0);
  let phase;
  if (last.maxLbc >= 6 && last.zt >= 55) phase = '高潮';
  else if (last.maxLbc <= 2 && last.zt < 35) phase = '冰点';
  else if (dir >= 0 && last.maxLbc >= 3 && days.slice(-3).every(d => d.maxLbc >= 3)) phase = '主升';
  else if (last.zt > prev.zt && last.maxLbc >= prev.maxLbc) phase = '回暖';
  else if (last.diverge >= 55 || last.zt < prev.zt) phase = '退潮';
  else phase = '平稳';
  let warn = '';
  if (prev.maxLbc >= 5 && last.maxLbc <= prev.maxLbc - 2) warn = '注意：空间高度自 ' + prev.maxLbc + ' 板降至 ' + last.maxLbc + ' 板，退潮转折';
  return { phase, dir, trend: days, warn };
};
var emotion = function emotion(rows, ctx) {
  const zt = rows.length;
  const lb = rows.filter(r => r.lbc >= 2).length;
  const maxLbc = rows.reduce((m, r) => Math.max(m, r.lbc), 0);
  const opened = rows.filter(r => (r.zbc || 0) > 0 || (r.firstTime && r.lastTime && r.firstTime !== r.lastTime)).length;
  const diverge = zt ? Math.round(opened / zt * 100) : 0;
  const sealRate = zt ? 100 - diverge : 0;
  const oneCount = rows.filter(r => r.isOne).length;
  const oneRatio = zt ? +(oneCount / zt).toFixed(2) : 0;
  const down = ctx.down == null ? null : ctx.down.length;
  const zddb = (down == null || !zt) ? null : +(zt / down).toFixed(2);
  const idx = ctx.indexEnv;
  const jz = ctx.jiezhi;
  const cycle = ctx.cycle || { phase: '—', warn: '' };

  // 退潮风险系数 0-100（越高越危险）
  let risk = 0; const risks = [];
  if (diverge >= 60) { risk += 30; risks.push('炸板率' + diverge + '%偏高'); }
  else if (diverge >= 40) { risk += 18; risks.push('炸板率' + diverge + '%中等'); }
  else if (diverge >= 25) { risk += 8; }
  if (oneRatio >= 0.35) { risk += 22; risks.push('一字占比' + (oneRatio * 100).toFixed(0) + '%虚胖'); }
  else if (oneRatio >= 0.22) { risk += 12; risks.push('一字占比偏高'); }
  if (zddb != null) { if (zddb < 1.5) { risk += 20; risks.push('涨跌停比' + zddb + '弱势'); } else if (zddb < 3) { risk += 10; } }
  else { risk += 8; risks.push('跌停池缺失'); }
  if (jz) {
    if (jz.jinjiRate != null) { if (jz.jinjiRate < 40) { risk += 22; risks.push('晋级率' + jz.jinjiRate + '%接力亏钱'); } else if (jz.jinjiRate < 60) { risk += 10; } }
    if (jz.premium != null) { if (jz.premium < 0) { risk += 18; risks.push('昨日涨停溢价' + jz.premium + '%为负'); } else if (jz.premium < 2) { risk += 8; } }
  } else { risk += 10; risks.push('接力效应缺失'); }
  if (idx) { const bad = (idx.sh != null && idx.sh < 0 ? 1 : 0) + (idx.cyb != null && idx.cyb < 0 ? 1 : 0); if (bad >= 2) { risk += 18; risks.push('指数双杀'); } else if (bad === 1) { risk += 8; } }
  else { risk += 6; risks.push('大盘缺失'); }
  if (cycle.phase === '退潮') risk += 12; else if (cycle.phase === '高潮') risk += 6;
  risk = Math.max(0, Math.min(100, risk));

  // 情绪分级（修正分歧日偏乐观）
  let mood, moodDesc;
  if (diverge >= 60 && maxLbc < 7) { mood = '分歧退潮'; moodDesc = '封板率仅' + sealRate + '%，盘中大量开板，退潮/强分歧，仅前排换手龙可分歧低吸'; }
  else if (maxLbc >= 7 && risk < 40) { mood = '高潮'; moodDesc = '高位连板打开空间，注意加速后分歧'; }
  else if (maxLbc >= 5 && risk < 55) { mood = '活跃'; moodDesc = '连板高度充足，题材可操作，但需控仓聚焦前排换手龙'; }
  else if (maxLbc >= 3 && zt >= 50 && risk < 60) { mood = '回暖'; moodDesc = '赚钱效应恢复，可积极试错'; }
  else if (maxLbc <= 1 && zt < 25) { mood = '冰点'; moodDesc = '情绪极致压缩，等待新周期启动'; }
  else if (risk >= 55 || maxLbc <= 2) { mood = '低迷/退潮'; moodDesc = '接力意愿弱、分歧大，控仓防守、回避中位'; }
  else { mood = '平稳'; moodDesc = '结构性机会，重个股轻指数'; }

  const note = (risks.length ? '风险点：' + risks.join('、') : '多维指标均衡') + (cycle.warn ? ' ｜ ' + cycle.warn : '');
  return { zt, lb, maxLbc, diverge, sealRate, oneCount, oneRatio, down, zddb, mood, moodDesc, risk, risks, note, jiezhi: jz, index: idx, cycle };
};
var themePlan = function themePlan(t, ctx) {
  const leader = t.stocks[0];                 // 已按 lbc 降序
  const L = leader.lbc;
  const P = leader.ztPrice || 0;              // 涨停价（元）
  const isOne = /一字/.test(leader.sealType);
  const turn = leader.turnoverRate || 0;
  const zbc = leader.zbc || 0;
  const back = t.stocks.slice(1);
  const backFirst = back.filter(s => s.lbc === 1).length;
  const backNames = back.map(s => s.name + (s.lbc > 1 ? `(${s.lbc}板)` : ''));

  const actionable = leader.level === 'buy' ? 'buy' : leader.level === 'hold' ? 'hold' : 'watch';
  const decision = leader.level === 'buy' ? leader.decision
    : leader.level === 'hold' ? '持强不接力·仅持筹'
    : (t.count >= 2 ? '题材观望·等确认' : '孤立·观望');

  // 买入区间 + 止损（绝对元价，缺失则退为百分比）
  let buy, stop; const stopPct = L >= 4 ? 0.95 : 0.93;
  if (actionable === 'buy') {
    if (L >= 4) {
      buy = P ? `分歧低吸 ${f2(P * 0.93)}~${f2(P * 0.97)} 元；打回封 / 回封打板 ${f2(P)} 元`
              : `分歧低吸 涨停价×0.93~0.97；打回封 涨停价`;
    } else {
      buy = P ? `竞价弱转强（开盘价附近）或打板 ${f2(P)} 元；分歧低吸 ${f2(P * 0.97)}~${f2(P * 0.99)} 元`
              : `竞价弱转强或打板（涨停价）；分歧低吸 涨停价×0.97~0.99`;
    }
    stop = P ? `${f2(P * stopPct)} 元（涨停价×${stopPct}，破位即走）` : `涨停价×${stopPct}`;
  } else if (actionable === 'hold') {
    buy = '一字加速，未持筹者无介入点；持筹者破板即离场';
    stop = '—';
  } else {
    buy = '等次日弱转强 / 晋级确认后再介入';
    stop = '—';
  }

  // 板块预计高度
  const heightBonus = t.count >= 7 ? 3 : t.count >= 5 ? 2 : t.count >= 3 ? 1 : 0;
  const sectorHeight = Math.min(L + heightBonus, ctx.maxLbc + 1);
  const heightText = P
    ? `${sectorHeight} 板（当前 ${L} 板｜题材 ${t.count} 家 / ${yi(t.amount)} 亿支撑｜市场最高 ${ctx.maxLbc} 板封顶）。晋级至 ${sectorHeight} 板对应 ≈ ${f2(P * Math.pow(1.10, sectorHeight - L))} 元`
    : `${sectorHeight} 板（当前 ${L} 板｜题材 ${t.count} 家支撑｜市场最高 ${ctx.maxLbc} 板封顶）`;

  // 预判走势
  let trend;
  if (isOne) {
    trend = `${leader.name} 一字 ${L} 板加速，持筹者格局盛宴；未上车不追。开板放量即视为分歧转弱，回封无力则见顶，优先止盈。`;
  } else if (L >= 4) {
    trend = `${leader.name} 是市场最高空间板（${L} 板），换手充分、资金博弈激烈。重点观察能否继续打开高度至 ${L + 1} 板；若爆量长上影 / 天地板即确认见顶，必须撤退。`;
  } else if (actionable === 'buy') {
    trend = `${leader.name} 为 ${t.name} 题材龙（${L} 板换手确认）。次日关键看竞价能否弱转强高开、量能温和（换手 8-15%）封板晋级 ${L + 1} 板；若高开秒板则确认主线地位，板块有望成为新周期核心。`;
  } else {
    trend = `${t.name} 题材家数偏少 / 梯队不完整，暂作观察；待龙头弱转强或后排扩员再确认地位。`;
  }

  // 量能 / 换手：出货 vs 洗盘 决策表
  const volTable = [
    ['缩量封板（换手<5% 且不开板）', '持筹锁仓·强', '不卖；未上车继续等分歧，不追缩量加速'],
    ['缩量开板 → 快速回封（zbc>0 但回封）', '洗盘', '回封即是低吸买点，可打回封'],
    [`放量不回封（换手>15%${turn > 20 ? '，本股 ' + turn + '%' : '，尤其>20%'}）`, '出货 / 派发', '减仓或离场，不接飞刀'],
    ['放量后回封（充分换手再封死）', '分歧转一致', '可打回封确认，龙头质量提升'],
  ];
  const vol = { table: volTable, anchor: `本股参考：换手 ${turn}%、盘中炸板 ${zbc} 次、封板方式 ${leader.sealType || '—'}` };

  // 后排跟进
  let backRow;
  if (backFirst >= 3) {
    backRow = `后排首板梯队完整（${backFirst} 只：${backNames.slice(0, 6).join('、')}${backNames.length > 6 ? '…' : ''}），资金认可题材，呈"前排带后排"结构，次日看后排是否继续扩员 / 晋级。`;
  } else if (backFirst >= 1) {
    backRow = `后排偏弱（仅 ${backFirst} 只：${backNames.join('、') || '—'}），题材合力不足；需中军 / 大盘股共振才具持续性，否则易冲高回落。`;
  } else if (back.length) {
    backRow = `后排为 ${backNames.join('、') || '—'}，无首板扩员，题材宽度有限。`;
  } else {
    backRow = `无后排联动，独立行情，持续性存疑。`;
  }

  // 持续性
  let persist;
  const healthy = turn >= 5 && turn <= 18;
  if (t.count >= 5 && backFirst >= 3 && healthy) persist = '强：主线容量足 + 后排完整 + 换手健康，有望走成周期核心，重点跟踪。';
  else if (t.count >= 3 && backFirst >= 1) persist = '中：题材初成，看次日后排是否扩员、龙头是否晋级，确认后加仓。';
  else if (isOne) persist = '中偏强（持筹角度）：一字封单未松动前延续，但无换手介入点，开板即分歧。';
  else persist = '弱：家数少 / 无后排，独立或一日游概率大，仅作观察。';

  // 题材星级：5星=无脑买，4星=积极参与，3星=可参与/持强不接力，2星=观望但有结构，1星=弱观望
  let star = 1;
  if (actionable === 'buy') {
    if (t.count >= 5 && backFirst >= 3 && healthy && !isOne) star = 5;
    else if ((t.count >= 3 && backFirst >= 1) || t.maxLbc >= 3) star = 4;
    else star = 3;
  } else if (actionable === 'hold') {
    star = t.count >= 5 ? 4 : t.count >= 3 ? 3 : 2;
  } else {
    star = t.count >= 3 ? 2 : 1;
  }

  return { actionable, decision, buy, stop, stopPct, heightText, trend, vol, backRow, persist, star };
};
var stockPlan = function stockPlan(r, ctx) {
  const P = r.ztPrice || 0;                 // 涨停价（元）
  const L = r.lbc;
  const isOne = /一字/.test(r.sealType);
  const turn = r.turnoverRate || 0;
  const zbc = r.zbc || 0;
  const themeHot = r.themeSize >= 3;

  // 买入区间 / 成本线 / 止损 / 止盈
  let buyText, entryLow, entryHigh, entryMid, stop, stopPct, t1, t2, rr1, rr2, execute, winLose;
  if (r.level === 'buy') {
    if (L >= 4) {
      entryLow = P * 0.93; entryHigh = P * 0.97;
      stopPct = 0.93;
      buyText = `分歧低吸 ${f2(entryLow)}~${f2(entryHigh)} 元；打回封 / 回封打板 ${f2(P)} 元`;
      execute = `次日开盘观察分时：回踩 ${f2(entryLow)}~${f2(entryHigh)} 区间且缩量企稳则分批低吸；若直接高开秒板或盘中放量回封，可打板确认。`;
    } else if (L >= 2) {
      entryLow = P * 0.97; entryHigh = P * 0.99;
      stopPct = 0.93;
      buyText = `竞价弱转强（开盘价附近）或打板 ${f2(P)} 元；分歧低吸 ${f2(entryLow)}~${f2(entryHigh)} 元`;
      execute = `次日竞价高开 3% 以上、竞价换手率 >0.5% 视为弱转强，可竞价或开盘介入；否则等盘中回踩 ${f2(entryLow)}~${f2(entryHigh)} 低吸。`;
    } else {
      entryLow = P * 0.98; entryHigh = P;
      stopPct = 0.93;
      buyText = `次日弱转强高开打板 ${f2(P)} 元；分歧低吸 ${f2(entryLow)}~${f2(entryHigh)} 元`;
      execute = `首板仅观察，次日高开 3% 以上且竞价放量方可试仓；盘中放量烂板则放弃。`;
    }
    entryMid = (entryLow + entryHigh) / 2;
    stop = P * stopPct;
    t1 = P * 1.10;
    t2 = P * 1.21;
    rr1 = stop < entryMid ? (t1 - entryMid) / (entryMid - stop) : 0;
    rr2 = stop < entryMid ? (t2 - entryMid) / (entryMid - stop) : 0;
    winLose = `以成本线 ${f2(entryMid)} 计，止损 ${f2(stop)}（${((stop / entryMid - 1) * 100).toFixed(1)}%），到 T1 ${f2(t1)} 盈亏比 ${rr1.toFixed(2)}；到 T2 ${f2(t2)} 盈亏比 ${rr2.toFixed(2)}。`;
  } else if (r.level === 'hold') {
    buyText = isOne ? '一字加速，未持筹者无介入点；持筹者破板即离场' : '非核心跟风，不追高；已持筹者破板离场';
    entryLow = entryHigh = entryMid = stop = t1 = t2 = 0;
    stopPct = 0;
    execute = '不新建仓位。持筹者若开板放量且 3 分钟内无法回封，果断止盈。';
    winLose = '无介入价值，不计算盈亏比。';
  } else if (r.level === 'reduce') {
    buyText = '高位爆量烂板，去弱留强，只卖不买';
    entryLow = entryHigh = entryMid = stop = t1 = t2 = 0;
    stopPct = 0;
    execute = '次日低开或冲高无量即减仓；跌破昨日涨停价-3% 清仓。';
    winLose = '撤退优先，不计算盈亏比。';
  } else {
    buyText = '等次日弱转强 / 晋级确认后再介入';
    entryLow = entryHigh = entryMid = stop = t1 = t2 = 0;
    stopPct = 0;
    execute = '当前地位未明，次日看竞价是否弱转强、题材是否持续，确认后再跟随。';
    winLose = '观察期，不计算盈亏比。';
  }

  // 预判走势
  let trend;
  if (isOne) {
    trend = `${r.name} 连续一字加速（${L}板），筹码断层严重；次日若继续一字则持筹格局，一旦开板放量换手>15%且3分钟不回封，即见顶信号，优先止盈。`;
  } else if (L === ctx.maxLbc && L >= 3) {
    trend = `${r.name} 为市场最高空间板（${L}板），资金博弈核心。明日若能温和换手（8-15%）晋级 ${L+1} 板，则打开新高度；若爆量长上影或天地板，则周期见顶。`;
  } else if (L >= 3) {
    trend = `${r.name} 处于高位（${L}板），题材地位${r.badges.includes(r.mainTheme + '龙') ? '核心' : '跟风'}。明日关键看能否分歧转一致，缩量加速则持筹，放量不回封则见顶。`;
  } else if (L === 2) {
    trend = `${r.name} 处于题材启动确认期（2板），${themeHot ? '题材热度足，次日弱转强可晋级3板' : '题材合力不足，需后排跟风配合'}。`;
  } else {
    trend = `${r.name} 为首板，次日需弱转强确认地位；若无题材联动或竞价低于预期，则大概率冲高回落。`;
  }

  // 量能 / 换手操作表
  const volTable = [
    ['缩量封板（换手<5% 且不开板）', '持筹锁仓·强', '不卖；未上车者不追，等分歧'],
    ['缩量开板→快速回封（炸板后迅速封死）', '洗盘', '回封即买点，可打回封'],
    [`放量不回封（换手>15%${turn > 20 ? '，本股 ' + turn.toFixed(1) + '%' : ''}）`, '出货/派发', '减仓或离场，不接飞刀'],
    ['放量后回封（充分换手再封死）', '分歧转一致', '可打回封确认，龙头质量提升'],
  ];

  // 分数阈值操作建议
  const s = r.score;
  let scoreGrade = s >= 70 ? '无脑买' : s >= 55 ? '可参与' : s >= 40 ? '观察' : '放弃';
  let scoreReason = s >= 70 ? '龙头分顶级，空间/封单/题材/换手共振，次日竞价或打板直接上仓位。'
    : s >= 55 ? '龙头分优良，买点清晰，按买入区间分批参与。'
    : s >= 40 ? '龙头分一般，需次日弱转强/晋级确认后再跟随。'
    : '龙头分偏低，跟风或孤立，放弃参与。';
  // 题材地位/决策级别可升一档：已识别为 buy 级别但分数落在观察区间，标记为低位可参与
  if (r.level === 'buy' && scoreGrade === '观察') { scoreGrade = '可参与（低位）'; scoreReason = '题材地位核心（空间龙/题材龙/启动确认），但分数未达 55，可轻仓按买点参与。'; }
  else if (r.level === 'buy' && scoreGrade === '可参与') { scoreReason = '题材地位核心 + 龙头分优良，积极参与。'; }

  return {
    buyText, execute, stop: stop ? f2(stop) + ' 元' : '—', stopPct,
    entryLow: entryLow ? f2(entryLow) : '—', entryHigh: entryHigh ? f2(entryHigh) : '—',
    entryMid: entryMid ? f2(entryMid) : '—', t1: t1 ? f2(t1) : '—', t2: t2 ? f2(t2) : '—',
    rr1: rr1 ? rr1.toFixed(2) : '—', rr2: rr2 ? rr2.toFixed(2) : '—',
    winLose, trend, volTable, scoreGrade, scoreReason,
    volAnchor: `本股参考：涨停价 ${P ? f2(P) : '—'} 元、换手 ${turn ? turn.toFixed(1) : '—'}%、炸板 ${zbc} 次、封板方式 ${r.sealType || '—'}`
  };
};
(function LIVE_PIPELINE_IMPL() {
  var UT = '7eea3edcaed734bea9cbfc24409ed989';
  function pdate(d) { return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function b_fetchJSON(url, ref) {
    var r = await fetch(url, { headers: { 'Referer': ref || 'https://quote.eastmoney.com/' } });
    var t = await r.text();
    if (/^\s*</.test(t)) throw new Error('WAF/HTML');
    return JSON.parse(t);
  }
  async function b_fetchEM(dc) {
    var url = 'https://push2ex.eastmoney.com/getTopicZTPool?ut=' + UT + '&dpt=wz.ztzt&Pageindex=0&pagesize=400&sort=fbt%3Aasc&date=' + dc + '&_=' + Date.now();
    var j = await b_fetchJSON(url, 'https://quote.eastmoney.com/ztb/detail');
    var data = (j && j.data) || {};
    return { qdate: data.qdate, pool: data.pool || [] };
  }
  async function b_fetchTHS(dateStr) {
    var url = 'https://data.10jqka.com.cn/dataapi/limit_up/limit_up_pool?page=1&limit=200&field=199112,10,9001,330323,330324,330325,9002,330329,133971,133970,1968584,3475914,9003,9004&filter=HS,GEM2STAR&order_field=330324&order_type=0&date=' + dateStr + '&_=' + Date.now();
    var j = await b_fetchJSON(url, 'https://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html');
    var info = ((j && j.data) || {}).info || [];
    var out = {};
    for (var i = 0; i < info.length; i++) {
      var x = info[i];
      out[String(x.code || '').padStart(6, '0')] = {
        code: String(x.code || '').padStart(6, '0'), name: x.name,
        firstTime: x.first_limit_up_time ? emTime(x.first_limit_up_time) : '',
        lastTime: x.last_limit_up_time ? emTime(x.last_limit_up_time) : '',
        sealType: x.limit_up_type || '', highDays: x.high_days || '', reason: x.reason_type || '',
        orderAmount: Math.round(Number(x.order_amount) || 0), turnoverRate: Number(x.turnover_rate) || 0,
        floatCap: Math.round(Number(x.currency_value) || 0), sealRate: Number(x.limit_up_suc_rate) || 0,
        openNum: Number(x.open_num) || 0,
      };
    }
    return out;
  }
  async function b_fetchEMDTZB(dc) {
    try {
      var url = 'https://push2ex.eastmoney.com/getTopicDTZB?ut=' + UT + '&dpt=wz.ztzt&Pageindex=0&pagesize=400&sort=fbt%3Aasc&date=' + dc + '&_=' + Date.now();
      var j = await b_fetchJSON(url, 'https://quote.eastmoney.com/ztb/detail');
      return ((j && j.data) || {}).pool || [];
    } catch (e) { return null; }
  }
  function txSecid(code) { code = String(code).padStart(6, '0'); if (/^(60|68|90|5|11|9)/.test(code)) return 'sh' + code; return 'sz' + code; }
  async function b_txChg(secids) {
    var out = {};
    for (var i = 0; i < secids.length; i += 40) {
      var sub = secids.slice(i, i + 40).join(',');
      try {
        var t = await (await fetch('https://qt.gtimg.cn/q=' + sub)).text();
        t.split(';').forEach(function (line) {
          var m = line.match(/v_(\w+)="(.+)"/);
          if (!m) return;
          var a = m[2].split('~');
          var cur = parseFloat(a[3]), prev = parseFloat(a[4]);
          if (cur > 0 && prev > 0) out[m[1]] = { chg: +(((cur - prev) / prev) * 100).toFixed(2), prev: prev, cur: cur };
        });
      } catch (e) {}
      await sleep(60);
    }
    return out;
  }
  async function runLive() {
    var dc = pdate(new Date());
    var r = await b_fetchEM(dc);
    if (!r.pool || !r.pool.length) throw new Error('当日涨停池为空/未就绪（盘前接口尚未返回），请于交易时间刷新');
    var realDs = r.qdate ? String(r.qdate) : dc;
    var ths = await b_fetchTHS(realDs).catch(function () { return {}; });
    var rows = r.pool.map(function (x) {
      var t = ths[String(x.c)] || {};
      return {
        code: String(x.c), name: String(x.n || '').replace(/\s/g, ''),
        lbc: Number(x.lbc) || 1, fund: Math.round(Number(x.fund) || 0), zbc: Number(x.zbc) || 0,
        industry: x.hybk || '', reason: t.reason || '',
        firstTime: t.firstTime || emTime(x.fbt), lastTime: t.lastTime || emTime(x.lbt),
        sealType: t.sealType || '', sealRate: t.sealRate || 0,
        turnoverRate: t.turnoverRate || Number(x.hs) || 0,
        floatCap: t.floatCap || 0, amount: Math.round(Number(x.amount) || 0),
        emZt: +(Number(x.p || 0) / 1000).toFixed(2),
      };
    });
    // 跌停池：优先同域注入（妙想MCP真实数据），回退东财 DTZB
    var dataDown = null, downNote = '';
    try {
      var inj = await (await fetch('./down_inject.json?t=' + Date.now())).json();
      if (inj && inj.date === realDs && Array.isArray(inj.down) && inj.down.length) {
        dataDown = inj.down.map(function (y) { return { c: String(y.code || '').padStart(6, '0'), n: y.name || '', chg: y.chg }; });
        downNote = '跌停池：妙想MCP注入(' + dataDown.length + '只·实时刷新)';
      }
    } catch (e) {}
    if (!dataDown) { var dx = await b_fetchEMDTZB(realDs).catch(function () { return null; }); if (dx && dx.length) dataDown = dx; }
    if (!downNote) downNote = dataDown == null ? '跌停池缺失［MISSING］' : '真实公开接口';
    rows = filterMain(rows);
    rows.forEach(function (r) { var ft = r.firstTime || '', lt = r.lastTime || ''; r.isOne = /一字/.test(r.sealType) || ((r.zbc || 0) === 0 && ft && lt && ft === lt); });
    // 历史缓存（同域 zt_daily.json）+ 周期 + 大盘 + 接力
    var history = { days: [] };
    try { history = await (await fetch('./zt_daily.json?t=' + Date.now())).json(); } catch (e) {}
    var cycle = detectCycle(history);
    var idx = await b_txChg(['sh000001', 'sz399001', 'sz399006']).catch(function () { return null; });
    var indexEnv = idx ? { sh: idx['sh000001'] ? idx['sh000001'].chg : null, sz: idx['sz399001'] ? idx['sz399001'].chg : null, cyb: idx['sz399006'] ? idx['sz399006'].chg : null } : null;
    var yDays = history.days.filter(function (d) { return d.date !== realDs; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var ySnap = yDays[0] || null;
    var changeMap = {};
    if (ySnap) {
      var sids = ySnap.codes.map(function (c) { return txSecid(c.code); });
      var cm = await b_txChg(sids).catch(function () { return {}; });
      ySnap.codes.forEach(function (c) { var sid = txSecid(c.code); if (cm[sid]) changeMap[String(c.code)] = cm[sid].chg; });
    }
    var jiezhi = ySnap ? computeJiezhi(ySnap, rows, changeMap) : null;
    var maxLbc = rows.reduce(function (m, r) { return Math.max(m, r.lbc); }, 0);
    rows = scoreLeaders(rows, maxLbc);
    // 题材主线榜
    var themeMap = {};
    for (var i = 0; i < rows.length; i++) {
      var r2 = rows[i]; var t = r2.mainTheme;
      if (!themeMap[t]) themeMap[t] = { name: t, count: 0, amount: 0, maxLbc: 0, stocks: [], leader: '' };
      var g = themeMap[t]; g.count++; g.amount += (r2.amount || 0); g.maxLbc = Math.max(g.maxLbc, r2.lbc); g.stocks.push(r2);
    }
    var themes = Object.keys(themeMap).map(function (k) { return themeMap[k]; })
      .filter(function (t) { return t.count >= 2 || t.maxLbc >= 3; })
      .map(function (t) { t.stocks.sort(function (a, b) { return b.lbc - a.lbc || b.score - a.score; }); t.leader = t.stocks[0].name; return t; });
    // 涨停价（腾讯昨收×1.10，避免东财 push2 冷却）
    var sidsAll = rows.map(function (r) { return r.code; }).map(txSecid);
    var uniqSids = []; sidsAll.forEach(function (s) { if (uniqSids.indexOf(s) < 0) uniqSids.push(s); });
    var chgMap = await b_txChg(uniqSids).catch(function () { return {}; });
    rows.forEach(function (r) { var m = chgMap[txSecid(r.code)]; if (m && m.prev) r.ztPrice = +(m.prev * 1.10).toFixed(2); else if (m && m.cur) r.ztPrice = m.cur; });
    themes.forEach(function (t) { t.plan = themePlan(t, { maxLbc: maxLbc }); });
    var actRank = { buy: 3, hold: 2, watch: 1 };
    themes.sort(function (a, b) {
      var ra = actRank[b.plan.actionable] - actRank[a.plan.actionable];
      if (ra) return ra;
      if (b.plan.star !== a.plan.star) return b.plan.star - a.plan.star;
      return b.count - a.count || b.amount - a.amount || b.maxLbc - a.maxLbc;
    });
    rows.forEach(function (r) { r.plan = stockPlan(r, { maxLbc: maxLbc }); });
    // 二板潜力榜
    var themeByName = {}; themes.forEach(function (t) { themeByName[t.name] = t; });
    var secBoardList = [];
    for (var j = 0; j < rows.length; j++) {
      var r3 = rows[j];
      if (r3.lbc === 1 && themeByName[r3.mainTheme]) {
        var sb = scoreSecondBoard(r3, themeByName[r3.mainTheme]); r3.secBoard = sb;
        if (sb.isCandidate) {
          var pre = r3.ztPrice ? r3.ztPrice / 1.10 : 0;
          secBoardList.push({ code: r3.code, name: r3.name, theme: r3.mainTheme, ztPrice: r3.ztPrice, firstTime: r3.firstTime, turnoverRate: r3.turnoverRate, fund: r3.fund, floatCap: r3.floatCap, score: sb.score, reason: sb.reason, warnPrice: pre ? +(pre * 1.03).toFixed(2) : 0, boardPrice: r3.ztPrice || 0, breakPrice: pre ? +(pre * 0.97).toFixed(2) : 0 });
        }
      }
    }
    secBoardList.sort(function (a, b) { return b.score - a.score; });
    var sbMap = {};
    rows.forEach(function (r) { if (r.secBoard) sbMap[r.code] = { score: r.secBoard.score, reason: r.secBoard.reason, isCandidate: r.secBoard.isCandidate }; });
    var klines = window.KL || {};
    var ladMap = {};
    for (var k = 0; k < rows.length; k++) { (ladMap[rows[k].lbc] || (ladMap[rows[k].lbc] = [])).push(rows[k]); }
    var ladder = Object.keys(ladMap).map(function (k) { return { lbc: +k, count: ladMap[k].length, stocks: ladMap[k].sort(function (a, b) { return b.score - a.score; }) }; }).sort(function (a, b) { return b.lbc - a.lbc; });
    var emo = emotion(rows, { down: dataDown, indexEnv: indexEnv, jiezhi: jiezhi, history: history, cycle: cycle, todaySnap: snapshotFromRows(rows, realDs) });
    var now = new Date();
    var phase = (now.getHours() * 60 + now.getMinutes()) < 9 * 60 + 30 ? '盘前竞价' : (now.getHours() * 60 + now.getMinutes()) < 15 * 60 ? '盘中' : '盘后';
    var genTime = '' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var data = { tradeDate: realDs.slice(0, 4) + '-' + realDs.slice(4, 6) + '-' + realDs.slice(6, 8), rows: rows, themes: themes, ladder: ladder, emotion: emo, downNote: downNote, phase: phase, genTime: genTime, klines: klines, secBoardList: secBoardList, sbMap: sbMap };
    window.__ltGen = genTime;
    document.open(); document.write(renderHTML(data)); document.close();
    return genTime;
  }
  // 绑定刷新按钮
  var btn = document.getElementById('refreshBtn');
  if (!btn) return;
  function setGen() { var info = document.getElementById('refreshInfo'); if (info) { var m = /生成于 ([0-9:\- ]+)/.exec(info.textContent); window.__ltGen = m ? m[1] : ''; } }
  setGen();
  btn.addEventListener('click', function () {
    btn.disabled = true; var old = btn.textContent; btn.textContent = '实时拉取中…';
    runLive().then(function (genTime) {
      btn.disabled = false; btn.textContent = old;
      var i2 = document.getElementById('refreshInfo');
      if (i2) i2.textContent = '已刷新 · 实时拉取 · 生成于 ' + genTime;
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = old;
      alert('实时刷新失败：' + ((e && e.message) || e) + '\n\n仅公网URL（aurora-am.github.io）可跨域拉取真实行情；本地 file:// 双击打开会被浏览器禁止联网。可改用本地运行 node scripts/build_leader.cjs。');
    });
  });
})();