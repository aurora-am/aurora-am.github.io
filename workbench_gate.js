/* ============================================================
 *  观复・研社 · 复盘工作台 权限遮罩
 *  依赖：supabase-js（window.supabase）、miao_supabase.js（window.MiaoSB）
 *  行为：未登录 或 未开通会员(pro) → 显示全屏遮罩、隐藏 .app-layout 全部内容；
 *        已登录且为 pro 会员 → 移除遮罩、显示内容。与主站付费页一致。
 *  说明：内容默认（CSS）即被隐藏，仅当确认 isPro 后才解锁，
 *        因此未登录 / 未会员 / JS 加载前 都看不到任何复盘内容。
 * ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function start() {
    var MiaoSB = window.MiaoSB;
    // 等待 miao_supabase.js 完成初始化（最多约 6 秒）
    if (!MiaoSB || !MiaoSB.client) {
      if (start._tries === undefined) start._tries = 0;
      if (start._tries++ < 60) { setTimeout(start, 100); return; }
      // 超时仍无 MiaoSB：保持遮罩（内容隐藏），避免未授权访问
      console.warn('[WorkGate] MiaoSB 未就绪，保持权限遮罩');
      return;
    }

    var body = document.body;
    var gate = $('miaoWorkGate');
    var loginBtn = $('wgateLogin');
    var vipBtn = $('wgateVip');

    // 根据共享会员态切换遮罩
    function apply() {
      var pro = !!(MiaoSB && MiaoSB.state && MiaoSB.state.isPro);
      body.classList.toggle('miao-unlocked', pro);
      if (gate) gate.setAttribute('aria-hidden', pro ? 'true' : 'false');
    }

    if (loginBtn) loginBtn.addEventListener('click', function () {
      if (window.MiaoSB) window.MiaoSB.openAuth('login');
    });
    if (vipBtn) vipBtn.addEventListener('click', function () {
      if (window.MiaoSB) window.MiaoSB.openPurchase();
    });

    // 1) 登录 / 登出 → 会话变化（miao_supabase 会随后 refreshState 更新 isPro）
    try {
      if (MiaoSB.client.auth && MiaoSB.client.auth.onAuthStateChange) {
        MiaoSB.client.auth.onAuthStateChange(function () { setTimeout(apply, 60); });
      }
    } catch (e) { /* 忽略 */ }

    // 2) 购买完成后 miao_supabase 会 refreshState 更新 state.isPro；
    //    轻量轮询共享状态（仅读属性，无网络开销），捕获所有翻转：登录 / 登出 / 开通
    setInterval(apply, 1500);

    // 3) 兼容自定义刷新事件
    window.addEventListener('miao:state', apply);

    // 首次评估（此时 isPro 多为 false → 维持遮罩；待 refreshState 完成后翻转）
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
