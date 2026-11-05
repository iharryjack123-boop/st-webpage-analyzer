// Calls any OpenAI-compatible endpoint. Defaults to OpenRouter's free open models.
const DEFAULT_MODELS = 'meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3-0324:free,qwen/qwen-2.5-72b-instruct:free';
export default async (req) => {
  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get('x-access-code') !== code) return Response.json({ error: 'Access code required.' }, { status: 401 });
  const key = process.env.AI_API_KEY;
  if (!key) return Response.json({ error: 'AI_API_KEY is not set in Netlify environment variables.' }, { status: 500 });
  const { prompt } = await req.json();
  const base = (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const models = (process.env.AI_MODEL || DEFAULT_MODELS).split(',').map(s => s.trim()).filter(Boolean);
  let last = '';
  for (const model of models) {
    try {
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(25000),
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, 'x-title': 'Page Analyzer' },
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 1800, messages: [
          { role: 'system', content: 'You are a precise SEO auditor. Reply with one valid JSON object only. No markdown, no commentary.' },
          { role: 'user', content: String(prompt).slice(0, 24000) }] })
      });
      const j = await r.json();
      const t = j.choices?.[0]?.message?.content;
      if (r.ok && t) return Response.json({ text: t, model });
      last = j.error?.message || ('HTTP ' + r.status);
    } catch (e) { last = e.message; }
  }
  return Response.json({ error: 'All AI models failed: ' + last }, { status: 502 });
};
