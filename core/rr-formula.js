// ============================================================
// RR formula — 统一盈亏比计算
// 输入: claimed_rr (string|number)
// 输出: number (无效输入返回 0)
//
// 注意: 本文件是 JS 端 RR 计算的权威实现。
// v3 python 脚本中对应的实现在 tools/rr_calc.py，修改本文件时
// 必须同步修改对应文件，并确保共享测试用例通过。
// ============================================================
const RR = {
  parse(r) {
    const n = parseFloat(r);
    return Number.isFinite(n) ? n : 0;
  }
};
