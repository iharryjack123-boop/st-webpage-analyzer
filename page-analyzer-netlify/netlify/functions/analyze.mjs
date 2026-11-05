// Automatically finds currently FREE text models on OpenRouter (pricing = 0) and tries them in order.
// Paid models are never used: every candidate must be listed with zero prompt and completion price.
const PREF = [/llama-3\.3-70b/, /gpt-oss/, /deepseek/, /qwen/, /gemma-3/, /mistral/, /llama/, /glm/, /nemotron/];
let cache = { t: 0, list: [] };
const dead = new Map();
const zero = v => v === undefined || v === null || Number(v) === 0;
const isFree = m => m.pricing && m.pricing.prompt !== undefined && m.pricing.completion !== undefined &&
  Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 && zero(m.pricing.request) && zero(m.pricing.image);

async function freeModels(base, key) {
  if (Date.now() - cache.t < 600000 && cache.list.length) return cache.list;
  const r = await fetch(base + '/models', { headers: { authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  const list = (j.data || [])
    .filter(m => isFree(m) && /text/.test((m.architecture?.output_modalities || ['text']).join()) &&
      /text/.test((m.architecture?.input_modalities || ['text']).join()) && (m.context_length || 0) >= 8000)
    .map(m => {
      let s = (m.context_length || 0) / 1e5;
      const i = PREF.findIndex(p => p.test(m.id));
      s += i < 0 ? 0 : (PREF.length - i) * 2;
      if (/r1|thinking|reason|\bvl\b|vision|coder|guard|embed/i.test(m.id)) s -= 6;
      if (/-(1|2|3|4)b\b/i.test(m.id)) s -= 5;
      return { id: m.id, s };
    })
    .sort((a, b) => b.s - a.s).map(x => x.id);
  cache = { t: Date.now(), list };
  return list;
}

export default async (req) => {
  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get('x-access-code') !== code) return Response.json({ error: 'Access code required.' }, { status: 401 });
  const key = process.env.AI_API_KEY;
  if (!key) return Response.json({ error: 'AI_API_KEY is not set in Netlify environment variables.' }, { status: 500 });
  const { prompt } = await req.json();
  const base = (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const pinned = (process.env.AI_MODEL || '').split(',').map(s => s.trim()).filter(Boolean);
  let last = '', models;
  if (base.includes('openrouter.ai')) {
    try {
      const free = await freeModels(base, key);
      models = [...pinned.filter(p => free.includes(p)), ...free.filter(m => !pinned.includes(m))];
    } catch (e) { last = 'Could not list free models: ' + e.message; models = []; }
  } else models = pinned; // custom endpoint: you choose the models
  const alive = models.filter(m => !(dead.get(m) > Date.now()));
  const tryList = (alive.length ? alive : models).slice(0, 4);
  if (!tryList.length) return Response.json({ error: 'No free models available right now. ' + last }, { status: 502 });
  for (const model of tryList) {
    try {
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, 'x-title': 'Page Analyzer' },
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 1600, messages: [
          { role: 'system', content: 'You are a precise SEO auditor. Reply with one valid JSON object only. No markdown, no commentary.' },
          { role: 'user', content: String(prompt).slice(0, 24000) }] })
      });
      const j = await r.json();
      const t = j.choices?.[0]?.message?.content;
      if (r.ok && t && t.includes('{')) return Response.json({ text: t, model });
      last = model + ': ' + (j.error?.message || (t ? 'no JSON in reply' : 'empty reply'));
      dead.set(model, Date.now() + 300000);
    } catch (e) { last = model + ': ' + e.message; dead.set(model, Date.now() + 120000); }
  }
  return Response.json({ error: 'All free models failed or are busy. Last error: ' + last }, { status: 502 });
};

