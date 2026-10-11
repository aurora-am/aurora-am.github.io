/* ============================================================
 *  观复・研社 · 复盘工作台 权限控制
 *  依赖：supabase-js（window.supabase）、miao_supabase.js（window.MiaoSB）
 *  行为：未登录 或 未开通会员(pro) → 直接跳转到主站默认页 https://mimihub.cloud/；
 *        已登录且为 pro 会员 → 给 body 加 miao-unlocked，显示 .app-layout 内容。
 *  说明：内容默认（CSS）即被隐藏，仅当确认 isPro 后才解锁。
 * ============================================================ */
(function () {
  'use strict';

  var HOME = 'https://mimihub.cloud/';

  function start() {
    var MiaoSB = window.MiaoSB;
    // 等待 miao_supabase.js 完成初始化（最多约 6 秒）
    if (!MiaoSB || !MiaoSB.client) {
      if (start._tries === undefined) start._tries = 0;
      if (start._tries++ < 60) { setTimeout(start, 100); return; }
      // 超时仍无 MiaoSB：为避免未授权内容外露，跳回主站
      console.warn('[WorkGate] MiaoSB 未就绪，跳转回主站');
      location.replace(HOME);
      return;
    }

    function check() {
      // ===== 临时模式：为爱发电 —— 注释掉会员跳回，登录用户直接放行 =====
      // 恢复付费时：删除下面 3 行，取消下方注释即可还原会员鉴权跳回。
      var loggedIn = !!(MiaoSB && MiaoSB.state && MiaoSB.state.user);
      if (loggedIn) document.body.classList.add('miao-unlocked');
      /*
      var pro = !!(MiaoSB && MiaoSB.state && MiaoSB.state.isPro);
      if (pro) {
        document.body.classList.add('miao-unlocked');
      } else {
        // 未登录/未会员：直接跳转到主站，不在工作台自己做遮罩
        location.replace(HOME);
      }
      */
    }

    // 1) 登录 / 登出 / 购买完成 → miao_supabase 会 refreshState 更新 isPro
    try {
      if (MiaoSB.client.auth && MiaoSB.client.auth.onAuthStateChange) {
        MiaoSB.client.auth.onAuthStateChange(function () { setTimeout(check, 60); });
      }
    } catch (e) { /* 忽略 */ }

    // 2) 轻量轮询共享状态（仅读属性，无网络开销），捕获所有翻转
    setInterval(check, 1500);

    // 3) 兼容自定义刷新事件
    window.addEventListener('miao:state', check);

    // 首次评估
    check();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
