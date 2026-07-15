// ============================================================
// 4. Renderer — 所有 UI 渲染
// ============================================================
const Renderer = {
  esc(s) { return (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  // ----- 交易卡片渲染 -----
  renderTrades(modelId, trades, audited, total) {
    const s = Store.state;
    let html = '';
    const filter = s.filter;
    const MAX_RENDER = 200;
    const displayTrades = trades.length > MAX_RENDER ? trades.slice(0, MAX_RENDER) : trades;

    displayTrades.forEach((t, i) => {
      const r = audited[i];
      const confirmVal = Store.getConfirm(modelId, i);
      const selectedKey = modelId + '_' + i;
      const isSelected = s.selected.has(selectedKey);

      // 筛选
      if (filter === 'confirmed' && confirmVal !== true) return;
      if (filter === 'rejected' && confirmVal !== false) return;

      const direction = t.direction === 'long' ? '做多' : '做空';
      const cls = r.verdict;
      const entry = '$' + (t.entry_low || 0).toLocaleString() + ' – $' + (t.entry_high || 0).toLocaleString();
      const stop = '$' + (t.stop || 0).toLocaleString();
      const t1 = t.target1 ? '$' + t.target1.toLocaleString() : '—';
      const t2 = t.target2 ? '$' + t.target2.toLocaleString() : '—';
      const size = (t.size_cny || 0).toLocaleString() + ' 元';
      const exitHtml = this.esc(t.exit_strategy || "未定义");

      const borderColor = confirmVal === true ? 'var(--green)' : (confirmVal === false ? 'var(--red)' : '');
      const confirmClass = confirmVal === true ? ' confirmed' : (confirmVal === false ? ' rejected' : '');
      const boxShadow = confirmVal === true ? '0 0 16px rgba(34,197,94,.12)' : (confirmVal === false ? 'none' : '');
            html += '<div class="trade-card ' + cls + confirmClass + '"' +
        ' style="' +
        (borderColor ? 'border-left:3px solid ' + borderColor + ';' : '') +
        (boxShadow !== 'none' ? 'box-shadow:' + boxShadow + ';' : '') +
        (confirmVal === false ? 'opacity:0.35;filter:grayscale(.6);' : '') +
        '">';

      // 头部: 复选框 + 品种 + 方向 + 判定 + 人工确认状态
      html += '<div class="trade-header">';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<input type="checkbox" class="trade-select" data-key="' + selectedKey + '" ' + (isSelected ? 'checked' : '') + ' style="width:14px;height:14px;cursor:pointer">';
      html += '<span class="trade-symbol">' + this.esc(t && t.symbol || '标的 #' + (i + 1)) + '</span>';
      html += '<span class="trade-direction ' + t.direction + '">' + direction + '</span>';
      html += '<span style="font-size:13px;color:#64748B;margin-left:4px">' + this.esc(t.strategy || '') + '</span>';
      html += '</div>';
      html += '<span class="trade-verdict ' + cls + '">' + (cls==='pass'?'✅ 通过':cls==='warn'?'⚠️ 存疑':'❌ 违规') + '</span>';
      html += '</div>';

      // 详情
      html += '<div class="trade-details">';
      html += '<div><div class="trade-detail-label">入场区间</div><div class="trade-detail-value">' + entry + '</div></div>';
      html += '<div><div class="trade-detail-label">止损</div><div class="trade-detail-value">' + stop + '</div></div>';
      html += '<div><div class="trade-detail-label">目标 1 / 2</div><div class="trade-detail-value">' + t1 + ' / ' + t2 + '</div></div>';
      html += '<div><div class="trade-detail-label">仓位</div><div class="trade-detail-value">' + size + '</div></div>';
      html += '</div>';

      // 离场策略
      html += '<div style="margin-top:12px;margin-bottom:4px;font-size:12px;color:#64748B;font-weight:500">🗺️ 离场策略</div>';
      html += '<div style="font-size:13px;color:#94A3B8;background:rgba(255,255,255,0.02);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);margin-bottom:12px">' + exitHtml + '</div>';

      // 回测
      const btBg = t.backtest;
      if (btBg && btBg.total_trades > 0) {
        html += '<div style="margin-top:10px;padding:8px 12px;background:rgba(88,166,255,0.06);border-radius:8px;border:1px solid rgba(88,166,255,0.15)">';
        html += '<div style="font-size:11px;color:#58a6ff;font-weight:500;margin-bottom:4px">📊 回测参考</div>';
        html += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#94A3B8">';
        html += '<span>胜率 ' + (btBg.win_rate || '?') + '%</span>';
        html += '<span>年化 ' + (btBg.annualized || '?') + '%</span>';
        html += '<span>最大回撤 ' + (btBg.max_drawdown || '?') + '%</span>';
        html += '<span>Sharp ' + (btBg.sharpe || '?') + '</span>';
        html += '<span>' + (btBg.total_trades || 0) + '笔</span>';
        html += '<span>' + (btBg.period || '') + '</span></div>';
        html += '<div style="font-size:10px;color:#475569;margin-top:3px">来源: ' + (btBg.source || '未标注') + '</div></div>';
      }

      // 检查项
      html += '<div class="trade-checks">';
      r.checks.forEach(c => {
        const icon = c.status === 'pass' ? '✅' : (c.status === 'warn' ? '⚠️' : '❌');
        html += '<div class="check-row ' + c.status + '"><span class="check-icon">' + icon + '</span><span class="check-text">' + this.esc(c.text) + '</span></div>';
      });
      html += '</div>';

      // 操作按钮
      html += '<div style="display:flex;gap:6px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05)">';
      html += '<button class="btn confirm-btn" data-action="confirmTrade" data-idx="' + i + '" data-value="true" style="border-color:var(--green);color:var(--green);font-size:11px;padding:4px 10px">✅ 人工确认</button>';
      html += '<button class="btn confirm-btn" data-action="confirmTrade" data-idx="' + i + '" data-value="false" style="border-color:var(--red);color:var(--red);font-size:11px;padding:4px 10px">🔄 驳回</button>';
      html += '<button class="btn confirm-btn" data-action="confirmTrade" data-idx="' + i + '" data-value="null" style="border-color:var(--text-muted);color:var(--text-dim);font-size:11px;padding:4px 10px">↩ 撤销</button>';
      html += '<span class="confirm-status" data-idx="' + i + '" style="font-size:11px;color:var(--text-dim);margin-left:4px;font-weight:500">' +
        (confirmVal === true ? '✅ 已确认' : confirmVal === false ? '🔄 已驳回' : '') + '</span>';
      // 追踪
      const tracked = Store.state.tracker.find(tx => tx.id === (modelId + '_' + i));
      html += '<button class="btn confirm-btn" data-action="trackTrade" data-idx="' + i + '" style="margin-left:auto;font-size:10px;padding:4px 8px;border-color:var(--cyan);color:var(--cyan)">' +
        (tracked ? '📒 已追踪' : '📒 追踪此交易') + '</button>';
      html += '</div>';

      html += '</div>';
    });

    if (trades.length > MAX_RENDER) {
      html += '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:11px;background:var(--surface);border-radius:8px;margin-top:8px">显示前 ' + MAX_RENDER + ' / ' + trades.length + ' 笔交易，更多请分模型查看</div>';
    }
    return html || '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:13px">没有匹配的交易</div>';
  },

  // ----- 统计面板 -----
  renderStats(audited) {
    let nPass = 0, nWarn = 0, nFail = 0;
    audited.forEach(r => { if (r.verdict === 'pass') nPass++; else if (r.verdict === 'warn') nWarn++; else nFail++; });
    return { total: audited.length, pass: nPass, warn: nWarn, fail: nFail };
  },

  // ----- 筛选摘要 -----
  renderFilterSummary(trades, audited, modelId) {
    const s = Store.state;
    const total = trades.length;
    const confirmed = trades.filter((_, i) => Store.getConfirm(modelId, i) === true).length;
    const rejected = trades.filter((_, i) => Store.getConfirm(modelId, i) === false).length;
    const pending = total - confirmed - rejected;
    return { total, confirmed, rejected, pending };
  },

  // ----- 组合信息 -----
  renderPortfolio(pf) {
    if (!pf) return '';
    const used = pf.total - (pf.cash || 0);
    const usedPct = used / pf.total * 100;
    const fillClass = usedPct > 70 ? 'red' : (usedPct > 50 ? 'yellow' : 'green');
    const barW = Math.min(usedPct, 100);
    return '<div class="portfolio-item"><span class="portfolio-label">总本金</span><span class="portfolio-value">¥' + (pf.total || 0).toLocaleString() + '</span></div>' +
      '<div class="portfolio-item"><span class="portfolio-label">可用现金</span><span class="portfolio-value">¥' + (pf.cash || 0).toLocaleString() + '</span></div>' +
      '<div class="portfolio-item"><span class="portfolio-label">已使用</span><span class="portfolio-value">¥' + used.toLocaleString() + ' (' + usedPct.toFixed(0) + '%)</span></div>' +
      '<div style="margin-top:4px"><div class="progress-bar"><div class="progress-fill ' + fillClass + '" style="width:' + barW + '%"></div></div></div>' +
      '<div class="portfolio-item" style="margin-top:12px"><span class="portfolio-label">同向持仓数</span><span class="portfolio-value">' + (pf.same_direction || 0) + ' 笔</span></div>' +
      '<div class="portfolio-item"><span class="portfolio-label">同向持仓上限</span><span class="portfolio-value">' + ((pf.same_direction || 0) * 20) + '%</span></div>';
  },

  // ----- 完整渲染入口 -----
  render(modelId) {
    const data = Store.getModelTrades(modelId);
    if (!data) return;
    if (!data.trades || !Array.isArray(data.trades)) {
      document.getElementById('tradesList').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:13px">数据格式异常，无法渲染</div>';
      return;
    }
    const total = (data.portfolio && data.portfolio.total) || 10000;
    const trades = data.trades || [];
    const audited = Auditor.auditAll(trades, total);
    const stats = this.renderStats(audited);

    // 更新统计
    document.getElementById('statsGrid').style.display = 'grid';
    document.getElementById('totalTrades').textContent = trades.length;
    document.getElementById('passCount').textContent = stats.pass;
    document.getElementById('warnCount').textContent = stats.warn;
    document.getElementById('failCount').textContent = stats.fail;

    // 显示主区域
    document.getElementById('mainContent').style.display = 'grid';
    document.getElementById('comparisonView').style.display = 'none';
    document.getElementById('modelAnalysis').style.display = 'block';

    // 渲染交易列表
    const listEl = document.getElementById('tradesList');
    listEl.innerHTML = this.renderTrades(modelId, trades, audited, total);

    // 更新筛选摘要
    this.updateFilterUI(modelId, trades, audited);

    // 更新批量操作栏
    this.updateBatchBar();

    // 组合信息
    if (data.portfolio) {
      document.getElementById('sidebarPortfolio').style.display = 'block';
      document.getElementById('portfolioContent').innerHTML = this.renderPortfolio(data.portfolio);
    }
  },

  // ----- 筛选 UI 更新 -----
  updateFilterUI(modelId, trades, audited) {
    const summary = this.renderFilterSummary(trades, audited, modelId);
    document.getElementById('filterSummary').textContent =
      '共 ' + summary.total + ' 笔 · ✅已确认 ' + summary.confirmed + ' · 🔄已驳回 ' + summary.rejected + ' · ⏳待处理 ' + summary.pending;
    // 更新筛选按钮状态
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const f = btn.dataset.filter;
      btn.classList.toggle('active', f === Store.state.filter);
    });
  },

  // ----- 批量操作栏更新 -----
  updateBatchBar() {
    const bar = document.getElementById('batchBar');
    const count = Store.state.selected.size;
    if (count > 0) {
      bar.style.display = 'flex';
      document.getElementById('batchCount').textContent = '已选 ' + count + ' 笔';
    } else {
      bar.style.display = 'none';
    }
  },

  // ============================================================
  // 多模型对比看板
  // ============================================================
  renderComparison() {
    const s = Store.state;
    const activeModels = MODEL_KEYS.filter(k => s.models[k] && s.models[k].data);
    if (activeModels.length === 0) { alert('还没有保存任何模型的结果，请先粘贴并审计'); return; }

    const allSymbols = {};
    activeModels.forEach(k => {
      const data = Store.getModelTrades(k);
      if (!data) return;
      const trades = data.trades || [];
      trades.forEach(t => {
        const sym = t.symbol || 'UNKNOWN';
        if (!allSymbols[sym]) allSymbols[sym] = {};
        allSymbols[sym][k] = t;
      });
    });

    const sortedSymbols = Object.keys(allSymbols).sort();
    const esc = s => this.esc(s);
    const mn = k => MODEL_LABELS[k].split(' ')[0];

    // 计算逐品种指标
    const symMetrics = {};
    sortedSymbols.forEach(sym => {
      const sm = {models:{}, dirs:{long:0, short:0}, total:0};
      activeModels.forEach(k => {
        const t = allSymbols[sym][k];
        if (!t) return;
        sm.total++;
        const d = (t.direction || '').toLowerCase();
        if (d === 'long' || d === 'buy') sm.dirs.long++;
        else if (d === 'short' || d === 'sell') sm.dirs.short++;

        const entry = t.entry_low ? (t.entry_low + (t.entry_high||t.entry_low))/2 : null;
        const stop = t.stop || null;
        const t1 = t.target1 || null;
        const t2 = t.target2 || null;
        const rr = t.claimed_rr || null;
        const size = parseFloat(t.size_cny) || 0;
        const exitOk = t.exit_strategy && t.exit_strategy.length > 8;
        const falOk = t.falsification && t.falsification.length > 5;
        const anchorOk = t.anchors && t.anchors.stop && t.anchors.stop.length > 3;

        sm.models[k] = {dir:d, entry, stop, t1, t2, rr, size, exitOk, falOk, anchorOk, _raw:t};
      });

      const maxDir = Math.max(sm.dirs.long, sm.dirs.short);
      sm.consensus = sm.total > 0 ? maxDir / sm.total : 0;
      sm.consensusDir = sm.dirs.long > sm.dirs.short ? 'long' : (sm.dirs.short > sm.dirs.long ? 'short' : 'tie');
      sm.divergence = sm.total >= 3 ? 1 - sm.consensus : 0;
      symMetrics[sym] = sm;
    });

    // 模型人格
    const modelPersonality = {};
    activeModels.forEach(k => {
      const mp = {syms:0, longs:0, shorts:0, entries:[], stops:[], rrs:[], sizes:[], anchorOk:0, falOk:0, exitOk:0};
      sortedSymbols.forEach(sym => {
        const m = symMetrics[sym].models[k];
        if (!m) return;
        mp.syms++;
        if (m.dir === 'long' || m.dir === 'buy') mp.longs++; else mp.shorts++;
        if (m.entry) mp.entries.push(m.entry);
        if (m.stop) mp.stops.push(m.stop);
        if (m.rr) mp.rrs.push(m.rr);
        if (m.size > 0) mp.sizes.push(m.size);
        if (m.anchorOk) mp.anchorOk++;
        if (m.falOk) mp.falOk++;
        if (m.exitOk) mp.exitOk++;
      });
      mp.avgRR = mp.rrs.length > 0 ? mp.rrs.reduce((a,b) => a+b, 0) / mp.rrs.length : 0;
      mp.anchorRate = mp.syms > 0 ? mp.anchorOk / mp.syms : 0;
      mp.falRate = mp.syms > 0 ? mp.falOk / mp.syms : 0;
      mp.exitRate = mp.syms > 0 ? mp.exitOk / mp.syms : 0;
      mp.bullPct = mp.syms > 0 ? mp.longs / mp.syms : 0;
      mp.totalRiskScore = (mp.anchorRate + mp.falRate + mp.exitRate) / 3;
      modelPersonality[k] = mp;
    });

    // 分歧排名
    const sortedByDivergence = sortedSymbols.slice().sort((a, b) => symMetrics[b].divergence - symMetrics[a].divergence);
    const topDivergent = sortedByDivergence.filter(s => symMetrics[s].divergence > 0.3).slice(0, 5);

    // KPI
    const consensusSyms = sortedSymbols.filter(s => symMetrics[s].consensus >= 0.6).length;
    const totalTrades = sortedSymbols.reduce((a, s) => a + symMetrics[s].total, 0);
    let avgRRAll = 0, rrCnt = 0;
    sortedSymbols.forEach(sym => {
      activeModels.forEach(k => {
        const m = symMetrics[sym].models[k];
        if (m && m.rr) { avgRRAll += m.rr; rrCnt++; }
      });
    });
    avgRRAll = rrCnt > 0 ? avgRRAll / rrCnt : 0;

    // --- 开始构建 HTML ---
    let h = '<div class="bi-dashboard">';

    // 头部
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    h += '<div style="display:flex;align-items:center;gap:10px">';
    h += '<span style="font-size:15px;font-weight:700">📊 多模型对比决策看板</span>';
    h += '<span class="badge" style="font-size:10px;background:rgba(88,166,255,.12);color:#58a6ff">' + activeModels.length + '/' + MODEL_KEYS.length + ' 模型</span></div>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="btn btn-secondary" data-action="backToModel" style="font-size:11px;padding:5px 12px">← 返回编辑</button></div></div>';

    // KPI 卡片
    const consensusPct = sortedSymbols.length > 0 ? (consensusSyms / sortedSymbols.length * 100).toFixed(0) : 0;
    h += '<div class="bi-kpi-grid">';
    h += '<div class="bi-kpi-card"><div class="kpi-label">关注品种</div><div class="kpi-value" style="color:#38BDF8">' + sortedSymbols.length + '</div><div class="kpi-sub">全部模型覆盖</div></div>';
    h += '<div class="bi-kpi-card"><div class="kpi-label">总交易机会</div><div class="kpi-value" style="color:#E2E8F0">' + totalTrades + '</div><div class="kpi-sub">全部模型合计</div></div>';
    h += '<div class="bi-kpi-card"><div class="kpi-label">方向共识率</div><div class="kpi-value" style="color:' + (consensusPct>=60?'#22C55E':'#d29922') + '">' + consensusPct + '%</div><div class="kpi-sub">' + consensusSyms + '/' + sortedSymbols.length + ' 品种共识</div></div>';
    h += '<div class="bi-kpi-card"><div class="kpi-label">平均盈亏比</div><div class="kpi-value" style="color:' + (avgRRAll>=2?'#22C55E':'#d29922') + '">' + avgRRAll.toFixed(1) + ':1</div><div class="kpi-sub">全模型平均</div></div>';
    h += '<div class="bi-kpi-card"><div class="kpi-label">模型分歧数</div><div class="kpi-value" style="color:' + (topDivergent.length>0?'#EF4444':'#22C55E') + '">' + topDivergent.length + '</div><div class="kpi-sub">分歧 ≥40% 品种</div></div>';
    h += '</div>';

    // 对比洞察
    const topBull = activeModels.slice().sort((a, b) => modelPersonality[b].bullPct - modelPersonality[a].bullPct)[0];
    const topBear = activeModels.slice().sort((a, b) => modelPersonality[a].bullPct - modelPersonality[b].bullPct)[0];
    const topAnchor = activeModels.slice().sort((a, b) => modelPersonality[b].anchorRate - modelPersonality[a].anchorRate)[0];
    const topRR = activeModels.slice().sort((a, b) => modelPersonality[b].avgRR - modelPersonality[a].avgRR)[0];

    h += '<div class="bi-section" style="border-left:3px solid var(--accent)">';
    h += '<div class="bi-section-title">🧠 对比洞察<span class="badge">AI分析</span></div>';
    h += '<div style="font-size:11px;color:#94A3B8;line-height:1.7">';
    h += '📌 方向共识：' + consensusPct + '% 的品种达成方向一致（' + consensusSyms + '/' + sortedSymbols.length + '），' + (consensusPct>=60?'整体一致性较高，可重点关注共识方向。':'分歧较大，需谨慎对待非共识品种。') + '<br>';
    h += '📌 多空倾向：最看多的是 <b style="color:'+MODEL_COLORS[topBull]+'">' + mn(topBull) + '</b>（多头率 ' + (modelPersonality[topBull].bullPct*100).toFixed(0) + '%），最看空的是 <b style="color:'+MODEL_COLORS[topBear]+'">' + mn(topBear) + '</b>（多头率 ' + (modelPersonality[topBear].bullPct*100).toFixed(0) + '%）<br>';
    h += '📌 风控质量：' + mn(topAnchor) + ' 的风控描述最完整（锚定率 ' + (modelPersonality[topAnchor].anchorRate*100).toFixed(0) + '%），' + mn(topRR) + ' 的盈亏比最高（均值 ' + modelPersonality[topRR].avgRR.toFixed(1) + ':1）<br>';
    if (topDivergent.length > 0) {
      h += '📌 <span style="color:#EF4444">⚠️ 最大分歧品种：' + topDivergent.slice(0,3).map(s => s).join('、') + '</span>，建议重点对比各模型判断依据再决策<br>';
    }
    h += '</div></div>';

    // 分歧预警
    if (topDivergent.length > 0) {
      h += '<div class="bi-section" style="border-left:3px solid #EF4444">';
      h += '<div class="bi-section-title">⚠️ 分歧预警<span class="badge" style="background:rgba(239,68,68,.12);color:#EF4444">需重点关注</span></div>';
      topDivergent.slice(0, 3).forEach(sym => {
        const sm = symMetrics[sym];
        h += '<div class="bi-reco-card" style="margin-top:6px">';
        h += '<div class="r-header"><span class="r-sym">' + esc(sym) + '</span>';
        h += '<span style="font-size:11px;color:#EF4444;font-weight:500">共识率仅 ' + (sm.consensus*100).toFixed(0) + '%</span></div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">';
        activeModels.forEach(k => {
          const m = sm.models[k];
          if (!m) return;
          const dirIcon = (m.dir==='long'||m.dir==='buy') ? '🟢' : '🔴';
          const entryStr = m.entry ? '$'+Number(m.entry).toLocaleString() : '—';
          const stopStr = m.stop ? '$'+Number(m.stop).toLocaleString() : '—';
          const rrStr = m.rr ? m.rr.toFixed(1)+':1' : '—';
          h += '<span style="font-size:10px;color:'+MODEL_COLORS[k]+';padding:4px 8px;background:'+MODEL_COLORS[k]+'12;border-radius:4px;font-weight:500;white-space:nowrap">';
          h += mn(k) + ' ' + dirIcon + '入场' + entryStr + ' 止损' + stopStr + ' RR' + rrStr + '</span>';
        });
        h += '</div></div>';
      });
      h += '</div>';
    }

    // 最终决策排行
    h += '<div class="bi-section" style="border-left:3px solid #22C55E">';
    h += '<div class="bi-section-title">🏆 最终决策排行<span class="badge" style="background:rgba(34,197,94,.12);color:#22C55E">优先级排序</span></div>';

    const rankings = [];
    sortedSymbols.forEach(sym => {
      const sm = symMetrics[sym];
      let entrySum = 0, entryCnt = 0, rrSum = 0, rrCnt = 0;
      let anchorOk = 0, falOk = 0, exitOk = 0, modelsCount = 0;
      activeModels.forEach(k => {
        const m = sm.models[k];
        if (!m) return;
        modelsCount++;
        if (m.entry) { entrySum += m.entry; entryCnt++; }
        if (m.rr) { rrSum += m.rr; rrCnt++; }
        if (m.anchorOk) anchorOk++;
        if (m.falOk) falOk++;
        if (m.exitOk) exitOk++;
      });
      const avgEntry = entryCnt > 0 ? entrySum / entryCnt : 0;
      const avgRR = rrCnt > 0 ? rrSum / rrCnt : 0;
      const riskPct = modelsCount > 0 ? (anchorOk + falOk + exitOk) / (modelsCount * 3) : 0;
      const coverage = activeModels.length > 0 ? modelsCount / activeModels.length : 0;
      const score = (sm.consensus * 0.35) + (Math.min(avgRR / 3.5, 1) * 0.25) + (riskPct * 0.25) + (coverage * 0.15);

      rankings.push({
        sym, score: score, scorePct: (score * 100).toFixed(0),
        consensus: sm.consensus, consensusDir: sm.consensusDir,
        avgEntry, avgRR, riskPct, modelsCount, totalModels: activeModels.length
      });
    });
    rankings.sort((a, b) => b.score - a.score);

    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    h += '<tr style="color:#94A3B8;font-size:10px;border-bottom:1px solid var(--border)">';
    h += '<th style="padding:6px 8px;text-align:center">#</th><th style="padding:6px 8px;text-align:left">品种</th>';
    h += '<th style="padding:6px 8px;text-align:center">方向</th><th style="padding:6px 8px;text-align:center">共识</th>';
    h += '<th style="padding:6px 8px;text-align:center">均价</th><th style="padding:6px 8px;text-align:center">平均RR</th>';
    h += '<th style="padding:6px 8px;text-align:center">风控</th><th style="padding:6px 8px;text-align:center">覆盖</th>';
    h += '<th style="padding:6px 8px;text-align:center">评分</th><th style="padding:6px 8px;text-align:center">建议</th></tr>';

    rankings.forEach((r, idx) => {
      const rank = idx + 1;
      const rankIcon = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : '  '));
      const dirStr = r.consensusDir === 'long' ? '🟢做多' : (r.consensusDir === 'short' ? '🔴做空' : '⚪观望');
      const dirColor = r.consensusDir === 'long' ? '#22C55E' : (r.consensusDir === 'short' ? '#EF4444' : '#94A3B8');
      const consPct = (r.consensus * 100).toFixed(0);
      const consColor = r.consensus >= 0.8 ? '#22C55E' : (r.consensus >= 0.6 ? '#d29922' : '#EF4444');
      const riskPct = (r.riskPct * 100).toFixed(0);
      const riskColor = r.riskPct >= 0.7 ? '#22C55E' : (r.riskPct >= 0.4 ? '#d29922' : '#EF4444');

      let suggestion = '', sugColor = '';
      if (rank === 1 && r.score >= 0.65) { suggestion = '⭐强烈推荐'; sugColor = '#22C55E'; }
      else if (rank <= 2 && r.score >= 0.55) { suggestion = '✅优先考虑'; sugColor = '#38BDF8'; }
      else if (r.consensus >= 0.6 && r.score >= 0.5) { suggestion = '📌可关注'; sugColor = '#d29922'; }
      else if (r.consensusDir === 'tie' || r.consensus < 0.6) { suggestion = '⚠️待观察'; sugColor = '#EF4444'; }
      else { suggestion = '💤可跳过'; sugColor = '#475569'; }

      const bgColor = rank === 1 ? 'rgba(34,197,94,.04)' : 'transparent';
      h += '<tr style="border-bottom:1px solid rgba(255,255,255,.03);background:' + bgColor + '">';
      h += '<td style="padding:8px;text-align:center;font-size:16px">' + rankIcon + '</td>';
      h += '<td style="padding:8px;text-align:left;font-weight:700">' + esc(r.sym) + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600;color:' + dirColor + '">' + dirStr + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600;color:' + consColor + '">' + consPct + '%</td>';
      h += '<td style="padding:8px;text-align:center;font-family:monospace;font-size:10px">' + (r.avgEntry ? '$' + Number(r.avgEntry).toLocaleString() : '—') + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600">' + r.avgRR.toFixed(1) + ':1</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600;color:' + riskColor + '">' + riskPct + '%</td>';
      h += '<td style="padding:8px;text-align:center;font-size:11px">' + r.modelsCount + '/' + r.totalModels + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:700;font-size:15px;color:' + sugColor + '">' + r.scorePct + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600;font-size:11px;color:' + sugColor + ';white-space:nowrap">' + suggestion + '</td>';
      h += '</tr>';
    });
    h += '</table></div></div>';

    // 逐品种对比
    h += '<div class="bi-section">';
    h += '<div class="bi-section-title">🔬 逐品种模型对比<span class="badge">详细数据</span></div>';
    sortedSymbols.forEach(sym => {
      const sm = symMetrics[sym];
      const consensusLabel = sm.consensusDir === 'long' ? '🟢' : (sm.consensusDir === 'short' ? '🔴' : '⚪');
      const consensusColor = sm.consensus >= 0.8 ? '#22C55E' : (sm.consensus >= 0.6 ? '#d29922' : '#EF4444');
      h += '<details style="margin-top:6px"><summary style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface2);border-radius:6px;font-size:12px">';
      h += '<span style="flex:1;font-weight:600">' + esc(sym) + '</span>';
      h += '<span style="font-size:10px;color:' + consensusColor + ';font-weight:500">共识 ' + (sm.consensus*100).toFixed(0) + '% ' + consensusLabel + '</span>';
      h += '<span style="font-size:10px;color:#94A3B8">' + sm.total + ' 模型</span></summary>';
      h += '<div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:620px">';
      h += '<tr style="color:#94A3B8;font-size:10px;border-bottom:1px solid var(--border)">';
      h += '<th style="padding:6px 8px;text-align:left">模型</th><th style="padding:6px 8px">方向</th><th style="padding:6px 8px">入场</th>';
      h += '<th style="padding:6px 8px">止损</th><th style="padding:6px 8px">目标1</th><th style="padding:6px 8px">目标2</th>';
      h += '<th style="padding:6px 8px">RR</th><th style="padding:6px 8px">仓位</th>';
      h += '<th style="padding:6px 8px">锚定</th><th style="padding:6px 8px">证伪</th><th style="padding:6px 8px">离场</th></tr>';
      activeModels.forEach(k => {
        const m = sm.models[k];
        if (!m) return;
        const raw = m._raw;
        const dirIcon2 = (m.dir==='long'||m.dir==='buy') ? '🟢做多' : (m.dir==='short'||m.dir==='sell') ? '🔴做空' : '⚪';
        const eL = raw && raw.entry_low ? '$' + Number(raw.entry_low).toLocaleString() : '—';
        const eH = raw && raw.entry_high ? '$' + Number(raw.entry_high).toLocaleString() : '';
        const entryStr2 = eL + (eH !== '—' && eH !== '' ? ' ~ ' + eH : '');
        const stopStr2 = m.stop ? '$' + Number(m.stop).toLocaleString() : '—';
        const t1Str = m.t1 ? '$' + Number(m.t1).toLocaleString() : '—';
        const t2Str = m.t2 ? '$' + Number(m.t2).toLocaleString() : '—';
        const rrStr2 = m.rr ? m.rr.toFixed(1) + ':1' : '—';
        const sizeStr = m.size > 0 ? '¥' + m.size : '—';
        h += '<tr style="border-bottom:1px solid rgba(255,255,255,.03)">';
        h += '<td style="padding:6px 8px;color:'+MODEL_COLORS[k]+';font-weight:600;white-space:nowrap">'+mn(k)+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:12px">'+dirIcon2+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-family:JetBrains Mono,monospace;font-size:10px">'+entryStr2+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-family:JetBrains Mono,monospace;font-size:10px;color:'+(m.stop?'#EF4444':'#475569')+'">'+stopStr2+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-family:JetBrains Mono,monospace;font-size:10px">'+t1Str+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-family:JetBrains Mono,monospace;font-size:10px">'+t2Str+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-weight:600;color:'+(m.rr&&m.rr>=2?'#22C55E':'#d29922')+'">'+rrStr2+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-size:10px">'+sizeStr+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-size:11px">'+(m.anchorOk?'✅':'❌')+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-size:11px">'+(m.falOk?'✅':'❌')+'</td>';
        h += '<td style="padding:6px 8px;text-align:center;font-size:11px">'+(m.exitOk?'✅':'❌')+'</td>';
        h += '</tr>';
      });
      h += '</table></div></details>';
    });
    h += '</div>';

    // 模型人格画像
    h += '<div class="bi-section">';
    h += '<div class="bi-section-title">🎭 模型人格画像<span class="badge">倾向分析</span></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">';
    activeModels.forEach(k => {
      const mp = modelPersonality[k];
      const bullLabel = mp.bullPct >= 0.7 ? '🟢 强烈看多' : (mp.bullPct >= 0.4 ? '⚪ 中性偏'+(mp.longs>mp.shorts?'多':'空') : '🔴 强烈看空');
      const riskLabel = mp.totalRiskScore >= 0.7 ? '✅ 严谨' : (mp.totalRiskScore >= 0.4 ? '⚠️ 一般' : '❌ 粗糙');
      const rrLabel = mp.avgRR >= 2.5 ? '激进' : (mp.avgRR >= 1.8 ? '平衡' : '保守');
      h += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px">';
      h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
      h += '<span style="width:8px;height:8px;border-radius:50%;background:'+MODEL_COLORS[k]+';display:inline-block"></span>';
      h += '<span style="font-size:12px;font-weight:600;color:'+MODEL_COLORS[k]+'">'+MODEL_LABELS[k]+'</span></div>';
      h += '<div style="font-size:10px;color:#94A3B8;line-height:1.7">';
      h += '<div>方向：' + bullLabel + '（' + mp.longs + '多/' + mp.shorts + '空）</div>';
      h += '<div>风格：' + rrLabel + '（平均RR ' + mp.avgRR.toFixed(1) + ':1）</div>';
      h += '<div>风控：' + riskLabel + '（锚定' + (mp.anchorRate*100).toFixed(0) + '% / 证伪' + (mp.falRate*100).toFixed(0) + '% / 离场' + (mp.exitRate*100).toFixed(0) + '%）</div>';
      h += '</div></div>';
    });
    h += '</div></div>';

    // 雷达图 + RR柱
    h += '<div class="bi-grid-2">';
    // 雷达图
    h += '<div class="bi-section">';
    h += '<div class="bi-section-title">🛡️ 风控完整度<span class="badge">百分比雷达</span></div>';
    const rfLabels = ['锚定依据','证伪条件','离场策略','盈亏比≥2'];
    const radarCX = 95, radarCY = 95, radarR = 65;
    h += '<svg width="100%" viewBox="0 0 190 220" style="display:block;margin:0 auto;font-family:inherit">';
    for (let fi = 0; fi < rfLabels.length; fi++) {
      const angle = (Math.PI * 2 * fi / rfLabels.length) - Math.PI/2;
      const x1 = radarCX + radarR * Math.cos(angle);
      const y1 = radarCY + radarR * Math.sin(angle);
      h += '<line x1="' + radarCX + '" y1="' + radarCY + '" x2="' + x1 + '" y2="' + y1 + '" stroke="#283040" stroke-width="1"/>';
      const lx = radarCX + (radarR + 14) * Math.cos(angle);
      const ly = radarCY + (radarR + 14) * Math.sin(angle);
      h += '<text x="' + lx + '" y="' + ly + '" fill="#94A3B8" font-size="7" text-anchor="middle" dominant-baseline="middle">' + rfLabels[fi] + '</text>';
    }
    for (let ri = 1; ri <= 3; ri++) {
      const r = radarR * ri / 3;
      let d = '';
      for (let fi = 0; fi <= rfLabels.length; fi++) {
        const angle = (Math.PI * 2 * fi / rfLabels.length) - Math.PI/2;
        const gx = radarCX + r * Math.cos(angle);
        const gy = radarCY + r * Math.sin(angle);
        d += (fi === 0 ? 'M' : 'L') + gx + ',' + gy;
      }
      h += '<path d="' + d + '" fill="none" stroke="#1a2332" stroke-width="1"/>';
    }
    activeModels.forEach(k => {
      const mp = modelPersonality[k];
      const vals = [mp.anchorRate, mp.falRate, mp.exitRate, Math.min(mp.avgRR/3, 1)];
      let d = '';
      for (let fi = 0; fi < rfLabels.length; fi++) {
        const angle = (Math.PI * 2 * fi / rfLabels.length) - Math.PI/2;
        const r = radarR * vals[fi];
        const gx = radarCX + r * Math.cos(angle);
        const gy = radarCY + r * Math.sin(angle);
        d += (fi === 0 ? 'M' : 'L') + gx + ',' + gy;
      }
      d += 'Z';
      const mc = MODEL_COLORS[k];
      h += '<path d="' + d + '" fill="' + mc + '" fill-opacity="0.08" stroke="' + mc + '" stroke-width="1.5" stroke-opacity="0.5"/>';
      for (let fi = 0; fi < rfLabels.length; fi++) {
        const angle = (Math.PI * 2 * fi / rfLabels.length) - Math.PI/2;
        const r = radarR * vals[fi];
        const gx = radarCX + r * Math.cos(angle);
        const gy = radarCY + r * Math.sin(angle);
        h += '<circle cx="' + gx + '" cy="' + gy + '" r="2.5" fill="' + mc + '"/>';
      }
    });
    h += '</svg><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:4px">';
    activeModels.forEach(k => {
      h += '<span style="font-size:9px;color:'+MODEL_COLORS[k]+';font-weight:500">● ' + mn(k) + '</span>';
    });
    h += '</div></div>';

    // RR柱状图
    h += '<div class="bi-section">';
    h += '<div class="bi-section-title">📈 盈亏比与风控得分<span class="badge">模型对比</span></div>';
    const rrChartData = activeModels.map(k => {
      const mp = modelPersonality[k];
      return {key: k, rr: mp.avgRR, risk: mp.totalRiskScore, cnt: mp.syms};
    });
    let maxRRVal = Math.max(...rrChartData.map(d => d.rr)) || 2.5;
    if (maxRRVal < 2) maxRRVal = 2.5;
    const chartH2 = 130, chartW2 = 280;
    const barW2 = Math.min(32, (chartW2 / rrChartData.length - 6));
    h += '<svg width="100%" viewBox="0 0 ' + chartW2 + ' ' + chartH2 + '" style="font-family:inherit;display:block;margin:0 auto">';
    const thY2 = (1 - 2.0 / (maxRRVal * 1.4)) * (chartH2 - 25);
    h += '<line x1="0" y1="' + thY2 + '" x2="' + chartW2 + '" y2="' + thY2 + '" stroke="#d29922" stroke-width="1" stroke-dasharray="4,3"/>';
    h += '<text x="' + (chartW2-2) + '" y="' + (thY2-3) + '" fill="#d29922" font-size="7" text-anchor="end">RR=2.0</text>';
    rrChartData.forEach((d, i) => {
      const barH = (d.rr / (maxRRVal * 1.4)) * (chartH2 - 25);
      const x = 16 + i * (chartW2 / rrChartData.length);
      const c = MODEL_COLORS[d.key];
      h += '<rect x="' + x + '" y="' + (chartH2 - 25 - barH) + '" width="' + barW2 + '" height="' + barH + '" fill="' + c + '" rx="2" opacity="0.85"/>';
      h += '<text x="' + (x + barW2/2) + '" y="' + (chartH2 - 28 - barH) + '" fill="' + c + '" font-size="9" text-anchor="middle" font-weight="600">' + d.rr.toFixed(1) + '</text>';
      h += '<text x="' + (x + barW2/2) + '" y="' + (chartH2 - 8) + '" fill="#94A3B8" font-size="7" text-anchor="middle">' + mn(d.key) + '</text>';
    });
    h += '</svg>';
    h += '<div style="margin-top:8px;padding:0 8px">';
    activeModels.forEach(k => {
      const mp = modelPersonality[k];
      const pct = mp.totalRiskScore * 100;
      h += '<div class="bi-bar"><span class="label" style="min-width:60px;color:'+MODEL_COLORS[k]+'">'+mn(k)+'</span>';
      h += '<div class="track"><div class="fill" style="width:'+pct+'%;background:'+MODEL_COLORS[k]+';opacity:0.7"></div></div>';
      h += '<span class="val">'+pct.toFixed(0)+'%</span></div>';
    });
    h += '</div></div></div>'; // close grid-2
    h += '</div>'; // close bi-dashboard

    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('statsGrid').style.display = 'none';
    document.getElementById('modelAnalysis').style.display = 'none';
    document.getElementById('comparisonView').innerHTML = h;
    document.getElementById('comparisonView').style.display = 'block';
  },

  // ============================================================
  // 追踪账本渲染
  // ============================================================
  renderTracker() {
    const tracker = Store.state.tracker;
    if (!tracker || tracker.length === 0) {
      document.getElementById('trackerContent').innerHTML =
        '<div style="text-align:center;padding:60px 20px;color:var(--text-dim)"><div style="font-size:32px;margin-bottom:10px">📒</div><div style="font-size:13px">暂无追踪的交易</div><div style="font-size:10px;color:#475569;margin-top:4px">在审计台中点击「追踪此交易」添加</div></div>';
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:10px">';
    tracker.forEach((t, i) => {
      const direction = t.direction === 'long' ? '做多' : '做空';
      const entry = '$' + (t.entry_low || 0).toLocaleString() + ' – $' + (t.entry_high || 0).toLocaleString();
      const stop = '$' + (t.stop || 0).toLocaleString();
      const t1 = t.target1 ? '$' + t.target1.toLocaleString() : '—';
      const now = new Date();
      const trackedDate = new Date(t.tracked_at);
      const hoursSince = Math.floor((now - trackedDate) / (1000 * 60 * 60));

      html += '<div class="trade-card pass" style="padding:10px 14px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      html += '<div><span style="font-size:16px;font-weight:700">' + this.esc(t.symbol) + '</span>';
      html += '<span class="trade-direction ' + t.direction + '" style="margin-left:8px">' + direction + '</span></div>';
      html += '<div style="display:flex;align-items:center;gap:6px">';
      html += '<span style="font-size:10px;color:#64748B">已追踪 ' + hoursSince + 'h</span>';
      html += '<button class="btn btn-secondary" data-action="removeTracker" data-idx="' + i + '" style="font-size:9px;padding:2px 6px;color:var(--red);border-color:var(--red)">✕ 移除</button>';
      html += '</div></div><div class="trade-details">';
      html += '<div><div class="trade-detail-label">入场区间</div><div class="trade-detail-value">' + entry + '</div></div>';
      html += '<div><div class="trade-detail-label">止损</div><div class="trade-detail-value">' + stop + '</div></div>';
      html += '<div><div class="trade-detail-label">目标 1</div><div class="trade-detail-value">' + t1 + '</div></div>';
      html += '<div><div class="trade-detail-label">盈亏比</div><div class="trade-detail-value">' + (t.claimed_rr || '—') + ':1</div></div>';
      html += '</div></div>';
    });
    html += '</div>';
    html += '<div style="margin-top:16px;text-align:center"><button class="btn btn-secondary" data-action="clearTracker" style="font-size:11px;color:var(--red);border-color:var(--red)">🗑️ 清空所有追踪</button></div>';
    document.getElementById('trackerContent').innerHTML = html;
  },

  // ============================================================
  // 学习看板渲染
  // ============================================================
  mdRender(text) {
    if (!text || !text.trim()) return '<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:13px">暂无内容</div>';

    let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 代码块
    const codeBlocks = [];
    t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      codeBlocks.push('<pre><code>' + code.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</code></pre>');
      return '%%CODEBLOCK' + (codeBlocks.length - 1) + '%%';
    });

    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    t = t.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    t = t.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    t = t.replace(/\[KPI\s+([^:]+):\s*([^\]]+)\]/g, '<div class="learn-kpi-card"><div class="kpi-val">$2</div><div class="kpi-lbl">$1</div></div>');
    t = t.replace(/^---$/gm, '<hr>');
    t = t.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    t = t.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');

    // 表格
    t = t.replace(/^(\|.+\|)$/gm, function(m) {
      if (m.indexOf('---') >= 0) return '<tr class="sep">';
      const cells = m.split('|').filter(c => c.trim());
      let html = '<tr>';
      cells.forEach(c => { html += '<td>' + c.trim() + '</td>'; });
      html += '</tr>';
      return html;
    });
    t = t.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>');

    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 段落
    const lines = t.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      const startsWithTag = l.match(/^<(h[1-4]|ul|ol|li|table|tr|td|th|blockquote|pre|hr|div|p)/);
      const isSpecial = l === '' || startsWithTag || l.indexOf('%%CODEBLOCK') >= 0 || l.indexOf('<li>') >= 0 || l.indexOf('<table>') >= 0 || l.indexOf('<h') >= 0 || l.indexOf('<hr>') >= 0 || l.indexOf('<blockquote>') >= 0;
      if (!isSpecial && l.length > 0) result.push('<p>' + l + '</p>');
      else if (l === '') result.push('');
      else result.push(l);
    }
    t = result.join('\n');
    t = t.replace(/%%CODEBLOCK(\d+)%%/g, (m, idx) => codeBlocks[parseInt(idx)] || m);
    t = t.replace(/<p><\/p>/g, '');
    return '<div class="md-body">' + t + '</div>';
  },

  renderLearning(input) {
    document.getElementById('learnOutput').innerHTML = this.mdRender(input);
  }
};

