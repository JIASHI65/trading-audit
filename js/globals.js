
window.onerror = function(msg, url, line) {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f85149;color:#fff;padding:10px;z-index:99999;font-size:12px;font-family:monospace';
  d.textContent = 'JS ERROR: ' + msg + ' (line ' + line + ')';
  document.body.appendChild(d);
  console.error('JS ERROR:', msg, 'at', url, 'line', line);
};
// ============================================================
// 交易审计台 v3 — audit.js
// 模块: Store → Parser → Auditor → Renderer → Snapshot → App
// 原则: 无全局变量(全在 store.state) · 无内联 onclick(事件委托) · 无散落 localStorage · 自动重渲染

// 最优先定义 _pm，确保无论如何都能用
// ============================================================

