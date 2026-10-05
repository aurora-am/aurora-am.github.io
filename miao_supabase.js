/* ============================================================
 *  喵喵盘研社 · Supabase 会员层
 *  依赖：@supabase/supabase-js@2 (UMD, window.supabase)
 *  提供：注册 / 登录 / 退出 / 会话保持 / 会员鉴权 / 购买 / 改密
 * ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://kbajwhtglnmhtyhavpmk.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiYWp3aHRnbG5taHR5aGF2cG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjEyMDksImV4cCI6MjEwNjY5NzIwOX0.NglgHEyY45zQoDSLgMoD3QBXislbAhCqn6xv0L9rlGo';

  // 免费模块（未登录也能看）；其余需登录且为 pro
  var FREE_PAGES = ['overview', 'market', 'premarket', 'notes', 'tthelper'];
  var PAID_PAGES = ['theme', 'mainline', 'echelon', 'stockpool', 'overnight', 'edge', 'verify'];

  var sb = null;
  var state = { user: null, session: null, isPro: false, expireAt: null, pricing: null, currentPage: 'overview' };

  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (e) {
    console.error('[MiaoSB] Supabase 初始化失败', e);
  }

  // ---------------- 工具 ----------------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }
  function toast(msg, type) {
    var t = document.createElement('div');
    t.className = 'miao-toast ' + (type || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }
  function fmtDate(s) { if (!s) return '—'; var d = new Date(s); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------------- 弹窗骨架 ----------------
  function ensureMask() {
    var m = $('miaoMask');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'miaoMask';
    m.className = 'miao-mask';
    m.innerHTML = '<div class="miao-modal"><span class="miao-close" id="miaoClose">×</span><div id="miaoBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    $('miaoClose').addEventListener('click', closeModal);
    return m;
  }
  function openModal(html) { ensureMask(); $('miaoBody').innerHTML = html; ensureMask().classList.add('show'); }
  function closeModal() { var m = $('miaoMask'); if (m) m.classList.remove('show'); }

  // ---------------- 鉴权态刷新 ----------------
  async function refreshState() {
    if (!sb) return;
    var s = await sb.auth.getSession();
    state.session = s && s.data ? s.data.session : null;
    state.user = state.session ? state.session.user : null;

    if (!state.user) {
      state.isPro = false; state.expireAt = null;
    } else {
      var r = await sb.rpc('my_membership');
      var row = r.data && r.data.length ? r.data[0] : null;
      state.isPro = !!(row && row.status === 'active' && row.plan === 'pro' && new Date(row.expire_at) > new Date());
      state.expireAt = row ? row.expire_at : null;
      // 首次登录补一条 public.users 记录（触发器已建，这里兜底）
      try {
        await sb.from('users').upsert({
          id: state.user.id,
          email: state.user.email,
          nickname: (state.user.email || '').split('@')[0],
          last_login_at: new Date().toISOString()
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) { /* 忽略：RLS 下 upsert 可能无权限，由触发器负责 */ }
    }
    renderBadge();
    applyGate(state.currentPage, true);
  }

  function renderBadge() {
    var b = $('vipBadge'); if (!b) return;
    var buy = $('vipBuyBtn'), chpw = $('vipChpwBtn'), out = $('vipLogoutBtn');
    if (!state.user) {
      b.textContent = '未登录'; b.className = 'vip-badge guest';
      if (buy) buy.style.display = '';
      if (chpw) chpw.style.display = 'none';
      if (out) out.style.display = 'none';
      // 顶栏加一个登录按钮
      if (!$('miaoLoginBtn')) {
        var lb = document.createElement('button');
        lb.id = 'miaoLoginBtn'; lb.className = 'topbar-btn'; lb.textContent = '登录 / 注册';
        lb.addEventListener('click', function () { openAuth('login'); });
        if (buy && buy.parentNode) buy.parentNode.insertBefore(lb, buy);
      }
    } else {
      var lb2 = $('miaoLoginBtn'); if (lb2) lb2.remove();
      b.textContent = state.isPro ? ('PRO · ' + fmtDate(state.expireAt)) : '免费版';
      b.className = 'vip-badge ' + (state.isPro ? 'pro' : 'free');
      if (buy) buy.style.display = state.isPro ? 'none' : '';
      if (chpw) chpw.style.display = '';
      if (out) out.style.display = '';
    }
  }

  // ---------------- 登录 / 注册 ----------------
  function openAuth(tab) {
    tab = tab || 'login';
    openModal(
      '<h3 class="miao-title">喵喵盘研社</h3>' +
      '<div class="miao-tabs"><span class="miao-tab' + (tab === 'login' ? ' active' : '') + '" data-t="login">登录</span>' +
      '<span class="miao-tab' + (tab === 'reg' ? ' active' : '') + '" data-t="reg">注册</span></div>' +
      '<label class="miao-label">邮箱</label><input id="miaoEmail" class="miao-in" type="email" placeholder="you@example.com" autocomplete="email">' +
      '<label class="miao-label">密码（至少 8 位）</label><input id="miaoPwd" class="miao-in" type="password" placeholder="••••••••" autocomplete="current-password">' +
      '<div class="miao-err" id="miaoErr"></div>' +
      '<button class="miao-btn primary" id="miaoSubmit">' + (tab === 'login' ? '登 录' : '注 册') + '</button>' +
      '<div class="miao-foot"><a href="javascript:void(0)" id="miaoForgot">忘记密码？</a></div>' +
      '<div class="miao-tip">测试环境已开启「注册即通过」，无需邮件验证。</div>'
    );
    document.querySelectorAll('.miao-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.miao-tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        $('miaoSubmit').textContent = t.dataset.t === 'login' ? '登 录' : '注 册';
      });
    });
    $('miaoSubmit').addEventListener('click', submitAuth);
    $('miaoPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitAuth(); });
    $('miaoForgot').addEventListener('click', openReset);
  }

  async function submitAuth() {
    var email = ($('miaoEmail').value || '').trim();
    var pwd = $('miaoPwd').value || '';
    var err = $('miaoErr');
    var actTab = document.querySelector('.miao-tab.active');
    if (!actTab) { actTab = document.querySelector('.miao-tab'); if (actTab) actTab.classList.add('active'); }
    var isReg = !!(actTab && actTab.dataset.t === 'reg');
    err.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = '请输入正确的邮箱地址'; return; }
    if (pwd.length < 8) { err.textContent = '密码至少 8 位'; return; }

    $('miaoSubmit').disabled = true; $('miaoSubmit').textContent = '处理中…';
    var res;
    try {
      res = isReg
        ? await sb.auth.signUp({ email: email, password: pwd })
        : await sb.auth.signInWithPassword({ email: email, password: pwd });
    } catch (e) { res = { error: { message: e.message } }; }
    $('miaoSubmit').disabled = false; $('miaoSubmit').textContent = isReg ? '注 册' : '登 录';

    if (res.error) { err.textContent = mapErr(res.error.message); return; }
    if (isReg && !res.data.session) {
      toast('注册成功，请登录', 'ok'); openAuth('login'); $('miaoEmail').value = email; return;
    }
    closeModal();
    toast(isReg ? '注册成功，已自动登录' : '登录成功', 'ok');
    await refreshState();
  }

  function mapErr(m) {
    m = String(m || '');
    if (/Invalid login/i.test(m)) return '邮箱或密码错误';
    if (/already registered|already been registered/i.test(m)) return '该邮箱已注册，请直接登录';
    if (/Email not confirmed/i.test(m)) return '邮箱尚未验证';
    if (/Password should be/i.test(m)) return '密码不符合要求（至少 8 位）';
    if (/over_email_send_rate|rate limit/i.test(m)) return '操作过于频繁，请稍后再试';
    return m;
  }

  async function openReset() {
    openModal(
      '<h3 class="miao-title">重置密码</h3>' +
      '<label class="miao-label">注册邮箱</label><input id="miaoResetEmail" class="miao-in" type="email" placeholder="you@example.com">' +
      '<div class="miao-err" id="miaoErr"></div>' +
      '<button class="miao-btn primary" id="miaoResetBtn">发送重置邮件</button>' +
      '<div class="miao-tip">Supabase 会发送重置链接到 Site URL（https://mimihub.cloud）。免费版每日邮件额度有限。</div>'
    );
    $('miaoResetBtn').addEventListener('click', async function () {
      var email = ($('miaoResetEmail').value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('miaoErr').textContent = '请输入正确的邮箱地址'; return; }
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (r.error) { $('miaoErr').textContent = mapErr(r.error.message); return; }
      toast('重置邮件已发送，请查收', 'ok'); closeModal();
    });
  }

  // ---------------- 修改密码 ----------------
  function openChangePw() {
    openModal(
      '<h3 class="miao-title">修改密码</h3>' +
      '<label class="miao-label">新密码（至少 8 位）</label><input id="miaoNp1" class="miao-in" type="password">' +
      '<label class="miao-label">确认新密码</label><input id="miaoNp2" class="miao-in" type="password">' +
      '<div class="miao-err" id="miaoErr"></div>' +
      '<button class="miao-btn primary" id="miaoCpBtn">确认修改</button>'
    );
    $('miaoCpBtn').addEventListener('click', async function () {
      var a = $('miaoNp1').value || '', b = $('miaoNp2').value || '';
      if (a.length < 8) { $('miaoErr').textContent = '密码至少 8 位'; return; }
      if (a !== b) { $('miaoErr').textContent = '两次输入的密码不一致'; return; }
      var r = await sb.auth.updateUser({ password: a });
      if (r.error) { $('miaoErr').textContent = mapErr(r.error.message); return; }
      toast('密码已修改', 'ok'); closeModal();
    });
  }

  // ---------------- 购买 ----------------
  var DUR_META = [
    { k: 'day', label: '一日体验', tag: '' },
    { k: 'month', label: '月卡', tag: '' },
    { k: 'quarter', label: '季卡', tag: '' },
    { k: 'year', label: '年卡', tag: '推荐' }
  ];

  async function loadPricing() {
    if (state.pricing) return state.pricing;
    var r = await sb.rpc('get_pricing');
    state.pricing = r.data || null;
    return state.pricing;
  }

  async function openPurchase() {
    if (!state.user) { toast('请先登录', 'warn'); openAuth('login'); return; }
    var p;
    try { p = await loadPricing(); } catch (e) { p = null; }
    if (!p || !p.tiers) { toast('定价加载失败，请稍后重试', 'warn'); return; }

    var eb = p.earlyBird || {};
    var cards = DUR_META.map(function (d) {
      var t = p.tiers[d.k] || {};
      var amount = t.amount, list = t.list;
      var perDay = t.days ? (amount / t.days) : 0;
      return '<div class="dur-card" data-d="' + d.k + '">' +
        (d.tag ? '<span class="dur-tag">' + d.tag + '</span>' : '') +
        (t.isEarly ? '<span class="dur-badge">早鸟限时</span>' : '') +
        '<div class="dur-name">' + d.label + '</div>' +
        '<div class="dur-price">¥' + amount + '</div>' +
        (list && list !== amount ? '<div class="dur-orig">原价 ¥' + list + '</div>' : '') +
        '<div class="dur-per">日均 ¥' + perDay.toFixed(2) + '</div>' +
        '</div>';
    }).join('');

    openModal(
      '<h3 class="miao-title">开通会员</h3>' +
      (eb.active ? '<div class="mm-eb">🎁 早鸟价 · 距结束还有 ' + eb.daysLeft + ' 天（' + eb.deadline + '）</div>' : '') +
      '<div class="dur-grid">' + cards + '</div>' +
      '<div class="miao-sum">应付：<b id="miaoSum">¥' + p.tiers.month.amount + '</b></div>' +
      '<button class="miao-btn pay" id="miaoPayBtn">立即开通</button>' +
      '<div class="miao-tip">下单后由支付平台确认收款并自动开通会员；未支付不会开通。</div>'
    );

    var sel = 'month';
    document.querySelectorAll('.dur-card').forEach(function (c) {
      if (c.dataset.d === 'month') c.classList.add('active');
      c.addEventListener('click', function () {
        document.querySelectorAll('.dur-card').forEach(function (x) { x.classList.remove('active'); });
        c.classList.add('active'); sel = c.dataset.d;
        $('miaoSum').textContent = '¥' + p.tiers[sel].amount;
      });
    });
    $('miaoPayBtn').addEventListener('click', function () { doPay(sel); });
  }

  async function doPay(dur) {
    var btn = $('miaoPayBtn');
    btn.disabled = true; btn.textContent = '提交中…';
    var r = await sb.rpc('create_order', { p_duration: dur });
    btn.disabled = false; btn.textContent = '立即开通（测试模式）';
    if (r.error) { toast(mapErr(r.error.message), 'warn'); return; }
    // 安全修复 R-2 后：下单只创建 pending 订单，必须由支付回调（service_role）才开通
    state.lastOrder = r.data;
    closeModal();
    openPending(r.data);
    await refreshState();
  }

  // 订单待支付提示
  function openPending(ord) {
    if (!ord) return;
    openModal(
      '<h3 class="miao-title">订单已创建</h3>' +
      '<div class="miao-sum" style="text-align:left">订单号：<b style="font-size:14px">' + esc(ord.order_no) + '</b></div>' +
      '<div class="miao-sum" style="text-align:left">应付金额：<b>¥' + ord.amount + '</b>（' + esc(ord.duration) + '，' + ord.days + ' 天）</div>' +
      '<div class="miao-sum" style="text-align:left">当前状态：<b style="color:#e8891a">等待支付</b></div>' +
      '<div class="miao-tip">为保证交易安全，会员<b>仅在支付成功后</b>由支付回调自动开通；重复支付不会叠加时长。' +
      '支付通道正在接入中，接入后本单可直接完成付款。</div>' +
      '<button class="miao-btn primary" id="miaoRefreshOrder">刷新开通状态</button>' +
      '<button class="miao-btn" id="miaoCloseOrder" style="background:#eef2f7;color:#5a6a7e;margin-top:8px">知道了</button>'
    );
    $('miaoCloseOrder').addEventListener('click', closeModal);
    $('miaoRefreshOrder').addEventListener('click', async function () {
      await refreshState();
      if (state.isPro) { toast('会员已开通', 'ok'); closeModal(); }
      else toast('仍在等待支付', 'warn');
    });
  }

  // ---------------- 付费墙（渐隐遮罩：只展示前 2/3） ----------------
  var PAGE_CN = {
    theme: '实时题材', mainline: '主线板块', echelon: '战法阁 · 连板梯队',
    stockpool: '股票池', overnight: '隔夜判断', edge: '盘中雷达', verify: '次日回验'
  };

  function wallHost(page) { return $('page-' + page); }

  function buildWall(page) {
    var w = document.createElement('div');
    w.className = 'miao-wall';
    w.innerHTML =
      '<div class="miao-wall-grad"></div>' +
      '<div class="miao-wall-ribbon"><span>会员专属 · 限时优惠</span></div>' +
      '<div class="miao-wall-title">解锁 <em>' + (PAGE_CN[page] || '会员内容') + '</em> 完整数据</div>' +
      '<div class="miao-wall-desc">开通会员后即可查看本页剩余全部内容，含每日更新</div>' +
      '<div class="miao-wall-btns">' +
        '<button class="miao-wall-btn ghost" data-act="sub">订阅专栏 · 解锁全文</button>' +
        '<button class="miao-wall-btn gold" data-act="vip">超级会员 · 免费看</button>' +
      '</div>' +
      '<div class="miao-wall-foot">支持 一日体验 / 月卡 / 季卡 / 年卡，随时取消</div>';
    w.querySelectorAll('.miao-wall-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!state.user) { toast('请先登录，再开通会员', 'warn'); openAuth('login'); return; }
        openPurchase();
      });
    });
    return w;
  }

  function setWall(page, gated) {
    var host = wallHost(page);
    if (!host) return;
    var exist = null;
    for (var i = 0; i < host.children.length; i++) {
      if (host.children[i].className === 'miao-wall') { exist = host.children[i]; break; }
    }
    if (gated) {
      host.classList.add('miao-gated');
      if (!exist) host.appendChild(buildWall(page));
    } else {
      host.classList.remove('miao-gated');
      if (exist && exist.parentNode) exist.parentNode.removeChild(exist);
    }
  }

  function syncWalls() {
    PAID_PAGES.forEach(function (p) { setWall(p, !state.isPro); });
    FREE_PAGES.forEach(function (p) { setWall(p, false); });
  }

  // 允许进入所有页面；付费页按会员态决定是否挂遮罩
  function applyGate(page) {
    state.currentPage = page;
    syncWalls();
    return true;
  }

  function wrapNavigate() {
    if (typeof window.navigateTo !== 'function') return false;
    var orig = window.navigateTo;
    window.navigateTo = function (page) {
      if (!applyGate(page, false)) return false;
      return orig.apply(this, arguments);
    };
    return true;
  }

  async function logout() {
    await sb.auth.signOut();
    state.user = null; state.session = null; state.isPro = false;
    renderBadge();
    toast('已退出登录', 'ok');
    if (typeof window.navigateTo === 'function') window.navigateTo('overview');
  }

  // ---------------- 启动 ----------------
  function boot() {
    // 顶栏按钮改绑到 Supabase 层
    var buy = $('vipBuyBtn'); if (buy) { buy.onclick = null; buy.addEventListener('click', openPurchase); }
    var cp = $('vipChpwBtn'); if (cp) { cp.onclick = null; cp.addEventListener('click', openChangePw); }
    var lo = $('vipLogoutBtn'); if (lo) { lo.onclick = null; lo.addEventListener('click', logout); }

    wrapNavigate();
    if (sb) sb.auth.onAuthStateChange(function () { refreshState(); });
    refreshState();
  }

  window.MiaoSB = {
    openAuth: openAuth, openPurchase: openPurchase, openChangePw: openChangePw,
    logout: logout, refreshState: refreshState, state: state, client: sb,
    FREE_PAGES: FREE_PAGES, PAID_PAGES: PAID_PAGES
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
