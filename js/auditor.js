// ============================================================
// 3. Auditor — 交易审计逻辑
// ============================================================
const Auditor = {
  auditTrade(t, total) {
    let verdict = 'pass';
    const checks = [];
    const d = (t.direction || '').toLowerCase();
    const isLong = d === 'long' || d === 'buy';
    const isShort = d === 'short' || d === 'sell';
    const eM = (parseFloat(t.entry_low || 0) + parseFloat(t.entry_high || 0)) / 2;
    const sP = parseFloat(t.stop || 0);
    const t1 = parseFloat(t.target1 || 0);

    // 1. 方向与价位一致
    if (isLong && sP && t1) {
      if (sP >= eM || t1 <= eM) { checks.push({status:'fail',text:'❌ 方向与价位矛盾'}); verdict='fail'; }
      else checks.push({status:'pass',text:'方向与价位一致 ✅'});
    } else if (isShort && sP && t1) {
      if (sP <= eM || t1 >= eM) { checks.push({status:'fail',text:'❌ 方向与价位矛盾'}); verdict='fail'; }
      else checks.push({status:'pass',text:'方向与价位一致 ✅'});
    }

    // 2. 止损锚定
    const anchorStop = t.anchors && t.anchors.stop;
    if (!anchorStop) { checks.push({status:'fail',text:'止损未锚定 — 未说明止损位的技术依据'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'止损锚定：' + anchorStop});

    // 3. 目标1锚定
    const anchorT1 = t.anchors && t.anchors.target1;
    if (!anchorT1) { checks.push({status:'warn',text:'目标 1 未锚定 — 建议说明目标位依据'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'目标 1 锚定：' + anchorT1});

    // 4. 盈亏比
    const rr = Parser.parseRR(t.claimed_rr);
    if (rr < 2.0) { checks.push({status:'warn',text:'盈亏比偏低（'+rr.toFixed(1)+':1）— 建议 ≥ 2:1'}); if (verdict==='pass') verdict='warn'; }
    else if (rr >= 3) checks.push({status:'pass',text:'盈亏比优秀（'+rr.toFixed(1)+':1）'});
    else checks.push({status:'pass',text:'盈亏比合理（'+rr.toFixed(1)+':1）'});

    // 5. 证伪条件
    if (!t.falsification) { checks.push({status:'fail',text:'未提供证伪条件 — 什么情况证明判断错误？'}); verdict='fail'; }
    else {
      const fSub = t.falsification.substring(0, 40);
      checks.push({status:'pass',text:'证伪条件已定义：'+fSub+(t.falsification.length>40?'...':'')});
    }

    // 6. 仓位大小
    const size = parseFloat(t.size_cny) || 0;
    const pct = total > 0 ? (size / total * 100) : 0;
    if (pct > 30) { checks.push({status:'fail',text:'仓位过重（'+pct.toFixed(0)+'%）— 单笔不超过总资金 30%'}); verdict='fail'; }
    else if (pct > 20) { checks.push({status:'warn',text:'仓位偏高（'+pct.toFixed(0)+'%）— 建议控制在 20% 以内'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'仓位合理（'+pct.toFixed(0)+'%）'});

    // 7. 入场区间宽度
    const spread = t.entry_low ? ((t.entry_high - t.entry_low) / t.entry_low * 100) : 0;
    if (spread > 2) { checks.push({status:'warn',text:'入场区间偏宽（'+spread.toFixed(1)+'%）— 建议缩窄区间'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'入场区间合理（'+spread.toFixed(1)+'%）'});

    // 8. 离场逻辑
    if (!t.exit_strategy || t.exit_strategy.trim().length < 10) { checks.push({status:'fail',text:'未提供离场逻辑 — 只有止损/目标价不够，需说明何时以及如何离场'}); verdict='fail'; }
    else {
      const eSub = t.exit_strategy.substring(0, 50);
      checks.push({status:'pass',text:'离场逻辑已明确定义：'+eSub+(t.exit_strategy.length>50?'...':'')});
    }

    // 9. 回测参考
    if (t.backtest && t.backtest.total_trades > 0) {
      const btd = t.backtest;
      const btWarn = [];
      if (btd.sharpe && btd.sharpe > 3) btWarn.push('Sharp>3偏高');
      if (btd.max_drawdown && btd.max_drawdown < -20) btWarn.push('回撤>20%');
      if (btd.annualized && btd.annualized > 100) btWarn.push('年化>100%过于乐观');
      const btStr = '胜率' + (btd.win_rate || '?') + '% | 年化' + (btd.annualized || '?') + '% | 最大回撤' + (btd.max_drawdown || '?') + '% | Sharp' + (btd.sharpe || '?') + ' | ' + (btd.total_trades || 0) + '笔 | ' + (btd.period || '') + ' | 来源:' + (btd.source || '未标注');
      if (btWarn.length > 0) { checks.push({status:'warn',text:'📊 回测参考：'+btStr+'（⚠️ '+btWarn.join('、')+'）'}); if (verdict==='pass') verdict='warn'; }
      else checks.push({status:'pass',text:'📊 回测参考：'+btStr});
    } else if (t.backtest && t.backtest.total_trades === 0) {
      checks.push({status:'warn',text:'📊 回测数据为空（total_trades=0）'});
    }

    // 10. 14字段完整性
    const reqFields = ['symbol','direction','entry_low','entry_high','stop','target1','target2','claimed_rr','size_cny'];
    const missing = [];
    reqFields.forEach(f => { const v = t[f]; if (v === undefined || v === null || v === '' || v === 0) missing.push(f); });
    const anchorFields = [];
    if (!t.anchors || !t.anchors.stop) anchorFields.push('锚定:stop');
    if (!t.anchors || !t.anchors.target1) anchorFields.push('锚定:target1');
    if (!t.anchors || !t.anchors.target2) anchorFields.push('锚定:target2');
    if (!t.falsification || t.falsification.trim().length < 2) anchorFields.push('证伪条件');
    if (!t.exit_strategy || t.exit_strategy.trim().length < 2) anchorFields.push('离场策略');
    const allMiss = missing.concat(anchorFields);
    if (allMiss.length > 0) {
      checks.push({status:'warn',text:'⚠️ 数据不完整 — 缺少: '+allMiss.join('、')});
      if (verdict === 'pass') verdict = 'warn';
    } else {
      checks.push({status:'pass',text:'✅ 14字段完整性 — 全部字段已填充'});
    }

    return {verdict, checks};
  },

  auditAll(trades, total) {
    return trades.map((t, i) => {
      const r = this.auditTrade(t, total);
      return {index: i, original: t, verdict: r.verdict, checks: r.checks};
    });
  }
};

