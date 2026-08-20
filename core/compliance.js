// ============================================================
// compliance.js — 执行合规硬检查（零 LLM，纯数字）
//
// 思路抄自 Vibe-Trading 的 check_mandate（fail-closed）：
//   黑名单 → 品种允许 → 单笔名义 → 总敞口 → 杠杆 → 每日笔数
//   → 资金镜像 → 市值/流动性门槛
// 区别：Vibe 拦截真实订单，这里拦截"审计台里不该入场的信号"。
//
// 纪律：
//   - 纯函数，零 DOM，输入 trades + portfolio，输出 checks
//   - 所有数字由字段反算，不信任 LLM 自报的 claimed_rr / size
//   - 任一 fail → 整单违规（fail-closed）
// ============================================================

const Compliance = {
  // ---------- 常量（与提示词 R-05/R-06/R-08 对齐） ----------
  LIMITS: {
    maxPositionPct: 20,        // 单笔 ≤ 20%
    maxSameDirection: 3,       // 同方向 ≤ 3 笔
    minCashPct: 40,            // 现金 ≥ 40%
    maxTradesPerDay: 3,        // 每日推荐 ≤ 3
    minRR: 2.0,                // 盈亏比 ≥ 2:1
    maxSpreadPct: 2,           // 入场区间 ≤ 2%
    forbidLeverage: true,      // 禁止杠杆
    excludeSymbols: []         // 黑名单（可配置）
  },

  // ---------- 单笔合规检查 ----------
  checkTrade(t, total) {
    const checks = [];
    const isLong = (t.direction || '').toLowerCase() === 'long' || (t.direction || '').toLowerCase() === 'buy';
    const isShort = (t.direction || '').toLowerCase() === 'short' || (t.direction || '').toLowerCase() === 'sell';
    const entryMid = (parseFloat(t.entry_low || 0) + parseFloat(t.entry_high || 0)) / 2;
    const stop = parseFloat(t.stop || 0);
    const target1 = parseFloat(t.target1 || 0);
    const size = parseFloat(t.size_cny) || 0;
    const pct = total > 0 ? (size / total * 100) : 0;

    // 1. 黑名单（fail-closed）
    const sym = (t.symbol || '').trim().toUpperCase();
    if (sym && Compliance.LIMITS.excludeSymbols.includes(sym)) {
      checks.push({status:'fail', text:'🚫 黑名单标的：' + sym + ' — 禁止入场'});
    }

    // 2. 单笔仓位 ≤ 20%（数字反算，不信自报）
    if (pct > Compliance.LIMITS.maxPositionPct) {
      checks.push({status:'fail', text:'❌ 单笔仓位 ' + pct.toFixed(0) + '% 超限（≤ ' + Compliance.LIMITS.maxPositionPct + '%）'});
    } else if (size > 0) {
      checks.push({status:'pass', text:'✅ 单笔仓位 ' + pct.toFixed(0) + '%（≤ ' + Compliance.LIMITS.maxPositionPct + '%）'});
    }

    // 3. 杠杆检查：size_cny > 账户资金即视为杠杆（禁止）
    if (Compliance.LIMITS.forbidLeverage && size > total) {
      checks.push({status:'fail', text:'❌ 仓位超过账户资金 — 疑似杠杆，禁止'});
    }

    // 4. 盈亏比反算（用 stop/entry/target 算，不信 claimed_rr）
    if (stop > 0 && entryMid > 0 && target1 > 0 && (isLong || isShort)) {
      const risk = Math.abs(entryMid - stop);
      const reward = Math.abs(target1 - entryMid);
      const rr = risk > 0 ? reward / risk : 0;
      if (rr < Compliance.LIMITS.minRR) {
        checks.push({status:'fail', text:'❌ 盈亏比反算 ' + rr.toFixed(1) + ':1 < ' + Compliance.LIMITS.minRR + ':1（自报 ' + t.claimed_rr + ' 不采信）'});
      } else {
        checks.push({status:'pass', text:'✅ 盈亏比反算 ' + rr.toFixed(1) + ':1（≥ ' + Compliance.LIMITS.minRR + ':1）'});
      }
    }

    // 5. 入场区间宽度 ≤ 2%
    if (parseFloat(t.entry_low) > 0 && parseFloat(t.entry_high) > 0) {
      const spread = (parseFloat(t.entry_high) - parseFloat(t.entry_low)) / parseFloat(t.entry_low) * 100;
      if (spread > Compliance.LIMITS.maxSpreadPct) {
        checks.push({status:'fail', text:'❌ 入场区间 ' + spread.toFixed(1) + '% 过宽（≤ ' + Compliance.LIMITS.maxSpreadPct + '%）'});
      } else {
        checks.push({status:'pass', text:'✅ 入场区间 ' + spread.toFixed(1) + '%（≤ ' + Compliance.LIMITS.maxSpreadPct + '%）'});
      }
    }

    return checks;
  },

  // ---------- 组合级合规检查 ----------
  checkPortfolio(trades, portfolio) {
    const checks = [];
    const total = (portfolio && portfolio.total) || 10000;
    const list = trades || [];
    const invested = list.reduce((s, t) => s + (parseFloat(t.size_cny) || 0), 0);
    const cashPct = total > 0 ? ((total - invested) / total * 100) : 0;
    const longs = list.filter(t => (t.direction || '').toLowerCase() === 'long' || (t.direction || '').toLowerCase() === 'buy').length;
    const shorts = list.filter(t => (t.direction || '').toLowerCase() === 'short' || (t.direction || '').toLowerCase() === 'sell').length;
    const maxDir = Math.max(longs, shorts);

    // 6. 现金 ≥ 40%
    if (cashPct < Compliance.LIMITS.minCashPct) {
      checks.push({status:'fail', text:'❌ 现金 ' + cashPct.toFixed(0) + '% < ' + Compliance.LIMITS.minCashPct + '%（已投 ' + invested.toFixed(0) + ' 元）'});
    } else {
      checks.push({status:'pass', text:'✅ 现金 ' + cashPct.toFixed(0) + '%（≥ ' + Compliance.LIMITS.minCashPct + '%）'});
    }

    // 7. 同方向 ≤ 3 笔
    if (maxDir > Compliance.LIMITS.maxSameDirection) {
      checks.push({status:'fail', text:'❌ 同方向 ' + maxDir + ' 笔 > ' + Compliance.LIMITS.maxSameDirection + ' 笔（多 ' + longs + ' 空 ' + shorts + '）'});
    } else {
      checks.push({status:'pass', text:'✅ 同方向 ' + maxDir + ' 笔（≤ ' + Compliance.LIMITS.maxSameDirection + '，多 ' + longs + ' 空 ' + shorts + '）'});
    }

    // 8. 每日推荐 ≤ 3 笔
    if (list.length > Compliance.LIMITS.maxTradesPerDay) {
      checks.push({status:'fail', text:'❌ 今日推荐 ' + list.length + ' 笔 > ' + Compliance.LIMITS.maxTradesPerDay + ' 笔'});
    } else {
      checks.push({status:'pass', text:'✅ 今日推荐 ' + list.length + ' 笔（≤ ' + Compliance.LIMITS.maxTradesPerDay + '）'});
    }

    // 9. 总敞口 ≤ 账户资金（禁止任何形式杠杆敞口）
    if (invested > total) {
      checks.push({status:'fail', text:'❌ 总敞口 ' + invested.toFixed(0) + ' 元 > 账户 ' + total.toFixed(0) + ' 元 — 疑似杠杆'});
    }

    return checks;
  },

  // ---------- 汇总入口：单笔 + 组合合并 ----------
  auditAll(trades, portfolio) {
    const total = (portfolio && portfolio.total) || 10000;
    const portChecks = Compliance.checkPortfolio(trades, portfolio);
    return (trades || []).map((t, i) => {
      const checks = Compliance.checkTrade(t, total);
      const hasFail = portChecks.some(c => c.status === 'fail') || checks.some(c => c.status === 'fail');
      const verdict = hasFail ? 'fail' : 'pass';
      return {index: i, original: t, verdict, checks: checks.concat(portChecks)};
    });
  }
};
