/* ============================================================
 *  观复・研社 · 复盘工作台 权限控制
 *  依赖：supabase-js（window.supabase）、miao_supabase.js（window.MiaoSB）
 *  行为（付费模式）：未登录 或 未开通会员(pro) → 跳转主站 https://mimihub.cloud/；
 *        已登录且为 pro 会员 → 给 body 加 miao-unlocked，显示 .app-layout 内容。
 *  说明：内容默认（CSS）即被隐藏，仅当确认 isPro 后才解锁。
 *
 *  ⚠️ 当前为「临时模式 · 为爱发电」：不鉴权，脚本执行即解锁。
 *  ============================================================
 *
 *  2026-10-16 性能修复（「进入很慢」根因之二）：
 *  原实现 start() 要等 window.MiaoSB 就绪（最多 60×100ms = 6 秒），
 *  而 MiaoSB 依赖 supabase-js（走 cdn.jsdelivr.net，实测首字节 3~4 秒、
 *  整体约 5 秒）→ 期间 .app-layout 被 body:not(.miao-unlocked) 隐藏 = 白屏；
 *  更糟的是轮询超时后会 location.replace(HOME) 跳回主站，
 *  而主站跳转页又指回工作台 → 用户看到「进不去 / 来回跳 / 很慢」。
 *  修法：临时模式下不再等待任何网络依赖，脚本一执行就解锁；
 *       付费鉴权逻辑完整保留在下方注释与 PAYWALL_ENABLED 开关中。
 * ============================================================ */
(function () {
  'use strict';

  var HOME = 'https://mimihub.cloud/';
  var PAYWALL_ENABLED = false; // ← 恢复付费模式时改为 true

  function unlock() {
    if (document.body && !document.body.classList.contains('miao-unlocked')) {
      document.body.classList.add('miao-unlocked');
    }
  }

  /* ===== 临时模式：立即解锁，不等 MiaoSB / 不等 DOMContentLoaded =====
     脚本位于 </body> 前，此时 document.body 已存在，可直接解锁；
     内容随解析进程逐段显示，不再有整页白屏。 */
  if (!PAYWALL_ENABLED) {
    unlock();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', unlock);
    }
    // 兜底：若因其它脚本异常导致未解锁，1 秒后再试一次
    setTimeout(unlock, 1000);
  }

  function start() {
    var MiaoSB = window.MiaoSB;

    /* 临时模式：MiaoSB 仅用于「登录/登出后更新用户态」，与内容显示无关，
       因此未就绪也不跳转、不阻塞（原超时会跳回主站，代价过高）。 */
    if (!MiaoSB || !MiaoSB.client) {
      if (start._tries === undefined) start._tries = 0;
      if (start._tries++ < 120) { setTimeout(start, 250); return; }
      if (PAYWALL_ENABLED) {
        // 付费模式：MiaoSB 长时间未就绪 → 为避免未授权内容外露，跳回主站
        console.warn('[WorkGate] MiaoSB 未就绪，跳转回主站');
        location.replace(HOME);
      } else {
        console.warn('[WorkGate] MiaoSB 未就绪（临时模式：内容已解锁，不跳转）');
      }
      return;
    }

    function check() {
      if (!PAYWALL_ENABLED) {
        // ===== 临时模式：为爱发电 —— 直接解锁显示内容，不鉴权 =====
        unlock();
        return;
      }
      /* ===== 付费模式（恢复时把 PAYWALL_ENABLED 改为 true 即生效）=====
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
