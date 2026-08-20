// ============================================================
// 3. Auditor — 交易审计逻辑（薄壳）
//
// 所有规则实现统一委托 core/（宪法），本文件只保留入口。
// auditAll 合并两套检查：
//   AuditRules  — 9+2 条 LLM 信号质量审计（宪法）
//   Compliance  — Vibe 式数字硬检查（零 LLM，fail-closed）
// verdict 取两者最严（任一 fail → fail）。
// ============================================================
const Auditor = {
  auditTrade(t, total) {
    return AuditRules.auditTrade(t, total);
  },

  auditAll(trades, total) {
    const portfolio = { total: total };
    const llmAudited = AuditRules.auditAll(trades, total);
    const compAudited = Compliance.auditAll(trades, portfolio);
    return llmAudited.map((r, i) => {
      const llmFail = r.verdict === 'fail';
      const compFail = compAudited[i] && compAudited[i].verdict === 'fail';
      const verdict = llmFail || compFail ? 'fail' : (r.verdict === 'warn' ? 'warn' : 'pass');
      return {
        index: r.index,
        original: r.original,
        verdict,
        checks: r.checks.concat(compAudited[i] ? compAudited[i].checks : [])
      };
    });
  }
};
