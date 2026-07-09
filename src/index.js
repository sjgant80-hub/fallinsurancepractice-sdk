// fallinsurancepractice SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallinsurancepractice/index.html · 146172 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "fallinsurancepractice" }); }
    else go();
  })();
'use strict';
// ════════════════════════════════════════════════════════════════
// FallInsurancePractice v1.0.0 · sovereign UK insurance broker firm accounting · MIT
// TOOL · NOT REGULATED ADVICE · FCA submissions remain firm's responsibility
// ════════════════════════════════════════════════════════════════
const TOOLNAME='fallinsurancepractice';
const VERSION='1.0.0';
const PRIME=857;
const STORE='fallinsurancepractice-v1';
const TAX_YEAR='2025-26';
// UK insurance broker firm-side rule constants (calibrated 2025-26)
const RULES={
 iptStandard:0.12, // standard IPT rate
 iptHigher:0.20, // higher IPT rate (motor, travel, electrical extended warranty)
 cassMonthlyAmberDays:25, // CASS 5.5.63 monthly reconciliation; amber after 25d
 cassMonthlyRedDays:45, // red after 45d
 premiumRemittanceAmberDays:35, // typical 30-60d insurer TOBA window
 premiumRemittanceRedDays:60,
 piMinCoverSingle:1500000, // FCA SYSC / IDD insurance broker: £1.5m single claim
 piMinCoverAggregate:2250000, // 1.5x single = aggregate (FCA minimum)
 fcaFeeMinimum:1500,
 fcaFeeQuarterMonth:7, // FCA invoices July, due August
 bibaAnnualEstimate:495, // typical small-broker BIBA membership
 vatStandard:0.20,
 vatRegThreshold:90000,
 invoiceTermsDays:14,
 staleClientMoneyDays:180, // CASS 5 stale-balance investigation trigger
};
const TABS=[
 {id:'cass5',label:'CASS 5'},
 {id:'commission',label:'commission'},
 {id:'ipt',label:'IPT'},
 {id:'renewals',label:'renewals'},
 {id:'policies',label:'policies'},
 {id:'clients',label:'clients'},
 {id:'advisers',label:'advisers'},
 {id:'firm-pl',label:'firm P&L'},
 {id:'expenses',label:'expenses'},
 {id:'qa',label:'Q&A'},
];
let state={
 active:'dashboard',
 selectedClientId:null,
 selectedAdviserId:null,
 selectedPolicyId:null,
 firm:null,
 clients:[],
 advisers:[],
 policies:[],
 clientAccount:[], // CASS 5 client money ledger
 officeAccount:[], // firm's own commission / fee account
 reconciliations:[], // CASS 5 monthly reconciliations
 expenses:[],
 chat:[],
 audit:[],
 settings:{
 anthropicKey:'',geminiKey:'',openaiKey:'',openrouterKey:'',
 auditChain:true,
 piAnnualPremium:3600,
 fcaAnnualEstimate:1500,
 bibaAnnualEstimate:495,
 amlSupervisionAnnual:300,
 insurerRemittanceDays:30,
 networkLevyPct:0, // % retained by network if AR (0 for DA)
 isAR:false,
 bankDetails:'',
 conversionRateDefault:0.85, // renewal conversion forecast
 demoLoaded:false,
 },
};
// ─── util ───
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const uid=p=>(p||'')+Math.random().toString(36).slice(2,11);
const now=()=>Date.now();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>(+n||0).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0});
const money=n=>'£'+fmt(n);
const moneyP=n=>'£'+(+n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=n=>((+n||0)*100).toFixed(1)+'%';
const isoDate=ts=>new Date(ts||Date.now()).toISOString().slice(0,10);
const monthKey=ts=>new Date(ts||Date.now()).toISOString().slice(0,7);
const dayMs=86400000;
const daysBetween=(a,b)=>Math.floor((b-a)/dayMs);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),1900)}
async function sha256(s){const buf=new TextEncoder().encode(String(s));const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
// ─── IDB ───
let db;
const STORES=['state','clients','advisers','firms','policies','clientAccount','officeAccount','reconciliations','expenses','audit'];
function openDB(){return new Promise((res,rej)=>{
 const r=indexedDB.open(STORE,1);
 r.onupgradeneeded=e=>{const d=e.target.result;for(const s of STORES){if(!d.objectStoreNames.contains(s)){d.createObjectStore(s,{keyPath:'id'})}}};
 r.onsuccess=e=>{db=e.target.result;res(db)};
 r.onerror=()=>rej(r.error);
});}
function txStore(name,mode='readonly'){const tx=db.transaction(name,mode);return tx.objectStore(name)}
function idbPut(store,val){return new Promise(r=>{const req=txStore(store,'readwrite').put(val);req.onsuccess=()=>r(true);req.onerror=()=>r(false)})}
function idbDel(store,key){return new Promise(r=>{const req=txStore(store,'readwrite').delete(key);req.onsuccess=()=>r(true)})}
function idbGetAll(store){return new Promise(r=>{const req=txStore(store).getAll();req.onsuccess=()=>r(req.result||[]);req.onerror=()=>r([])})}
function idbGet(store,key){return new Promise(r=>{const req=txStore(store).get(key);req.onsuccess=()=>r(req.result);req.onerror=()=>r(null)})}
async function appendAudit(action,reasoning,payload){
 if(!state.settings.auditChain)return;
 const prev=state.audit.length?state.audit[state.audit.length-1]:null;
 const prevHash=prev?prev.hash:'';
 const docStr=JSON.stringify(payload||{});
 const docHash=await sha256(docStr);
 const i=(prev?prev.i:0)+1;
 const ts=Date.now();
 const hash=await sha256(prevHash+docHash+ts+i);
 const entry={id:'au_'+i+'_'+ts,i,ts,tool:TOOLNAME,configVersion:TOOLNAME+'@'+VERSION,adviserId:'',clientId:payload?.clientId||'',action,reasoning:reasoning||'',prevHash,docHash,hash,payload:payload||{}};
 state.audit.push(entry);
 if(state.audit.length>5000)state.audit=state.audit.slice(-5000);
 await idbPut('audit',entry);
}
async function saveState(){
 await idbPut('state',{id:'singleton',active:state.active,selectedClientId:state.selectedClientId,selectedAdviserId:state.selectedAdviserId,selectedPolicyId:state.selectedPolicyId,settings:state.settings,chat:state.chat});
}
async function loadAll(){
 await openDB();
 const s=await idbGet('state','singleton');
 if(s){state.active=s.active||state.active;state.selectedClientId=s.selectedClientId||null;state.selectedAdviserId=s.selectedAdviserId||null;state.selectedPolicyId=s.selectedPolicyId||null;state.settings=Object.assign({},state.settings,s.settings||{});state.chat=s.chat||[]}
 state.clients=await idbGetAll('clients');
 state.advisers=await idbGetAll('advisers');
 const firms=await idbGetAll('firms');state.firm=firms[0]||null;
 state.policies=await idbGetAll('policies');
 state.clientAccount=await idbGetAll('clientAccount');
 state.officeAccount=await idbGetAll('officeAccount');
 state.reconciliations=await idbGetAll('reconciliations');
 state.expenses=await idbGetAll('expenses');
 state.audit=await idbGetAll('audit');
 try{const ls=localStorage.getItem(STORE+'.settings');if(ls&&!s){state.settings=Object.assign({},state.settings,JSON.parse(ls))}}catch(e){}
}
function persistSettingsLS(){try{localStorage.setItem(STORE+'.settings',JSON.stringify(state.settings))}catch(e){}}
// ─── Demo data seed ───
async function maybeSeedDemo(){
 if(state.settings.demoLoaded)return;
 if(state.clients.length||state.advisers.length||state.firm||state.policies.length)return;
 const firmId='fm_demo_'+uid();
 state.firm={id:firmId,createdAt:now(),updatedAt:now(),name:'Marlow Insurance Brokers Ltd',tradingName:'',fcaRefNo:'654321',companiesHouseNo:'12345678',vatNumber:'',registeredAddress:{line1:'7 Insurance Square',city:'London',postcode:'EC3V 0AA',country:'GB'},piInsurer:'Travelers',piPolicyNo:'PI-IB-2026-001',piExpiresAt:Date.now()+95*dayMs,piCoverSingle:RULES.piMinCoverSingle,piCoverAggregate:RULES.piMinCoverAggregate,piAnnualPremium:3600,professionalBody:'BIBA',bibaMemberNo:'BIBA-2026-MARLOW',brandColor:'#8b1a1a',brandLogoDataUri:'',setupCompletedAt:now(),demo:true};
 await idbPut('firms',state.firm);
 const adv={id:'ad_demo_'+uid(),firmId,createdAt:now(),updatedAt:now(),archivedAt:null,name:'Sarah Marlow',email:'sarah@marlowbrokers.example',phone:'+44 7700 900222',fcaRefNo:'SM-IB-001',smcrRole:'SMF22',cpdHours:18,iddCompliance:true,status:'active',startedAt:now()-365*dayMs,leftAt:null,demo:true};
 state.advisers=[adv];await idbPut('advisers',adv);
 const cl={id:'cl_demo_'+uid(),firmId,createdAt:now()-200*dayMs,updatedAt:now(),archivedAt:null,title:'Mr',firstName:'David',middleName:'',lastName:'Chen',preferredName:'',dob:'1975-08-22',gender:'',nationality:'GB',countryOfResidence:'GB',nino:'',utr:'',taxResidency:['GB'],email:'david@chenmanufacturing.example',phone:'+44 7700 900333',industry:'Manufacturing',companiesHouseNo:'87654321',address:{line1:'14 Industrial Way',line2:'',city:'Birmingham',region:'England',postcode:'B1 1AA',country:'GB',since:'2018-01-01'},addressHistory:[],relationships:[],riskProfile:{claimsHistory:[],premiumTrend:'stable'},policiesHeld:[],kyc:{status:'verified',riskGrade:'low',pepFlag:false,pepDetails:'',sanctionsStatus:'clear',sanctionsCheckedAt:now()-30*dayMs,sanctionsCheckedBy:adv.id,sourceOfFunds:'business-trading',sourceOfFundsNotes:'',sourceOfWealth:'business',sourceOfWealthNotes:'',vulnerableCustomerFlag:false,vulnerabilityCategory:'',vulnerabilityNotes:'',documentsHeld:[],lastReviewAt:now()-30*dayMs,nextReviewDue:now()+335*dayMs},adviserId:adv.id,engagement:{startedAt:now()-180*dayMs,type:'ongoing',feeBasis:'commission',feeAgreementHash:'',feeAgreementSignedAt:now()-180*dayMs,initialFee:0,ongoingFee:0,nextReviewDue:now()+185*dayMs},notes:[],links:{},demo:true};
 state.clients=[cl];await idbPut('clients',cl);
 // 1 demo policy · commercial property
 const polId='pol_demo_'+uid();
 const gross=4500,iptRate=RULES.iptStandard,ipt=Math.round(gross*iptRate),fee=150,commissionPct=15,commission=Math.round((gross)*commissionPct/100);
 const netToInsurer=gross-commission;
 const pol={id:polId,firmId,clientId:cl.id,ts:now()-90*dayMs,updatedAt:now()-90*dayMs,lapsedAt:null,ref:'P-2026-0001',productClass:'commercial-property',insurer:'AXA Commercial',schemeRef:'',policyNumber:'AXA-CP-998877',inceptionDate:isoDate(now()-90*dayMs),renewalDate:isoDate(now()+275*dayMs),expiryDate:isoDate(now()+275*dayMs),status:'in-force',premium:{gross,ipt,fee,commission,net:netToInsurer},commissionPct,sumInsured:1500000,indemnityLimit:0,excess:1000,cover:{summary:'Buildings + contents + business interruption',exclusions:['flood-areas-stated'],endorsements:[]},demandsAndNeeds:'Client requires cover for Birmingham manufacturing site incl BI to £500k',cdSummary:'IPID delivered 2026-03-20',vulnerableCustomerFlag:false,midTermAdjustments:[],claims:[],adviserId:adv.id,demo:true};
 state.policies=[pol];await idbPut('policies',pol);
 cl.policiesHeld=[polId];await idbPut('clients',cl);
 // 3 demo CASS 5 client account entries
 const ce1={id:'ca_'+uid(),policyId:polId,clientId:cl.id,ts:now()-88*dayMs,dateOf:isoDate(now()-88*dayMs),direction:'in',amount:gross+ipt+fee,source:'premium-in',notes:'Premium + IPT + broker fee received from client D Chen, ref AXA-CP-998877',reconciledAt:now()-60*dayMs,advisorId:adv.id,demo:true};
 const ce2={id:'ca_'+uid(),policyId:polId,clientId:cl.id,ts:now()-85*dayMs,dateOf:isoDate(now()-85*dayMs),direction:'out',amount:netToInsurer+ipt,source:'IPT-out',notes:'Net premium + IPT remitted to AXA Commercial · within 30d TOBA terms',reconciledAt:now()-60*dayMs,advisorId:adv.id,demo:true};
 const ce3={id:'ca_'+uid(),policyId:polId,clientId:cl.id,ts:now()-85*dayMs,dateOf:isoDate(now()-85*dayMs),direction:'out',amount:commission+fee,source:'commission-out',notes:'Commission '+commissionPct+'% + broker fee transferred to office account · CASS 5.3.5 same-day split',reconciledAt:now()-60*dayMs,advisorId:adv.id,demo:true};
 state.clientAccount=[ce1,ce2,ce3];
 for(const c of state.clientAccount)await idbPut('clientAccount',c);
 // mirror commission receipt into office account
 const oa1={id:'oa_'+uid(),policyId:polId,clientId:cl.id,adviserId:adv.id,ts:now()-85*dayMs,dateOf:isoDate(now()-85*dayMs),direction:'in',amount:commission+fee,source:'commission-in',notes:'Commission received from client account',demo:true};
 state.officeAccount=[oa1];await idbPut('officeAccount',oa1);
 // monthly reconciliation (CASS 5.5.63) for last month
 const recMonth=monthKey(now()-30*dayMs);
 const rec1={id:'rec_'+uid(),month:recMonth,ts:now()-2*dayMs,advisorId:adv.id,bankBalance:0,internalBalance:0,discrepancy:0,supportingDocsSha256:await sha256('demo-bank-statement-'+recMonth),notes:'Monthly external reconciliation per CASS 5.5.63 · all cleared',demo:true};
 state.reconciliations=[rec1];await idbPut('reconciliations',rec1);
 // example expenses
 const m=monthKey(now());
 const expSeed=[
 {id:'ex_'+uid(),month:m,type:'PI insurance accrual',amount:Math.round((state.settings.piAnnualPremium||3600)/12),notes:'Monthly PI accrual',ts:now(),demo:true},
 {id:'ex_'+uid(),month:m,type:'BIBA membership',amount:Math.round((state.settings.bibaAnnualEstimate||495)/12),notes:'BIBA monthly accrual',ts:now(),demo:true},
 {id:'ex_'+uid(),month:m,type:'Software',amount:180,notes:'Acturis / SSP monthly',ts:now(),demo:true},
 ];
 state.expenses=expSeed;
 for(const e of state.expenses)await idbPut('expenses',e);
 state.settings.demoLoaded=true;
 state.selectedClientId=cl.id;state.selectedAdviserId=adv.id;state.selectedPolicyId=polId;
 await saveState();persistSettingsLS();
 await appendAudit('demo.seeded','Empty-state demo data loaded for insurance broker',{firm:state.firm.id,adviserCount:1,clientCount:1,policyCount:1,cassEntries:3});
}
// ─── BroadcastChannel mesh ───
let chFallInsurance=null, chFallClient=null, chFallSignal=null;
function setupMesh(){
 try{
 chFallInsurance=new BroadcastChannel('fall-insurance');
 chFallInsurance.addEventListener('message',onFallInsuranceMsg);
 chFallInsurance.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{}});
 }catch(e){}
 try{
 // also listen to base IFA mesh for shared client/adviser/firm
 chFallClient=new BroadcastChannel('fall-client');
 chFallClient.addEventListener('message',onFallClientMsg);
 chFallClient.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{}});
 }catch(e){}
 try{
 chFallSignal=new BroadcastChannel('fall-signal');
 chFallSignal.postMessage({source:TOOLNAME,type:'hello',prime:PRIME,version:VERSION,ts:now()});
 chFallSignal.addEventListener('message',async e=>{
 const m=e.data;if(!m)return;
 if(m.type==='ping')chFallSignal.postMessage({source:TOOLNAME,type:'pong',prime:PRIME});
 if(m.source==='si-didy'&&m.type==='query'&&m.intent){const ans=await answerQuestion(m.intent);chFallSignal.postMessage({source:TOOLNAME,type:'answer',replyTo:m.id,text:ans.text})}
 });
 }catch(e){}
}
async function onFallInsuranceMsg(e){
 const m=e.data;if(!m||m.source===TOOLNAME)return;
 if(m.type==='sync.request'){
 chFallInsurance.postMessage({v:1,type:'sync.snapshot',ts:now(),source:TOOLNAME,payload:{clients:state.clients,advisers:state.advisers,firm:state.firm,policies:state.policies}});
 return;
 }
 if(m.type==='sync.snapshot'){
 const p=m.payload||{};
 if(p.firm&&(!state.firm||(p.firm.updatedAt||0)>(state.firm.updatedAt||0))){state.firm=p.firm;await idbPut('firms',p.firm)}
 if(Array.isArray(p.clients))for(const c of p.clients){const ex=state.clients.find(x=>x.id===c.id);if(!ex||(c.updatedAt||0)>(ex.updatedAt||0)){if(ex)Object.assign(ex,c);else state.clients.push(c);await idbPut('clients',c)}}
 if(Array.isArray(p.advisers))for(const a of p.advisers){const ex=state.advisers.find(x=>x.id===a.id);if(!ex||(a.updatedAt||0)>(ex.updatedAt||0)){if(ex)Object.assign(ex,a);else state.advisers.push(a);await idbPut('advisers',a)}}
 if(Array.isArray(p.policies))for(const p2 of p.policies){const ex=state.policies.find(x=>x.id===p2.id);if(!ex||(p2.updatedAt||0)>(ex.updatedAt||0)){if(ex)Object.assign(ex,p2);else state.policies.push(p2);await idbPut('policies',p2)}}
 render();return;
 }
 if(m.type==='policy.created'||m.type==='policy.updated'||m.type==='policy.renewed'){
 const p=m.payload;if(!p||!p.id)return;
 const ex=state.policies.find(x=>x.id===p.id);
 if(ex)Object.assign(ex,p);else state.policies.push(p);
 await idbPut('policies',p);render();return;
 }
 if(m.type==='policy.lapsed'||m.type==='policy.claimed'){
 const p=m.payload;if(!p||!p.id)return;
 const ex=state.policies.find(x=>x.id===p.id);
 if(ex){Object.assign(ex,p);await idbPut('policies',ex)}
 render();return;
 }
 if(m.type==='commission.received'){
 // auto-create office account entry when other tool reports a commission receipt
 const cm=m.payload;if(!cm)return;
 const oa={id:'oa_'+uid(),policyId:cm.policyId||'',clientId:cm.clientId||'',adviserId:cm.adviserId||'',ts:cm.ts||now(),dateOf:isoDate(cm.ts||now()),direction:'in',amount:cm.amount||0,source:'commission-in',notes:'Auto-imported from '+m.source};
 state.officeAccount.push(oa);await idbPut('officeAccount',oa);
 await appendAudit('commission.imported','From mesh '+m.source,oa);
 render();return;
 }
 // shared client/adviser/firm events
 if(m.type==='client.created'||m.type==='client.updated'){
 const c=m.payload;if(!c||!c.id)return;
 const ex=state.clients.find(x=>x.id===c.id);
 if(ex)Object.assign(ex,c);else state.clients.push(c);
 await idbPut('clients',c);render();return;
 }
 if(m.type==='adviser.created'||m.type==='adviser.updated'){
 const a=m.payload;if(!a||!a.id)return;
 const ex=state.advisers.find(x=>x.id===a.id);
 if(ex)Object.assign(ex,a);else state.advisers.push(a);
 await idbPut('advisers',a);render();return;
 }
 if(m.type==='firm.updated'){
 if(m.payload){state.firm=m.payload;await idbPut('firms',m.payload);render()}
 return;
 }
}
async function onFallClientMsg(e){
 // shared IFA-base mesh — accept client/adviser/firm sync from siblings
 const m=e.data;if(!m||m.source===TOOLNAME)return;
 if(m.type==='sync.request'){
 chFallClient.postMessage({v:1,type:'sync.snapshot',ts:now(),source:TOOLNAME,payload:{clients:state.clients,advisers:state.advisers,firm:state.firm}});
 return;
 }
 if(m.type==='sync.snapshot'){
 const p=m.payload||{};
 if(p.firm&&(!state.firm||(p.firm.updatedAt||0)>(state.firm.updatedAt||0))){state.firm=p.firm;await idbPut('firms',p.firm)}
 if(Array.isArray(p.clients))for(const c of p.clients){const ex=state.clients.find(x=>x.id===c.id);if(!ex||(c.updatedAt||0)>(ex.updatedAt||0)){if(ex)Object.assign(ex,c);else state.clients.push(c);await idbPut('clients',c)}}
 if(Array.isArray(p.advisers))for(const a of p.advisers){const ex=state.advisers.find(x=>x.id===a.id);if(!ex||(a.updatedAt||0)>(ex.updatedAt||0)){if(ex)Object.assign(ex,a);else state.advisers.push(a);await idbPut('advisers',a)}}
 render();return;
 }
}
let bcastDebounce=null;
function broadcastUpsert(type,payload){
 clearTimeout(bcastDebounce);
 bcastDebounce=setTimeout(()=>{
 try{chFallInsurance&&chFallInsurance.postMessage({v:1,type,ts:now(),source:TOOLNAME,payload})}catch(e){}
 if(type==='client.created'||type==='client.updated'||type==='adviser.created'||type==='adviser.updated'||type==='firm.updated'){
 try{chFallClient&&chFallClient.postMessage({v:1,type,ts:now(),source:TOOLNAME,payload})}catch(e){}
 }
 },300);
}
function broadcastClientAccountEntry(ce){
 try{chFallInsurance&&chFallInsurance.postMessage({v:1,type:'clientAccount.entry',ts:now(),source:TOOLNAME,payload:ce})}catch(e){}
}
function broadcastReconciliation(rec){
 try{chFallInsurance&&chFallInsurance.postMessage({v:1,type:'reconciliation.done',ts:now(),source:TOOLNAME,payload:rec})}catch(e){}
}
// ═══════════════════ Analytics ═══════════════════
// ── CASS 5 client account ──
function clientAccountBalance(){
 let bal=0;
 for(const e of state.clientAccount){
 if(e.direction==='in')bal+=(e.amount||0);
 else if(e.direction==='out')bal-=(e.amount||0);
 }
 return bal;
}
function clientAccountByPolicy(policyId){
 return state.clientAccount.filter(e=>e.policyId===policyId);
}
function clientAccountBalanceByPolicy(policyId){
 return clientAccountByPolicy(policyId).reduce((b,e)=>b+(e.direction==='in'?(e.amount||0):-(e.amount||0)),0);
}
function lastReconciliation(){
 const r=state.reconciliations.slice().sort((a,b)=>b.ts-a.ts);return r[0]||null;
}
function daysSinceReconciliation(){const l=lastReconciliation();return l?daysBetween(l.ts,now()):999}
function staleClientBalances(){
 // policies with positive client-account balance held >180 days
 const out=[];
 for(const p of state.policies){
 const entries=clientAccountByPolicy(p.id);
 if(!entries.length)continue;
 const bal=clientAccountBalanceByPolicy(p.id);
 if(bal<=0)continue;
 const newest=Math.max(...entries.map(e=>e.ts));
 if(daysBetween(newest,now())>=RULES.staleClientMoneyDays){
 out.push({policy:p,balance:bal,daysHeld:daysBetween(newest,now())});
 }
 }
 return out;
}
function premiumRemittanceLate(){
 // for each policy: premium in but not yet fully remitted to insurer past TOBA terms
 const late=[];
 for(const p of state.policies){
 const entries=clientAccountByPolicy(p.id);
 const premIn=entries.filter(e=>e.source==='premium-in').reduce((a,e)=>a+(e.amount||0),0);
 const remitOut=entries.filter(e=>e.source==='IPT-out').reduce((a,e)=>a+(e.amount||0),0);
 if(!premIn)continue;
 const expected=(p.premium?.net||0)+(p.premium?.ipt||0);
 if(remitOut>=expected*0.99)continue; // settled
 // find earliest unfulfilled premium-in
 const oldestIn=Math.min(...entries.filter(e=>e.source==='premium-in').map(e=>e.ts));
 const daysOpen=daysBetween(oldestIn,now());
 if(daysOpen>state.settings.insurerRemittanceDays){
 late.push({policy:p,daysOpen,owing:expected-remitOut});
 }
 }
 return late;
}
// ── Commission ──
function commissionForPolicy(p){return (p.premium?.commission||0)}
function commissionTotal(opts){
 opts=opts||{};
 let total=0;
 for(const p of state.policies){
 if(opts.adviserId&&p.adviserId!==opts.adviserId)continue;
 if(opts.insurer&&p.insurer!==opts.insurer)continue;
 if(opts.month&&monthKey(p.ts)!==opts.month)continue;
 if(opts.year&&new Date(p.ts).getFullYear()!==opts.year)continue;
 if(opts.status&&p.status!==opts.status)continue;
 total+=commissionForPolicy(p);
 }
 return total;
}
function ytdCommission(){return commissionTotal({year:new Date().getFullYear()})}
function mtdCommission(){return commissionTotal({month:monthKey(now())})}
function commissionByInsurer(){
 const m={};for(const p of state.policies){m[p.insurer]=(m[p.insurer]||0)+commissionForPolicy(p)}return m;
}
function commissionByAdviser(adviserId){
 return state.policies.filter(p=>p.adviserId===adviserId).reduce((a,p)=>a+commissionForPolicy(p),0);
}
function commissionByMonth(n){
 const map=new Map();
 const d=new Date();d.setDate(1);
 for(let i=n-1;i>=0;i--){const dd=new Date(d.getFullYear(),d.getMonth()-i,1);map.set(monthKey(dd),{newBusiness:0,renewal:0,total:0})}
 for(const p of state.policies){
 const k=monthKey(p.ts);if(!map.has(k))continue;
 const e=map.get(k);
 const c=commissionForPolicy(p);
 // heuristic: if policy ts within last 12m of any older policy for same client -> renewal
 const isRenewal=state.policies.some(p2=>p2.id!==p.id&&p2.clientId===p.clientId&&p2.productClass===p.productClass&&p2.ts<p.ts);
 if(isRenewal)e.renewal+=c;else e.newBusiness+=c;
 e.total+=c;
 }
 return [...map.entries()].map(([k,v])=>({month:k,...v}));
}
function netCommissionAfterNetwork(c){
 if(!state.settings.isAR)return c;
 return c*(1-(state.settings.networkLevyPct||0));
}
// ── IPT ──
function iptForPolicy(p){return (p.premium?.ipt||0)}
function iptInsurerMonth(){
 // {insurer:{month:{collected,remitted,balance}}}
 const map={};
 for(const p of state.policies){
 if(!p.insurer)continue;
 if(!map[p.insurer])map[p.insurer]={};
 const m=monthKey(p.ts);
 if(!map[p.insurer][m])map[p.insurer][m]={collected:0,remitted:0,balance:0};
 map[p.insurer][m].collected+=iptForPolicy(p);
 }
 // remittance from client account IPT-out entries
 for(const e of state.clientAccount){
 if(e.source!=='IPT-out')continue;
 const p=state.policies.find(x=>x.id===e.policyId);if(!p)continue;
 const m=monthKey(e.ts);
 if(!map[p.insurer])map[p.insurer]={};
 if(!map[p.insurer][m])map[p.insurer][m]={collected:0,remitted:0,balance:0};
 // estimate IPT share of the outbound (IPT-out covers both net + IPT in our schema; use policy IPT)
 map[p.insurer][m].remitted+=iptForPolicy(p);
 }
 for(const ins in map){for(const m in map[ins]){map[ins][m].balance=map[ins][m].collected-map[ins][m].remitted}}
 return map;
}
// ── Renewal pipeline ──
function renewalsInRange(daysAhead){
 const cutoff=now()+daysAhead*dayMs;
 return state.policies.filter(p=>{
 if(p.status==='lapsed'||p.status==='mid-term-cancel')return false;
 if(!p.renewalDate)return false;
 const r=new Date(p.renewalDate).getTime();
 return r>=now()-7*dayMs&&r<=cutoff;
 }).sort((a,b)=>new Date(a.renewalDate).getTime()-new Date(b.renewalDate).getTime());
}
function renewalPipelineForecast(){
 // next 12 months bucketed by month
 const buckets=new Map();
 const d=new Date();d.setDate(1);
 for(let i=0;i<12;i++){const dd=new Date(d.getFullYear(),d.getMonth()+i,1);buckets.set(monthKey(dd),{expected:0,policies:0,conversionRate:state.settings.conversionRateDefault||0.85})}
 for(const p of renewalsInRange(365)){
 const k=monthKey(new Date(p.renewalDate).getTime());
 if(!buckets.has(k))continue;
 const b=buckets.get(k);
 b.expected+=commissionForPolicy(p)*(b.conversionRate);
 b.policies++;
 }
 return [...buckets.entries()].map(([k,v])=>({month:k,...v}));
}
// ── Office (firm) account / P&L ──
function officeIncomeMonth(m){
 return state.officeAccount.filter(e=>e.direction==='in'&&monthKey(e.ts)===m).reduce((a,e)=>a+(e.amount||0),0);
}
function expensesForMonth(m){return state.expenses.filter(e=>e.month===m)}
function expensesTotal(m){return expensesForMonth(m).reduce((a,e)=>a+(e.amount||0),0)}
function piMonthlyAccrual(){return Math.round((state.settings.piAnnualPremium||0)/12)}
function fcaMonthlyAccrual(){return Math.round((state.settings.fcaAnnualEstimate||0)/12)}
function bibaMonthlyAccrual(){return Math.round((state.settings.bibaAnnualEstimate||0)/12)}
function amlMonthlyAccrual(){return Math.round((state.settings.amlSupervisionAnnual||0)/12)}
function piDaysToExpiry(){if(!state.firm?.piExpiresAt)return null;return daysBetween(now(),state.firm.piExpiresAt)}
function expectedFixedCostMonthly(){return piMonthlyAccrual()+fcaMonthlyAccrual()+bibaMonthlyAccrual()+amlMonthlyAccrual()}
// ═══════════════════════ T0 / T3 cascade ═══════════════════════
const Cascade={
 async detectTier(){const s=state.settings;if(await this._probe())return'T2';if(s.anthropicKey||s.openaiKey||s.geminiKey||s.openrouterKey)return'T3';return'T0'},
 async _probe(){if(this._p!==undefined)return this._p;try{this._p=await Promise.race([fetch('http://127.0.0.1:11434/api/tags').then(r=>r.ok).catch(()=>false),new Promise(r=>setTimeout(()=>r(false),350))])}catch(e){this._p=false}return this._p},
 async generate(sys,user,maxTok){const s=state.settings,max=maxTok||1400;
 if(s.anthropicKey)try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':s.anthropicKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-4-5',max_tokens:max,system:sys,messages:[{role:'user',content:user}]})});const d=await r.json();return{tier:'T3·Claude',text:d?.content?.[0]?.text||''}}catch(e){}
 if(s.geminiKey)try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${s.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:[{parts:[{text:user}]}]})});const d=await r.json();return{tier:'T3·Gemini',text:d?.candidates?.[0]?.content?.parts?.[0]?.text||''}}catch(e){}
 if(s.openaiKey)try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.openaiKey},body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:sys},{role:'user',content:user}]})});const d=await r.json();return{tier:'T3·GPT',text:d?.choices?.[0]?.message?.content||''}}catch(e){}
 if(s.openrouterKey)try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.openrouterKey,'HTTP-Referer':location.origin},body:JSON.stringify({model:'anthropic/claude-haiku-4-5',messages:[{role:'system',content:sys},{role:'user',content:user}]})});const d=await r.json();return{tier:'T3·OpenRouter',text:d?.choices?.[0]?.message?.content||''}}catch(e){}
 return{tier:'T0',text:null}
 }
};
async function updateTierBadge(){const t=await Cascade.detectTier();const el=$('#tierBadge');el.textContent=t==='T0'?'offline':t;el.classList.toggle('t3',t!=='T0');$('#pTier').textContent=t==='T0'?'T0':t}
// T0 rules · 14 UK insurance-broker firm-side rules
const T0_RULES=[
 {id:'cass5-cadence',match:/cass ?5 ?reconcil|reconciliation cadence|how often.+(reconcil|client money)/i,answer:()=>`**CASS 5 reconciliation cadence (insurance brokers):**
- **Internal client money calculation** · CASS 5.5.63R · **at least every 25 business days** for non-statutory trust firms; **monthly** is the practical baseline.
- **External reconciliation** · against bank statement, **monthly minimum**, more frequent for high-volume firms.
- Discrepancies must be investigated within **5 business days** and either reflected, returned, or topped up.
- Records kept **3 years** minimum (FCA SYSC pushes to 6).
Posture · last reconciliation ${lastReconciliation()?'was '+daysSinceReconciliation()+' days ago':'has never been logged'}.
- Amber after ${RULES.cassMonthlyAmberDays} days · Red after ${RULES.cassMonthlyRedDays} days.
${daysSinceReconciliation()>RULES.cassMonthlyAmberDays?'⚠ Overdue — run reconcile now.':'OK.'}`},
 {id:'cass5-mixed',match:/mixed payment|cass ?5\.?3\.?5|mixed remittance/i,answer:()=>`**Mixed payment splits · CASS 5.3.5R:**
When a client payment includes both *client money* (insurer premium + IPT) and *firm money* (broker fee, commission already due), the firm must:
1. Pay the **entire** mixed remittance into the **client bank account** first
2. Transfer the firm-money portion (commission + broker fee) to the office account **the same business day** (CASS 5.3.5R)
3. Audit-trail both legs with the same reference
You cannot pay the gross mixed sum straight into office account and "split later". FallInsurancePractice logs both legs against the same policyId so the chain is visible.
Current client account balance: ${money(clientAccountBalance())}.`},
 {id:'remittance',match:/premium remittance|insurer.+(pay|remit)|toba.+(terms|window)/i,answer:()=>`**Premium-to-insurer remittance timing:**
- Governed by the **Terms of Business Agreement (TOBA)** with each insurer — typically **30 days** from inception/renewal, sometimes 45 or 60.
- Held longer? CASS 5 says it's still client money, but you owe the insurer per TOBA — late remittance breaches contract, can trigger commission clawback.
- Track per insurer · default amber after ${RULES.premiumRemittanceAmberDays}d · red after ${RULES.premiumRemittanceRedDays}d.
Your default insurer remittance days: ${state.settings.insurerRemittanceDays} · settable in Settings.
Late remittances right now: ${premiumRemittanceLate().length}.`},
 {id:'ipt-rates',match:/ipt ?(standard|higher|rate)|insurance premium tax/i,answer:()=>`**Insurance Premium Tax (IPT) — UK:**
- **Standard rate: ${(RULES.iptStandard*100).toFixed(0)}%** · most general insurance: commercial property, EL, PL, PI, D&O, cyber, home, landlord, pet, marine
- **Higher rate: ${(RULES.iptHigher*100).toFixed(0)}%** · travel insurance, mechanical/electrical extended warranties sold with vehicles or appliances, certain motor cover sold *via* the dealer
- **Exempt** · reinsurance, long-term life, commercial aircraft & ships, certain MoD risks, export risks
- Broker **collects IPT from client, remits to insurer with the premium**; the insurer then remits to HMRC. Broker is a pass-through.
Your IPT posture · ${state.policies.length} policies · total IPT collected: ${money(state.policies.reduce((a,p)=>a+iptForPolicy(p),0))}.`},
 {id:'pi-min',match:/pi (insurance|minimum|cover)|professional indemnit/i,answer:()=>`**PI insurance — FCA SYSC + IDD insurance broker minimums:**
- **Single claim** · €1.3m IDD floor, **£1.5m** is the FCA-set UK figure (≈ ${money(RULES.piMinCoverSingle)})
- **Aggregate** · €1.85m IDD, **£2.25m** UK (≈ ${money(RULES.piMinCoverAggregate)})
- Excess: typically £5k-£10k per claim, no cap from FCA but should be appropriate to firm size
- Must be from a UK or EEA insurer authorised in general insurance
- **No PI = no FCA permission** — letting cover lapse is a Threshold Conditions breach
Your firm: ${state.firm?.piInsurer||'(insurer not set)'} · policy ${state.firm?.piPolicyNo||'(none)'} · cover ${state.firm?.piCoverSingle?money(state.firm.piCoverSingle)+' / '+money(state.firm.piCoverAggregate):'(not set)'} · expires ${state.firm?.piExpiresAt?isoDate(state.firm.piExpiresAt):'(not set)'}.
${piDaysToExpiry()!==null&&piDaysToExpiry()<60?'⚠ Renewal due in '+piDaysToExpiry()+' days — start the broker conversation now.':''}`},
 {id:'fca-fee',match:/fca fee|periodic fee|when.+(fca|invoice)/i,answer:()=>`**FCA periodic (annual) fee — insurance broker:**
- Invoiced **July**, due **end of August**.
- Insurance brokers sit in **fee block A.19** (general insurance distribution) and/or A.18 (insurance intermediation).
- Minimum periodic fee for small firms typically £${RULES.fcaFeeMinimum} (varies year to year, tariff-driven on retained brokerage).
- **FCA Financial Penalty Scheme** rebate applied at end of fee year.
- FSCS levy invoiced separately (also July/August), class **A — general insurance distribution**.
- Network ARs pay the network, not FCA directly.
Your firm estimate: ${money(state.settings.fcaAnnualEstimate||0)}/yr · accruing ${money(fcaMonthlyAccrual())}/month.`},
 {id:'capacity',match:/broker.+(vs|or) ?agent|agent of insurer|capacity/i,answer:()=>`**Broker vs Agent capacity (ICOBS 2.3.3R):**
Brokers can wear two hats and **must disclose which** to the client at every transaction:
- **Independent broker** · agent of the **client**; sources from a fair analysis of the market; client is the principal
- **Insurer's agent** · acting for the insurer (a "tied" or "multi-tied" appointed rep); insurer is the principal — commission may be undisclosed but capacity must be
- Disclosure required on the **demands & needs statement** and the IPID
Practical: if you bind cover on insurer A's binder but quote from market for the same client, you are acting as insurer's agent for the bound policy and broker for the rest. Disclose per-transaction.`},
 {id:'commission-disclosure',match:/commission disclos|disclose commission|fee.+disclosure/i,answer:()=>`**Commission disclosure rules (ICOBS 4.4 & IDD):**
- **Commercial clients · large risks** · disclose commission **only on request**, then in writing within reasonable time
- **Consumer & micro-enterprise** · disclose if asked; firm policy + IPID transparency expected
- **Broker fee (separately charged)** · MUST be disclosed *up front in cash terms* — never as a %, never hidden in premium
- **Premium financing** · APR + total cost of credit disclosed under Consumer Credit Act + ICOBS 5
- **Net of commission** policies (large commercial) · separately invoiced
Your average commission %: ${state.policies.length?(state.policies.reduce((a,p)=>a+(p.commissionPct||0),0)/state.policies.length).toFixed(1):'-'}%.`},
 {id:'net-vs-gross',match:/net of commission|gross premium|net premium/i,answer:()=>`**Net of commission vs gross premium:**
- **Gross premium** · the headline figure including commission (most retail / SME). Broker collects gross, splits commission to office, remits net to insurer.
- **Net premium** · large commercial / placed via Lloyd's broker / scheme — insurer quotes net, broker invoices client separately for the commission/fee on top.
When commission is paid net by insurer rather than collected via gross premium, **no CASS 5 client money applies to that commission** — it's never client money in the first place. Still record on the office account ledger for P&L.
Net of commission entries today: ${state.officeAccount.filter(e=>e.source==='commission-net').length}.`},
 {id:'premium-financing',match:/premium financ|premium credit|instalment.+(premium|cover)/i,answer:()=>`**Premium financing T&Cs (ICOBS 5 + CONC):**
- If the firm arranges premium credit (with a credit broker like Premium Credit, Close Brothers): **firm needs credit broking permission**.
- Disclose: APR, total cost of credit, total amount payable, instalment schedule, **cancellation fees on default**.
- Default consequence: if client misses an instalment, the policy can be **cancelled mid-term** by the credit provider (or insurer if NCD)
- **Mid-term cancellation refunds** flow back via the credit provider, not directly to client — track this on the client account ledger as a refund entry
- Treat premium credit referrals as a **separately remunerated** distribution channel — disclose commission per ICOBS 4
Insurance broker isn't a regulated credit-broker for free — that's a separate FCA permission (CB-only is low burden but it must be added).`},
 {id:'network-ar',match:/network.+(ar|levy)|appointed rep|ar.+(retain|net to firm)/i,answer:()=>`**Network AR vs Directly Authorised (DA):**
- **Directly Authorised (DA)** · firm holds FCA permission itself; pays full FCA fees; full compliance overhead
- **Appointed Representative (AR)** · network (principal) holds the permission; firm runs under their umbrella; network charges:
 - **% of brokerage retained** · typically **15-30%** for full-service networks (Bspoke, Cobra, Movo, Bravo)
 - Plus per-policy fees, software fees, audit fees
- AR firms still subject to FCA conduct rules but the principal carries SYSC accountability
Your firm config: ${state.settings.isAR?'**AR** · network retains '+pct(state.settings.networkLevyPct):'**DA**'} · ${state.settings.isAR?'net commission this YTD '+money(ytdCommission()*(1-(state.settings.networkLevyPct||0))):'no network levy'}.`},
 {id:'stale-client-money',match:/stale.+(client money|balance)|unallocated.+(premium|refund)/i,answer:()=>`**Stale client money (CASS 5):**
Per CASS 5, **unallocated / unclaimed client money** held > ${RULES.staleClientMoneyDays} days must be:
1. **Investigated** — usually old refund credits, overpaid premiums, mid-term refunds that never reached the client
2. **Returned to the client** if traceable
3. **Paid to a registered charity** with FCA notification if untraceable (after reasonable efforts)
4. Records of disposal kept **6 years**
Current stale balances on your books: ${staleClientBalances().length} policy(s).
${staleClientBalances().length?staleClientBalances().map(s=>`- ${s.policy.ref} · ${money(s.balance)} · held ${s.daysHeld}d`).join('\n'):''}`},
 {id:'audit-market',match:/insurer audit|market account|account.+(insurer|market)/i,answer:()=>`**Insurer audit / market account reconciliation:**
Each insurer's TOBA typically grants **right of audit** of the broker's records relating to that insurer's business — usually with reasonable notice.
- **Bordereau** · monthly statement to the insurer listing policies bound, premiums, commission — must reconcile to the insurer's own ledger
- **Aged debtor report** by insurer · how much premium is owed to them?
- **Cancellation refund flows** · who owes who on mid-term?
- Disputes typically resolved via **market accounts** — accumulating credits/debits per insurer settled periodically
Your insurers on book: ${[...new Set(state.policies.map(p=>p.insurer))].length} · top by commission: ${Object.entries(commissionByInsurer()).sort((a,b)=>b[1]-a[1])[0]?.[0]||'-'}.`},
 {id:'icobs-client-money',match:/icobs.+(principle|client money)|client money.+icobs/i,answer:()=>`**ICOBS principles for client money (insurance brokers):**
ICOBS doesn't run the client money rules itself — **CASS 5** does — but ICOBS frames the conduct around it:
- **ICOBS 2** · clear, fair, not misleading (covers how you describe holding premium)
- **ICOBS 4** · status disclosure (broker capacity, fees, commission)
- **ICOBS 5.3** · responsibilities pre-contract (demands & needs, IPID delivery)
- **ICOBS 6** · post-sale (mid-term changes, renewals)
- **ICOBS 6A** · mid-term cancellation, premium refunds, cooling-off
And cross-cutting: **Consumer Duty (PRIN 2A)** since July 2023 for retail + SME — fair value assessment on broker fees + commission.`},
];
async function answerQuestion(q){
 for(const r of T0_RULES){if(r.match.test(q))return{src:'T0 · UK insurance broker rules engine',text:r.answer()}}
 const tier=await Cascade.detectTier();
 if(tier!=='T0'){
 const ctx=`Firm: ${state.firm?.name||'(not set)'} · FCA ref ${state.firm?.fcaRefNo||'(n/a)'}
Advisers: ${state.advisers.length} · Clients: ${state.clients.length} · Policies: ${state.policies.length}
YTD commission: ${money(ytdCommission())} · MTD commission: ${money(mtdCommission())}
Client account balance: ${money(clientAccountBalance())} · last reconciled ${daysSinceReconciliation()}d ago
PI expires: ${state.firm?.piExpiresAt?isoDate(state.firm.piExpiresAt):'(unset)'}
Late premium remittances: ${premiumRemittanceLate().length} · stale balances: ${staleClientBalances().length}`;
 const sys=`You are FallInsurancePractice, a sovereign UK insurance broker firm-accounting tool. You support firm-side: CASS 5 client money, commission ledger, IPT, renewal pipeline, PI/FCA accruals. You are NOT a regulatory submission system — FCA RegData submissions remain the firm's responsibility. Always be concrete, cite £ amounts, prefer UK terminology, end with 'Verify with your compliance consultant before acting.'
Firm context:
${ctx}`;
 const r=await Cascade.generate(sys,q,1200);
 if(r.text)return{src:r.tier,text:r.text};
 }
 return{src:'T0 · fallback',text:`No rule match. Try: "CASS 5 reconciliation cadence?", "mixed payment rule?", "IPT standard rate?", "PI minimum cover?", "broker vs agent capacity?", "premium-to-insurer remittance timing?", "network AR levy?".
Or add an API key in Settings for grounded answers.`};
}
// ═══════════════════════ RENDER ═══════════════════════
function render(){
 renderTabs();
 const v=$('#view');
 let html='<div class="disclaimer"><strong>FallInsurancePractice</strong> is a tool for UK FCA-regulated insurance brokers. It assists with CASS 5 client money tracking, commission ledger, IPT remittance, renewal pipeline P&L, and PI/FCA/BIBA accruals. It is not a quote/bind/issue platform — insurer integrations remain the broker\'s responsibility. Sovereign — client data never leaves the device. Audit chain '+(state.settings.auditChain?'<strong>ON</strong>':'OFF')+' · '+state.audit.length+' entries.</div>';
 const t=state.active;
 if(t==='dashboard')html+=viewDashboard();
 else if(t==='cass5')html+=viewCASS5();
 else if(t==='commission')html+=viewCommission();
 else if(t==='ipt')html+=viewIPT();
 else if(t==='renewals')html+=viewRenewals();
 else if(t==='policies')html+=viewPolicies();
 else if(t==='clients')html+=viewClients();
 else if(t==='advisers')html+=viewAdvisers();
 else if(t==='firm-pl')html+=viewFirmPL();
 else if(t==='expenses')html+=viewExpenses();
 else if(t==='qa')html+=viewQA();
 v.innerHTML=html;
 if(t==='qa')scrollChatBottom();
}
function renderTabs(){
 $('#tabNav').innerHTML=TABS.map(t=>`<button class="${t.id===state.active?'active':''}" onclick="switchTab('${t.id}')">${esc(t.label)}</button>`).join('');
}
async function switchTab(id){state.active=id;await saveState();render()}
// ─── views ───
function viewDashboard(){
 const cbm=commissionByMonth(6);
 const maxMonth=Math.max(...cbm.map(m=>m.total),1);
 const cassDays=daysSinceReconciliation();
 const cassTone=cassDays>RULES.cassMonthlyRedDays?'red':cassDays>RULES.cassMonthlyAmberDays?'amber':'green';
 const piD=piDaysToExpiry();
 const piTone=piD===null?'muted':piD<30?'red':piD<60?'amber':'green';
 const remitLate=premiumRemittanceLate();
 const stale=staleClientBalances();
 const next30=renewalsInRange(30);
 const colors={newBusiness:'#b8974a',renewal:'#4ade80'};
 const yearForecast=renewalPipelineForecast().reduce((a,b)=>a+b.expected,0);
 return `
 <div class="section-h"><h2>Firm dashboard</h2><div class="sub">${esc(state.firm?.name||'(firm unset · open Settings)')} · ${TAX_YEAR} · ${state.settings.isAR?'AR':'DA'}</div></div>
 <div class="grid">
 <div class="card"><h3>Headline KPIs</h3>
 <div class="kpi"><span class="l">YTD commission</span><span class="v brass">${money(ytdCommission())}</span></div>
 <div class="kpi"><span class="l">MTD commission</span><span class="v">${money(mtdCommission())}</span></div>
 <div class="kpi"><span class="l">${state.settings.isAR?'Net after network levy':'(DA · no levy)'}</span><span class="v">${money(netCommissionAfterNetwork(ytdCommission()))}</span></div>
 <div class="kpi"><span class="l">Forecast renewal commission · 12m</span><span class="v purple">${money(yearForecast)}</span></div>
 <div class="kpi"><span class="l">Policies in-force</span><span class="v">${state.policies.filter(p=>p.status==='in-force').length} / ${state.policies.length}</span></div>
 <div class="kpi"><span class="l">Clients · advisers</span><span class="v">${state.clients.filter(c=>!c.archivedAt).length} · ${state.advisers.filter(a=>a.status==='active').length}</span></div>
 <div class="kpi"><span class="l">Expected fixed cost / mo</span><span class="v">${money(expectedFixedCostMonthly())}</span></div>
 </div>
 <div class="card"><h3>Last 6 months · commission</h3>
 <div class="barchart">
 ${cbm.map(m=>{
 const totalH=Math.round((m.total/maxMonth)*120);
 return `<div class="b"><div class="bar2" style="height:${totalH}px" title="${m.month} · ${money(m.total)}">
 ${['newBusiness','renewal'].map(t=>{const v=m[t]||0;if(!v)return '';const h=Math.round((v/maxMonth)*120);return `<div class="seg" style="background:${colors[t]};height:${h}px" title="${t}: ${money(v)}"></div>`}).join('')}
 </div><div class="lab">${m.month.slice(2)}</div></div>`;
 }).join('')}
 </div>
 <div class="legend">${Object.entries(colors).map(([k,c])=>`<span><span class="sw" style="background:${c}"></span>${k}</span>`).join('')}</div>
 </div>
 <div class="card"><h3>CASS 5 posture <span class="meta">killer feature</span></h3>
 <div class="kpi"><span class="l">Client account balance</span><span class="v brass">${money(clientAccountBalance())}</span></div>
 <div class="kpi"><span class="l">Days since reconciliation</span><span class="v ${cassTone}">${cassDays===999?'never':cassDays}</span></div>
 <div class="kpi"><span class="l">Late premium remittances</span><span class="v ${remitLate.length?'red':''}">${remitLate.length}</span></div>
 <div class="kpi"><span class="l">Stale balances >${RULES.staleClientMoneyDays}d</span><span class="v ${stale.length?'red':''}">${stale.length}</span></div>
 <button class="btn sm" onclick="switchTab('cass5')">open CASS 5</button>
 </div>
 <div class="card"><h3>PI insurance</h3>
 <div class="kpi"><span class="l">Insurer / policy</span><span class="v" style="font-size:11px">${esc(state.firm?.piInsurer||'-')} / ${esc(state.firm?.piPolicyNo||'-')}</span></div>
 <div class="kpi"><span class="l">Cover single / agg</span><span class="v" style="font-size:11px">${state.firm?.piCoverSingle?money(state.firm.piCoverSingle):'-'} / ${state.firm?.piCoverAggregate?money(state.firm.piCoverAggregate):'-'}</span></div>
 <div class="kpi"><span class="l">Expires</span><span class="v ${piTone}">${state.firm?.piExpiresAt?isoDate(state.firm.piExpiresAt):'(not set)'}</span></div>
 <div class="kpi"><span class="l">Days to renewal</span><span class="v ${piTone}">${piD===null?'-':piD}</span></div>
 <div class="kpi"><span class="l">Monthly accrual</span><span class="v">${money(piMonthlyAccrual())}</span></div>
 </div>
 <div class="card"><h3>Renewals · next 30d</h3>
 ${next30.length?next30.slice(0,6).map(p=>{
 const cl=state.clients.find(c=>c.id===p.clientId);
 const days=daysBetween(now(),new Date(p.renewalDate).getTime());
 const tone=days<14?'red':days<30?'amber':'green';
 return `<div class="kpi"><span class="l" style="font-size:11px">${esc(cl?cl.firstName+' '+cl.lastName:p.ref)} · ${esc(p.productClass)}</span><span class="v ${tone}">${p.renewalDate} (${days}d)</span></div>`;
 }).join(''):`<div class="empty" style="padding:10px;font-size:11px">No renewals in next 30d</div>`}
 <button class="btn sm" onclick="switchTab('renewals')">open renewals</button>
 </div>
 <div class="card"><h3>Quick actions</h3>
 <button class="btn primary sm" onclick="openModal('newPolicy')">+ policy</button>
 <button class="btn sm" onclick="openModal('cassReceipt')">+ premium-in</button>
 <button class="btn sm" onclick="openModal('cassRemittance')">+ remit to insurer</button>
 <button class="btn sm" onclick="openModal('reconcile')">monthly reconcile</button>
 <button class="btn sm" onclick="openModal('newClient')">+ client</button>
 <button class="btn sm" onclick="openModal('newAdviser')">+ adviser</button>
 <button class="btn sm" onclick="openModal('newExpense')">+ expense</button>
 </div>
 </div>`;
}
function viewCASS5(){
 const entries=state.clientAccount.slice().sort((a,b)=>b.ts-a.ts);
 const office=state.officeAccount.slice().sort((a,b)=>b.ts-a.ts);
 const days=daysSinceReconciliation();
 const tone=days>RULES.cassMonthlyRedDays?'red':days>RULES.cassMonthlyAmberDays?'amber':'green';
 const remitLate=premiumRemittanceLate();
 const stale=staleClientBalances();
 return `
 <div class="section-h"><h2>CASS 5 · client money <span class="sub">killer · 5.5.63 monthly recon · 5.3.5 mixed splits</span></h2><div class="actions">
 <button class="btn sm" onclick="openModal('cassReceipt')">+ premium-in</button>
 <button class="btn sm" onclick="openModal('cassRemittance')">+ remit to insurer</button>
 <button class="btn sm" onclick="openModal('cassSplit')">+ mixed split (5.3.5)</button>
 <button class="btn primary sm" onclick="openModal('reconcile')">+ monthly reconcile</button>
 </div></div>
 <div class="grid">
 <div class="card"><h3>Posture</h3>
 <div class="kpi"><span class="l">Client account balance</span><span class="v brass">${money(clientAccountBalance())}</span></div>
 <div class="kpi"><span class="l">Office account balance (MTD income)</span><span class="v">${money(officeIncomeMonth(monthKey(now())))}</span></div>
 <div class="kpi"><span class="l">Days since reconciliation</span><span class="v ${tone}">${days===999?'never':days}</span></div>
 <div class="kpi"><span class="l">Amber / Red threshold</span><span class="v">${RULES.cassMonthlyAmberDays}d · ${RULES.cassMonthlyRedDays}d</span></div>
 <div class="kpi"><span class="l">Late remittances to insurer</span><span class="v ${remitLate.length?'red':''}">${remitLate.length}</span></div>
 <div class="kpi"><span class="l">Stale balances >${RULES.staleClientMoneyDays}d</span><span class="v ${stale.length?'red':''}">${stale.length}</span></div>
 </div>
 <div class="card"><h3>By policy · current ledger</h3>
 ${state.policies.length?`<table><thead><tr><th>Policy</th><th>Insurer</th><th class="r">In</th><th class="r">Out</th><th class="r">Balance</th></tr></thead><tbody>
 ${state.policies.map(p=>{
 const ents=clientAccountByPolicy(p.id);
 const inn=ents.filter(e=>e.direction==='in').reduce((a,e)=>a+(e.amount||0),0);
 const out=ents.filter(e=>e.direction==='out').reduce((a,e)=>a+(e.amount||0),0);
 const bal=inn-out;
 return `<tr><td style="font-size:11px">${esc(p.ref)}</td><td style="font-size:11px">${esc(p.insurer)}</td><td class="r">${moneyP(inn)}</td><td class="r">${moneyP(out)}</td><td class="r ${bal>0?'amber':''}" style="color:${bal>0?'var(--amber)':bal<0?'var(--red)':'inherit'}">${moneyP(bal)}</td></tr>`;
 }).join('')}
 <tr class="total"><td colspan="4">Total client account</td><td class="r">${moneyP(clientAccountBalance())}</td></tr>
 </tbody></table>`:`<div class="empty">No policies yet.</div>`}
 </div>
 </div>
 ${remitLate.length?`<div class="card" style="margin-top:14px;border-color:var(--red)"><h3 style="color:var(--red)">⚠ Late premium remittances</h3>
 <table><thead><tr><th>Policy</th><th>Insurer</th><th class="r">Owing</th><th>Days open</th></tr></thead><tbody>
 ${remitLate.map(l=>`<tr><td>${esc(l.policy.ref)}</td><td>${esc(l.policy.insurer)}</td><td class="r">${moneyP(l.owing)}</td><td class="mono red" style="color:var(--red)">${l.daysOpen}</td></tr>`).join('')}
 </tbody></table></div>`:''}
 ${stale.length?`<div class="card" style="margin-top:14px;border-color:var(--amber)"><h3 style="color:var(--amber)">⚠ Stale client balances</h3>
 <p style="font-size:11px;color:var(--cream-muted);margin-bottom:8px">Per CASS 5 stale-balance rules: investigate, return to client if traceable, otherwise donate to charity with FCA notification.</p>
 <table><thead><tr><th>Policy</th><th>Insurer</th><th class="r">Balance</th><th>Days held</th></tr></thead><tbody>
 ${stale.map(s=>`<tr><td>${esc(s.policy.ref)}</td><td>${esc(s.policy.insurer)}</td><td class="r">${moneyP(s.balance)}</td><td class="mono amber" style="color:var(--amber)">${s.daysHeld}</td></tr>`).join('')}
 </tbody></table></div>`:''}
 <div class="split" style="margin-top:14px">
 <div class="card"><h3>Client account ledger <span class="meta">CASS 5</span></h3>
 ${entries.length?`<table><thead><tr><th>Date</th><th>Dir</th><th>Source</th><th>Policy</th><th class="r">Amount</th><th>Recon</th></tr></thead><tbody>
 ${entries.slice(0,30).map(e=>{
 const p=state.policies.find(x=>x.id===e.policyId);
 const dirColor=e.direction==='in'?'green':'red';
 return `<tr><td class="mono" style="font-size:11px">${isoDate(e.ts)}</td>
 <td><span class="tag ${dirColor}" style="font-size:9px">${esc(e.direction)}</span></td>
 <td><span class="tag" style="font-size:9px">${esc(e.source)}</span></td>
 <td style="font-size:11px">${esc(p?p.ref:'-')}</td>
 <td class="r">${moneyP(e.amount)}</td>
 <td style="font-size:11px">${e.reconciledAt?'<span class="tag green" style="font-size:9px">✓</span>':'<button class="btn sm" onclick="markCAEntryReconciled(\''+e.id+'\')">mark</button>'}</td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty">No client account entries.</div>`}
 </div>
 <div class="card"><h3>Office account ledger <span class="meta">firm money</span></h3>
 ${office.length?`<table><thead><tr><th>Date</th><th>Source</th><th>Policy</th><th class="r">Amount</th></tr></thead><tbody>
 ${office.slice(0,30).map(e=>{
 const p=state.policies.find(x=>x.id===e.policyId);
 return `<tr><td class="mono" style="font-size:11px">${isoDate(e.ts)}</td>
 <td><span class="tag" style="font-size:9px">${esc(e.source)}</span></td>
 <td style="font-size:11px">${esc(p?p.ref:'-')}</td>
 <td class="r">${moneyP(e.amount)}</td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty">No office account entries.</div>`}
 </div>
 </div>
 <div class="card" style="margin-top:14px">
 <h3>Reconciliation history <span class="meta">CASS 5.5.63</span></h3>
 ${state.reconciliations.length?`<table><thead><tr><th>Month</th><th>Date</th><th class="r">Bank</th><th class="r">Internal</th><th class="r">Discrepancy</th><th>Adviser</th><th>Docs hash</th></tr></thead><tbody>
 ${state.reconciliations.slice().sort((a,b)=>b.ts-a.ts).map(r=>{
 const adv=state.advisers.find(a=>a.id===r.advisorId);
 const disc=Math.abs(r.discrepancy||0);
 return `<tr><td class="mono">${esc(r.month)}</td><td class="mono" style="font-size:11px">${isoDate(r.ts)}</td><td class="r">${moneyP(r.bankBalance)}</td><td class="r">${moneyP(r.internalBalance)}</td><td class="r ${disc>0?'red':''}" style="color:${disc>0?'var(--red)':'var(--green)'}">${moneyP(r.discrepancy)}</td><td style="font-size:11px">${esc(adv?adv.name:'-')}</td><td class="mono" style="font-size:10px;color:var(--cream-muted)">${esc((r.supportingDocsSha256||'').slice(0,12))}…</td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty">No reconciliations recorded. Monthly minimum (CASS 5.5.63) — run one now.</div>`}
 </div>`;
}
function viewCommission(){
 const policies=state.policies.slice().sort((a,b)=>b.ts-a.ts);
 const byInsurer=commissionByInsurer();
 const totalC=state.policies.reduce((a,p)=>a+commissionForPolicy(p),0);
 const netC=netCommissionAfterNetwork(totalC);
 return `
 <div class="section-h"><h2>Commission ledger</h2><div class="actions">
 <button class="btn sm" onclick="exportCommission()">↓ CSV</button>
 <button class="btn primary sm" onclick="openModal('newPolicy')">+ policy</button>
 </div></div>
 <div class="grid">
 <div class="card"><h3>Totals</h3>
 <div class="kpi"><span class="l">Gross commission · all time</span><span class="v brass">${money(totalC)}</span></div>
 <div class="kpi"><span class="l">YTD</span><span class="v">${money(ytdCommission())}</span></div>
 <div class="kpi"><span class="l">MTD</span><span class="v">${money(mtdCommission())}</span></div>
 ${state.settings.isAR?`<div class="kpi"><span class="l">Network levy</span><span class="v red">-${money(totalC-netC)} (${pct(state.settings.networkLevyPct)})</span></div>
 <div class="kpi"><span class="l">Net to firm after levy</span><span class="v brass">${money(netC)}</span></div>`:''}
 <div class="kpi"><span class="l">Avg commission %</span><span class="v">${state.policies.length?(state.policies.reduce((a,p)=>a+(p.commissionPct||0),0)/state.policies.length).toFixed(1):'-'}%</span></div>
 </div>
 <div class="card"><h3>By insurer</h3>
 ${Object.keys(byInsurer).length?Object.entries(byInsurer).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="kpi"><span class="l">${esc(k)}</span><span class="v">${money(v)}</span></div>`).join(''):`<div class="empty">No policies.</div>`}
 </div>
 <div class="card"><h3>By adviser</h3>
 ${state.advisers.length?state.advisers.map(a=>`<div class="kpi"><span class="l">${esc(a.name)}</span><span class="v">${money(commissionByAdviser(a.id))}</span></div>`).join(''):`<div class="empty">No advisers.</div>`}
 </div>
 </div>
 <div class="card" style="margin-top:14px">
 ${policies.length?`<table><thead><tr><th>Date</th><th>Ref</th><th>Client</th><th>Insurer</th><th>Product</th><th class="r">Gross</th><th class="r">IPT</th><th class="r">Fee</th><th class="r">Comm%</th><th class="r">Commission</th><th>Status</th></tr></thead><tbody>
 ${policies.map(p=>{
 const cl=state.clients.find(c=>c.id===p.clientId);
 const stColor=p.status==='in-force'?'green':p.status==='lapsed'?'red':p.status==='claimed'?'amber':'muted';
 return `<tr><td class="mono" style="font-size:11px">${isoDate(p.ts)}</td>
 <td class="mono" style="font-size:11px">${esc(p.ref)}</td>
 <td style="font-size:12px">${esc(cl?cl.firstName+' '+cl.lastName:'-')}</td>
 <td style="font-size:11px">${esc(p.insurer)}</td>
 <td><span class="tag" style="font-size:9px">${esc(p.productClass)}</span></td>
 <td class="r">${moneyP(p.premium?.gross)}</td>
 <td class="r">${moneyP(p.premium?.ipt)}</td>
 <td class="r">${moneyP(p.premium?.fee)}</td>
 <td class="r">${esc(p.commissionPct)}%</td>
 <td class="r" style="color:var(--brass);font-weight:600">${moneyP(p.premium?.commission)}</td>
 <td><span class="tag ${stColor}" style="font-size:9px">${esc(p.status)}</span></td></tr>`;
 }).join('')}
 <tr class="total"><td colspan="5">Total</td><td class="r">${moneyP(policies.reduce((a,p)=>a+(p.premium?.gross||0),0))}</td><td class="r">${moneyP(policies.reduce((a,p)=>a+(p.premium?.ipt||0),0))}</td><td class="r">${moneyP(policies.reduce((a,p)=>a+(p.premium?.fee||0),0))}</td><td></td><td class="r">${moneyP(policies.reduce((a,p)=>a+(p.premium?.commission||0),0))}</td><td></td></tr>
 </tbody></table>`:`<div class="empty">No policies recorded. + policy to start.</div>`}
 </div>`;
}
function viewIPT(){
 const data=iptInsurerMonth();
 const totalCollected=Object.values(data).reduce((a,b)=>a+Object.values(b).reduce((c,d)=>c+d.collected,0),0);
 const totalRemitted=Object.values(data).reduce((a,b)=>a+Object.values(b).reduce((c,d)=>c+d.remitted,0),0);
 return `
 <div class="section-h"><h2>IPT remittance tracker</h2><div class="sub">${(RULES.iptStandard*100)}% standard · ${(RULES.iptHigher*100)}% higher · broker is pass-through</div></div>
 <div class="grid">
 <div class="card"><h3>Totals</h3>
 <div class="kpi"><span class="l">IPT collected (all time)</span><span class="v brass">${money(totalCollected)}</span></div>
 <div class="kpi"><span class="l">IPT remitted to insurers</span><span class="v">${money(totalRemitted)}</span></div>
 <div class="kpi"><span class="l">Outstanding balance</span><span class="v ${totalCollected-totalRemitted>0?'amber':'green'}">${money(totalCollected-totalRemitted)}</span></div>
 </div>
 <div class="card"><h3>About</h3>
 <p style="font-size:12px;color:var(--cream-dim)">IPT is collected from the client with the premium and remitted to the insurer with the net premium. The insurer then remits to HMRC. Broker holds IPT in the client account briefly — same CASS 5 cadence as premium. This tracker reconciles IPT-in vs IPT-out per insurer-month for audit.</p>
 </div>
 </div>
 <div class="card" style="margin-top:14px">
 <h3>By insurer × month</h3>
 ${Object.keys(data).length?`<table><thead><tr><th>Insurer</th><th>Month</th><th class="r">Collected</th><th class="r">Remitted</th><th class="r">Balance</th></tr></thead><tbody>
 ${Object.entries(data).flatMap(([ins,months])=>Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0])).map(([m,v])=>{
 const tone=v.balance>0?'amber':v.balance<0?'red':'green';
 return `<tr><td>${esc(ins)}</td><td class="mono">${esc(m)}</td><td class="r">${moneyP(v.collected)}</td><td class="r">${moneyP(v.remitted)}</td><td class="r" style="color:var(--${tone})">${moneyP(v.balance)}</td></tr>`;
 })).join('')}</tbody></table>`:`<div class="empty">No IPT activity yet.</div>`}
 </div>`;
}
function viewRenewals(){
 const next30=renewalsInRange(30);
 const next60=renewalsInRange(60).filter(p=>!next30.includes(p));
 const next90=renewalsInRange(90).filter(p=>!renewalsInRange(60).includes(p));
 const pipeline=renewalPipelineForecast();
 const yearForecast=pipeline.reduce((a,b)=>a+b.expected,0);
 const maxPipeline=Math.max(...pipeline.map(p=>p.expected),1);
 const lastYearActual=commissionTotal({year:new Date().getFullYear()-1});
 return `
 <div class="section-h"><h2>Renewal pipeline · P&L</h2><div class="actions">
 <button class="btn sm" onclick="openModal('conversionConfig')">conversion rate · ${pct(state.settings.conversionRateDefault)}</button>
 </div></div>
 <div class="grid">
 <div class="card"><h3>Forecast · next 12 months</h3>
 <div class="kpi"><span class="l">Expected commission (× conversion)</span><span class="v brass">${money(yearForecast)}</span></div>
 <div class="kpi"><span class="l">Default conversion rate</span><span class="v">${pct(state.settings.conversionRateDefault)}</span></div>
 <div class="kpi"><span class="l">vs prior year actual</span><span class="v ${yearForecast>=lastYearActual?'green':'amber'}">${lastYearActual?pct((yearForecast-lastYearActual)/lastYearActual):'-'}</span></div>
 <div class="kpi"><span class="l">Renewals in next 30 / 60 / 90d</span><span class="v">${next30.length} / ${next60.length+next30.length} / ${next90.length+next60.length+next30.length}</span></div>
 </div>
 <div class="card" style="grid-column:span 2"><h3>Pipeline by month</h3>
 <div class="barchart">
 ${pipeline.map(p=>{
 const h=Math.round((p.expected/maxPipeline)*120);
 return `<div class="b"><div class="bar2" style="height:${h}px;background:var(--purple);border-radius:2px" title="${p.month} · ${money(p.expected)} · ${p.policies} policies"></div><div class="lab">${p.month.slice(2)}</div></div>`;
 }).join('')}
 </div>
 <div class="legend"><span><span class="sw" style="background:var(--purple)"></span>expected commission</span></div>
 </div>
 </div>
 <div class="card" style="margin-top:14px"><h3>Next 90 days · renewal queue</h3>
 ${renewalsInRange(90).length?`<table><thead><tr><th>Renewal date</th><th>Days</th><th>Ref</th><th>Client</th><th>Insurer</th><th>Product</th><th class="r">Gross</th><th class="r">Commission</th><th class="r">Expected (× conv)</th></tr></thead><tbody>
 ${renewalsInRange(90).map(p=>{
 const cl=state.clients.find(c=>c.id===p.clientId);
 const days=daysBetween(now(),new Date(p.renewalDate).getTime());
 const tone=days<14?'red':days<30?'amber':'green';
 const exp=commissionForPolicy(p)*(state.settings.conversionRateDefault||0.85);
 return `<tr><td class="mono">${esc(p.renewalDate)}</td><td class="mono ${tone}" style="color:var(--${tone})">${days}d</td><td class="mono" style="font-size:11px">${esc(p.ref)}</td><td style="font-size:12px">${esc(cl?cl.firstName+' '+cl.lastName:'-')}</td><td style="font-size:11px">${esc(p.insurer)}</td><td><span class="tag" style="font-size:9px">${esc(p.productClass)}</span></td><td class="r">${moneyP(p.premium?.gross)}</td><td class="r" style="color:var(--brass)">${moneyP(commissionForPolicy(p))}</td><td class="r" style="color:var(--purple)">${moneyP(exp)}</td></tr>`;
 }).join('')}
 </tbody></table>`:`<div class="empty">No renewals in next 90 days.</div>`}
 </div>`;
}
function viewPolicies(){
 const policies=state.policies.slice().sort((a,b)=>b.ts-a.ts);
 const sel=state.policies.find(p=>p.id===state.selectedPolicyId);
 return `
 <div class="section-h"><h2>Policies · ${policies.length}</h2><div class="actions">
 <button class="btn primary sm" onclick="openModal('newPolicy')">+ policy</button>
 </div></div>
 <div class="grid2">
 <div class="card"><h3>List</h3>
 ${policies.length?`<table><tbody>${policies.map(p=>{
 const cl=state.clients.find(c=>c.id===p.clientId);
 return `<tr class="clickable" onclick="selectPolicy('${p.id}')"><td><strong>${esc(p.ref)}</strong><div style="font-size:11px;color:var(--cream-muted)">${esc(p.productClass)} · ${esc(p.insurer)}</div></td>
 <td style="font-size:11px">${esc(cl?cl.firstName+' '+cl.lastName:'-')}</td>
 <td class="r" style="font-size:11px">${money(commissionForPolicy(p))}</td>
 <td><span class="tag ${p.status==='in-force'?'green':p.status==='lapsed'?'red':'muted'}" style="font-size:9px">${esc(p.status)}</span></td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty">No policies. + policy.</div>`}
 </div>
 <div class="card"><h3>Detail</h3>
 ${sel?renderPolicyDetail(sel):`<div class="empty">Select a policy to see detail.</div>`}
 </div>
 </div>`;
}
function renderPolicyDetail(p){
 const cl=state.clients.find(c=>c.id===p.clientId);
 const adv=state.advisers.find(a=>a.id===p.adviserId);
 const ents=clientAccountByPolicy(p.id);
 const bal=clientAccountBalanceByPolicy(p.id);
 const renewalDays=p.renewalDate?daysBetween(now(),new Date(p.renewalDate).getTime()):null;
 return `
 <div class="kpi"><span class="l">Ref</span><span class="v">${esc(p.ref)}</span></div>
 <div class="kpi"><span class="l">Status</span><span class="v"><span class="tag ${p.status==='in-force'?'green':'amber'}">${esc(p.status)}</span></span></div>
 <div class="kpi"><span class="l">Client</span><span class="v">${esc(cl?cl.firstName+' '+cl.lastName:'-')}</span></div>
 <div class="kpi"><span class="l">Adviser</span><span class="v">${esc(adv?adv.name:'-')}</span></div>
 <div class="kpi"><span class="l">Insurer / scheme</span><span class="v">${esc(p.insurer)} / ${esc(p.schemeRef||'-')}</span></div>
 <div class="kpi"><span class="l">Policy number</span><span class="v mono" style="font-size:11px">${esc(p.policyNumber||'-')}</span></div>
 <div class="kpi"><span class="l">Inception → renewal</span><span class="v mono">${esc(p.inceptionDate||'-')} → ${esc(p.renewalDate||'-')}${renewalDays!==null?' ('+renewalDays+'d)':''}</span></div>
 <div class="kpi"><span class="l">Sum insured</span><span class="v">${money(p.sumInsured)}</span></div>
 <div class="kpi"><span class="l">Premium gross / IPT / fee</span><span class="v">${moneyP(p.premium?.gross)} / ${moneyP(p.premium?.ipt)} / ${moneyP(p.premium?.fee)}</span></div>
 <div class="kpi"><span class="l">Commission %</span><span class="v">${esc(p.commissionPct)}%</span></div>
 <div class="kpi"><span class="l">Commission £</span><span class="v brass">${moneyP(p.premium?.commission)}</span></div>
 <div class="kpi"><span class="l">Net to insurer</span><span class="v">${moneyP(p.premium?.net)}</span></div>
 <div class="kpi"><span class="l">D&N statement</span><span class="v" style="font-size:11px;text-align:left">${esc(p.demandsAndNeeds||'-')}</span></div>
 <div class="kpi"><span class="l">IPID</span><span class="v" style="font-size:11px">${esc(p.cdSummary||'-')}</span></div>
 <div class="kpi"><span class="l">Client-account balance for this policy</span><span class="v ${bal>0?'amber':bal<0?'red':'green'}">${moneyP(bal)}</span></div>
 <div style="margin-top:10px">
 <button class="btn sm" onclick="openModal('cassReceiptFor:${p.id}')">+ premium-in</button>
 <button class="btn sm" onclick="openModal('cassRemittanceFor:${p.id}')">+ remit to insurer</button>
 <button class="btn sm danger" onclick="lapsePolicy('${p.id}')">mark lapsed</button>
 </div>
 ${ents.length?`<div style="margin-top:10px;font-family:var(--mono);font-size:10px;color:var(--brass);letter-spacing:0.1em;text-transform:uppercase">CASS 5 ledger for this policy</div>
 <table><thead><tr><th>Date</th><th>Dir</th><th>Source</th><th class="r">Amount</th><th>Recon</th></tr></thead><tbody>
 ${ents.sort((a,b)=>b.ts-a.ts).map(e=>`<tr><td class="mono" style="font-size:11px">${isoDate(e.ts)}</td><td><span class="tag ${e.direction==='in'?'green':'red'}" style="font-size:9px">${e.direction}</span></td><td><span class="tag" style="font-size:9px">${esc(e.source)}</span></td><td class="r">${moneyP(e.amount)}</td><td style="font-size:11px">${e.reconciledAt?'<span class="tag green" style="font-size:9px">✓</span>':'-'}</td></tr>`).join('')}
 </tbody></table>`:''}`;
}
function viewClients(){
 const sel=state.clients.find(c=>c.id===state.selectedClientId);
 const list=state.clients.filter(c=>!c.archivedAt).sort((a,b)=>(a.lastName||'').localeCompare(b.lastName||''));
 return `
 <div class="section-h"><h2>Clients</h2><div class="actions">
 <button class="btn primary sm" onclick="openModal('newClient')">+ client</button>
 </div></div>
 <div class="grid2">
 <div class="card"><h3>List · ${list.length}</h3>
 ${list.length?`<table><tbody>${list.map(c=>{
 const polCount=state.policies.filter(p=>p.clientId===c.id).length;
 const comm=state.policies.filter(p=>p.clientId===c.id).reduce((a,p)=>a+commissionForPolicy(p),0);
 return `<tr class="clickable" onclick="selectClient('${c.id}')"><td><strong>${esc((c.firstName||'')+' '+(c.lastName||''))}</strong><div style="font-size:11px;color:var(--cream-muted)">${esc(c.industry||'-')} · ${esc(c.email||'')}</div></td>
 <td class="r" style="font-size:11px">${polCount} pol · ${money(comm)}</td>
 <td><span class="tag ${c.kyc?.status==='verified'?'green':'amber'}" style="font-size:9px">${esc(c.kyc?.status||'-')}</span></td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty">No clients. Add one or wait for sync from FallInsurance/FallInsuranceOnboard.</div>`}
 </div>
 <div class="card"><h3>Detail</h3>
 ${sel?renderClientDetail(sel):`<div class="empty">Select a client.</div>`}
 </div>
 </div>`;
}
function renderClientDetail(c){
 const pols=state.policies.filter(p=>p.clientId===c.id);
 const totalComm=pols.reduce((a,p)=>a+commissionForPolicy(p),0);
 const totalGross=pols.reduce((a,p)=>a+(p.premium?.gross||0),0);
 const ce=state.clientAccount.filter(e=>e.clientId===c.id);
 return `
 <div class="kpi"><span class="l">Name</span><span class="v">${esc((c.firstName||'')+' '+(c.lastName||''))}</span></div>
 <div class="kpi"><span class="l">Industry</span><span class="v">${esc(c.industry||'-')}</span></div>
 <div class="kpi"><span class="l">Companies House</span><span class="v mono">${esc(c.companiesHouseNo||'-')}</span></div>
 <div class="kpi"><span class="l">Email</span><span class="v" style="font-size:11px">${esc(c.email||'-')}</span></div>
 <div class="kpi"><span class="l">Adviser</span><span class="v">${esc(state.advisers.find(a=>a.id===c.adviserId)?.name||'-')}</span></div>
 <div class="kpi"><span class="l">KYC</span><span class="v">${esc(c.kyc?.status||'-')} · ${esc(c.kyc?.riskGrade||'-')}</span></div>
 <div class="kpi"><span class="l">Policies held</span><span class="v">${pols.length}</span></div>
 <div class="kpi"><span class="l">Lifetime gross premium</span><span class="v">${money(totalGross)}</span></div>
 <div class="kpi"><span class="l">Lifetime commission</span><span class="v brass">${money(totalComm)}</span></div>
 ${pols.length?`<table style="margin-top:10px"><thead><tr><th>Ref</th><th>Product</th><th>Insurer</th><th class="r">Comm</th><th>Renewal</th></tr></thead><tbody>
 ${pols.sort((a,b)=>b.ts-a.ts).map(p=>`<tr><td class="mono" style="font-size:11px">${esc(p.ref)}</td><td><span class="tag" style="font-size:9px">${esc(p.productClass)}</span></td><td style="font-size:11px">${esc(p.insurer)}</td><td class="r">${moneyP(commissionForPolicy(p))}</td><td class="mono" style="font-size:11px">${esc(p.renewalDate||'-')}</td></tr>`).join('')}
 </tbody></table>`:''}`;
}
function viewAdvisers(){
 const sel=state.advisers.find(a=>a.id===state.selectedAdviserId);
 const list=state.advisers.filter(a=>!a.archivedAt).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
 return `
 <div class="section-h"><h2>Advisers · P&L</h2><div class="actions">
 <button class="btn primary sm" onclick="openModal('newAdviser')">+ adviser</button>
 </div></div>
 <div class="grid2">
 <div class="card"><h3>List · ${list.length}</h3>
 ${list.length?`<table><tbody>${list.map(a=>{
 const comm=commissionByAdviser(a.id);
 return `<tr class="clickable" onclick="selectAdviser('${a.id}')"><td><strong>${esc(a.name)}</strong><div style="font-size:11px;color:var(--cream-muted)">${esc(a.smcrRole||'-')} · ${esc(a.fcaRefNo||'-')}</div></td>
 <td class="r" style="font-size:11px">${money(comm)}</td>
 <td><span class="tag ${a.status==='active'?'green':'muted'}" style="font-size:9px">${esc(a.status)}</span></td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty">No advisers. Add one.</div>`}
 </div>
 <div class="card"><h3>Detail</h3>
 ${sel?renderAdviserDetail(sel):`<div class="empty">Select an adviser.</div>`}
 </div>
 </div>`;
}
function renderAdviserDetail(a){
 const pols=state.policies.filter(p=>p.adviserId===a.id);
 const total=commissionByAdviser(a.id);
 const ytd=state.policies.filter(p=>p.adviserId===a.id&&new Date(p.ts).getFullYear()===new Date().getFullYear()).reduce((s,p)=>s+commissionForPolicy(p),0);
 const mtd=state.policies.filter(p=>p.adviserId===a.id&&monthKey(p.ts)===monthKey(now())).reduce((s,p)=>s+commissionForPolicy(p),0);
 const newBiz=pols.filter(p=>!state.policies.some(p2=>p2.id!==p.id&&p2.clientId===p.clientId&&p2.productClass===p.productClass&&p2.ts<p.ts)).length;
 const renewals=pols.length-newBiz;
 const clientCount=new Set(pols.map(p=>p.clientId)).size;
 const conversion=pols.length?(pols.filter(p=>p.status==='in-force').length/pols.length):0;
 const avgComm=pols.length?total/pols.length:0;
 const firmTotal=state.policies.reduce((a,p)=>a+commissionForPolicy(p),0);
 return `
 <div class="kpi"><span class="l">Name · role</span><span class="v">${esc(a.name)} · ${esc(a.smcrRole||'-')}</span></div>
 <div class="kpi"><span class="l">FCA ref</span><span class="v mono">${esc(a.fcaRefNo||'-')}</span></div>
 <div class="kpi"><span class="l">CPD hours (15/yr)</span><span class="v ${(a.cpdHours||0)<15?'amber':'green'}">${esc(a.cpdHours||0)}</span></div>
 <div class="kpi"><span class="l">IDD compliance</span><span class="v">${a.iddCompliance?'<span class="tag green" style="font-size:9px">yes</span>':'<span class="tag amber" style="font-size:9px">review</span>'}</span></div>
 <div class="kpi"><span class="l">Total commission</span><span class="v brass">${money(total)}</span></div>
 <div class="kpi"><span class="l">YTD / MTD</span><span class="v">${money(ytd)} / ${money(mtd)}</span></div>
 <div class="kpi"><span class="l">Policies · clients</span><span class="v">${pols.length} · ${clientCount}</span></div>
 <div class="kpi"><span class="l">New biz / renewals</span><span class="v">${newBiz} / ${renewals}</span></div>
 <div class="kpi"><span class="l">In-force conversion</span><span class="v">${pct(conversion)}</span></div>
 <div class="kpi"><span class="l">Avg commission / case</span><span class="v">${money(avgComm)}</span></div>
 <div class="kpi"><span class="l">% of firm commission</span><span class="v">${firmTotal?pct(total/firmTotal):'-'}</span></div>`;
}
function viewFirmPL(){
 const m=monthKey(now());
 const monthComm=commissionTotal({month:m});
 const prevMonth=monthKey(new Date(new Date().getFullYear(),new Date().getMonth()-1,1).getTime());
 const prevComm=commissionTotal({month:prevMonth});
 const y=new Date().getFullYear();
 const yearComm=commissionTotal({year:y});
 const prevYearComm=commissionTotal({year:y-1});
 const monthExp=expensesTotal(m);
 const accrual=expectedFixedCostMonthly();
 const netLevy=state.settings.isAR?(monthComm*(state.settings.networkLevyPct||0)):0;
 const monthNet=monthComm-netLevy-monthExp-accrual;
 return `
 <div class="section-h"><h2>Firm P&L</h2><div class="actions">
 <button class="btn sm" onclick="exportFirmPL()">↓ markdown summary</button>
 </div></div>
 <div class="grid">
 <div class="card"><h3>This month · ${m}</h3>
 <div class="kpi"><span class="l">Gross commission</span><span class="v brass">${money(monthComm)}</span></div>
 ${state.settings.isAR?`<div class="kpi"><span class="l">Network levy (${pct(state.settings.networkLevyPct)})</span><span class="v red">-${money(netLevy)}</span></div>`:''}
 <div class="kpi"><span class="l">Recorded expenses</span><span class="v red">-${money(monthExp)}</span></div>
 <div class="kpi"><span class="l">Accruals (PI · FCA · BIBA · AML)</span><span class="v red">-${money(accrual)}</span></div>
 <div class="kpi"><span class="l">Net</span><span class="v ${monthNet>=0?'green':'red'}">${money(monthNet)}</span></div>
 </div>
 <div class="card"><h3>Comparisons</h3>
 <div class="kpi"><span class="l">Previous month · ${prevMonth}</span><span class="v">${money(prevComm)}</span></div>
 <div class="kpi"><span class="l">MoM change</span><span class="v ${monthComm>=prevComm?'green':'red'}">${prevComm?pct((monthComm-prevComm)/prevComm):'-'}</span></div>
 <div class="kpi"><span class="l">${y} YTD</span><span class="v">${money(yearComm)}</span></div>
 <div class="kpi"><span class="l">${y-1} full year</span><span class="v">${money(prevYearComm)}</span></div>
 <div class="kpi"><span class="l">YoY change</span><span class="v ${yearComm>=prevYearComm?'green':'red'}">${prevYearComm?pct((yearComm-prevYearComm)/prevYearComm):'-'}</span></div>
 </div>
 <div class="card"><h3>Forecast vs actual</h3>
 <div class="kpi"><span class="l">Renewal forecast (next 12m)</span><span class="v purple">${money(renewalPipelineForecast().reduce((a,b)=>a+b.expected,0))}</span></div>
 <div class="kpi"><span class="l">Avg commission %</span><span class="v">${state.policies.length?(state.policies.reduce((a,p)=>a+(p.commissionPct||0),0)/state.policies.length).toFixed(1):'-'}%</span></div>
 <div class="kpi"><span class="l">Total IPT pass-through</span><span class="v">${money(state.policies.reduce((a,p)=>a+iptForPolicy(p),0))}</span></div>
 <div class="kpi"><span class="l">Total gross premium handled</span><span class="v">${money(state.policies.reduce((a,p)=>a+(p.premium?.gross||0),0))}</span></div>
 </div>
 <div class="card"><h3>VAT (firm)</h3>
 <div class="kpi"><span class="l">Firm VAT-reg threshold</span><span class="v">${money(RULES.vatRegThreshold)} turnover</span></div>
 <p style="font-size:11px;color:var(--cream-muted);margin-top:8px">Insurance commission is largely VAT-exempt (insurance intermediation, VATA 1994 Sch 9 Group 2). Pure admin fees can be standard-rated. Broker fees disclosed up-front per ICOBS 4.</p>
 </div>
 </div>`;
}
function viewExpenses(){
 const m=monthKey(now());
 const exp=expensesForMonth(m).slice().sort((a,b)=>(a.type||'').localeCompare(b.type||''));
 return `
 <div class="section-h"><h2>Expenses</h2><div class="sub">${esc(m)}</div><div class="actions">
 <button class="btn primary sm" onclick="openModal('newExpense')">+ expense</button>
 <button class="btn sm" onclick="seedMonthlyAccruals()">seed monthly accruals</button>
 </div></div>
 <div class="card">
 <div class="kpi"><span class="l">PI insurance accrual</span><span class="v">${money(piMonthlyAccrual())}</span></div>
 <div class="kpi"><span class="l">FCA annual accrual</span><span class="v">${money(fcaMonthlyAccrual())}</span></div>
 <div class="kpi"><span class="l">BIBA / professional body accrual</span><span class="v">${money(bibaMonthlyAccrual())}</span></div>
 <div class="kpi"><span class="l">AML supervision accrual</span><span class="v">${money(amlMonthlyAccrual())}</span></div>
 <div class="kpi"><span class="l">Recorded for month</span><span class="v">${money(expensesTotal(m))}</span></div>
 </div>
 <div class="card" style="margin-top:14px">
 ${exp.length?`<table><thead><tr><th>Type</th><th>Notes</th><th class="r">Amount</th><th></th></tr></thead><tbody>
 ${exp.map(e=>`<tr><td>${esc(e.type)}</td><td style="font-size:11px">${esc(e.notes||'')}</td><td class="r">${moneyP(e.amount)}</td><td><button class="btn sm danger" onclick="deleteExpense('${e.id}')">x</button></td></tr>`).join('')}
 <tr class="total"><td colspan="2">Total this month</td><td class="r">${moneyP(expensesTotal(m))}</td><td></td></tr>
 </tbody></table>`:`<div class="empty">No expenses for ${m}. Use seed-monthly-accruals to drop PI/FCA/BIBA/AML accruals in.</div>`}
 </div>`;
}
function viewQA(){
 return `
 <div class="section-h"><h2>Q&A · UK insurance broker rules</h2><div class="sub">14 T0 rules · CASS 5 · IPT · PI · ICOBS</div></div>
 <div class="card">
 <div class="chat" id="chatBox">
 ${state.chat.length?state.chat.map(m=>`<div class="msg ${esc(m.role)}">${esc(m.text)}${m.src?`<div class="src">${esc(m.src)}</div>`:''}</div>`).join(''):`<div class="empty">Ask anything — CASS 5 cadence, mixed payments, IPT rates, broker capacity, premium financing, network AR.</div>`}
 </div>
 <div class="chat-input">
 <input type="text" id="chatInput" placeholder="ask · 'CASS 5 reconciliation cadence?' · 'IPT standard vs higher rate?' · 'PI minimum cover?'" onkeydown="if(event.key==='Enter')sendChat()">
 <button class="btn primary" onclick="sendChat()">ask</button>
 </div>
 <div style="margin-top:14px;font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:0.08em">Topics: ${T0_RULES.map(r=>r.id).join(' · ')}</div>
 </div>`;
}
// ─── selection ───
async function selectClient(id){state.selectedClientId=id;await saveState();render()}
async function selectAdviser(id){state.selectedAdviserId=id;await saveState();render()}
async function selectPolicy(id){state.selectedPolicyId=id;await saveState();render()}
function scrollChatBottom(){const b=$('#chatBox');if(b)b.scrollTop=b.scrollHeight}
async function sendChat(){
 const i=$('#chatInput');const q=(i.value||'').trim();if(!q)return;
 state.chat.push({role:'user',text:q});
 i.value='';render();
 const ans=await answerQuestion(q);
 state.chat.push({role:'bot',text:ans.text,src:ans.src});
 if(state.chat.length>40)state.chat=state.chat.slice(-40);
 await saveState();render();
}
// ═══════════════════════ MUTATIONS ═══════════════════════
async function addPolicy(data){
 const id='pol_'+uid();
 const gross=+data.gross||0;
 const iptRate=data.iptRate||RULES.iptStandard;
 const ipt=Math.round(gross*iptRate*100)/100;
 const fee=+data.fee||0;
 const commissionPct=+data.commissionPct||0;
 const commission=Math.round((gross)*commissionPct/100*100)/100;
 const net=gross-commission;
 const p={
 id,firmId:state.firm?.id||'',clientId:data.clientId,adviserId:data.adviserId,
 ts:now(),updatedAt:now(),lapsedAt:null,
 ref:data.ref||'P-'+new Date().getFullYear()+'-'+(state.policies.length+1).toString().padStart(4,'0'),
 productClass:data.productClass||'commercial-property',
 insurer:data.insurer||'',schemeRef:data.schemeRef||'',policyNumber:data.policyNumber||'',
 inceptionDate:data.inceptionDate||isoDate(now()),
 renewalDate:data.renewalDate||isoDate(now()+365*dayMs),
 expiryDate:data.expiryDate||data.renewalDate||isoDate(now()+365*dayMs),
 status:'in-force',
 premium:{gross,ipt,fee,commission,net},
 commissionPct,
 sumInsured:+data.sumInsured||0,indemnityLimit:+data.indemnityLimit||0,excess:+data.excess||0,
 cover:{summary:data.coverSummary||'',exclusions:[],endorsements:[]},
 demandsAndNeeds:data.demandsAndNeeds||'',
 cdSummary:data.cdSummary||'',
 vulnerableCustomerFlag:false,midTermAdjustments:[],claims:[],
 };
 state.policies.push(p);await idbPut('policies',p);
 broadcastUpsert('policy.created',p);
 await appendAudit('policy.created','New policy · '+p.ref,p);
 toast('policy '+p.ref+' created');
 await saveState();render();
 return p;
}
async function addCAEntry(data){
 const id='ca_'+uid();
 const e={
 id,policyId:data.policyId,clientId:data.clientId||'',ts:now(),dateOf:isoDate(now()),
 direction:data.direction||'in',
 amount:+data.amount||0,
 source:data.source||'premium-in',
 notes:data.notes||'',
 reconciledAt:null,
 advisorId:data.advisorId||state.selectedAdviserId||'',
 };
 state.clientAccount.push(e);await idbPut('clientAccount',e);
 broadcastClientAccountEntry(e);
 await appendAudit('cass.entry.'+e.direction,e.source+' · '+moneyP(e.amount),e);
 toast('CASS entry recorded');
 await saveState();render();
 return e;
}
async function addOAEntry(data){
 const id='oa_'+uid();
 const e={
 id,policyId:data.policyId||'',clientId:data.clientId||'',adviserId:data.adviserId||'',
 ts:now(),dateOf:isoDate(now()),
 direction:data.direction||'in',
 amount:+data.amount||0,
 source:data.source||'commission-in',
 notes:data.notes||'',
 };
 state.officeAccount.push(e);await idbPut('officeAccount',e);
 await appendAudit('office.entry.'+e.direction,e.source+' · '+moneyP(e.amount),e);
 return e;
}
async function markCAEntryReconciled(id){
 const e=state.clientAccount.find(x=>x.id===id);if(!e)return;
 e.reconciledAt=now();await idbPut('clientAccount',e);
 await appendAudit('cass.entry.reconciled','Marked reconciled',{id:e.id});
 toast('marked reconciled');render();
}
async function doReconcile(data){
 const bank=+data.bankBalance||0;
 const internal=clientAccountBalance();
 const disc=bank-internal;
 const docsHash=await sha256(data.supportingDocs||'no-docs');
 const r={
 id:'rec_'+uid(),
 month:data.month||monthKey(now()),
 ts:now(),
 advisorId:data.advisorId||state.selectedAdviserId||'',
 bankBalance:bank,
 internalBalance:internal,
 discrepancy:disc,
 supportingDocsSha256:docsHash,
 notes:data.notes||'',
 };
 state.reconciliations.push(r);await idbPut('reconciliations',r);
 // mark all unreconciled CA entries up to now as reconciled
 for(const e of state.clientAccount){if(!e.reconciledAt){e.reconciledAt=now();await idbPut('clientAccount',e)}}
 broadcastReconciliation(r);
 await appendAudit('cass.reconciliation','Monthly CASS 5.5.63 · discrepancy '+moneyP(disc),r);
 toast('reconciliation logged · '+(disc===0?'clean':'discrepancy '+moneyP(disc)));
 closeModal();render();
}
async function lapsePolicy(id){
 if(!confirm('Mark policy as lapsed? This affects renewal pipeline.'))return;
 const p=state.policies.find(x=>x.id===id);if(!p)return;
 p.status='lapsed';p.lapsedAt=now();p.updatedAt=now();
 await idbPut('policies',p);
 broadcastUpsert('policy.lapsed',p);
 await appendAudit('policy.lapsed','Marked lapsed',{id:p.id,ref:p.ref});
 toast('policy lapsed');render();
}
async function addClient(data){
 const id='cl_'+uid();
 const c={
 id,firmId:state.firm?.id||'',createdAt:now(),updatedAt:now(),archivedAt:null,
 title:data.title||'',firstName:data.firstName||'',middleName:'',lastName:data.lastName||'',
 preferredName:'',dob:data.dob||'',gender:'',nationality:'GB',countryOfResidence:'GB',
 nino:'',utr:'',taxResidency:['GB'],
 email:data.email||'',phone:data.phone||'',
 industry:data.industry||'',companiesHouseNo:data.companiesHouseNo||'',
 address:{line1:'',line2:'',city:'',region:'England',postcode:'',country:'GB',since:''},
 addressHistory:[],relationships:[],
 riskProfile:{claimsHistory:[],premiumTrend:'unknown'},policiesHeld:[],
 kyc:{status:'pending',riskGrade:'low',pepFlag:false,pepDetails:'',sanctionsStatus:'not-checked',sanctionsCheckedAt:null,sanctionsCheckedBy:'',sourceOfFunds:'',sourceOfFundsNotes:'',sourceOfWealth:'',sourceOfWealthNotes:'',vulnerableCustomerFlag:false,vulnerabilityCategory:'',vulnerabilityNotes:'',documentsHeld:[],lastReviewAt:null,nextReviewDue:null},
 adviserId:data.adviserId||state.selectedAdviserId||'',
 engagement:{startedAt:now(),type:'ongoing',feeBasis:'commission',feeAgreementHash:'',feeAgreementSignedAt:null,initialFee:0,ongoingFee:0,nextReviewDue:null},
 notes:[],links:{},
 };
 state.clients.push(c);await idbPut('clients',c);
 broadcastUpsert('client.created',c);
 await appendAudit('client.created','New client',c);
 toast('client added');render();
}
async function addAdviser(data){
 const id='ad_'+uid();
 const a={
 id,firmId:state.firm?.id||'',createdAt:now(),updatedAt:now(),archivedAt:null,
 name:data.name||'',email:data.email||'',phone:'',
 fcaRefNo:data.fcaRefNo||'',smcrRole:data.smcrRole||'SMF22',
 cpdHours:+data.cpdHours||0,iddCompliance:!!data.iddCompliance,
 status:'active',startedAt:now(),leftAt:null,
 };
 state.advisers.push(a);await idbPut('advisers',a);
 broadcastUpsert('adviser.created',a);
 await appendAudit('adviser.created','New adviser',a);
 toast('adviser added');render();
}
async function saveFirmSettings(data){
 if(!state.firm){
 state.firm={id:'fm_'+uid(),createdAt:now(),updatedAt:now(),name:'',tradingName:'',fcaRefNo:'',companiesHouseNo:'',vatNumber:'',registeredAddress:{line1:'',line2:'',city:'',postcode:'',country:'GB'},piInsurer:'',piPolicyNo:'',piExpiresAt:null,piCoverSingle:0,piCoverAggregate:0,piAnnualPremium:0,professionalBody:'',bibaMemberNo:'',brandColor:'#8b1a1a',brandLogoDataUri:'',setupCompletedAt:null};
 }
 Object.assign(state.firm,data,{updatedAt:now()});
 if(!state.firm.setupCompletedAt)state.firm.setupCompletedAt=now();
 await idbPut('firms',state.firm);
 broadcastUpsert('firm.updated',state.firm);
 await appendAudit('firm.updated','Firm settings updated',state.firm);
 toast('firm saved');render();
}
async function addExpense(data){
 const id='ex_'+uid();
 const e={id,month:data.month||monthKey(now()),type:data.type||'Other',amount:+data.amount||0,notes:data.notes||'',ts:now()};
 state.expenses.push(e);await idbPut('expenses',e);
 await appendAudit('expense.added',e.type,e);
 toast('expense added');render();
}
async function deleteExpense(id){
 if(!confirm('Delete expense?'))return;
 state.expenses=state.expenses.filter(e=>e.id!==id);
 await idbDel('expenses',id);
 await appendAudit('expense.deleted','',{id});
 toast('expense deleted');render();
}
async function seedMonthlyAccruals(){
 const m=monthKey(now());
 const lines=[
 {type:'PI insurance accrual',amount:piMonthlyAccrual(),notes:'Monthly accrual seeded'},
 {type:'FCA fee accrual',amount:fcaMonthlyAccrual(),notes:'Monthly accrual seeded'},
 {type:'BIBA membership',amount:bibaMonthlyAccrual(),notes:'Monthly accrual seeded'},
 {type:'AML supervision',amount:amlMonthlyAccrual(),notes:'Monthly accrual seeded'},
 ];
 for(const l of lines){
 if(!l.amount)continue;
 // skip if same type already exists for month
 if(state.expenses.some(e=>e.month===m&&e.type===l.type))continue;
 await addExpense({month:m,...l});
 }
 toast('accruals seeded');render();
}
// ═══════════════════════ Modals ═══════════════════════
function openModal(kind){
 $('#modal').classList.add('open');
 let body='';let title='';
 // parse "kind:arg"
 let arg='';
 if(kind.includes(':')){[kind,arg]=kind.split(':')}
 if(kind==='newPolicy'){
 title='New policy';
 const clOpts=state.clients.map(c=>`<option value="${c.id}" ${c.id===state.selectedClientId?'selected':''}>${esc((c.firstName||'')+' '+(c.lastName||''))}</option>`).join('');
 const advOpts=state.advisers.map(a=>`<option value="${a.id}" ${a.id===state.selectedAdviserId?'selected':''}>${esc(a.name)}</option>`).join('');
 body=`
 <div class="row"><div class="field"><label>Client</label><select id="m_clientId">${clOpts}</select></div>
 <div class="field"><label>Adviser</label><select id="m_adviserId">${advOpts}</select></div></div>
 <div class="row3"><div class="field"><label>Ref</label><input id="m_ref" value="P-${new Date().getFullYear()}-${(state.policies.length+1).toString().padStart(4,'0')}"></div>
 <div class="field"><label>Product class</label><select id="m_productClass">
 ${['commercial-property','EL','PL','motor-fleet','cyber','PI','D&O','landlord','home','travel','health','pet','other'].map(c=>`<option>${c}</option>`).join('')}
 </select></div>
 <div class="field"><label>Insurer</label><input id="m_insurer" placeholder="AXA Commercial"></div></div>
 <div class="row3"><div class="field"><label>Inception</label><input type="date" id="m_inceptionDate" value="${isoDate(now())}"></div>
 <div class="field"><label>Renewal</label><input type="date" id="m_renewalDate" value="${isoDate(now()+365*dayMs)}"></div>
 <div class="field"><label>Policy number</label><input id="m_policyNumber"></div></div>
 <div class="row3"><div class="field"><label>Gross premium £</label><input type="number" step="0.01" id="m_gross"></div>
 <div class="field"><label>IPT rate</label><select id="m_iptRate"><option value="0.12">standard 12%</option><option value="0.20">higher 20%</option><option value="0">exempt</option></select></div>
 <div class="field"><label>Broker fee £</label><input type="number" step="0.01" id="m_fee" value="0"></div></div>
 <div class="row3"><div class="field"><label>Commission %</label><input type="number" step="0.1" id="m_commissionPct" value="15"></div>
 <div class="field"><label>Sum insured £</label><input type="number" id="m_sumInsured"></div>
 <div class="field"><label>Excess £</label><input type="number" id="m_excess"></div></div>
 <div class="field"><label>Demands & needs (IDD Art 20)</label><textarea id="m_demandsAndNeeds" rows="2" placeholder="Client requires cover for…"></textarea></div>
 <div class="field"><label>IPID delivered</label><input id="m_cdSummary" placeholder="IPID delivered YYYY-MM-DD"></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitNewPolicy()">create policy</button></div>`;
 }
 else if(kind==='cassReceipt'||kind==='cassReceiptFor'){
 title='Premium-in (CASS 5 client account)';
 const polOpts=state.policies.map(p=>`<option value="${p.id}" ${p.id===arg||p.id===state.selectedPolicyId?'selected':''}>${esc(p.ref)} · ${esc(p.insurer)}</option>`).join('');
 body=`
 <div class="field"><label>Policy</label><select id="m_policyId">${polOpts||'<option value="">(no policies)</option>'}</select></div>
 <div class="row"><div class="field"><label>Amount (gross + IPT + fee) £</label><input type="number" step="0.01" id="m_amount"></div>
 <div class="field"><label>Source</label><select id="m_source"><option value="premium-in">premium-in</option><option value="claim-refund">claim-refund</option><option value="mixed">mixed</option></select></div></div>
 <div class="field"><label>Notes</label><textarea id="m_notes" rows="2" placeholder="From client X, ref Y…"></textarea></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitCAEntry('in')">record receipt</button></div>`;
 }
 else if(kind==='cassRemittance'||kind==='cassRemittanceFor'){
 title='Remit to insurer (CASS 5 out)';
 const polOpts=state.policies.map(p=>`<option value="${p.id}" ${p.id===arg||p.id===state.selectedPolicyId?'selected':''}>${esc(p.ref)} · ${esc(p.insurer)}</option>`).join('');
 body=`
 <div class="field"><label>Policy</label><select id="m_policyId">${polOpts||'<option value="">(no policies)</option>'}</select></div>
 <div class="row"><div class="field"><label>Amount (net premium + IPT) £</label><input type="number" step="0.01" id="m_amount"></div>
 <div class="field"><label>Source</label><select id="m_source"><option value="IPT-out">IPT-out (premium + IPT to insurer)</option><option value="claim-refund">claim-refund to client</option></select></div></div>
 <div class="field"><label>Notes</label><textarea id="m_notes" rows="2" placeholder="Remitted to insurer X via BACS ref…"></textarea></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitCAEntry('out')">record remittance</button></div>`;
 }
 else if(kind==='cassSplit'){
 title='Mixed payment split (CASS 5.3.5R same-day)';
 const polOpts=state.policies.map(p=>`<option value="${p.id}">${esc(p.ref)} · ${esc(p.insurer)}</option>`).join('');
 body=`
 <p style="font-size:12px;color:var(--cream-dim);margin-bottom:12px">A mixed remittance from client (premium + commission + fee) goes to the <strong>client account</strong> in full, then commission + fee transfers to the <strong>office account same business day</strong>. This modal logs all three legs.</p>
 <div class="field"><label>Policy</label><select id="m_policyId">${polOpts||'<option value="">(no policies)</option>'}</select></div>
 <div class="row3"><div class="field"><label>Gross-in to client account £</label><input type="number" step="0.01" id="m_grossIn"></div>
 <div class="field"><label>Net premium + IPT to insurer £</label><input type="number" step="0.01" id="m_netOut"></div>
 <div class="field"><label>Commission + fee to office £</label><input type="number" step="0.01" id="m_commOut"></div></div>
 <div class="field"><label>Notes</label><textarea id="m_notes" rows="2" placeholder="Reference, payer, channel…"></textarea></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitMixedSplit()">log three legs</button></div>`;
 }
 else if(kind==='reconcile'){
 title='Monthly CASS 5.5.63 reconciliation';
 const advOpts=state.advisers.map(a=>`<option value="${a.id}" ${a.id===state.selectedAdviserId?'selected':''}>${esc(a.name)}</option>`).join('');
 body=`
 <p style="font-size:12px;color:var(--cream-dim);margin-bottom:12px">Enter the bank statement balance for the client account. Tool computes discrepancy vs internal ledger (currently ${moneyP(clientAccountBalance())}). Sha256 of supporting docs is recorded for audit.</p>
 <div class="row"><div class="field"><label>Month</label><input id="m_month" value="${monthKey(now())}"></div>
 <div class="field"><label>Adviser performing</label><select id="m_advisorId">${advOpts}</select></div></div>
 <div class="field"><label>Bank statement balance £</label><input type="number" step="0.01" id="m_bankBalance" value="${clientAccountBalance().toFixed(2)}"></div>
 <div class="field"><label>Supporting docs (paste reference or filename)</label><textarea id="m_supportingDocs" rows="2" placeholder="bank-stmt-2026-06.pdf · adjustments-log.xlsx"></textarea></div>
 <div class="field"><label>Notes</label><textarea id="m_notes" rows="2" placeholder="Any adjustments, breaks, follow-ups…"></textarea></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitReconcile()">log reconciliation</button></div>`;
 }
 else if(kind==='newClient'){
 title='New client';
 const advOpts=state.advisers.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
 body=`
 <div class="row3"><div class="field"><label>Title</label><select id="m_title"><option>Mr</option><option>Mrs</option><option>Ms</option><option>Mx</option><option>Dr</option></select></div>
 <div class="field"><label>First name</label><input id="m_firstName"></div>
 <div class="field"><label>Last name</label><input id="m_lastName"></div></div>
 <div class="row"><div class="field"><label>Email</label><input id="m_email"></div>
 <div class="field"><label>Phone</label><input id="m_phone"></div></div>
 <div class="row"><div class="field"><label>Industry</label><input id="m_industry" placeholder="Manufacturing"></div>
 <div class="field"><label>Companies House no</label><input id="m_companiesHouseNo"></div></div>
 <div class="field"><label>Adviser</label><select id="m_adviserId">${advOpts}</select></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitNewClient()">create</button></div>`;
 }
 else if(kind==='newAdviser'){
 title='New adviser';
 body=`
 <div class="row"><div class="field"><label>Name</label><input id="m_name"></div>
 <div class="field"><label>Email</label><input id="m_email"></div></div>
 <div class="row3"><div class="field"><label>FCA ref</label><input id="m_fcaRefNo"></div>
 <div class="field"><label>SMCR role</label><select id="m_smcrRole"><option>SMF3</option><option>SMF22</option><option>SMF27</option><option>certified</option></select></div>
 <div class="field"><label>CPD hours YTD</label><input type="number" id="m_cpdHours" value="0"></div></div>
 <div class="field"><label><input type="checkbox" id="m_iddCompliance" checked> IDD compliant</label></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitNewAdviser()">create</button></div>`;
 }
 else if(kind==='newExpense'){
 title='New expense';
 body=`
 <div class="row"><div class="field"><label>Month</label><input id="m_month" value="${monthKey(now())}"></div>
 <div class="field"><label>Type</label><input id="m_type" placeholder="Software · Rent · PI · etc"></div></div>
 <div class="field"><label>Amount £</label><input type="number" step="0.01" id="m_amount"></div>
 <div class="field"><label>Notes</label><textarea id="m_notes" rows="2"></textarea></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitNewExpense()">add</button></div>`;
 }
 else if(kind==='conversionConfig'){
 title='Renewal conversion rate';
 body=`
 <p style="font-size:12px;color:var(--cream-dim);margin-bottom:12px">Forecast multiplier applied to renewal-pipeline commission. 0.85 = 85% expected to renew. Configure based on your firm's actual retention.</p>
 <div class="field"><label>Conversion rate (0-1)</label><input type="number" step="0.01" min="0" max="1" id="m_conversionRateDefault" value="${state.settings.conversionRateDefault}"></div>
 <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="submitConversionConfig()">save</button></div>`;
 }
 else if(kind==='settings'){
 title='Settings';
 body=renderSettingsModal();
 }
 $('#modalTitle').textContent=title;
 $('#modalBody').innerHTML=body;
}
function closeModal(){$('#modal').classList.remove('open')}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
async function submitNewPolicy(){
 const d={
 clientId:$('#m_clientId').value,
 adviserId:$('#m_adviserId').value,
 ref:$('#m_ref').value,
 productClass:$('#m_productClass').value,
 insurer:$('#m_insurer').value,
 inceptionDate:$('#m_inceptionDate').value,
 renewalDate:$('#m_renewalDate').value,
 policyNumber:$('#m_policyNumber').value,
 gross:+$('#m_gross').value,
 iptRate:+$('#m_iptRate').value,
 fee:+$('#m_fee').value,
 commissionPct:+$('#m_commissionPct').value,
 sumInsured:+$('#m_sumInsured').value,
 excess:+$('#m_excess').value,
 demandsAndNeeds:$('#m_demandsAndNeeds').value,
 cdSummary:$('#m_cdSummary').value,
 };
 if(!d.clientId||!d.insurer||!d.gross){toast('client, insurer + gross required');return}
 await addPolicy(d);
 closeModal();
}
async function submitCAEntry(direction){
 const d={
 policyId:$('#m_policyId').value,
 clientId:state.policies.find(p=>p.id===$('#m_policyId').value)?.clientId||'',
 direction,
 amount:+$('#m_amount').value,
 source:$('#m_source').value,
 notes:$('#m_notes').value,
 };
 if(!d.policyId||!d.amount){toast('policy + amount required');return}
 await addCAEntry(d);
 closeModal();
}
async function submitMixedSplit(){
 const policyId=$('#m_policyId').value;
 const grossIn=+$('#m_grossIn').value;
 const netOut=+$('#m_netOut').value;
 const commOut=+$('#m_commOut').value;
 const notes=$('#m_notes').value;
 if(!policyId||!grossIn){toast('policy + gross-in required');return}
 if(Math.abs(grossIn-netOut-commOut)>0.5){
 if(!confirm('Legs don\'t balance: '+moneyP(grossIn)+' in vs '+moneyP(netOut+commOut)+' out. Continue anyway?'))return;
 }
 const pol=state.policies.find(p=>p.id===policyId);
 // leg 1: client account in
 await addCAEntry({policyId,clientId:pol?.clientId||'',direction:'in',amount:grossIn,source:'mixed',notes:'CASS 5.3.5 mixed in · '+notes});
 // leg 2: net out to insurer
 if(netOut>0)await addCAEntry({policyId,clientId:pol?.clientId||'',direction:'out',amount:netOut,source:'IPT-out',notes:'CASS 5.3.5 same-day · net to insurer · '+notes});
 // leg 3: commission out (client account) + commission in (office account) -- same day
 if(commOut>0){
 await addCAEntry({policyId,clientId:pol?.clientId||'',direction:'out',amount:commOut,source:'commission-out',notes:'CASS 5.3.5 same-day · commission to office · '+notes});
 await addOAEntry({policyId,clientId:pol?.clientId||'',adviserId:pol?.adviserId||'',direction:'in',amount:commOut,source:'commission-in',notes:'From client account mixed split · '+notes});
 }
 await appendAudit('cass.mixed.split','CASS 5.3.5R same-day mixed split logged',{policyId,grossIn,netOut,commOut});
 toast('3 legs logged · CASS 5.3.5');
 closeModal();render();
}
async function submitReconcile(){
 const d={
 month:$('#m_month').value,
 advisorId:$('#m_advisorId').value,
 bankBalance:+$('#m_bankBalance').value,
 supportingDocs:$('#m_supportingDocs').value,
 notes:$('#m_notes').value,
 };
 await doReconcile(d);
}
async function submitNewClient(){
 const d={
 title:$('#m_title').value,firstName:$('#m_firstName').value,lastName:$('#m_lastName').value,
 email:$('#m_email').value,phone:$('#m_phone').value,
 industry:$('#m_industry').value,companiesHouseNo:$('#m_companiesHouseNo').value,
 adviserId:$('#m_adviserId').value,
 };
 if(!d.firstName||!d.lastName){toast('name required');return}
 await addClient(d);closeModal();
}
async function submitNewAdviser(){
 const d={
 name:$('#m_name').value,email:$('#m_email').value,
 fcaRefNo:$('#m_fcaRefNo').value,smcrRole:$('#m_smcrRole').value,
 cpdHours:+$('#m_cpdHours').value,iddCompliance:$('#m_iddCompliance').checked,
 };
 if(!d.name){toast('name required');return}
 await addAdviser(d);closeModal();
}
async function submitNewExpense(){
 const d={month:$('#m_month').value,type:$('#m_type').value,amount:+$('#m_amount').value,notes:$('#m_notes').value};
 if(!d.type||!d.amount){toast('type + amount required');return}
 await addExpense(d);closeModal();
}
async function submitConversionConfig(){
 const v=+$('#m_conversionRateDefault').value;
 if(v<0||v>1){toast('0-1 only');return}
 state.settings.conversionRateDefault=v;
 await saveState();persistSettingsLS();
 toast('saved');closeModal();render();
}
function renderSettingsModal(){
 const f=state.firm||{};
 return `
 <div style="border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px">
 <h3 style="font-family:var(--serif);margin-bottom:10px;font-size:14px">Firm</h3>
 <div class="row"><div class="field"><label>Firm name</label><input id="s_name" value="${esc(f.name||'')}"></div>
 <div class="field"><label>Trading name</label><input id="s_tradingName" value="${esc(f.tradingName||'')}"></div></div>
 <div class="row3"><div class="field"><label>FCA ref</label><input id="s_fcaRefNo" value="${esc(f.fcaRefNo||'')}"></div>
 <div class="field"><label>Companies House</label><input id="s_companiesHouseNo" value="${esc(f.companiesHouseNo||'')}"></div>
 <div class="field"><label>VAT no</label><input id="s_vatNumber" value="${esc(f.vatNumber||'')}"></div></div>
 <div class="row"><div class="field"><label>Professional body</label><input id="s_professionalBody" value="${esc(f.professionalBody||'BIBA')}"></div>
 <div class="field"><label>BIBA member no</label><input id="s_bibaMemberNo" value="${esc(f.bibaMemberNo||'')}"></div></div>
 </div>
 <div style="border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px">
 <h3 style="font-family:var(--serif);margin-bottom:10px;font-size:14px">PI insurance</h3>
 <div class="row"><div class="field"><label>Insurer</label><input id="s_piInsurer" value="${esc(f.piInsurer||'')}"></div>
 <div class="field"><label>Policy no</label><input id="s_piPolicyNo" value="${esc(f.piPolicyNo||'')}"></div></div>
 <div class="row3"><div class="field"><label>Cover single £ (min ${money(RULES.piMinCoverSingle)})</label><input type="number" id="s_piCoverSingle" value="${f.piCoverSingle||RULES.piMinCoverSingle}"></div>
 <div class="field"><label>Cover aggregate £ (min ${money(RULES.piMinCoverAggregate)})</label><input type="number" id="s_piCoverAggregate" value="${f.piCoverAggregate||RULES.piMinCoverAggregate}"></div>
 <div class="field"><label>Expires</label><input type="date" id="s_piExpiresAt" value="${f.piExpiresAt?isoDate(f.piExpiresAt):''}"></div></div>
 <div class="field"><label>Annual premium £</label><input type="number" id="s_piAnnualPremium" value="${state.settings.piAnnualPremium||3600}"></div>
 </div>
 <div style="border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px">
 <h3 style="font-family:var(--serif);margin-bottom:10px;font-size:14px">Accruals + network</h3>
 <div class="row3"><div class="field"><label>FCA annual £</label><input type="number" id="s_fcaAnnualEstimate" value="${state.settings.fcaAnnualEstimate}"></div>
 <div class="field"><label>BIBA annual £</label><input type="number" id="s_bibaAnnualEstimate" value="${state.settings.bibaAnnualEstimate}"></div>
 <div class="field"><label>AML supervision £/yr</label><input type="number" id="s_amlSupervisionAnnual" value="${state.settings.amlSupervisionAnnual}"></div></div>
 <div class="row"><div class="field"><label><input type="checkbox" id="s_isAR" ${state.settings.isAR?'checked':''}> Appointed Representative (AR)</label></div>
 <div class="field"><label>Network levy % (0-1, e.g. 0.20)</label><input type="number" step="0.01" id="s_networkLevyPct" value="${state.settings.networkLevyPct}"></div></div>
 <div class="row"><div class="field"><label>Insurer remittance days (TOBA default)</label><input type="number" id="s_insurerRemittanceDays" value="${state.settings.insurerRemittanceDays}"></div>
 <div class="field"><label>Default renewal conversion rate</label><input type="number" step="0.01" id="s_conversionRateDefault" value="${state.settings.conversionRateDefault}"></div></div>
 </div>
 <div style="border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px">
 <h3 style="font-family:var(--serif);margin-bottom:10px;font-size:14px">T3 BYOK · LLM keys (optional)</h3>
 <div class="row"><div class="field"><label>Anthropic</label><input type="password" id="s_anthropicKey" value="${esc(state.settings.anthropicKey)}" placeholder="sk-ant-…"></div>
 <div class="field"><label>OpenAI</label><input type="password" id="s_openaiKey" value="${esc(state.settings.openaiKey)}" placeholder="sk-…"></div></div>
 <div class="row"><div class="field"><label>Gemini</label><input type="password" id="s_geminiKey" value="${esc(state.settings.geminiKey)}"></div>
 <div class="field"><label>OpenRouter</label><input type="password" id="s_openrouterKey" value="${esc(state.settings.openrouterKey)}"></div></div>
 <div class="field"><label><input type="checkbox" id="s_auditChain" ${state.settings.auditChain?'checked':''}> Audit chain ON (P3 · 6yr SYSC retain)</label></div>
 </div>
 <div style="margin-bottom:14px">
 <h3 style="font-family:var(--serif);margin-bottom:10px;font-size:14px">Audit chain</h3>
 <div class="kpi"><span class="l">Entries</span><span class="v">${state.audit.length}</span></div>
 <div class="kpi"><span class="l">Last entry</span><span class="v">${state.audit.length?isoDate(state.audit[state.audit.length-1].ts):'-'}</span></div>
 <button class="btn sm" onclick="exportAudit()">↓ export JSON</button>
 <button class="btn sm" onclick="verifyAudit()">verify chain</button>
 </div>
 <div class="actions">
 <button class="btn danger" onclick="if(confirm('Wipe all data?'))wipeAll()">wipe data</button>
 <button class="btn" onclick="closeModal()">cancel</button>
 <button class="btn primary" onclick="submitSettings()">save</button>
 </div>`;
}
async function submitSettings(){
 const firmData={
 name:$('#s_name').value,tradingName:$('#s_tradingName').value,
 fcaRefNo:$('#s_fcaRefNo').value,companiesHouseNo:$('#s_companiesHouseNo').value,vatNumber:$('#s_vatNumber').value,
 professionalBody:$('#s_professionalBody').value,bibaMemberNo:$('#s_bibaMemberNo').value,
 piInsurer:$('#s_piInsurer').value,piPolicyNo:$('#s_piPolicyNo').value,
 piCoverSingle:+$('#s_piCoverSingle').value,piCoverAggregate:+$('#s_piCoverAggregate').value,
 piExpiresAt:$('#s_piExpiresAt').value?new Date($('#s_piExpiresAt').value).getTime():null,
 piAnnualPremium:+$('#s_piAnnualPremium').value,
 };
 await saveFirmSettings(firmData);
 state.settings.piAnnualPremium=+$('#s_piAnnualPremium').value;
 state.settings.fcaAnnualEstimate=+$('#s_fcaAnnualEstimate').value;
 state.settings.bibaAnnualEstimate=+$('#s_bibaAnnualEstimate').value;
 state.settings.amlSupervisionAnnual=+$('#s_amlSupervisionAnnual').value;
 state.settings.isAR=$('#s_isAR').checked;
 state.settings.networkLevyPct=+$('#s_networkLevyPct').value;
 state.settings.insurerRemittanceDays=+$('#s_insurerRemittanceDays').value;
 state.settings.conversionRateDefault=+$('#s_conversionRateDefault').value;
 state.settings.anthropicKey=$('#s_anthropicKey').value;
 state.settings.openaiKey=$('#s_openaiKey').value;
 state.settings.geminiKey=$('#s_geminiKey').value;
 state.settings.openrouterKey=$('#s_openrouterKey').value;
 state.settings.auditChain=$('#s_auditChain').checked;
 await saveState();persistSettingsLS();
 Cascade._p=undefined;await updateTierBadge();
 toast('settings saved');closeModal();render();
}
// ═══════════════════════ Export / palette ═══════════════════════
function download(name,content,mime){
 const blob=new Blob([content],{type:mime||'text/plain'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportCommission(){
 const rows=[['date','ref','client','adviser','insurer','product','gross','ipt','fee','commission_pct','commission','net_to_insurer','status']];
 for(const p of state.policies){
 const cl=state.clients.find(c=>c.id===p.clientId);
 const adv=state.advisers.find(a=>a.id===p.adviserId);
 rows.push([isoDate(p.ts),p.ref,cl?cl.firstName+' '+cl.lastName:'',adv?adv.name:'',p.insurer,p.productClass,p.premium?.gross,p.premium?.ipt,p.premium?.fee,p.commissionPct,p.premium?.commission,p.premium?.net,p.status]);
 }
 download('commission-'+isoDate(now())+'.csv',rows.map(r=>r.map(c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`).join(',')).join('\n'),'text/csv');
 toast('CSV exported');
}
function exportFirmPL(){
 const m=monthKey(now()),y=new Date().getFullYear();
 const md=`# FallInsurancePractice · Firm P&L Summary\n\nFirm: ${state.firm?.name||'(unset)'} · FCA ${state.firm?.fcaRefNo||'-'}\nGenerated: ${isoDate(now())}\n\n## This month (${m})\n- Gross commission: ${money(commissionTotal({month:m}))}\n- Recorded expenses: ${money(expensesTotal(m))}\n- Accruals: ${money(expectedFixedCostMonthly())}\n\n## ${y} YTD\n- Commission: ${money(ytdCommission())}\n- Forecast renewal pipeline (12m): ${money(renewalPipelineForecast().reduce((a,b)=>a+b.expected,0))}\n\n## CASS 5 posture\n- Client account balance: ${money(clientAccountBalance())}\n- Last reconciliation: ${daysSinceReconciliation()===999?'never':daysSinceReconciliation()+' days ago'}\n- Late insurer remittances: ${premiumRemittanceLate().length}\n- Stale balances: ${staleClientBalances().length}\n\n## PI\n- ${state.firm?.piInsurer||'-'} / ${state.firm?.piPolicyNo||'-'}\n- Cover: ${state.firm?.piCoverSingle?money(state.firm.piCoverSingle):'-'} / ${state.firm?.piCoverAggregate?money(state.firm.piCoverAggregate):'-'}\n- Expires: ${state.firm?.piExpiresAt?isoDate(state.firm.piExpiresAt):'-'} (${piDaysToExpiry()}d)\n\n## Mesh / sovereignty\n- Audit chain: ${state.audit.length} entries\n- Sovereign · data never leaves device\n`;
 download('firm-pl-'+m+'.md',md,'text/markdown');toast('P&L exported');
}
function exportAudit(){
 download('audit-chain-'+isoDate(now())+'.json',JSON.stringify(state.audit,null,2),'application/json');
 toast('audit exported');
}
async function verifyAudit(){
 let prev='';let broken=null;
 for(const e of state.audit){
 const ph=e.prevHash;
 if(ph!==prev){broken=e.i;break}
 const docHash=await sha256(JSON.stringify(e.payload||{}));
 if(docHash!==e.docHash){broken=e.i;break}
 const hash=await sha256(ph+docHash+e.ts+e.i);
 if(hash!==e.hash){broken=e.i;break}
 prev=e.hash;
 }
 if(broken)toast('chain broken at entry '+broken);
 else toast('chain verified · '+state.audit.length+' entries');
}
async function wipeAll(){
 for(const s of STORES){
 const arr=await idbGetAll(s);
 for(const x of arr)await idbDel(s,x.id);
 }
 try{localStorage.removeItem(STORE+'.settings')}catch(e){}
 toast('wiped · reload');setTimeout(()=>location.reload(),900);
}
// ─── Palette ───
function openPalette(){$('#palette').classList.add('open');setTimeout(()=>$('#pInput').focus(),50)}
function closePalette(){$('#palette').classList.remove('open');$('#pBody').innerHTML='';$('#pInput').value=''}
$('#palette').addEventListener('click',e=>{if(e.target.id==='palette')closePalette()});
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openPalette()}
 if(e.key==='Escape'){closeModal();closePalette()}
});
$('#pInput').addEventListener('keydown',async e=>{
 if(e.key==='Enter'){
 const q=e.target.value.trim();if(!q)return;
 $('#pBody').innerHTML='<div style="padding:14px;color:var(--cream-muted);font-family:var(--mono);font-size:11px">thinking…</div>';
 const ans=await answerQuestion(q);
 $('#pBody').innerHTML=`<div style="padding:14px"><div style="white-space:pre-wrap;font-size:13px;line-height:1.55">${esc(ans.text)}</div><div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);margin-top:10px;letter-spacing:0.08em">${esc(ans.src)}</div></div>`;
 }
});
// ═══════════════════════ Boot ═══════════════════════
async function boot(){
 await loadAll();
 setupMesh();
 await maybeSeedDemo();
 await updateTierBadge();
 render();
 // run-once monthly recon nudge
 if(daysSinceReconciliation()>RULES.cassMonthlyAmberDays){
 setTimeout(()=>toast('CASS 5 reconciliation overdue · '+daysSinceReconciliation()+'d'),1500);
 }
}
boot().catch(e=>{console.error('boot fail',e);document.body.innerHTML='<div style="padding:40px;font-family:monospace;color:#ef4444">Boot failed: '+esc(e.message||e)+'</div>'});

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { TOOLNAME };
export { VERSION };
