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
const tLong = { symbol:'BTC/USDT', direction:'long', entry_low:61000, entry_high:61700, stop:60400, target1:62900, target2:64900, claimed_rr:2.2, size_cny:1600, anchors:{stop:'61k',target1:'63k',target2:'65k'}, falsification:'跌破60900', exit_strategy:'60400止损；62900卖半；64900清仓', market_env:'宏观中性，BTC 波动率收缩，适合开仓', bear_case:'1) 宏观转鹰可能压制风险资产 2) 61000 上方套牢盘密集 3) 量能未确认突破', backtest:{win_rate:62,avg_return:1.8,max_drawdown:-8.5,sharpe:1.42,annualized:34.7,total_trades:47,period:'2025-01~2026-06',source:'回测'} };
eq(AuditRules.auditTrade(tLong, 10000).verdict, 'pass', '正确做多');

// Test 2: 方向矛盾
eq(AuditRules.auditTrade({ ...tLong, stop:62000 }, 10000).verdict, 'fail', '做多止损>入场');

// Test 3: 做空正确
const tShort = { symbol:'NVDA', direction:'short', entry_low:138, entry_high:140, stop:144, target1:128, target2:120, claimed_rr:2.5, size_cny:2000, anchors:{stop:'144阻力',target1:'128支撑',target2:'120支撑'}, falsification:'站稳144失效', exit_strategy:'144止损；128平50%；120清仓', market_env:'宏观中性，半导体板块轮动活跃，适合开仓', bear_case:'1) AI 资本开支可能不及预期 2) 估值仍偏高 3) 大盘若回调易加速下跌' };
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

// Test 10: 无市场环境评估
eq(AuditRules.auditTrade({ ...tLong, market_env:'' }, 10000).verdict, 'fail', '无市场环境');

// Test 11: 市场环境禁止开仓
eq(AuditRules.auditTrade({ ...tLong, market_env:'宏观逆风，禁止开仓' }, 10000).verdict, 'fail', '市场禁止开仓');

// Test 12: 市场环境观望 → warn
eq(AuditRules.auditTrade({ ...tLong, market_env:'波动率扩张，观望' }, 10000).verdict, 'warn', '市场观望 → warn');

// Test 13: 无空头反驳 → warn
eq(AuditRules.auditTrade({ ...tLong, bear_case:'' }, 10000).verdict, 'warn', '无空头反驳 → warn');

// ===== Compliance 数字硬检查 =====
console.log('\n📐 Compliance（Vibe 式数字风控）');
const compCode = fs.readFileSync('core/compliance.js', 'utf-8');
const Compliance = new Function(compCode + '; return Compliance;')();

// Test 14: 单笔仓位超 20% → fail
const cLong = { symbol:'BTC/USDT', direction:'long', entry_low:61000, entry_high:61700, stop:60400, target1:62900, target2:64900, claimed_rr:2.2, size_cny:3000, falsification:'x', exit_strategy:'y' };
eq(Compliance.checkTrade(cLong, 10000).some(c => c.status === 'fail'), true, '仓位30% → fail');

// Test 15: 盈亏比反算 < 2 → fail（自报 2.2 但价位算出来 1.2）
const cBadRR = { symbol:'BTC/USDT', direction:'long', entry_low:61000, entry_high:61700, stop:60800, target1:61700, target2:62900, claimed_rr:2.2, size_cny:1000 };
eq(Compliance.checkTrade(cBadRR, 10000).some(c => c.status === 'fail' && c.text.includes('盈亏比反算')), true, 'RR反算1.2 → fail');

// Test 16: 入场区间过宽 → fail
const cWide = { symbol:'BTC/USDT', direction:'long', entry_low:60000, entry_high:63000, stop:59000, target1:65000, target2:67000, claimed_rr:2.2, size_cny:1000 };
eq(Compliance.checkTrade(cWide, 10000).some(c => c.status === 'fail' && c.text.includes('入场区间')), true, '区间5% → fail');

