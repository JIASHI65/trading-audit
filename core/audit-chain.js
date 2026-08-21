// ============================================================
// audit-chain.js — 审计日志链（防篡改）
//
// 用途：每次审计保存时追加一条链记录，hash 覆盖本次内容 + 上一笔 hash。
//       任何一笔被改，其后所有 hash 全部失配 → 可检测篡改。
//
// 纪律：
//   - 纯函数，零 DOM，输入 records 数组，输出校验结果
//   - hash 算法：FNV-1a 32bit（确定性、快、无需 crypto 模块）
// ============================================================

const AuditChain = {
  // ---------- FNV-1a 32bit hash ----------
  hash(str) {
    const s = String(str == null ? '' : str);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  },

  // ---------- 序列化审计内容（稳定字段顺序） ----------
  serialize(trades, meta) {
    const norm = (trades || []).map(t => ({
      symbol: t.symbol || '',
      direction: t.direction || '',
      entry_low: t.entry_low || 0,
      entry_high: t.entry_high || 0,
      stop: t.stop || 0,
      target1: t.target1 || 0,
      target2: t.target2 || 0,
      claimed_rr: t.claimed_rr || 0,
      size_cny: t.size_cny || 0,
      anchors: t.anchors || {},
      falsification: t.falsification || '',
      exit_strategy: t.exit_strategy || '',
      market_env: t.market_env || '',
      bear_case: t.bear_case || ''
    }));
    return JSON.stringify({meta: meta || {}, trades: norm});
  },

  // ---------- 创建下一条记录 ----------
  append(records, entry) {
    const prev = records.length > 0 ? records[records.length - 1] : null;
    const prevHash = prev ? prev.hash : '00000000';
    const contentHash = this.hash(entry.content || '');
    const hash = this.hash(contentHash + '|' + prevHash);
    return {
      ts: entry.ts || new Date().toISOString(),
      model: entry.model || '',
      action: entry.action || 'audit',
      content: entry.content || '',
      summary: entry.summary || '',
      contentHash: contentHash,
      prevHash: prevHash,
      hash: hash
    };
  },

  // ---------- 校验整条链（重放） ----------
  // 返回 {ok, brokenAt, records, reason}
  verify(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return {ok: true, brokenAt: -1, records: records || [], reason: 'empty'};
    }
    let prevHash = '00000000';
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      // 1. 上一笔链接是否正确
      if (r.prevHash !== prevHash) {
        return {ok: false, brokenAt: i, records, reason: 'prev_hash_mismatch: 第 ' + (i + 1) + ' 笔的 prevHash 与上一笔不符'};
      }
      // 2. 本笔 hash 是否自洽（内容 + prevHash 重算）
      const expectHash = this.hash((r.contentHash || this.hash(r.content || '')) + '|' + prevHash);
      if (r.hash !== expectHash) {
        return {ok: false, brokenAt: i, records, reason: 'hash_mismatch: 第 ' + (i + 1) + ' 笔内容被改动或 hash 被伪造'};
      }
      // 3. contentHash 是否匹配内容
      if (r.contentHash && this.hash(r.content || '') !== r.contentHash) {
        return {ok: false, brokenAt: i, records, reason: 'content_mismatch: 第 ' + (i + 1) + ' 笔内容被改动'};
      }
      prevHash = r.hash;
    }
    return {ok: true, brokenAt: -1, records, reason: 'ok'};
  },

  // ---------- 摘要（用于展示） ----------
  summary(records) {
    return {
      length: (records || []).length,
      latestHash: (records && records.length > 0) ? records[records.length - 1].hash : null,
      firstTs: (records && records.length > 0) ? records[0].ts : null,
      lastTs: (records && records.length > 0) ? records[records.length - 1].ts : null
    };
  }
};
