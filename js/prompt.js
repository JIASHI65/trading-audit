
// ===== 底部提示词卡片事件重绑定 =====
// （因上方IIFE执行时对应DOM元素尚未渲染，此处重新绑定）
(function rebindPromptCards() {
  var addBtn = document.getElementById("promptAddBtn");
  var editorModal = document.getElementById("promptEditorModal");
  var editorClose = document.getElementById("promptEditorClose");
  var editorCancel = document.getElementById("promptEditorCancel");
  var editorSave = document.getElementById("promptEditorSave");
  var editorTitle = document.getElementById("promptEditorTitle");
  var editorVersion = document.getElementById("promptEditorVersion");
  var editorContent = document.getElementById("promptEditorContent");
  var cardList = document.getElementById("promptCardList");
  var badge = document.getElementById("promptSectionBadge");
  if (!addBtn || !editorModal) { console.warn("rebind: prompt DOM not ready"); return; }

  function closeEditor() { editorModal.style.display = "none"; }
  function renderPromptCards() {
    if (!window.Store) return;
    // 确保 prompts 已从 localStorage 加载
    try {
      var raw = localStorage.getItem('app_prompts');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed) Store.state.prompts = parsed;
      }
    } catch(e) {}
    var lane = Store.state.currentLane;
    var prompts = Store.getPrompts(lane);
    if (!prompts || prompts.length === 0) {
      cardList.innerHTML = '<div style="padding:20px;text-align:center;color:#556070;font-size:12px">暂无保存的提示词</div>';
      if (badge) badge.textContent = "";
      return;
    }
    if (badge) badge.textContent = "(" + prompts.length + ")";
    var h = "";
    for (var i = prompts.length-1; i >= 0; i--) {
      var p = prompts[i];
      var idx = prompts.length - 1 - i;
      var preview = (p.content || "").substring(0, 80).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      h += '<div class="prompt-card" data-prompt-idx="' + idx + '" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:6px">'
        + '<div style="font-size:11px;color:var(--text-dim);display:flex;gap:12px;margin-bottom:4px;align-items:center">'
        + '<span style="background:rgba(88,166,255,.12);color:var(--accent);padding:1px 6px;border-radius:4px;font-size:10px">v' + (idx+1) + '</span>'
        + '<span style="flex:1">' + (p.version || "未命名") + '</span>'
        + '<span>' + (p.date || "") + '</span>'
        + '<span data-action="editPrompt" data-idx="' + idx + '" style="cursor:pointer;color:#58a6ff;font-size:11px;padding:2px 6px;border-radius:4px">✏️</span>'
        + '<span data-action="deletePrompt" data-idx="' + idx + '" style="cursor:pointer;color:#f85149;font-size:13px;padding:2px 6px;border-radius:4px">🗑️</span>'
        + '</div>'
        + '<div class="prompt-preview" style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + preview + '</div>'
        + '<div class="prompt-full" style="display:none;font-size:12px;color:var(--text-muted);margin-top:4px;padding:8px;background:rgba(0,0,0,.2);border-radius:4px;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto">' + (p.content || "").replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
        + '<div style="margin-top:4px;text-align:right"><span class="prompt-toggle" data-idx="' + idx + '" style="cursor:pointer;font-size:10px;color:var(--text-dim)">展开全文 ▾</span></div>'
        + '</div>';
    }
    cardList.innerHTML = h;
    // 绑定折叠展开（防止重复绑定）
    cardList.querySelectorAll('.prompt-toggle').forEach(function(el) {
      if (el._promptBound) return;
      el._promptBound = true;
      el.addEventListener('click', function(e) {
        var card = el.closest('.prompt-card');
        var preview = card.querySelector('.prompt-preview');
        var full = card.querySelector('.prompt-full');
        var isHidden = full.style.display === 'none';
        full.style.display = isHidden ? 'block' : 'none';
        preview.style.display = isHidden ? 'none' : '';
        el.textContent = isHidden ? '收起全文 ▴' : '展开全文 ▾';
      });
    });
  }

  var newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);

  newBtn.addEventListener("click", function() {
    editorTitle.textContent = "\u{1f4dd} \u65b0\u589e\u63d0\u793a\u8bcd";
    editorVersion.value = "";
    editorContent.value = "";
    delete editorSave.dataset.editIdx;
    editorModal.style.display = "flex";
  });

  if (editorClose) editorClose.addEventListener("click", closeEditor);
  if (editorCancel) editorCancel.addEventListener("click", closeEditor);
  if (editorSave) editorSave.addEventListener("click", function() {
    if (!window.Store) return;
    var lane = Store.state.currentLane;
    var v = editorVersion.value.trim() || "未命名";
    var c = editorContent.value.trim();
    if (!c) { alert("请输入提示词内容"); return; }
    var editIdx = editorSave.dataset.editIdx;
    if (editIdx !== undefined) {
      Store.updatePrompt(lane, parseInt(editIdx), v, c);
    } else {
      Store.savePrompts(lane, v, c);
    }
    closeEditor();
  });

  // editPrompt / deletePrompt 委托（只保留底部卡片系统，避免旧 handleAction 双触发）
  cardList.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;
    var idx = parseInt(el.dataset.idx);
    if (isNaN(idx)) return;
    var lane = Store.state.currentLane;
    var prompts = Store.getPrompts(lane);
    if (action === 'editPrompt') {
      if (!prompts || idx < 0 || idx >= prompts.length) return;
      var p = prompts[idx];
      editorTitle.textContent = '✏️ 编辑提示词';
      editorVersion.value = p.version || '';
      editorContent.value = p.content || '';
      editorSave.dataset.editIdx = idx;
      editorModal.style.display = 'flex';
    } else if (action === 'deletePrompt') {
      if (!confirm('确定删除这个版本吗？')) return;
      Store.deletePrompt(lane, idx);
    }
  });

  // 暴露给外部（App.init 需要调用）
  window.renderPromptCards = renderPromptCards;

  if (window.Store) {
    Store.state.subscribers.push({key: "currentLane", fn: renderPromptCards});
    Store.state.subscribers.push({key: "prompts", fn: renderPromptCards});
  }
  // 首次渲染：双重保险
  // 1. 立即尝试（如果 Store 已经就绪）
  renderPromptCards();
  // 2. DOMContentLoaded 后再跑一次
  document.addEventListener('DOMContentLoaded', function() { renderPromptCards(); });
  // 3. 1秒后最后再跑一次（兜底）
  setTimeout(renderPromptCards, 1000);
})();
