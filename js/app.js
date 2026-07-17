// ============================================================
// 5. Snapshot — 行情数据加载
// ============================================================
const Snapshot = {
  async loadMarketSnapshot() {
    const candidates = [
      './snapshots/latest_summary.json',
      './snapshots/latest.json',
      '../snapshots/latest.json',
      '../../snapshots/latest.json',
      '../../snapshots/latest_summary.json',
      './latest.json'
    ];

    for (const path of candidates) {
      try {
        const resp = await fetch(path);
        if (!resp.ok) continue;
        const data = await resp.json();
        Store.dispatch('SET_SNAPSHOT', {data, ts: Date.now()});
        this.updateMarketPanel();
        return;
      } catch(e) {}
    }

    // v2 fallback
    const v2Candidates = [
      '../../snapshots/market_snapshot_v2.json',
      './market_snapshot_v2.json',
      '../../market_snapshot.json',
      './market_snapshot.json'
    ];

    for (const path of v2Candidates) {
      try {
        const resp = await fetch(path);
        if (!resp.ok) continue;
        const data = await resp.json();
        Store.dispatch('SET_SNAPSHOT', {data, ts: Date.now(), v2: true});
        this.updateMarketPanel();
        return;
      } catch(e) {}
    }

    // 都没找到 → 使用内置 100+ 标数据
    this._showFallbackPanel();
  },

  updateMarketPanel() {
    const snap = Store.state.snapshot;
    if (!snap || !snap.data) {
      this._showFallbackPanel();
      return;
    }

    const raw = snap.data;
    const isV2 = snap.v2;
    let symbols = {};

    if (isV2) {
      Object.keys(raw).forEach(key => {
        const bars = raw[key];
        if (!Array.isArray(bars) || bars.length === 0) return;
        const last = bars[bars.length - 1];
        const prev = bars.length > 1 ? bars[bars.length - 2] : null;
        const price = last ? (last.c !== undefined ? last.c : (Array.isArray(last) ? last[4] : null)) : null;
        const prevPrice = prev ? (prev.c !== undefined ? prev.c : (Array.isArray(prev) ? prev[4] : null)) : null;
        if (price === null) return;
        symbols[key] = {price, change: prevPrice ? ((price - prevPrice) / prevPrice * 100) : null, cat: this.getMarketCat(key)};
      });
    } else {
      // v3: 可能有 _meta 包装
      let unwrapped = raw;
      if (raw._meta) {
        unwrapped = raw.symbols || raw.data || {};
      } else if (raw.data && !Array.isArray(raw.data)) {
        unwrapped = raw.data.symbols || raw.data;
      }
      if (unwrapped._meta) {
        unwrapped = unwrapped.symbols || unwrapped.data || unwrapped;
      }

      Object.keys(unwrapped).forEach(key => {
        if (key === '_meta') return;
        const cleanKey = key.replace(/@.*$/, '');
        const val = unwrapped[key];
        let price = null, prevPrice = null;
        if (Array.isArray(val)) {
          const last = val[val.length - 1];
          const prev = val.length > 1 ? val[val.length - 2] : null;
          if (last) {
            price = Array.isArray(last) ? last[4] : (last.c || last.close);
            prevPrice = prev ? (Array.isArray(prev) ? prev[4] : (prev.c || prev.close)) : null;
          }
        } else if (val && typeof val === 'object') {
          const s = val.summary || val;
          price = s.last_price || s.close || s.price;
          prevPrice = s.prev_close || s.prevPrice || s.open;
        }
        if (price === null || price === undefined) return;
        symbols[cleanKey] = {price, change: prevPrice ? ((price - prevPrice) / prevPrice * 100) : null, cat: this.getMarketCat(cleanKey)};
      });
    }

    if (Object.keys(symbols).length === 0) { this._showFallbackPanel(); return; }

    // 渲染到面板
    const panel = document.getElementById('marketSnapshot');
    if (!panel) return;
    const catOrder = ['🪙 加密','📈 美股','🇭🇰 港股','🇨🇳 A股','💱 外汇','🥇 商品','📜 债券','📊 指数','其他'];
    const cats = {};
    Object.keys(symbols).forEach(sym => {
      const item = symbols[sym];
      const cat = item.cat || '其他';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({sym, price: item.price, change: item.change});
    });
    let html = '<div class="sidebar-card"><div class="sidebar-title" style="display:flex;justify-content:space-between"><span>📡 行情面板</span><span style="font-size:9px;color:#475569;font-weight:400">' + Object.keys(symbols).length + ' 个品种</span></div><div style="max-height:360px;overflow-y:auto">';
    catOrder.forEach(cat => {
      const items = cats[cat];
      if (!items || items.length === 0) return;
      html += '<div style="font-size:9px;color:#475569;margin-top:6px;margin-bottom:2px;font-weight:500">' + cat + '</div>';
      items.forEach(item => {
        const c = item.change !== null ? (item.change >= 0 ? '<span style="color:var(--green)">+' + item.change.toFixed(2) + '%</span>' : '<span style="color:var(--red)">' + item.change.toFixed(2) + '%</span>') : '<span style="color:#64748B">—</span>';
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px"><span style="color:#94A3B8">' + item.sym + '</span><span>' + Number(item.price).toLocaleString() + ' ' + c + '</span></div>';
      });
    });
    html += '</div></div>';
    panel.innerHTML = html;
  },

  // 内置 100+ 标保底数据（找不到快照时用）
  _showFallbackPanel() {
    const SYMBOLS = {
      '🪙 加密': [
        {sym:'BTC/USDT',price:63958,change:1.8},{sym:'ETH/USDT',price:1789,change:2.9},{sym:'SOL/USDT',price:77.67,change:-0.5},
        {sym:'BNB/USDT',price:582,change:1.2},{sym:'XRP/USDT',price:0.52,change:-0.3},{sym:'ADA/USDT',price:0.45,change:0.8},
        {sym:'DOGE/USDT',price:0.124,change:-1.1},{sym:'AVAX/USDT',price:32.5,change:2.1},{sym:'DOT/USDT',price:7.2,change:0.5},
        {sym:'LINK/USDT',price:14.8,change:1.4},{sym:'MATIC/USDT',price:0.68,change:-0.2},{sym:'ATOM/USDT',price:9.5,change:0.9},
        {sym:'UNI/USDT',price:7.8,change:1.5},{sym:'APT/USDT',price:8.2,change:-0.7},{sym:'ARB/USDT',price:1.1,change:0.3},
        {sym:'OP/USDT',price:2.4,change:1.1},{sym:'SUI/USDT',price:1.8,change:2.3},{sym:'NEAR/USDT',price:4.9,change:0.6},
        {sym:'FIL/USDT',price:5.6,change:-0.8},{sym:'INJ/USDT',price:28.5,change:1.9}
      ],
      '📈 美股': [
        {sym:'NVDA',price:485,change:2.3},{sym:'AAPL',price:218,change:0.5},{sym:'TSLA',price:262,change:-1.2},
        {sym:'MSFT',price:415,change:0.8},{sym:'AMZN',price:195,change:1.1},{sym:'GOOGL',price:182,change:0.3},
        {sym:'META',price:515,change:2.8},{sym:'AMD',price:165,change:1.5},{sym:'INTC',price:32,change:-0.4},
        {sym:'CRM',price:285,change:0.9},{sym:'NFLX',price:680,change:-0.6},{sym:'PYPL',price:72,change:0.7},
        {sym:'UBER',price:78,change:2.1},{sym:'COIN',price:175,change:1.8},{sym:'TSM',price:168,change:2.5},
        {sym:'AVGO',price:1550,change:1.7},{sym:'QCOM',price:185,change:0.2},{sym:'MU',price:128,change:-1.5},
        {sym:'SNOW',price:155,change:3.1},{sym:'CRWD',price:375,change:1.4},{sym:'NET',price:95,change:2.7},
        {sym:'SHOP',price:88,change:1.2},{sym:'PLTR',price:24,change:3.2},{sym:'SNAP',price:16,change:-2.4},
        {sym:'SQ',price:82,change:1.6},{sym:'MRVL',price:72,change:2.0},{sym:'DDOG',price:125,change:0.8}
      ],
      '🇭🇰 港股': [
        {sym:'0700.HK',price:388,change:0.8},{sym:'9988.HK',price:82,change:-0.3},{sym:'3690.HK',price:118,change:1.5},
        {sym:'9618.HK',price:112,change:0.2},{sym:'1810.HK',price:14.5,change:-0.6},{sym:'1024.HK',price:48,change:1.1},
        {sym:'2382.HK',price:295,change:0.7},{sym:'2269.HK',price:42.5,change:0.4},{sym:'1211.HK',price:235,change:2.3}
      ],
      '🇨🇳 A股': [
        {sym:'上证指数',price:3996,change:-1.00},{sym:'深证成指',price:15047,change:-0.8},{sym:'创业板指',price:2450,change:-1.2},
        {sym:'科创50',price:1050,change:0.5},{sym:'沪深300',price:4150,change:-0.6},{sym:'中证500',price:6150,change:-0.3}
      ],
      '💱 外汇': [
        {sym:'DXY',price:100.6,change:-0.25},{sym:'EUR/USD',price:1.1432,change:0.15},{sym:'USD/JPY',price:161.47,change:-0.56},
        {sym:'GBP/USD',price:1.285,change:0.08},{sym:'AUD/USD',price:0.668,change:0.12},{sym:'USD/CAD',price:1.362,change:-0.05},
        {sym:'NZD/USD',price:0.605,change:0.03},{sym:'USD/CNH',price:6.7794,change:-0.08}
      ],
      '🥇 商品': [
        {sym:'XAU/USD',price:4104,change:0.12},{sym:'XAG/USD',price:59.5,change:-0.25},{sym:'WTI',price:71.17,change:-1.26},
        {sym:'布伦特',price:75.54,change:-0.95},{sym:'铜',price:6.281,change:0.25},{sym:'天然气',price:2.888,change:-4.1}
      ],
      '📜 债券': [
        {sym:'美2Y',price:4.16,change:-0.02},{sym:'美10Y',price:4.54,change:-0.03},{sym:'美30Y',price:4.72,change:-0.01},
        {sym:'德10Y',price:2.45,change:0.01},{sym:'日10Y',price:1.05,change:0.00},{sym:'中10Y',price:2.85,change:-0.02}
      ],
      '📊 指数': [
        {sym:'标普500',price:7575,change:0.42},{sym:'纳斯达克',price:26282,change:0.29},{sym:'道琼斯',price:52637,change:0.29},
        {sym:'日经225',price:68558,change:1.20},{sym:'DAX',price:19850,change:0.35},{sym:'FTSE',price:8420,change:-0.15},
        {sym:'CAC',price:7980,change:0.28},{sym:'恒生',price:24175,change:0.60},{sym:'KOSPI',price:2850,change:-0.45},
        {sym:'Nifty50',price:24650,change:0.22},{sym:'VIX',price:16.5,change:-0.8}
      ]
    };

    const panel = document.getElementById('marketSnapshot');
    if (!panel) return;
    let total = 0;
    Object.values(SYMBOLS).forEach(v => { total += v.length; });
    let html = '<div class="sidebar-card"><div class="sidebar-title" style="display:flex;justify-content:space-between"><span>📡 行情面板</span><span style="font-size:9px;color:#475569;font-weight:400">' + total + ' 个品种</span></div><div style="max-height:360px;overflow-y:auto">';
    Object.keys(SYMBOLS).forEach(cat => {
      const items = SYMBOLS[cat];
      if (!items) return;
      html += '<div style="font-size:9px;color:#475569;margin-top:6px;margin-bottom:2px;font-weight:500">' + cat + '</div>';
      items.forEach(item => {
        const c = item.change !== null ? (item.change >= 0 ? '<span style="color:var(--green)">+' + item.change.toFixed(2) + '%</span>' : '<span style="color:var(--red)">' + item.change.toFixed(2) + '%</span>') : '<span style="color:#64748B">—</span>';
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px"><span style="color:#94A3B8">' + item.sym + '</span><span>' + Number(item.price).toLocaleString() + ' ' + c + '</span></div>';
      });
    });
    html += '</div></div>';
    panel.innerHTML = html;
  },

  getMarketCat(sym) {
    const s = sym.toUpperCase();
    if (s.indexOf('BTC') >= 0 || s.indexOf('ETH') >= 0 || s.indexOf('SOL') >= 0 || s.indexOf('USDT') >= 0 || s.indexOf('USDC') >= 0) return '🪙 加密';
    if (s.indexOf('NVDA') >= 0 || s.indexOf('AAPL') >= 0 || s.indexOf('TSLA') >= 0 || s.indexOf('MSFT') >= 0 || s.indexOf('GOOGL') >= 0 || s.indexOf('AMZN') >= 0 || s.indexOf('META') >= 0) return '📈 美股';
    if (s.indexOf('SP500') >= 0 || s.indexOf('NDX') >= 0 || s.indexOf('DJI') >= 0 || s.indexOf('VIX') >= 0) return '📈 美股';
    if (s.indexOf('HSI') >= 0 || s.indexOf('HST') >= 0 || s.indexOf('HK') >= 0) return '🇭🇰 港股';
    if (s.indexOf('SH') >= 0 || s.indexOf('SZ') >= 0 || s.indexOf('CSI') >= 0) return '🇨🇳 A股';
    if (s.indexOf('XAU') >= 0 || s.indexOf('XAG') >= 0 || s.indexOf('GOLD') >= 0 || s.indexOf('WTI') >= 0 || s.indexOf('BRENT') >= 0 || s.indexOf('OIL') >= 0 || s.indexOf('铜') >= 0 || s.indexOf('天然气') >= 0) return '🥇 商品';
    if (s.indexOf('DXY') >= 0 || s.indexOf('EUR') >= 0 || s.indexOf('JPY') >= 0 || s.indexOf('GBP') >= 0 || s.indexOf('CNH') >= 0) return '💱 外汇';
    if (s.indexOf('Y') >= 0 && s.indexOf('年期') >= 0) return '📜 债券';
    if (s.indexOf('NIKKEI') >= 0 || s.indexOf('DAX') >= 0 || s.indexOf('FTSE') >= 0 || s.indexOf('CAC') >= 0 || s.indexOf('KOSPI') >= 0 || s.indexOf('Nifty') >= 0) return '📊 指数';
    if (s.indexOf('标普') >= 0 || s.indexOf('纳斯达克') >= 0 || s.indexOf('道琼斯') >= 0 || s.indexOf('恒生') >= 0 || s.indexOf('日经') >= 0) return '📊 指数';
    return '其他';
  }
};
const App = {
  async init() {
      try {
    Store.init();

    // 事件委托 — 所有点击由这一个监听器处理
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      // 点击反馈
      target.classList.add('clickBounce');
      setTimeout(() => target.classList.remove('clickBounce'), 250);

      const action = target.dataset.action;
      const modelId = target.dataset.model;
      const filter = target.dataset.filter;
      const idx = target.dataset.idx;
      const value = target.dataset.value;
      const tab = target.dataset.tab;
      const key = target.dataset.key;

      this.handleAction(action, {modelId, filter, idx, value, tab, key, target});
    });

    // 直接绑定提示词按钮：滚动到底部提示词卡片区
    var promptBtn = document.getElementById('promptBtn');
    if (promptBtn) {
      promptBtn.addEventListener('click', function() {
        var sec = document.getElementById('promptSection');
        if (sec) sec.scrollIntoView({behavior:'smooth', block:'start'});
      });
    }
    // 选中复选框的委托
    document.getElementById('app').addEventListener('change', (e) => {
      if (e.target.classList.contains('trade-select')) {
        const key = e.target.dataset.key;
        Store.dispatch('SELECT_TRADE', {key, multi: e.shiftKey || true});
        this.refreshUI();
      }
    });

    // 2分钟自动刷新行情
    Store.state.pendingSnapshotTimer = setInterval(() => Snapshot.loadMarketSnapshot(), 120000); window._auditTimers.push(Store.state.pendingSnapshotTimer);

    // [FIX Bug 5] 不再30秒自动刷新追踪（通过subscribe机制在数据变化时刷新）
    // 保留定时器仅用于检查外部数据变化
    Store.state.pendingTrackerTimer = (_t_trk = setInterval(() => {
      const t = document.querySelector('.tab-content.active');
      if (t && t.id === 'tab-tracker') Renderer.renderTracker();
    }, 30000)) && window._auditTimers.push(_t_trk);

    // 初始化 UI
    this.restoreUI();
    this._syncLaneUI();

    // 加载行情
    await Snapshot.loadMarketSnapshot();

    // [FIX Bug 4] Subscribe to data changes for auto-refresh tracker tab
    Store.subscribe('tracker', () => {
      const t = document.querySelector('.tab-content.active');
      if (t && t.id === 'tab-tracker') Renderer.renderTracker();
    });
    Store.subscribe('confirms', () => {
      const t = document.querySelector('.tab-content.active');
      if (t && t.id === 'tab-tracker') Renderer.renderTracker();
    });
    } catch(e) {
      var errDiv = document.createElement('div');
      errDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#f85149;color:#fff;padding:10px;font-size:13px;z-index:999999;text-align:center';
      errDiv.textContent = '❌ 初始化错误: ' + e.message;
      document.body.appendChild(errDiv);
      console.error('App.init error:', e);
    }
  },

  handleAction(action, ctx) {
    const s = Store.state;

    switch (action) {
      // ----- 模型切换 -----
      case 'loadModel': {
        if (ctx.modelId) {
          Store.dispatch('SET_MODEL', ctx.modelId);
          this.loadModelUI(ctx.modelId);
        }
        break;
      }

      // ----- 审计 -----
      case 'audit': {
        this.runAudit();
        break;
      }

      // ----- 清除当前模型 -----
      case 'clearModel': {
        if (s.activeModel) {
          Store.dispatch('CLEAR_MODEL', s.activeModel);
          document.getElementById('jsonInput').value = '';
          document.getElementById('statsGrid').style.display = 'none';
          document.getElementById('mainContent').style.display = 'none';
          document.getElementById('modelAnalysis').style.display = 'none';
          this.loadModelUI(s.activeModel);
        }
        break;
      }

      // ----- 加载示例 -----
      case 'loadSample': {
        this.loadSample();
        break;
      }

      // ----- 确认/驳回/撤销 -----
      case 'confirmTrade': {
        if (s.activeModel === null) return;
        const i = parseInt(ctx.idx);
        const key = s.activeModel + '_' + i;
        let val;
        if (ctx.value === 'true') val = true;
        else if (ctx.value === 'false') val = false;
        else val = null;
        Store.dispatch('CONFIRM_TRADE', {key, value: val});
        this.refreshUI();
        break;
      }

      // ----- 筛选 -----
      case 'setFilter': {
        if (ctx.filter) {
          // [FIX Bug 3] Clear selection when changing filter
          Store.dispatch('CLEAR_SELECTION');
          Store.dispatch('SET_FILTER', ctx.filter);
          this.refreshUI();
        }
        break;
      }

      // ----- 批量确认 -----
      case 'batchConfirm': {
        if (s.activeModel === null) return;
        const keys = Array.from(s.selected);
        Store.dispatch('BATCH_CONFIRM', {keys, value: true});
        this.refreshUI();
        break;
      }

      // ----- 批量驳回 -----
      case 'batchReject': {
        if (s.activeModel === null) return;
        const keys2 = Array.from(s.selected);
        Store.dispatch('BATCH_CONFIRM', {keys: keys2, value: false});
        this.refreshUI();
        break;
      }

      // ----- 取消选择 -----
      case 'batchClear': {
        Store.dispatch('CLEAR_SELECTION');
        this.refreshUI();
        break;
      }

      // ----- 多模型对比 -----
      case 'comparison': {
        Renderer.renderComparison();
        break;
      }

      // ----- 返回编辑 -----
      case 'backToModel': {
        document.getElementById('comparisonView').style.display = 'none';
        document.getElementById('mainContent').style.display = 'grid';
        document.getElementById('statsGrid').style.display = 'grid';
        document.getElementById('modelAnalysis').style.display = 'block';
        if (s.activeModel) this.loadModelUI(s.activeModel);
        break;
      }

      // ----- Tab切换 -----
      case 'switchLane': {
        var newLane = ctx.target.dataset.lane;
        if (newLane) {
          Store.switchLane(newLane);
          this._syncLaneUI();
          this.restoreUI();
        }
        break;
      }

      case 'switchTab': {
        if (ctx.tab) {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          const tabBtn = document.querySelector(`[data-tab="${ctx.tab}"]`);
          if (tabBtn) tabBtn.classList.add('active');
          const tabContent = document.getElementById('tab-' + ctx.tab);
          if (tabContent) tabContent.classList.add('active');

          // [FIX Bug 4] 切换到追踪账本时自动刷新
          if (ctx.tab === 'tracker') {
            Renderer.renderTracker();
          }
          if (ctx.tab === 'audit') {
            if (s.activeModel) this.refreshUI();
          }
        }
        break;
      }

      // ----- 追踪交易 -----
      case 'trackTrade': {
        let _modelId = s.activeModel;
        if (!_modelId || !MODEL_KEYS.includes(_modelId)) {
          const _existing = Object.keys(s.models);
          if (_existing.length > 0) {
            _modelId = _existing[0];
            if (s.activeModel !== _modelId) {
              Store.dispatch('SET_MODEL', _modelId);
              this.loadModelUI(_modelId);
            }
          } else { return; }
        }
        const i3 = parseInt(ctx.idx);
        const data = Store.getModelTrades(_modelId);
        if (!data || !data.trades || !data.trades[i3]) return;
        const t = data.trades[i3];
        const id = _modelId + '_' + i3;
        const existing = s.tracker.find(tx => tx.id === id);
        if (existing) {
          Store.dispatch('REMOVE_TRACKER', id);
        } else {
          Store.dispatch('ADD_TRACKER', {
            id,
            symbol: t.symbol,
            direction: t.direction,
            entry_low: t.entry_low,
            entry_high: t.entry_high,
            stop: t.stop,
            target1: t.target1,
            target2: t.target2,
            claimed_rr: t.claimed_rr,
            tracked_at: new Date().toISOString()
          });
        }
        this.refreshUI();
        break;
      }

      // ----- 移除追踪 -----
      case 'removeTracker': {
        const idx4 = parseInt(ctx.idx);
        const items = s.tracker;
        if (items[idx4]) {
          Store.dispatch('REMOVE_TRACKER', items[idx4].id);
        }
        Renderer.renderTracker();
        break;
      }

      // ----- 清空追踪 -----
      case 'clearTracker': {
        if (confirm('确定清空所有追踪交易吗？')) {
          Store.dispatch('CLEAR_TRACKER');
          Renderer.renderTracker();
        }
        break;
      }

      // ----- 刷新追踪 -----
      case 'trackerRefresh': {
        Renderer.renderTracker();
        break;
      }

      // ----- 学习看板 -----
      case 'learnRender': {
        const input = document.getElementById('learnInput').value;
        Renderer.renderLearning(input);
        break;
      }

      // ----- 学习看板清空 -----
      case 'learnClear': {
        document.getElementById('learnInput').value = '';
        document.getElementById('learnOutput').innerHTML =
          '<div style="padding:60px 20px;text-align:center;color:var(--text-dim)"><div style="font-size:32px;margin-bottom:10px">📊</div><div style="font-size:13px">粘贴 Prompt A 输出后点「渲染看板」</div></div>';
        break;
      }

      // ----- 学习看板加载示例 -----
      case 'learnSample': {
        this.loadLearnSample();
        break;
      }
    }
  },

  // ----- 恢复 UI 状态 -----
  restoreUI() {
    const s = Store.state;
    // 如果有已保存的模型，加载第一个
    const savedModels = Object.keys(s.models);
    if (savedModels.length > 0) {
      // 尝试恢复上次活跃的模型
      const first = savedModels[0];
      Store.dispatch('SET_MODEL', first);
      this.loadModelUI(first);
    }
  },

  // ----- 加载模型 UI -----
  loadModelUI(modelId) {
    const m = Store.state.models[modelId];
    const label = MODEL_LABELS[modelId];
    const color = MODEL_COLORS[modelId];

    document.getElementById('activeModel').textContent = '当前模型: ' + label;
    document.getElementById('activeModel').style.color = color;

    // 更新按钮状态
    MODEL_KEYS.forEach(k => {
      const btn = document.querySelector(`[data-model="${k}"]`);
      if (btn) btn.classList.toggle('active', k === modelId);
    });

    // 如果有已保存的数据，渲染
    if (m && m.data) {
      document.getElementById('jsonInput').value = m.input || '';
      let verStr = '';
      if (m.version) verStr += '<span style="font-size:11px;color:#58a6ff;margin-left:8px">版本:' + m.version + '</span>';
      if (m.generated_at) verStr += '<span style="font-size:10px;color:#475569;margin-left:4px">' + m.generated_at + '</span>';
      document.getElementById('modelAnalysis').innerHTML =
        '<div class="save-indicator" style="border-left-color:' + color + '">' +
        '<span>✅ 已保存 ' + label + ' 结果 • ' + (m.time || '') + '</span>' + verStr +
        '<span style="font-size:11px;color:#475569">重新粘贴并审计可覆盖</span></div>';
      document.getElementById('comparisonView').style.display = 'none';
      document.getElementById('modelAnalysis').style.display = 'block';
      document.getElementById('statsGrid').style.display = 'grid';
      document.getElementById('mainContent').style.display = 'grid';
      Renderer.render(modelId);
    } else {
      document.getElementById('jsonInput').value = '';
      document.getElementById('comparisonView').style.display = 'none';
      document.getElementById('modelAnalysis').style.display = 'block';
      document.getElementById('modelAnalysis').innerHTML =
        '<div style="padding:14px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:12px;font-size:14px;color:#94A3B8;text-align:center;border-left:3px solid ' + color + '">' +
        '✏️ 请粘贴 <strong style="color:' + color + '">' + label + '</strong> 的输出到下方框框，点"开始审计"<br>' +
        '<span style="font-size:10px;color:#475569">当前保留上次模型数据，粘贴后自动覆盖此模型</span></div>';
    }
  },

  // ----- 运行审计 -----
  runAudit() {
    const raw = document.getElementById('jsonInput').value.trim();
    if (!raw) { alert('请粘贴交易数据'); return; }
    const data = Parser.tryNormalize(raw);
    if (!data) { alert('无法解析输入内容。支持：JSON、JSON代码块、Gemini输出、Markdown交易卡片格式。'); return; }

    // 确定当前模型
    let modelId = Store.state.activeModel;
    if (!modelId || !MODEL_KEYS.includes(modelId)) {
      // 如果有模型数据，但没选模型，选第一个有数据的
      const existing = Object.keys(Store.state.models);
      if (existing.length > 0) {
        modelId = existing[0];
      } else {
        modelId = 'claude';
      }
      Store.dispatch('SET_MODEL', modelId);
    }

    Store.dispatch('SAVE_MODEL', {id: modelId, input: raw, data});
    this.loadModelUI(modelId);
  },

  // ----- 刷新 UI（重新渲染当前视图）-----
  refreshUI() {
    if (Store.state.activeModel) {
      Renderer.render(Store.state.activeModel);
    }
  },

  // ============================================================
  // 泳道/提示词
  // ============================================================
  _syncLaneUI() {
    var lane = Store.state.currentLane;
    document.querySelectorAll('.lane-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.lane === lane);
    });
    var h = document.querySelector('.header h1 span');
    if (h) {
      var labels = { stream_us: '🇺🇸美股', stream_a: '🇨🇳A股', stream_hk: '🇭🇰港股', stream_crypto: '🪙加密现货' };
      h.textContent = labels[lane] || lane;
    }
  },

  // ============================================================
  // 示例数据
  // ============================================================
  loadSample() {
    const samples = {
      claude: {
        date: '2026-07-10', portfolio: {total:10000, cash:3000, same_direction:2},
        trades: [
          {symbol:'BTC/USDT', direction:'long', entry_low:61300, entry_high:61700, stop:60400, target1:62900, target2:64900, claimed_rr:2.2, size_cny:1600,
            anchors:{stop:'61k整数关+区间下沿吞没前低', target1:'61k-63k区间上沿留100美元缓冲'}, falsification:'放量跌破60900且1小时内收不回', exit_strategy:'60400止损全平；62900卖半；64900清仓',
            backtest:{win_rate:62, avg_return:1.8, max_drawdown:-8.5, sharpe:1.42, annualized:34.7, total_trades:47, period:'2025-01~2026-06', source:'Claude 策略回测'}},
          {symbol:'ETH/USDT', direction:'long', entry_low:3380, entry_high:3420, stop:3300, target1:3550, target2:3680, claimed_rr:2.5, size_cny:1500,
            anchors:{stop:'3300整数关下方（前低支撑）', target1:'3550日线MA20阻力'}, falsification:'日线实体跌破3300', exit_strategy:'3300止损全平；3550卖半；3680清仓'},
          {symbol:'XAU/USD', direction:'short', entry_low:2395, entry_high:2395, stop:2415, target1:2360, target2:2340, claimed_rr:2.0, size_cny:1200,
            anchors:{stop:'2415前高上方', target1:'2360短期支撑'}, falsification:'日线站稳2415则空头失效', exit_strategy:'2415止损；2360平50%；2340清仓'},
          {symbol:'NVDA', direction:'long', entry_low:128, entry_high:132, stop:122, target1:142, target2:155, claimed_rr:2.5, size_cny:1500,
            anchors:{stop:'122前低支撑位', target1:'142前高阻力'}, falsification:'周线跌破122则突破失败', exit_strategy:'122止损全平；142卖半；155清仓'}
        ]
      },
      gpt: {
        date: '2026-07-10', portfolio: {total:10000, cash:4000, same_direction:1},
        trades: [
          {symbol:'BTC/USDT', direction:'long', entry_low:62500, entry_high:62800, stop:61500, target1:64500, target2:66000, claimed_rr:2.8, size_cny:1000,
            anchors:{stop:'61500突破前高回踩位下方', target1:'64500日线通道上沿'}, falsification:'BTC放量跌破61000即趋势破坏', exit_strategy:'61500止损；64500减1/3；66000清仓'},
          {symbol:'ETH/USDT', direction:'short', entry_low:3480, entry_high:3520, stop:3560, target1:3300, target2:3200, claimed_rr:3.2, size_cny:1000,
            anchors:{stop:'3560双顶颈线上方', target1:'3300前低支撑', target2:'3200MA120'}, falsification:'日线站稳3560则空头失效', exit_strategy:'3560止损；3300平60%；3200清仓'},
          {symbol:'SOL/USDT', direction:'long', entry_low:148, entry_high:152, stop:142, target1:165, target2:178, claimed_rr:2.5, size_cny:1000,
            anchors:{stop:'142前低支撑', target1:'165前期阻力'}, falsification:'SOL日线跌破142趋势线', exit_strategy:'142止损；165卖半；178清仓'}
        ]
      },
      gemini: {
        date: '2026-07-10', portfolio: {total:10000, cash:5000, same_direction:0},
        trades: [
          {symbol:'BTC/USDT', direction:'short', entry_low:63000, entry_high:63300, stop:64200, target1:60500, target2:58800, claimed_rr:2.4, size_cny:1200,
            anchors:{stop:'64200前高上方', target1:'60500通道中轨', target2:'58800通道下沿'}, falsification:'日线收于64200上方，空头失效', exit_strategy:'64200止损；60500平50%；58800清仓'},
          {symbol:'XAU/USD', direction:'long', entry_low:2350, entry_high:2360, stop:2320, target1:2410, target2:2450, claimed_rr:2.6, size_cny:1500,
            anchors:{stop:'2320日线支撑下方', target1:'2410前高阻力'}, falsification:'日线实体跌破2320，多头失效', exit_strategy:'2320止损；2410卖半；2450清仓'},
          {symbol:'TSLA', direction:'long', entry_low:262, entry_high:268, stop:252, target1:285, target2:300, claimed_rr:2.4, size_cny:1200,
            anchors:{stop:'252日线MA60支撑', target1:'285前高'}, falsification:'跌破252周线级别破位', exit_strategy:'252止损；285减1/3；300清仓'},
          {symbol:'USD/JPY', direction:'short', entry_low:159.5, entry_high:160.2, stop:161.5, target1:157, target2:155, claimed_rr:2.2, size_cny:1100,
            anchors:{stop:'161.5前高上方', target1:'157日线支撑区'}, falsification:'USD/JPY站稳161.5则干预无效', exit_strategy:'161.5止损；157平50%；155清仓'}
        ]
      },
      grok: {
        date: '2026-07-10', portfolio: {total:10000, cash:2500, same_direction:3},
        trades: [
          {symbol:'BTC/USDT', direction:'long', entry_low:60500, entry_high:61000, stop:59500, target1:63500, target2:65000, claimed_rr:3.0, size_cny:2000,
            anchors:{stop:'59500前低下方（超卖容忍位）', target1:'63500日线MA20'}, falsification:'BTC周线收盘低于59500则趋势破位', exit_strategy:'59500止损；63500卖半；65000清仓；若1小时不涨破62000减1/3'},
          {symbol:'ETH/USDT', direction:'long', entry_low:3320, entry_high:3360, stop:3250, target1:3500, target2:3600, claimed_rr:2.4, size_cny:2000,
            anchors:{stop:'3250前低下方', target1:'3500阻力位'}, falsification:'日线实体跌破3250', exit_strategy:'3250止损；3500卖半；3600清仓'},
          {symbol:'DOGE/USDT', direction:'long', entry_low:0.124, entry_high:0.128, stop:0.118, target1:0.142, target2:0.155, claimed_rr:2.2, size_cny:1500,
            anchors:{stop:'0.118前低下方', target1:'0.142阻力位'}, falsification:'跌破0.118则Meme退潮', exit_strategy:'0.118止损；0.142卖半；0.155清仓'},
          {symbol:'NVDA', direction:'short', entry_low:138, entry_high:140, stop:144, target1:128, target2:120, claimed_rr:2.5, size_cny:2000,
            anchors:{stop:'144前高上方', target1:'128MA60支撑'}, falsification:'NVDA站稳144则做空失效', exit_strategy:'144止损；128平50%；120清仓'}
        ]
      },
      deepseek: {
        date: '2026-07-10', portfolio: {total:10000, cash:6000, same_direction:0},
        trades: [
          {symbol:'BTC/USDT', direction:'short', entry_low:62200, entry_high:61800, stop:63500, target1:59000, target2:57200, claimed_rr:2.2, size_cny:1000,
            anchors:{stop:'63500右肩上方', target1:'59000颈线', target2:'57200头肩顶量度目标'}, falsification:'BTC日线收于63500上方，头肩顶失效', exit_strategy:'63500止损；59000平40%；57200清仓'},
          {symbol:'ETH/USDT', direction:'short', entry_low:3450, entry_high:3480, stop:3540, target1:3320, target2:3220, claimed_rr:2.1, size_cny:1000,
            anchors:{stop:'3540阻力位上方', target1:'3320支撑', target2:'3220前低'}, falsification:'站稳3540则转向', exit_strategy:'3540止损；3320平50%；3220清仓'},
          {symbol:'XAU/USD', direction:'long', entry_low:2365, entry_high:2375, stop:2335, target1:2420, target2:2460, claimed_rr:2.3, size_cny:1000,
            anchors:{stop:'2335日线支撑', target1:'2420前高'}, falsification:'日线跌破2335则多头失效', exit_strategy:'2335止损；2420卖半；2460清仓'},
          {symbol:'AAPL', direction:'long', entry_low:218, entry_high:222, stop:212, target1:235, target2:248, claimed_rr:2.8, size_cny:1000,
            anchors:{stop:'212前低支撑', target1:'235前高阻力'}, falsification:'跌破212则财报预期落空', exit_strategy:'212止损；235卖半；248清仓'}
        ]
      }
    };
    const data = (Store.state.activeModel && samples[Store.state.activeModel]) ? samples[Store.state.activeModel] : samples.claude;
    document.getElementById('jsonInput').value = JSON.stringify(data, null, 2);
  },

  // ----- 学习看板示例 -----
  loadLearnSample() {
    const sample = `# 📊 全市场扫描 · 2026年7月10日

**今日模式：** 🎯 震荡日 — CPI公布后市场消化中，无明显趋势方向

## 🪙 加密货币

| 品种 | 趋势 | 异动 |
|------|------|------|
| BTC/USDT | 震荡偏多 | 区间 61k-63k 运行 |
| ETH/USDT | 震荡 | 3300-3500 整理中 |
| SOL/USDT | 上升 | 回踩 148 获得支撑 |

## 🥇 重点品种分析

### BTC/USDT — 🟢 条件做多

**M 宏观：** CPI 数据符合预期，降息预期维持 → 顺风
**F 基本面：** ETF 资金连续三日净流入 → 正面
**T 技术面：**
\`\`\`
┌────────── BTC 关键价位图 ──────────┐
│  \$65,000 ┤ ══ 🔴 强阻力 ══         │
│  \$63,000 ┤ ── 🔴 区间上沿 ──        │
│  \$61,500 ┤ ╳ 📍 当前价              │
│  \$60,400 ┤ ══ 🟢 止损位 ══         │
│  \$60,000 ┤ ── 🟢🟢 极端支撑 ──     │
└────────────────────────────────────┘
\`\`\`
**R 风控：** RR 2.2:1 | 止损 60400 | 目标 62900/64900

> **策略：** 区间下沿回踩买入，突破 61700 确认入场

### ETH/USDT — ⚪ 观望

**M 宏观：** 与 BTC 联动，无明显独立叙事 → 中性
**T 技术面：** 3300-3500 区间整理，方向不明确
**R 风控：** 盈亏比不足 2:1，暂不操作

> **今日不操作。** 等突破 3500 或回踩 3300 再评估。

---

## 📊 核心指标卡

[KPI 总市值:2.45万亿] [KPI 24h成交量:820亿] [KPI BTC.D:54.2%] [KPI 恐贪指数:48]

## 🌍 TOP 3 今日关注

1. **美国 CPI 数据后续影响** → 降息预期维持，风险资产偏多
2. **BTC ETF 资金流** → 连续 3 日净流入，机构买盘支撑
3. **ETH 质押率变化** → 质押量创新高，供应紧缩逻辑

## 💬 一句话总结

震荡行情不追高，区间下沿试多，破位严格止损。空仓也是仓位。`;
    document.getElementById('learnInput').value = sample;
  Renderer.renderLearning(sample);
  }
};

// 全局提示词函数
// ============================================================
// 启动
// ============================================================
// 暴露到全局，让 onclick 可以访问
window.Store = Store;
window.ModelKeys = MODEL_KEYS;
window.openPromptManager = function() {
  var sec = document.getElementById('promptSection');
  if (sec) sec.scrollIntoView({behavior:'smooth', block:'start'});
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  var btn = document.getElementById('promptBtn');
  if (btn) {
    btn.addEventListener('click', function() {
      window.openPromptManager();
    });
  }
});

