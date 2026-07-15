// ============================================================
// 1. Store — 集中状态管理
// ============================================================
const MODEL_KEYS = ['claude','gpt','gemini','grok','deepseek'];
const MODEL_LABELS = {claude:'Claude Fable',gpt:'GPT-5.5',gemini:'Gemini 3.5 Pro',grok:'Grok 4.5',deepseek:'DeepSeek V4'};
const MODEL_COLORS = {claude:'#D97757',gpt:'#10A37F',gemini:'#1A73E8',grok:'#1DA1F2',deepseek:'#4D6BFE'};

const Store = {
  state: {
    activeModel: null,
    currentData: null,        // {portfolio, trades, _meta}
    models: {},               // {modelId: {input, data, time, version, generated_at}}
    confirms: {},             // {modelId_idx: true/false/null}
    selected: new Set(),      // Set of "modelId_idx" strings
    filter: 'all',            // 'all' | 'confirmed' | 'rejected'
    currentLane: 'stream_us',    // 当前赛道
    tracker: [],              // [{id, symbol, direction, entry_low, entry_high, ...}]
    snapshot: null,           // {symbols: {...}, ts: ...}
    pendingSnapshotTimer: null,
    pendingTrackerTimer: null,
    subscribers: [],           // [{key, fn}]
    prompts: {}              // {lane: [{version, date, content}]}
  },

  _prefix: 'app_',
  _storageKeys: ['confirms', 'models', 'tracker', 'selected'],

  _save(key, val) {
    try { localStorage.setItem(this._prefix + key, JSON.stringify(val)); } catch(e) {}
  },
  _load(key, def) {
    try { const d = localStorage.getItem(this._prefix + key); return d ? JSON.parse(d) : def; } catch(e) { return def; }
  },

  // 从旧版 localStorage 迁移
  _migrateOldKeys() {
    const migrated = {confirms:{}, models:{}, tracker:[]};
    // 迁移模型数据: tradeflow_claude etc.
    MODEL_KEYS.forEach(k => {
      try {
        const old = localStorage.getItem('tradeflow_' + k);
        if (old) {
          const parsed = JSON.parse(old);
          if (parsed && parsed.data) {
            let ver = '', gen = '';
            if (parsed.data._meta) {
              ver = parsed.data._meta.version || '';
              gen = parsed.data._meta.generated_at || '';
            }
            migrated.models[k] = {
              input: parsed.input || '',
              data: parsed.data,
              time: parsed.time || '',
              version: ver,
              generated_at: gen
            };
          }
        }
      } catch(e) {}
    });
    // 迁移确认状态: tradeflow_confirm_claude_0 etc.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tradeflow_confirm_')) {
        try {
          const val = localStorage.getItem(key);
          const suffix = key.replace('tradeflow_confirm_', '');
          if (val === '1') migrated.confirms[suffix] = true;
          else if (val === '0') migrated.confirms[suffix] = false;
        } catch(e) {}
      }
    }
    // 迁移追踪: tradeflow_tracker
    try {
      const oldTracker = localStorage.getItem('app_tracker');
      if (oldTracker) {
        const parsed = JSON.parse(oldTracker);
        if (Array.isArray(parsed)) migrated.tracker = parsed;
      }
    } catch(e) {}
    return migrated;
  },

  subscribe(key, fn) {
    this.state.subscribers.push({key, fn});
  },

  _notify(changedKey) {
    this.state.subscribers.forEach(s => {
      if (s.key === changedKey || s.key === '*') s.fn(changedKey, this.state);
    });
  },

  dispatch(action, payload) {
    const s = this.state;
    // 调试：将 action 写入页面
    var dbg = document.getElementById('debugAction');
    if (!dbg) {
      dbg = document.createElement('div');
      dbg.id = 'debugAction';
      dbg.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#000;color:#0f0;padding:4px 8px;font-size:12px;font-family:monospace;z-index:99999;border-radius:4px';
      document.body.appendChild(dbg);
    }
    dbg.textContent = 'action: ' + action;
switch (action) {
      case 'SET_MODEL': {
        s.activeModel = payload;
        s.filter = 'all';
        s.selected = new Set();
        this._notify('activeModel');
        break;
      }
      case 'SET_DATA': {
        s.currentData = payload;
        this._notify('currentData');
        break;
      }
      case 'SAVE_MODEL': {
        const {id, input, data} = payload;
        const now = new Date();
        const ts = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        let ver = '', gen = '';
        if (data && data._meta) {
          ver = data._meta.version || '';
          gen = data._meta.generated_at || '';
        }
        s.models[id] = {input, data, time: ts, version: ver, generated_at: gen};
        this._save(s.currentLane + '_models', s.models);
        this._notify('models');
        break;
      }
      case 'CLEAR_MODEL': {
        const id = payload;
        delete s.models[id];
        this._save('models', s.models);
        this._notify('models');
        break;
      }
      case 'CONFIRM_TRADE': {
        const {key, value} = payload; // key = "modelId_idx", value = true/false/null
        if (value === null) delete s.confirms[key];
        else s.confirms[key] = value;
        this._save('confirms', s.confirms);
        this._notify('confirms');
        break;
      }
      case 'SET_FILTER': {
        s.filter = payload;
        this._notify('filter');
        break;
      }
      case 'SELECT_TRADE': {
        const {key, multi} = payload;
        if (multi) {
          if (s.selected.has(key)) s.selected.delete(key);
          else s.selected.add(key);
        } else {
          s.selected = new Set([key]);
        }
        this._notify('selected');
        break;
      }
      case 'SELECT_ALL': {
        s.selected = new Set(payload);
        this._notify('selected');
        break;
      }
      case 'CLEAR_SELECTION': {
        s.selected = new Set();
        this._notify('selected');
        break;
      }
      case 'BATCH_CONFIRM': {
        const {keys, value} = payload;
        keys.forEach(k => {
          if (value === null) delete s.confirms[k];
          else s.confirms[k] = value;
        });
        s.selected = new Set();
        this._save('confirms', s.confirms);
        this._notify('confirms');
        this._notify('selected');
        break;
      }
      case 'ADD_TRACKER': {
        const items = Array.isArray(payload) ? payload : [payload];
        items.forEach(item => {
          if (!s.tracker.find(t => t.id === item.id)) {
            s.tracker.push({...item, tracked_at: new Date().toISOString()});
          }
        });
        this._save('tracker', s.tracker);
        this._notify('tracker');
        break;
      }
      case 'REMOVE_TRACKER': {
        s.tracker = s.tracker.filter(t => t.id !== payload);
        this._save('tracker', s.tracker);
        this._notify('tracker');
        break;
      }
      case 'CLEAR_TRACKER': {
        s.tracker = [];
        this._save('tracker', []);
        this._notify('tracker');
        break;
      }
      case 'SET_SNAPSHOT': {
        s.snapshot = payload;
        this._notify('snapshot');
        break;
      }
      default: {
        console.warn('handleAction: unknown action', action);
        break;
      }
    }
  },

  init() {
      // 清理之前的定时器，防止堆积
      if (window._auditTimers) {
        window._auditTimers.forEach(function(t) { clearInterval(t); clearTimeout(t); });
      }
      window._auditTimers = [];

    // 加载新格式数据
    this.state.models = this._load('models', {});
    this.state.confirms = this._load('confirms', {});
    this.state.tracker = this._load('tracker', []);
    const sel = this._load(this.state.currentLane + '_selected', []);
    this.state.selected = new Set(sel);
    try {
      var p = JSON.parse(localStorage.getItem('app_prompts'));
      if (p) this.state.prompts = p;
    } catch(e) {}

    // 检查是否有旧版数据需要迁移
    const hasNew = Object.keys(this.state.models).length > 0;
    if (!hasNew) {
      const old = this._migrateOldKeys();
      if (Object.keys(old.models).length > 0 || Object.keys(old.confirms).length > 0) {
        this.state.models = old.models;
        this.state.confirms = old.confirms;
        this.state.tracker = old.tracker;
        this._save('models', old.models);
        this._save('confirms', old.confirms);
        this._save('tracker', old.tracker);
        // 清理旧键
        MODEL_KEYS.forEach(k => { try { localStorage.removeItem('tradeflow_' + k); } catch(e) {} });
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('tradeflow_confirm_')) try { localStorage.removeItem(k); } catch(e) {}
        }
        try { localStorage.removeItem('tradeflow_tracker'); } catch(e) {}
      }
    }
  },

  getModelTrades(modelId) {
    const m = this.state.models[modelId];
    if (!m || !m.data) return null;
    let d = m.data;
    let depth = 0;
    while (d && d.data && d.data.portfolio && !d.portfolio && depth < 3) {
      d = d.data;
      depth++;
    }
    return d;
  },

  getConfirmKey(modelId, idx) {
    return modelId + '_' + idx;
  },

  getConfirm(modelId, idx) {
    const key = this.getConfirmKey(modelId, idx);
    return this.state.confirms[key] !== undefined ? this.state.confirms[key] : null;
  },

  getSelectedData() {
    return Array.from(this.state.selected);
  },

  switchLane(lane) {
    if (lane === this.state.currentLane) return;
    this.state.currentLane = lane;
    this.state.selected = new Set();
    this.state.models = this._load(lane + '_models', {});
    this.state.confirms = this._load(lane + '_confirms', {});
    this.state.tracker = this._load(lane + '_tracker', []);
    const sel = this._load(lane + '_selected', []);
    this.state.selected = new Set(sel);
    this.state.filter = 'all';
    this.state.activeModel = null;
    this.state.currentData = null;
    this._notify('currentLane');
  },

  savePrompts(lane, version, content) {
    if (!this.state.prompts) this.state.prompts = {};
    const prompts = this.state.prompts;
    if (!prompts[lane]) prompts[lane] = [];
    prompts[lane].push({
      version: version,
      date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      content: content
    });
    try { localStorage.setItem('app_prompts', JSON.stringify(prompts)); } catch(e) {}
    this._notify('prompts');
  },

  updatePrompt(lane, idx, version, content) {
    if (!this.state.prompts || !this.state.prompts[lane]) return;
    if (idx < 0 || idx >= this.state.prompts[lane].length) return;
    this.state.prompts[lane][idx].version = version;
    this.state.prompts[lane][idx].content = content;
    this.state.prompts[lane][idx].date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    try { localStorage.setItem('app_prompts', JSON.stringify(this.state.prompts)); } catch(e) {}
    this._notify('prompts');
  },

  deletePrompt(lane, idx) {
    if (!this.state.prompts || !this.state.prompts[lane]) return;
    if (idx < 0 || idx >= this.state.prompts[lane].length) return;
    this.state.prompts[lane].splice(idx, 1);
    try { localStorage.setItem('app_prompts', JSON.stringify(this.state.prompts)); } catch(e) {}
    this._notify('prompts');
  },

  getPrompts(lane) {
    if (!this.state.prompts) this.state.prompts = {};
    return this.state.prompts[lane] || [];
  }
};

