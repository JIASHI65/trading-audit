// ============================================================
// audit-rules.js — 合同规则引擎（宪法）
// 
// 核心职责:
//   1. R-10a 九条审计（方向价位一致 / 止损锚定 / 目标锚定 / 盈亏比 / 证伪 / 仓位 / 入场宽度 / 离场 / 回测）
//   2. 14字段完整性校验
//   3. 风险评分（anchorRate / falRate / exitRate / bullPct / totalRiskScore）
//
// 纪律:
//   - 纯函数，零 DOM 依赖
//   - 输入 trade 对象 + portfolio total，输出裁定
//   - 本文件是 JS 端合同规则的权威实现
//   - v3 python 脚本中对应的实现必须与本文件逐条一致
//   - 修改任何规则前，先改测试用例
// ============================================================

const AuditRules = {
  // ---------- 常量 ----------
  R10A_REQUIRED_FIELDS: [
    'symbol', 'direction', 'entry_low', 'entry_high',
    'stop', 'target1', 'target2', 'claimed_rr', 'size_cny'
  ],

  // ---------- R-10a: 单笔审计 ----------
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
      if (sP >= eM || t1 <= eM) { checks.push({status:'fail',text:'\u274c \u65b9\u5411\u4e0e\u4ef7\u4f4d\u77db\u76fe'}); verdict='fail'; }
      else checks.push({status:'pass',text:'\u65b9\u5411\u4e0e\u4ef7\u4f4d\u4e00\u81f4 \u2705'});
    } else if (isShort && sP && t1) {
      if (sP <= eM || t1 >= eM) { checks.push({status:'fail',text:'\u274c \u65b9\u5411\u4e0e\u4ef7\u4f4d\u77db\u76fe'}); verdict='fail'; }
      else checks.push({status:'pass',text:'\u65b9\u5411\u4e0e\u4ef7\u4f4d\u4e00\u81f4 \u2705'});
    }

    // 2. \u6b62\u635f\u951a\u5b9a
    const anchorStop = t.anchors && t.anchors.stop;
    if (!anchorStop) { checks.push({status:'fail',text:'\u6b62\u635f\u672a\u951a\u5b9a \u2014 \u672a\u8bf4\u660e\u6b62\u635f\u4f4d\u7684\u6280\u672f\u4f9d\u636e'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'\u6b62\u635f\u951a\u5b9a\uff1a' + anchorStop});

    // 3. \u76ee\u68071\u951a\u5b9a
    const anchorT1 = t.anchors && t.anchors.target1;
    if (!anchorT1) { checks.push({status:'warn',text:'\u76ee\u6807 1 \u672a\u951a\u5b9a \u2014 \u5efa\u8bae\u8bf4\u660e\u76ee\u6807\u4f4d\u4f9d\u636e'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'\u76ee\u6807 1 \u951a\u5b9a\uff1a' + anchorT1});

    // 4. \u76c8\u4e8f\u6bd4
    const rr = RR.parse(t.claimed_rr);
    if (rr < 1.5) { checks.push({status:'warn',text:'\u76c8\u4e8f\u6bd4\u504f\u4f4e\uff08'+rr.toFixed(1)+':1\uff09\u2014 \u5efa\u8bae \u2265 1.5:1'}); if (verdict==='pass') verdict='warn'; }
    else if (rr >= 3) checks.push({status:'pass',text:'\u76c8\u4e8f\u6bd4\u4f18\u79c0\uff08'+rr.toFixed(1)+':1\uff09'});
    else checks.push({status:'pass',text:'\u76c8\u4e8f\u6bd4\u5408\u7406\uff08'+rr.toFixed(1)+':1\uff09'});

    // 5. \u8bc1\u4f2a\u6761\u4ef6
    if (!t.falsification) { checks.push({status:'fail',text:'\u672a\u63d0\u4f9b\u8bc1\u4f2a\u6761\u4ef6 \u2014 \u4ec0\u4e48\u60c5\u51b5\u8bc1\u660e\u5224\u65ad\u9519\u8bef\uff1f'}); verdict='fail'; }
    else {
      const fSub = t.falsification.substring(0, 40);
      checks.push({status:'pass',text:'\u8bc1\u4f2a\u6761\u4ef6\u5df2\u5b9a\u4e49\uff1a'+fSub+(t.falsification.length>40?'...':'')});
    }

    // 6. \u4ed3\u4f4d\u5927\u5c0f
    const size = parseFloat(t.size_cny) || 0;
    const pct = total > 0 ? (size / total * 100) : 0;
    if (pct > 30) { checks.push({status:'fail',text:'\u4ed3\u4f4d\u8fc7\u91cd\uff08'+pct.toFixed(0)+'%\uff09\u2014 \u5355\u7b14\u4e0d\u8d85\u8fc7\u603b\u8d44\u91d1 30%'}); verdict='fail'; }
    else if (pct > 20) { checks.push({status:'warn',text:'\u4ed3\u4f4d\u504f\u9ad8\uff08'+pct.toFixed(0)+'%\uff09\u2014 \u5efa\u8bae\u63a7\u5236\u5728 20% \u4ee5\u5185'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'\u4ed3\u4f4d\u5408\u7406\uff08'+pct.toFixed(0)+'%\uff09'});

    // 7. \u5165\u573a\u533a\u95f4\u5bbd\u5ea6
    const spread = t.entry_low ? ((t.entry_high - t.entry_low) / t.entry_low * 100) : 0;
    if (spread > 2) { checks.push({status:'warn',text:'\u5165\u573a\u533a\u95f4\u504f\u5bbd\uff08'+spread.toFixed(1)+'%\uff09\u2014 \u5efa\u8bae\u7f29\u7a84\u533a\u95f4'}); if (verdict==='pass') verdict='warn'; }
    else checks.push({status:'pass',text:'\u5165\u573a\u533a\u95f4\u5408\u7406\uff08'+spread.toFixed(1)+'%\uff09'});

    // 8. \u79bb\u573a\u903b\u8f91
    if (!t.exit_strategy || t.exit_strategy.trim().length < 10) { checks.push({status:'fail',text:'\u672a\u63d0\u4f9b\u79bb\u573a\u903b\u8f91 \u2014 \u53ea\u6709\u6b62\u635f/\u76ee\u6807\u4ef7\u4e0d\u591f\uff0c\u9700\u8bf4\u660e\u4f55\u65f6\u4ee5\u53ca\u5982\u4f55\u79bb\u573a'}); verdict='fail'; }
    else {
      const eSub = t.exit_strategy.substring(0, 50);
      checks.push({status:'pass',text:'\u79bb\u573a\u903b\u8f91\u5df2\u660e\u786e\u5b9a\u4e49\uff1a'+eSub+(t.exit_strategy.length>50?'...':'')});
    }

    // 9. \u56de\u6d4b\u53c2\u8003
    if (t.backtest && t.backtest.total_trades > 0) {
      const btd = t.backtest;
      const btWarn = [];
      if (btd.sharpe && btd.sharpe > 3) btWarn.push('Sharp>3\u504f\u9ad8');
      if (btd.max_drawdown && btd.max_drawdown < -20) btWarn.push('\u56de\u64a4>20%');
      if (btd.annualized && btd.annualized > 100) btWarn.push('\u5e74\u5316>100%\u8fc7\u4e8e\u4e50\u89c2');
      const btStr = '\u80dc\u7387' + (btd.win_rate || '?') + '% | \u5e74\u5316' + (btd.annualized || '?') + '% | \u6700\u5927\u56de\u64a4' + (btd.max_drawdown || '?') + '% | Sharp' + (btd.sharpe || '?') + ' | ' + (btd.total_trades || 0) + '\u7b14 | ' + (btd.period || '') + ' | \u6765\u6e90:' + (btd.source || '\u672a\u6807\u6ce8');
      if (btWarn.length > 0) { checks.push({status:'warn',text:'\ud83d\udcca \u56de\u6d4b\u53c2\u8003\uff1a'+btStr+'\uff08\u26a0\ufe0f '+btWarn.join('\u3001')+'\uff09'}); if (verdict==='pass') verdict='warn'; }
      else checks.push({status:'pass',text:'\ud83d\udcca \u56de\u6d4b\u53c2\u8003\uff1a'+btStr});
    } else if (t.backtest && t.backtest.total_trades === 0) {
      checks.push({status:'warn',text:'\ud83d\udcca \u56de\u6d4b\u6570\u636e\u4e3a\u7a7a\uff08total_trades=0\uff09'});
    }

    // 10. 14\u5b57\u6bb5\u5b8c\u6574\u6027
    const missing = [];
    AuditRules.R10A_REQUIRED_FIELDS.forEach(f => { const v = t[f]; if (v === undefined || v === null || v === '' || v === 0) missing.push(f); });
    const anchorFields = [];
    if (!t.anchors || !t.anchors.stop) anchorFields.push('\u951a\u5b9a:stop');
    if (!t.anchors || !t.anchors.target1) anchorFields.push('\u951a\u5b9a:target1');
    if (!t.anchors || !t.anchors.target2) anchorFields.push('\u951a\u5b9a:target2');
    if (!t.falsification || t.falsification.trim().length < 2) anchorFields.push('\u8bc1\u4f2a\u6761\u4ef6');
    if (!t.exit_strategy || t.exit_strategy.trim().length < 2) anchorFields.push('\u79bb\u573a\u7b56\u7565');
    const allMiss = missing.concat(anchorFields);
    if (allMiss.length > 0) {
      checks.push({status:'warn',text:'\u26a0\ufe0f \u6570\u636e\u4e0d\u5b8c\u6574 \u2014 \u7f3a\u5c11: '+allMiss.join('\u3001')});
      if (verdict === 'pass') verdict = 'warn';
    } else {
      checks.push({status:'pass',text:'\u2705 14\u5b57\u6bb5\u5b8c\u6574\u6027 \u2014 \u5168\u90e8\u5b57\u6bb5\u5df2\u586b\u5145'});
    }

    return {verdict, checks};
  },

  // ---------- \u6279\u91cf\u5ba1\u8ba1 ----------
  auditAll(trades, total) {
    return trades.map((t, i) => {
      const r = this.auditTrade(t, total);
      return {index: i, original: t, verdict: r.verdict, checks: r.checks};
    });
  },

  // ---------- \u98ce\u9669\u8bc4\u5206 ----------
  calcPersonality(trades) {
    const mp = { syms:0, longs:0, shorts:0, anchorOk:0, falOk:0, exitOk:0, rrSum:0, anchorRate:0, falRate:0, exitRate:0, bullPct:0, avgRR:0, totalRiskScore:0 };
    (trades || []).forEach(t => {
      mp.syms++;
      if ((t.direction||'').toLowerCase()==='long'||(t.direction||'').toLowerCase()==='buy') mp.longs++; else mp.shorts++;
      if (t.anchors && t.anchors.stop) mp.anchorOk++;
      if (t.falsification && t.falsification.trim().length > 2) mp.falOk++;
      if (t.exit_strategy && t.exit_strategy.trim().length > 2) mp.exitOk++;
      mp.rrSum += RR.parse(t.claimed_rr);
    });
    mp.anchorRate = mp.syms > 0 ? mp.anchorOk / mp.syms : 0;
    mp.falRate = mp.syms > 0 ? mp.falOk / mp.syms : 0;
    mp.exitRate = mp.syms > 0 ? mp.exitOk / mp.syms : 0;
    mp.bullPct = mp.syms > 0 ? mp.longs / mp.syms : 0;
    mp.avgRR = mp.syms > 0 ? mp.rrSum / mp.syms : 0;
    mp.totalRiskScore = (mp.anchorRate + mp.falRate + mp.exitRate) / 3;
    return {
      syms: mp.syms, longs: mp.longs, shorts: mp.shorts,
      anchorRate: mp.anchorRate, falRate: mp.falRate, exitRate: mp.exitRate,
      bullPct: mp.bullPct, avgRR: mp.avgRR, totalRiskScore: mp.totalRiskScore
    };
  },

  // ---------- \u5b57\u6bb5\u5168\u96c6 ----------
  FIELD_KEYS: {
    required: ['symbol','direction','entry_low','entry_high','stop','target1','target2','claimed_rr','size_cny'],
    anchor: ['anchors.stop','anchors.target1','anchors.target2'],
    narrative: ['falsification','exit_strategy']
  }
};