// Test 17: 组合现金不足 40% → fail
const cPortBad = [
  { symbol:'A', direction:'long', size_cny:2500 },
  { symbol:'B', direction:'long', size_cny:2500 },
  { symbol:'C', direction:'long', size_cny:2500 }
];
eq(Compliance.checkPortfolio(cPortBad, { total:10000 }).some(c => c.status === 'fail' && c.text.includes('现金')), true, '现金25% → fail');

// Test 18: 同方向 4 笔 → fail
const cDirBad = [
  { symbol:'A', direction:'long', size_cny:500 },
  { symbol:'B', direction:'long', size_cny:500 },
  { symbol:'C', direction:'long', size_cny:500 },
  { symbol:'D', direction:'long', size_cny:500 }
];
eq(Compliance.checkPortfolio(cDirBad, { total:10000 }).some(c => c.status === 'fail' && c.text.includes('同方向')), true, '同向4笔 → fail');

// Test 19: 合规单全 pass
const cGood = { symbol:'BTC/USDT', direction:'long', entry_low:61000, entry_high:61700, stop:60400, target1:64000, target2:66000, claimed_rr:2.2, size_cny:1600 };
eq(Compliance.checkTrade(cGood, 10000).every(c => c.status === 'pass'), true, '合规单全 pass');

// Test 20: 黑名单 → fail
const cBlock = { symbol:'XXX', direction:'long', entry_low:1, entry_high:1.01, stop:0.95, target1:1.1, target2:1.2, claimed_rr:2.2, size_cny:1000 };
eq(Compliance.checkTrade(cBlock, 10000).some(c => c.status === 'fail' && c.text.includes('黑名单')), false, '黑名单空 → 不误伤');
Compliance.LIMITS.excludeSymbols.push('XXX');
eq(Compliance.checkTrade(cBlock, 10000).some(c => c.status === 'fail' && c.text.includes('黑名单')), true, '加入黑名单 → fail');

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

// ===== AuditChain 日志链 =====
console.log('\n🔗 AuditChain');
const chainCode = fs.readFileSync('core/audit-chain.js', 'utf-8');
const AuditChain = new Function(chainCode + '; return AuditChain;')();

// Test 21: 空链校验通过
eq(AuditChain.verify([]).ok, true, '空链 ok');

// Test 22: 追加两笔后链完整
const recs = [];
recs.push(AuditChain.append(recs, {model:'claude', content: JSON.stringify({symbol:'BTC', dir:'long'}), summary:'BTC long'}));
recs.push(AuditChain.append(recs, {model:'gpt', content: JSON.stringify({symbol:'ETH', dir:'short'}), summary:'ETH short'}));
eq(AuditChain.verify(recs).ok, true, '两笔链完整');
eq(recs[1].prevHash, recs[0].hash, '第二笔 prevHash = 第一笔 hash');

// Test 23: 篡改第二笔内容 → 校验断裂
const tampered = JSON.parse(JSON.stringify(recs));
tampered[1].content = '{"symbol":"ETH","dir":"long"}';  // 改方向
eq(AuditChain.verify(tampered).ok, false, '篡改内容 → 断裂');

// Test 24: 篡改第一笔 hash → 第二笔 prevHash 失配
const tampered2 = JSON.parse(JSON.stringify(recs));
tampered2[0].hash = 'deadbeef';
const v2 = AuditChain.verify(tampered2);
eq(v2.ok, false, '伪造第一笔 hash → 断裂');
eq(v2.brokenAt, 0, '断裂点在第 1 笔（自身 hash 失配）');

// Test 25: 删除中间一笔 → prevHash 链断
const tampered3 = JSON.parse(JSON.stringify(recs));
tampered3.splice(0, 1);
eq(AuditChain.verify(tampered3).ok, false, '删除中间笔 → 断裂');

// Test 26: summary
eq(AuditChain.summary(recs).length, 2, 'summary 长度');
eq(AuditChain.summary(recs).latestHash, recs[1].hash, 'summary 最新 hash');

// ===== 汇总 =====
const total = passed + failed;
console.log(`\n${'='.repeat(50)}`);
console.log(`${passed}/${total} 通过, ${failed}/${total} 失败`);
if (failed === 0) { console.log('✅ ALL PASS'); process.exit(0); }
else { console.log('❌ FAILED'); process.exit(1); }
