// ============================================================
// audit-rules.test.js — 合同规则单元测试
// 
// 用法: node audit-rules.test.js
// 通过输出 "ALL PASS"，失败显示差异
// ============================================================

const fs = require('fs');

// ---- 加载 RR ----
const RR = {
  parse(r) { const n = parseFloat(r); return Number.isFinite(n) ? n : 0; }
};

// ---- 加载 AuditRules ----
const rulesCode = fs.readFileSync('core/audit-rules.js', 'utf-8');
const AuditRules = new Function('RR', rulesCode + '; return AuditRules;')(RR);

let passed = 0;
let failed = 0;
function ok(cond, msg) { cond ? passed++ : (failed++, console.error('  ❌', msg)); }
function eq(act, exp, msg) {
  const a = JSON.stringify(act), e = JSON.stringify(exp);
  a === e ? passed++ : (failed++, console.error('  ❌', msg, '\n    exp:', e, '\n    got:', a));
}

// ===== RR.parse =====
console.log('\n📐 RR.parse');
eq(RR.parse('2.5'), 2.5, '"2.5"');
eq(RR.parse(3), 3, '3');
eq(RR.parse(''), 0, '""');
eq(RR.parse('abc'), 0, '"abc"');
eq(RR.parse(null), 0, 'null');
eq(RR.parse(undefined), 0, 'undefined');

// ===== auditTrade =====
console.log('\n📐 auditTrade');

// Test 1: 正确做多
const tLong = { symbol:'BTC/USDT', direction:'long', entry_low:61000, entry_high:61700, stop:60400, target1:62900, target2:64900, claimed_rr:2.2, size_cny:1600, anchors:{stop:'61k',target1:'63k',target2:'65k'}, falsification:'跌破60900', exit_strategy:'60400止损；62900卖半；64900清仓', backtest:{win_rate:62,avg_return:1.8,max_drawdown:-8.5,sharpe:1.42,annualized:34.7,total_trades:47,period:'2025-01~2026-06',source:'回测'} };
eq(AuditRules.auditTrade(tLong, 10000).verdict, 'pass', '正确做多');

// Test 2: 方向矛盾
eq(AuditRules.auditTrade({ ...tLong, stop:62000 }, 10000).verdict, 'fail', '做多止损>入场');

// Test 3: 做空正确
const tShort = { symbol:'NVDA', direction:'short', entry_low:138, entry_high:140, stop:144, target1:128, target2:120, claimed_rr:2.5, size_cny:2000, anchors:{stop:'144阻力',target1:'128支撑',target2:'120支撑'}, falsification:'站稳144失效', exit_strategy:'144止损；128平50%；120清仓' };
eq(AuditRules.auditTrade(tShort, 10000).verdict, 'pass', '正确做空');

// Test 4: 做空矛盾
eq(AuditRules.auditTrade({ ...tShort, stop:130 }, 10000).verdict, 'fail', '做空止损<入场');

// Test 5: 仓位过重
eq(AuditRules.auditTrade({ ...tLong, size_cny:5000 }, 10000).verdict, 'fail', '仓位50%');

// Test 6: 缺失多个字段
const tMiss = { symbol:'X', direction:'long', entry_low:0, entry_high:0, stop:0, claimed_rr:'', size_cny:0 };
eq(AuditRules.auditTrade(tMiss, 10000).verdict, 'fail', '多字段缺失');

// Test 7: RR 边界
eq(AuditRules.auditTrade({ ...tLong, claimed_rr:1.4 }, 10000).verdict, 'warn', 'RR=1.4 → warn');
eq(AuditRules.auditTrade({ ...tLong, claimed_rr:3 }, 10000).verdict, 'pass', 'RR=3 → pass');

// Test 8: 无证伪
eq(AuditRules.auditTrade({ ...tLong, falsification:'' }, 10000).verdict, 'fail', '无证伪');

// Test 9: 无离场策略
eq(AuditRules.auditTrade({ ...tLong, exit_strategy:'' }, 10000).verdict, 'fail', '无离场');

// ===== calcPersonality =====
console.log('\n📐 calcPersonality');
const p = AuditRules.calcPersonality([tLong, tShort]);
ok(p.syms === 2, '2笔');
ok(p.longs === 1 && p.shorts === 1, '1多1空');
ok(p.anchorRate > 0, '锚定率>0');
ok(p.avgRR > 0, '平均RR>0');

const p0 = AuditRules.calcPersonality([]);
eq(p0.avgRR, 0, '空数组avgRR=0');
eq(p0.totalRiskScore, 0, '空数组totalRiskScore=0');

// ===== 汇总 =====
const total = passed + failed;
console.log(`\n${'='.repeat(50)}`);
console.log(`${passed}/${total} 通过, ${failed}/${total} 失败`);
if (failed === 0) { console.log('✅ ALL PASS'); process.exit(0); }
else { console.log('❌ FAILED'); process.exit(1); }
