// ============================================================
// 2. Parser — 多格式解析器
// ============================================================
const Parser = {
  parseRR(r) {
    const n = parseFloat(r);
    return Number.isFinite(n) ? n : 0;
  },

  tryNormalize(raw) {
    const trimmed = raw.trim();
    // 尝试直接解析 JSON
    try {
      const parsed = JSON.parse(trimmed);
      const pm = parsed._meta;
      let d = parsed;
      if (parsed.data && parsed.data.portfolio && !parsed.portfolio) d = parsed.data;
      if (pm) d._meta = pm;
      if (d.portfolio && d.trades) return d;
    } catch(e) {}

    // 尝试提取 ```json 代码块
    const jm = trimmed.match(/```json\s*([\s\S]*?)```/);
    if (jm) {
      try {
        const parsed = JSON.parse(jm[1].trim());
        const pm = parsed._meta;
        let d = parsed;
        if (parsed.data && parsed.data.portfolio && !parsed.portfolio) d = parsed.data;
        if (pm) d._meta = pm;
        if (d.portfolio && d.trades) return d;
      } catch(e) {}
    }

    // 尝试 Gemini 格式
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.part_3 && parsed.part_4) return this.convertGemini(parsed);
    } catch(e) {}

    // 纯 trades 数组
    try {
      const parsed = JSON.parse(trimmed);
      const pm2 = parsed._meta;
      if (parsed.trades && parsed.trades.length > 0) {
        if (pm2) parsed._meta = pm2;
        return parsed;
      }
    } catch(e) {}

    // 文本解析
    const textRes = this.parseText(trimmed);
    if (textRes && textRes.trades && textRes.trades.length > 0) return textRes;

    return null;
  },

  convertGemini(g) {
    const ps = (g.part_4 && g.part_4.portfolio_snapshot) || {};
    const eats = [];
    const deep = (g.part_3 && g.part_3.deep_analysis) || [];
    for (let i = 0; i < deep.length; i++) {
      const a = deep[i];
      const name = a.asset_name || '';
      const pm = name.match(/\(([^)]+)\)/);
      const jr = (a.debate && a.debate.judgment_and_risk) || {};
      const bear = (a.debate && a.debate.bear_evidence) || [];
      const et = a.exit_table || [];
      const s = jr.setup || '';
      const gp = function(k) {
        const r = new RegExp(k + '[：:]\\s*\\$?([\\d,]+(?:\\.\\d+)?)');
        const x = s.match(r);
        return x ? +x[1].replace(/,/g, '') : 0;
      };
      const dir = (jr.direction || '').indexOf('做空') >= 0 ? 'short' : 'long';
      eats.push({
        symbol: pm ? pm[1] : name,
        direction: dir,
        entry_low: gp('入场位'),
        entry_high: gp('入场位'),
        stop: gp('止损位'),
        target1: gp('目标1'),
        target2: gp('目标2'),
        claimed_rr: +(jr.risk_reward_ratio || '0').replace(/[^\d.]/g, '') || 0,
        size_cny: +((jr.allocated_capital_yuan || '').match(/([\d,]+)/) || [0, 0])[1].replace(/,/g, '') || 0,
        anchors: { stop: (a.mftr && a.mftr.risk_control || '').substring(0, 100), target1: '', target2: '' },
        falsification: (bear[0] || '') + '；' + (bear[1] || '') || '未提供',
        exit_strategy: et.map(r => r.action + ' ' + r.price + ' ' + (r.execution || '')).join('；') || '未提供'
      });
    }
    return { portfolio: { total: ps.total_assets_yuan || 10000, cash: ps.cash_yuan || 7000 }, trades: eats };
  },

  parseText(text) {
    const lines = text.split('\n');
    const trades = [];
    let current = null;
    let inBox = false;

    function bt() { return {win_rate:0, avg_return:0, max_drawdown:0, sharpe:0, annualized:0, total_trades:0, period:'', source:''}; }
    function nt() { return {entry_low:0, entry_high:0, stop:0, target1:0, target2:0, claimed_rr:0, size_cny:0, anchors:{stop:'', target1:'', target2:''}, falsification:'', exit_strategy:'', backtest:bt(), direction:'long', symbol:''}; }
    function ft() { if (current && (current.entry_low || current.stop || current.target1 || current.symbol)) { trades.push(current); } current = null; inBox = false; }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const isBoxStart = line.charCodeAt(0) === 0x250c;
      const isBoxEnd = line.charCodeAt(0) === 0x2514;
      const isStarLine = line.indexOf('⭐') >= 0;

      if (isBoxStart) { inBox = true; if (!current) current = nt(); continue; }
      if (isBoxEnd) { ft(); continue; }

      if (isStarLine && !inBox) {
        ft();
        current = nt();
        const clean = line.replace(/[\u{1f000}-\u{1ffff}\u2600-\u2bff\ufe00-\ufe0f\u2700-\u27bf]/gu, '').trim();
        const parts = clean.split(/[\u2014\u2013\u2012-]/);
        if (parts.length > 0) {
          let sym = parts[0].trim();
          const pm = sym.match(/\(([^)]+)\)/);
          if (pm) sym = pm[1];
          current.symbol = sym;
        }
        current.direction = line.indexOf('做空') >= 0 ? 'short' : 'long';
        continue;
      }

      if (inBox && current) {
        const cl = line.replace(/^[│┃]\s*/, '');
        if (!current.entry_low && (cl.indexOf('买入') >= 0 || cl.indexOf('做空') >= 0 || cl.indexOf('观察区间') >= 0)) {
          const em = cl.match(/[\$\u00a5]\s*([\d,]+(?:\.\d+)?)\s*(?:[-\u2013\u2014\uff5eto]+\s*[\$\u00a5]?\s*([\d,]+(?:\.\d+)?))?/);
          if (em) { current.entry_low = +em[1].replace(/,/g, ''); current.entry_high = em[2] ? +em[2].replace(/,/g, '') : current.entry_low; }
        }
        const stopM = cl.match(/止损[：:]\s*[\$\u00a5]?\s*([\d,]+(?:\.\d+)?)/);
        if (stopM) current.stop = +stopM[1].replace(/,/g, '');
        const t1M = cl.match(/目标1[：:]\s*[\$\u00a5]?\s*([\d,]+(?:\.\d+)?)/);
        if (t1M) current.target1 = +t1M[1].replace(/,/g, '');
        const t2M = cl.match(/目标2[：:]\s*[\$\u00a5]?\s*([\d,]+(?:\.\d+)?)/);
        if (t2M) current.target2 = +t2M[1].replace(/,/g, '');
        const rrM = cl.match(/盈亏比[：:]\s*([\d.]+)/);
        if (rrM) current.claimed_rr = +rrM[1];
        const sizeM = cl.match(/仓位[：:]\s*([\d,]+)\s*元/);
        if (sizeM) current.size_cny = +sizeM[1].replace(/,/g, '');
        const falM = cl.match(/证伪条件[：:]\s*(.+)/);
        if (falM) current.falsification = falM[1].replace(/[│┃].*$/, '').trim().substring(0, 100);
        const exitM = cl.match(/离场[策略逻辑][：:]\s*(.+)/);
        if (exitM) current.exit_strategy = exitM[1].replace(/[│┃].*$/, '').trim().substring(0, 100);
      }
    }
    if (current && (current.entry_low || current.stop || current.target1 || current.symbol)) { trades.push(current); }

    for (let j = 0; j < trades.length; j++) {
      const t = trades[j];
      if (!t.symbol) t.symbol = 'UNKNOWN';
      if (!t.anchors || typeof t.anchors !== 'object') t.anchors = {stop:'文本解析：技术位设定', target1:'', target2:''};
      if (!t.falsification) t.falsification = '文本解析：未提供';
      if (!t.exit_strategy) t.exit_strategy = '文本解析：未提供';
      if (!t.size_cny) t.size_cny = 1000;
    }
    return trades.length > 0 ? { portfolio: { total: 10000, cash: 7000 }, trades: trades } : null;
  }
};

