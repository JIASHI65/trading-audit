// ============================================================
// signal-verifier.js — 信号后验器（回测留存）
//
// 职责: 录入价格序列 → 按止损/止盈自动模拟平仓 → 输出结果与盈亏
// 纪律: 纯函数零 DOM · 止损优先 · tp1 平半仓 / tp2 清仓 · pnl 为金额口径估算
//   - result: 'holding' 持仓中 | 'half' 半仓止盈1(剩半仓在途) | 'tp2' 全结 | 'sl' 全结
//   - pnl 仅估算，不含杠杆与手续费，long: size*(exit-entry)/entry
// ============================================================

const SignalVerifier = {
  // 入场参考价 = 区间中点，缺区间用单边
  entryMid(t) {
    const lo = parseFloat(t && t.entry_low) || 0;
    const hi = parseFloat(t && t.entry_high) || 0;
    if (lo && hi) return (lo + hi) / 2;
    return lo || hi;
  },

  isLong(t) {
    const d = (t && t.direction || '').toLowerCase();
    return d === 'long' || d === 'buy';
  },

  // 单笔盈亏（金额口径）
  gain(t, exitPrice, ratio) {
    const entry = this.entryMid(t);
    if (!entry || !exitPrice) return 0;
    const size = parseFloat(t.size_cny) || 0;
    const move = this.isLong(t) ? (exitPrice - entry) : (entry - exitPrice);
    return size * (ratio === undefined ? 1 : ratio) * move / entry;
  },

  // 价格序列模拟平仓（逐点，止损优先）
  simulate(t, priceLog) {
    const prices = (Array.isArray(priceLog) ? priceLog : [])
      .filter(p => typeof p === 'number' && isFinite(p) && p > 0);
    const entry = this.entryMid(t);
    const stop = parseFloat(t.stop) || 0;
    const t1 = parseFloat(t.target1) || 0;
    const t2 = parseFloat(t.target2) || 0;
    if (!entry || !stop || (!t1 && !t2)) return {result:'holding', pnl:0, exit_price:null, half_tp1:false};

    const long = this.isLong(t);
    let pnl = 0;
    let halfDone = false;
    for (const p of prices) {
      if (long) {
        // 止损优先
        if (p <= stop) {
          pnl += this.gain(t, stop, halfDone ? 0.5 : 1);
          return {result:'sl', pnl, exit_price:stop, half_tp1:halfDone};
        }
        if (!t2 && t1 && p >= t1) return {result:'tp2', pnl:this.gain(t, t1, 1), exit_price:t1, half_tp1:false};
        if (t2 && p >= t2) {
          // 触发目标2：剩余半仓结在 t2；若未先平半仓（跳空），限价单按 t1+t2 顺序成交
          pnl += this.gain(t, t1 || t2, halfDone ? 0 : 0.5) + this.gain(t, t2, 0.5);
          return {result:'tp2', pnl, exit_price:t2, half_tp1:halfDone};
        }
        if (t1 && p >= t1 && !halfDone) {
          pnl += this.gain(t, t1, 0.5);
          halfDone = true;
        }
      } else {
        if (p >= stop) {
          pnl += this.gain(t, stop, halfDone ? 0.5 : 1);
          return {result:'sl', pnl, exit_price:stop, half_tp1:halfDone};
        }
        if (!t2 && t1 && p <= t1) return {result:'tp2', pnl:this.gain(t, t1, 1), exit_price:t1, half_tp1:false};
        if (t2 && p <= t2) {
          pnl += this.gain(t, t1 || t2, halfDone ? 0 : 0.5) + this.gain(t, t2, 0.5);
          return {result:'tp2', pnl, exit_price:t2, half_tp1:halfDone};
        }
        if (t1 && p <= t1 && !halfDone) {
          pnl += this.gain(t, t1, 0.5);
          halfDone = true;
        }
      }
    }
    if (halfDone) return {result:'half', pnl, exit_price:t1, half_tp1:true};
    return {result:'holding', pnl:0, exit_price:null, half_tp1:false};
  },

  // 台账统计：期望值 / 真实盈亏比 / 自报 vs 实际
  stats(tracker) {
    const closed = (tracker || []).filter(t => t.result && t.result !== 'half');
    const wins = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl < 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const claimed = closed.filter(t => t.claimed_rr && parseFloat(t.claimed_rr) > 0)
      .map(t => parseFloat(t.claimed_rr));
    return {
      total: (tracker || []).length,
      closed: closed.length,
      wins: wins.length,
      losses: losses.length,
      totalPnl,
      winRate: closed.length ? wins.length / closed.length * 100 : 0,
      ev: closed.length ? totalPnl / closed.length : 0,
      realRR: avgLoss > 0 && wins.length ? avgWin / avgLoss : 0,
      claimedAvg: claimed.length ? claimed.reduce((s, v) => s + v, 0) / claimed.length : 0,
      claimedCount: claimed.length
    };
  }
};
