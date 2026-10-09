/* ============================================================
 *  观复・研社 · Supabase 会员层
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
  function base64urlDecode(s) {
    s += new Array(5 - s.length % 4).join('=');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    try { return atob(s); } catch (e) { return ''; }
  }
  function parseJwt(token) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length < 2) return null;
      var payload = JSON.parse(base64urlDecode(parts[1]));
      return payload && payload.sub ? payload : null;
    } catch (e) { return null; }
  }
  function userFromJwtPayload(payload) {
    return payload ? { id: payload.sub, email: payload.email || '' } : null;
  }
  function getStoredSession() {
    // 兼容 supabase-js v2 默认 key：sb-<project-ref>-auth-token
    var ref = (SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1] || '';
    var keys = ['sb-' + ref + '-auth-token', 'sb:token', 'supabase.auth.token'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var data = JSON.parse(raw);
        var token = data && (data.access_token || (data.currentSession && data.currentSession.access_token));
        if (!token && typeof data === 'string') token = data;
        var payload = parseJwt(token);
        if (!payload || !payload.sub) continue;
        var now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now - 60) continue; // 允许 60s 时钟偏移
        return { access_token: token, user: userFromJwtPayload(payload), expires_at: payload.exp };
      } catch (e) { /* 忽略单条解析失败 */ }
    }
    return null;
  }

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
  function race(promise, ms, msg) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error(msg || 'timeout')); }, ms);
      })
    ]);
  }
  async function refreshState(retry, providedSession) {
    if (!sb) { renderBadge(); applyGate(state.currentPage, true); return; }
    try {
      var sess = providedSession || state.session;
      if (!sess) {
        // 优先用 Supabase 官方方法恢复会话，但某些环境下 getSession 会永久挂起，加 4s 超时
        try {
          var s = await race(sb.auth.getSession(), 4000, 'getSession timeout');
          sess = s && s.data ? s.data.session : null;
        } catch (e) {
          console.warn('[MiaoSB] getSession hung, falling back to localStorage');
          sess = getStoredSession();
          if (!sess) throw e;
        }
      }
      state.session = sess || null;
      state.user = sess ? (sess.user || userFromJwtPayload(parseJwt(sess.access_token))) : null;

      if (!state.user) {
        state.isPro = false; state.expireAt = null;
      } else {
        var r = await race(sb.rpc('my_membership'), 6000, 'my_membership timeout');
        var row = r.data && r.data.length ? r.data[0] : null;
        state.isPro = !!(row && row.status === 'active' && row.plan === 'pro' && new Date(row.expire_at) > new Date());
        state.expireAt = row ? row.expire_at : null;
        // 首次登录补一条 public.users 记录（触发器已建，这里兜底）
        try {
          await race(sb.from('users').upsert({
            id: state.user.id,
            email: state.user.email,
            nickname: (state.user.email || '').split('@')[0],
            last_login_at: new Date().toISOString()
          }, { onConflict: 'id', ignoreDuplicates: true }), 4000, 'upsert users timeout');
        } catch (e) { /* 忽略：RLS 下 upsert 可能无权限，由触发器负责 */ }
      }
    } catch (e) {
      console.error('[MiaoSB] refreshState failed:', e && e.message ? e.message : e);
      // RPC/网络抖动导致检测失败：静默重试一次，仍失败则降级为未开通，避免界面卡死
      if (!retry) {
        setTimeout(function () { refreshState(true); }, 1200);
        return;
      }
      // 即便最终失败，也保留已有的 session/user，避免登录成功后因 getSession 挂起而被误判为未登录
      if (!state.user) state.isPro = false;
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
  var CODE_TTL_MIN = 10;
  function authModalBody(tab) {
    var isReg = tab === 'reg';
    return '<h3 class="miao-title">观复・研社</h3>' +
      '<div class="miao-tabs"><span class="miao-tab' + (isReg ? '' : ' active') + '" data-t="login">登录</span>' +
      '<span class="miao-tab' + (isReg ? ' active' : '') + '" data-t="reg">注册</span></div>' +
      '<label class="miao-label">邮箱</label><input id="miaoEmail" class="miao-in" type="email" placeholder="you@example.com" autocomplete="email">' +
      '<label class="miao-label">密码（至少 8 位）</label><input id="miaoPwd" class="miao-in" type="password" placeholder="••••••••" autocomplete="current-password">' +
      (isReg ?
        '<label class="miao-label">邮箱验证码</label>' +
        '<div class="miao-code-row">' +
        '<input id="miaoCode" class="miao-in" type="text" inputmode="numeric" placeholder="6 位数字" maxlength="6" autocomplete="one-time-code">' +
        '<button class="miao-btn code" id="miaoSendCode">获取验证码</button>' +
        '</div>' : '') +
      '<div class="miao-err" id="miaoErr"></div>' +
      '<button class="miao-btn primary" id="miaoSubmit">' + (isReg ? '注 册' : '登 录') + '</button>' +
      (isReg ? '' : '<div class="miao-foot"><a href="javascript:void(0)" id="miaoForgot">忘记密码？</a></div>');
  }

  function openAuth(tab) {
    tab = tab || 'login';
    openModal(authModalBody(tab));
    document.querySelectorAll('.miao-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var to = t.dataset.t;
        document.querySelectorAll('.miao-tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        // 切换登录/注册时重建表单（注册态才有验证码行）
        document.querySelector('.miao-modal-body, .miao-body, #miaoBody') &&
          (function (host) { host.innerHTML = authModalBody(to); bindAuth(to); })(document.querySelector('.miao-modal-body, .miao-body, #miaoBody'));
      });
    });
    bindAuth(tab);
  }

  function bindAuth(tab) {
    var isReg = tab === 'reg';
    $('miaoSubmit').textContent = isReg ? '注 册' : '登 录';
    $('miaoSubmit').addEventListener('click', submitAuth);
    $('miaoPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitAuth(); });
    var fg = $('miaoForgot'); if (fg) fg.addEventListener('click', openReset);
    if (isReg && $('miaoSendCode')) $('miaoSendCode').addEventListener('click', sendCode);
  }

  async function sendCode() {
    var email = ($('miaoEmail').value || '').trim();
    var btn = $('miaoSendCode');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      $('miaoErr').textContent = '请先填写正确的邮箱地址'; return;
    }
    btn.disabled = true;
    var left = 0;
    try {
      var r = await fetch(SUPABASE_URL + '/functions/v1/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
        body: JSON.stringify({ email: email, purpose: 'signup' })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        $('miaoErr').textContent = j.message || '验证码发送失败，请稍后重试';
        btn.disabled = false; btn.textContent = '获取验证码';
        return;
      }
      left = j.cooldownSec || 60;
      toast('验证码已发送，' + (j.ttlMin || CODE_TTL_MIN) + ' 分钟内有效', 'ok');
    } catch (e) {
      $('miaoErr').textContent = '网络错误：' + e.message;
      btn.disabled = false; btn.textContent = '获取验证码';
      return;
    }
    // 倒计时
    (function tick() {
      btn.textContent = left > 0 ? (left + ' 秒后重发') : '重新获取';
      if (left <= 0) { btn.disabled = false; return; }
      left--;
      setTimeout(tick, 1000);
    })();
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

    // 注册：先校验邮箱验证码
    if (isReg) {
      var code = (($('miaoCode') || {}).value || '').trim();
      if (!/^\d{6}$/.test(code)) { err.textContent = '请输入 6 位邮箱验证码'; return; }
      var vr = await sb.rpc('verify_email_code', { p_email: email, p_action: 'signup', p_code: code });
      if (vr.error) { err.textContent = '验证码校验失败：' + vr.error.message; return; }
      if (!vr.data) { err.textContent = '验证码无效或已过期，请重新获取'; return; }
    }

    $('miaoSubmit').disabled = true; $('miaoSubmit').textContent = '处理中…';
    var res;
    try {
      // 注册前清理本地残留会话（幽灵 token 会导致 GoTrue 报 Database error finding user）
      if (isReg) {
        try {
          var st = await sb.auth.getSession();
          if (st && st.data && st.data.session) await sb.auth.signOut();
        } catch (e) { /* 忽略清理失败 */ }
      }
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
    // 登录成功后直接使用返回的 session，避免再次 getSession 挂起导致状态被误判为未登录
    var sess = res.data && res.data.session ? res.data.session : null;
    if (sess) { state.session = sess; state.user = sess.user || null; }
    await refreshState(null, sess);
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
      '<a class="miao-btn pay" id="miaoPayWx" style="display:block;text-align:center;text-decoration:none;margin-top:14px" href="javascript:void(0)">微信支付</a>' +
      '<a class="miao-btn pay ali" id="miaoPayAli" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="javascript:void(0)">支付宝支付</a>' +
      '<div class="miao-foot"><a id="miaoGoManual" href="javascript:void(0)">收不到二维码？用备用付款方式</a></div>' +
      '<div class="miao-tip">通过官方备案通道扫码收款，付款成功后自动开通；未支付不会开通。</div>'
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
    $('miaoPayWx').addEventListener('click', function () { doPay(sel, 'wxpay', this); });
    $('miaoPayAli').addEventListener('click', function () { doPay(sel, 'alipay', this); });
    $('miaoGoManual').addEventListener('click', function () { doPay(sel, 'manual', this); });
  }

  async function doPay(dur, type, btn) {
    var old = btn.textContent;
    btn.classList.add('busy');
    btn.textContent = '提交中…';

    // 1) 先落一张待支付订单（金额/天数全部由后端定价决定）
    var r = await sb.rpc('create_order', { p_duration: dur });
    if (r.error) {
      btn.classList.remove('busy'); btn.textContent = old;
      toast(mapErr(r.error.message), 'warn');
      return;
    }

    var tip = '';
    // 2) 向 Edge Function 索取收银台地址（EPAY_KEY 只在服务端）
    if (type !== 'manual') {
      try {
        var fr = await fetch(SUPABASE_URL + '/functions/v1/epay-create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON,
            Authorization: 'Bearer ' + (state.session && state.session.access_token)
          },
          body: JSON.stringify({ duration: dur, type: type })
        });
        var fj = await fr.json().catch(function () { return {}; });
        if (fr.ok && fj.url) {
          toast('正在跳转' + (type === 'alipay' ? '支付宝' : '微信') + '付款…', 'ok');
          setTimeout(function () { location.href = fj.url; }, 600);
          return;
        }
        tip = fj.error === 'EPAY_NOT_CONFIGURED'
          ? '在线收款通道正在配置中，你的订单已保存。'
          : (fj.message || '创建支付失败，请稍后重试。');
      } catch (e) {
        tip = '网络异常，订单已保存，可稍后重试。';
      }
    } else {
      tip = '请使用备用方式付款（下单后把订单号发给客服核对入账）。';
    }

    btn.classList.remove('busy'); btn.textContent = old;
    state.lastOrder = r.data;
    closeModal();
    if (/尚未开通|未开启/.test(tip)) { toast(tip, 'warn'); setTimeout(function () { location.href = manualUrl(r.data); }, 900); return; }
    openPending(r.data, tip);
    await refreshState();
  }

  // 备用付款页（静态收款码 + 订单号人工核对）
  function manualUrl(ord) {
    if (!ord) return 'pay.html';
    return 'pay.html?order=' + encodeURIComponent(ord.order_no) +
      '&amount=' + encodeURIComponent(ord.amount) +
      '&duration=' + encodeURIComponent(ord.duration) +
      '&days=' + encodeURIComponent(ord.days);
  }

  // 订单待支付提示
  function openPending(ord, tip) {
    if (!ord) return;
    var payUrl = manualUrl(ord);
    openModal(
      '<h3 class="miao-title">订单已创建</h3>' +
      '<div class="miao-sum" style="text-align:left">订单号：<b style="font-size:14px">' + esc(ord.order_no) + '</b></div>' +
      '<div class="miao-sum" style="text-align:left">应付金额：<b>¥' + ord.amount + '</b>（' + esc(ord.duration) + '，' + ord.days + ' 天）</div>' +
      '<div class="miao-sum" style="text-align:left">当前状态：<b style="color:#e8891a">等待支付</b></div>' +
      '<div class="miao-tip">' + esc(tip || '会员仅在确认到账后开通；重复付款不会叠加时长。') + '</div>' +
      '<a class="miao-btn pay" id="miaoGoPay" style="display:block;text-align:center;text-decoration:none" href="' + payUrl + '">前往付款（微信 / 支付宝）</a>' +
      '<button class="miao-btn primary" id="miaoRefreshOrder" style="margin-top:8px">我已付款，刷新开通状态</button>' +
      '<button class="miao-btn" id="miaoCloseOrder" style="background:#eef2f7;color:#5a6a7e;margin-top:8px">知道了</button>'
    );
    $('miaoCloseOrder').addEventListener('click', closeModal);
    $('miaoRefreshOrder').addEventListener('click', async function () {
      await refreshState();
      if (state.isPro) { toast('会员已开通', 'ok'); closeModal(); }
      else toast('仍在等待核对到账', 'warn');
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
      '<div class="miao-wall-desc">开通会员后可查看本页剩余全部内容，含每日更新</div>' +
      '<div class="miao-wall-btns">' +
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

  // 移动端侧栏会变成底部 fixed 导航，CTA 需要上移避让
  function syncBottomInset() {
    var inset = 0;
    try {
      var nav = document.querySelector('.sidebar');
      if (nav && window.getComputedStyle(nav).position === 'fixed') {
        var r = nav.getBoundingClientRect();
        if (r && r.height) inset = Math.round(r.height);
      }
    } catch (e) { /* jsdom 等无布局环境忽略 */ }
    document.documentElement.style.setProperty('--miao-wall-bottom', inset + 'px');
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
      syncBottomInset();
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
    try { await race(sb.auth.signOut(), 4000, 'signOut timeout'); }
    catch (e) { console.warn('[MiaoSB] signOut timeout, force clear local state'); }
    // 同时清理本地 token，确保即使服务端 signOut 挂起也退出
    try {
      var ref = (SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1] || '';
      localStorage.removeItem('sb-' + ref + '-auth-token');
    } catch (e) {}
    state.user = null; state.session = null; state.isPro = false;
    renderBadge();
    applyGate(state.currentPage, true);
    toast('已退出登录', 'ok');
    if (typeof window.navigateTo === 'function') window.navigateTo('overview');
  }

  // ---------------- 启动 ----------------
  function boot() {
    try {
      // 顶栏按钮改绑到 Supabase 层
      var buy = $('vipBuyBtn'); if (buy) { buy.onclick = null; buy.addEventListener('click', openPurchase); }
      var cp = $('vipChpwBtn'); if (cp) { cp.onclick = null; cp.addEventListener('click', openChangePw); }
      var lo = $('vipLogoutBtn'); if (lo) { lo.onclick = null; lo.addEventListener('click', logout); }

      wrapNavigate();
      // onAuthStateChange 会携带最新 session，直接复用，避免 getSession 挂起
      if (sb) sb.auth.onAuthStateChange(function (event, sess) { refreshState(null, sess); });
      refreshState();

      // 兜底：页面完全加载后若状态仍卡住，再刷新一次
      if (document.readyState === 'complete') refreshState();
      else window.addEventListener('load', function () { refreshState(); });

      window.addEventListener('resize', syncBottomInset);

      // 支付完成回跳（?paid=1）→ 自动刷新会员态并提示
      if (/[?&]paid=1/.test(location.search || '')) {
        setTimeout(function () {
          refreshState().then(function () {
            toast(state.isPro ? '支付成功，会员已开通' : '支付已提交，稍候自动开通', state.isPro ? 'ok' : 'warn');
          });
        }, 800);
      }
    } catch (e) {
      console.error('[MiaoSB] boot failed:', e && e.message ? e.message : e);
    }
  }

  window.MiaoSB = {
    openAuth: openAuth, openPurchase: openPurchase, openChangePw: openChangePw,
    logout: logout, refreshState: refreshState, state: state, client: sb,
    FREE_PAGES: FREE_PAGES, PAID_PAGES: PAID_PAGES
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
