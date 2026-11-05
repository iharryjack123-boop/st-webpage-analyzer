# Page Analyzer (Netlify)

1. Push this folder to a GitHub repo, then in Netlify: Add new site > Import from Git. (CLI alternative: `netlify deploy --prod`.)
2. Get a free key at https://openrouter.ai/keys (no card needed).
3. Site configuration > Environment variables, add:
   - AI_API_KEY = your key (required)
   - ACCESS_CODE = any code you choose (optional, recommended so strangers cannot use your key)
   - AI_MODEL = comma-separated model ids, tried in order (optional). Defaults to free open models; change if one is retired.
   - AI_BASE_URL = any OpenAI-compatible endpoint (optional), e.g. a hosted open model of your own.
4. Redeploy. Open the site, enter a URL and keywords, click Analyze.
