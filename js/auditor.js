// ============================================================
// 3. Auditor — 交易审计逻辑（薄壳）
//
// 所有规则实现统一委托 core/audit-rules.js（宪法），
// 本文件只保留 Auditor 入口，避免双份维护。
// ============================================================
const Auditor = {
  auditTrade(t, total) {
    return AuditRules.auditTrade(t, total);
  },

  auditAll(trades, total) {
    return AuditRules.auditAll(trades, total);
  }
};
