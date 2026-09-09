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
  <div class="sec-t">二板潜力榜 <em>首板→2板晋级候选 · 按评分降序 · 共 ${secBoardList.length} 只 · 展示 Top15 · 名称悬浮看K线+评分</em></div>
  <div class="sb-wrap">
    ${secBoardList.slice(0, 15).map(x => `
    <div class="sb-row">
      <span><span class="sb-name" data-code="${x.code}">${x.name}</span><span class="sb-theme">${x.theme}</span><span class="sb-score ${x.score >= 70 ? 'sg-s' : x.score >= 55 ? 'sg-b' : x.score >= 45 ? 'sg-w' : 'sg-g'}">${x.score}分</span></span>
      <span class="sb-meta">涨停价 ${x.ztPrice ? f2(x.ztPrice) : '—'} 元 ｜ 上板 ${x.firstTime || '—'} ｜ 换手 ${x.turnoverRate ? x.turnoverRate.toFixed(1) + '%' : '—'} ｜ 封单 ${x.fund ? (x.fund / 1e8).toFixed(2) + '亿' : '—'}</span>
      <span class="sb-warn">次日竞价预警：弱转强≥ <b class="pos">${x.warnPrice || '—'}</b> 元 ｜ 打板 <b>${x.boardPrice || '—'}</b> 元 ｜ 跌破 <b class="neg">${x.breakPrice || '—'}</b> 元即放弃</span>
      <div class="sb-reason"><b>晋级2板理由：</b>${x.reason}</div>
    </div>`).join('')}
    ${secBoardList.length > 15 ? `<div class="sb-more">… 其余 ${secBoardList.length - 15} 只已纳入 data/leader_trade.csv（全部候选），可按需查看</div>` : ''}
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
.blk summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.blk summary::-webkit-details-marker{display:none}
.blk summary::before{content:"▸";color:var(--muted);margin-right:6px}
.blk[open] summary::before{content:"▾"}
.th-name{font-weight:700;font-size:14px} .th-stat{font-size:11px;color:var(--muted);text-align:right}
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
(function(){
  var btn = document.getElementById("refreshBtn");
  if(!btn) return;
  btn.addEventListener("click", function(){
    btn.disabled = true; var old = btn.textContent; btn.textContent = "刷新中…";
    fetch("./leader_data.json?t=" + Date.now()).then(function(r){ return r.json(); }).then(function(d){
      btn.disabled = false; btn.textContent = old;
      var info = document.getElementById("refreshInfo");
      if(info) info.textContent = "已刷新 · 数据口径：" + (d.phase||"") + " · 生成于 " + (d.genTime||"");
      document.open(); document.write(renderHTML(d)); document.close();
    }).catch(function(e){
      btn.disabled = false; btn.textContent = old;
      alert("刷新失败：" + ((e && e.message) || e) + "\n\n本地 file:// 双击打开受浏览器同源限制无法联网；请访问公网URL，或在本地运行 node scripts/build_leader.cjs 后重试。");
    });
  });
})();