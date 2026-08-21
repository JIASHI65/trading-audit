// ============================================================
// signal-verifier.test.js — 信号后验器单元测试
//
// 用法: node signal-verifier.test.js
// 通过输出 "ALL PASS"，失败显示差异
// ============================================================

const fs = require('fs');
const code = fs.readFileSync('core/signal-verifier.js', 'utf-8');
const SignalVerifier = new Function(code + '; return SignalVerifier;')();

let passed = 0, failed = 0;
function ok(cond, msg) { cond ? passed++ : (failed++, console.error('  ❌', msg)); }
function near(act, exp, msg, tol) {
  const t = tol === undefined ? 0.05 : tol;
  Math.abs(act - exp) <= t ? passed++ : (failed++, console.error('  ❌', msg, '\n    exp:', exp, '\n    got:', act));
}

// ===== 做多 =====
console.log('\n📈 做多');
const tLong = { direction:'long', entry_low:61000, entry_high:61700, stop:60400, target1:62900, target2:64900, claimed_rr:2.2, size_cny:1600 };
// mid = 61350

let r = SignalVerifier.simulate(tLong, [61200]);
ok(r.result === 'holding', '未触价 → holding');
near(r.pnl, 0, 'holding pnl=0');

r = SignalVerifier.simulate(tLong, [61200, 63000]);
ok(r.result === 'half', '触 t1 → half');
ok(r.half_tp1 === true, 'half_tp1=true');
near(r.pnl, 800 * (62900-61350) / 61350, '半仓@t1 pnl');  // ≈ 20.21

r = SignalVerifier.simulate(tLong, [61200, 63000, 62000, 65000]);
ok(r.result === 'tp2', 'half 后触 t2 → tp2');
near(r.pnl, 800 * (62900-61350) / 61350 + 800 * (64900-61350) / 61350, 'tp2 总 pnl');  // ≈ 66.52
ok(r.half_tp1 === true, 'tp2 half_tp1=true');

r = SignalVerifier.simulate(tLong, [61200, 65000]);
ok(r.result === 'tp2', '跳空直达 t2 → tp2 全结');
near(r.pnl, 800 * (62900-61350) / 61350 + 800 * (64900-61350) / 61350, '跳空 tp2 pnl（限价单 t1+t2 顺序）');

r = SignalVerifier.simulate(tLong, [61200, 60300]);
ok(r.result === 'sl', '触止损 → sl');
near(r.pnl, 1600 * (60400-61350) / 61350, 'sl 全仓 pnl');  // ≈ -24.77

r = SignalVerifier.simulate(tLong, [61200, 63000, 60400]);
ok(r.result === 'sl', 'half 后触止损 → sl');
ok(r.half_tp1 === true, 'half 后止损 half_tp1=true');
near(r.pnl, 800 * (62900-61350) / 61350 + 800 * (60400-61350) / 61350, 'half 后止损总 pnl');  // ≈ 7.82

// 只有 t1 没有 t2
r = SignalVerifier.simulate({ ...tLong, target2:0 }, [61200, 63000]);
ok(r.result === 'tp2', '仅 t1 → 触 t1 全结 tp2');
near(r.pnl, 1600 * (62900-61350) / 61350, '仅 t1 全结 pnl');  // ≈ 40.42

// 无仓位 → pnl=0 不崩
r = SignalVerifier.simulate({ ...tLong, size_cny:0 }, [61200, 63000]);
ok(r.result === 'half' && r.pnl === 0, '无 size_cny → half 且 pnl=0');

// 无效价格过滤
r = SignalVerifier.simulate(tLong, [61200, 'abc', -5, null, 63000]);
ok(r.result === 'half', '无效价格被过滤仍可判定');

// ===== 做空 =====
console.log('\n📉 做空');
const tShort = { direction:'short', entry_low:138, entry_high:140, stop:144, target1:128, target2:120, claimed_rr:2.5, size_cny:2000 };
// mid = 139

r = SignalVerifier.simulate(tShort, [139.5]);
ok(r.result === 'holding', '空头未触价 → holding');

r = SignalVerifier.simulate(tShort, [139.5, 127]);
ok(r.result === 'half', '空头触 t1 → half');
near(r.pnl, 1000 * (139-128) / 139, '空头半仓@t1 pnl');  // ≈ 79.14

r = SignalVerifier.simulate(tShort, [139.5, 127, 132, 119]);
ok(r.result === 'tp2', '空头 half 后触 t2 → tp2');
near(r.pnl, 1000 * (139-128) / 139 + 1000 * (139-120) / 139, '空头 tp2 总 pnl');  // ≈ 215.83

r = SignalVerifier.simulate(tShort, [139.5, 145]);
ok(r.result === 'sl', '空头触止损 → sl');
near(r.pnl, 2000 * (139-144) / 139, '空头 sl 全仓 pnl');  // ≈ -71.94

// ===== stats =====
console.log('\n📊 stats');
const tracker = [
  { result:'tp2', pnl:100, claimed_rr:'2.2' },
  { result:'tp2', pnl:60, claimed_rr:'3' },
  { result:'sl', pnl:-50, claimed_rr:'2.2' },
  { result:'half', pnl:20, claimed_rr:'2.5' },   // 半仓不计 closed
  { result:null, pnl:0 }                          // 持仓中不计
];
const st = SignalVerifier.stats(tracker);
ok(st.closed === 3, 'closed=3（half 与持仓中排除）');
ok(st.wins === 2 && st.losses === 1, '2盈1亏');
ok(st.totalPnl === 110, 'totalPnl=110');
ok(Math.abs(st.ev - 110/3) < 0.01, 'ev=36.67');
ok(Math.abs(st.realRR - 80/50) < 0.01, 'realRR=1.6');
ok(Math.abs(st.claimedAvg - (2.2+3+2.2)/3) < 0.01, 'claimedAvg=2.47');

// ===== 汇总 =====
const total = passed + failed;
console.log(`\n${'='.repeat(50)}`);
console.log(`${passed}/${total} 通过, ${failed}/${total} 失败`);
if (failed === 0) { console.log('✅ ALL PASS'); process.exit(0); }
else { console.log('❌ FAILED'); process.exit(1); }
