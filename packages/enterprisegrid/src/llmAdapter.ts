/**
 * Universal Multi-LLM Adapter & Fallback Engine for @enterprisegrid/grid
 *
 * Allows developers to integrate ANY LLM provider (OpenAI, Anthropic Claude,
 * Google Gemini, Ollama local models, OpenRouter, Azure OpenAI, or any custom
 * backend proxy / SDK function) with automatic zero-configuration fallback to
 * EnterpriseGrid's deterministic local analytical engine.
 */

export type LLMProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'openrouter'
  | 'custom'
  | 'local';

export interface LLMTaskContext<T = any> {
  task: 'query' | 'insights' | 'summary' | 'chat';
  query?: string;
  schema: Array<{ id: string; name: string; sampleType: string }>;
  rows: T[];
  totalRowCount: number;
}

export interface LLMInsightItem {
  title: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  description: string;
}

export interface LLMConfig<T = any> {
  /** Provider preset: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter' | 'custom' | 'local' */
  provider?: LLMProviderType;
  /** Model ID (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet-latest', 'gemini-3.8-flash', 'llama3.2') */
  model?: string;
  /** Optional bearer token or custom authorization token when calling custom proxy endpoints */
  apiKey?: string;
  /** Custom endpoint URL or backend proxy route (e.g., '/api/llm', 'http://localhost:11434/v1/chat/completions') */
  endpoint?: string;
  /** Custom HTTP headers */
  headers?: Record<string, string>;
  /** Sampling temperature (default: 0.1 for structured data tasks) */
  temperature?: number;
  /** Custom system prompt override */
  systemPrompt?: string;
  /**
   * Universal custom completion callback.
   * Plug in ANY LLM SDK (Vercel AI SDK, LangChain, OpenAI SDK, Anthropic SDK, @google/genai, WebLLM, etc.)
   */
  complete?: (prompt: string, context: LLMTaskContext<T>) => Promise<string | any>;
  /** Automatically fall back to built-in smart local engine if network/API is unavailable (default: true) */
  fallbackToLocal?: boolean;
}

const DEFAULT_MODELS: Record<LLMProviderType, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-3.8-flash',
  ollama: 'llama3.2',
  openrouter: 'openai/gpt-4o-mini',
  custom: 'default',
  local: 'enterprisegrid-local-v1',
};

const DANGEROUS_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeParsedJson(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sanitizeParsedJson);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!DANGEROUS_JSON_KEYS.has(k)) {
        clean[k] = sanitizeParsedJson(v);
      }
    }
    return clean;
  }
  return value;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseJsonSafe(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .slice(0, 100_000)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return sanitizeParsedJson(JSON.parse(cleaned));
  } catch {
    const objMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      try {
        return sanitizeParsedJson(JSON.parse(objMatch[1]));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Deterministic Local Natural Language Query Engine
 * Parses natural language prompts like:
 * - "rating > 4.7" or "over 100000" or "under 1995"
 * - "director Christopher Nolan" or "show me engineering"
 * - "top 5 by rating" or "sort by year desc"
 * - "after 2000" / "before 1995"
 */
export function executeSmartLocalQuery<T extends Record<string, any>>(
  query: string,
  rows: T[],
  columns: Array<{ id: string; name: string; selector?: (row: T, idx?: number) => any }>
): T[] {
  const q = String(query || '').slice(0, 500).trim().toLowerCase();
  if (!q) return rows;

  let result = [...rows];

  const getVal = (row: T, colId: string) => {
    const col = columns.find(c => c.id.toLowerCase() === colId.toLowerCase() || c.name.toLowerCase() === colId.toLowerCase());
    if (col?.selector) return col.selector(row);
    return row[colId];
  };

  const toNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[$,%\s,]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? NaN : n;
    }
    return NaN;
  };

  // Detect numeric fields
  const numericCols = columns.filter(col => {
    const sample = rows.find(r => getVal(r, col.id) !== undefined && getVal(r, col.id) !== null);
    if (!sample) return false;
    return !isNaN(toNumber(getVal(sample, col.id)));
  });

  // Normalize "100k" -> 100000
  const normalizedQuery = q.replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_, num) => String(parseFloat(num) * 1000));

  // 1. Check explicit column comparisons: e.g. "rating > 4.8", "year >= 2000", "salary over 95000"
  let matchedComparison = false;
  for (const col of numericCols) {
    const colTokens = [col.id.toLowerCase(), col.name.toLowerCase()].filter(Boolean);
    for (const token of colTokens) {
      const safeToken = escapeRegExp(token);
      const gtRegex = new RegExp(`${safeToken}\\s*(?:>|>=|over|above|greater than|more than|after|at least)\\s*(\\d+(?:\\.\\d+)?)`, 'i');
      const ltRegex = new RegExp(`${safeToken}\\s*(?:<|<=|under|below|less than|before|at most)\\s*(\\d+(?:\\.\\d+)?)`, 'i');
      const eqRegex = new RegExp(`${safeToken}\\s*(?:=|==|is|equals)\\s*(\\d+(?:\\.\\d+)?)`, 'i');

      const gtMatch = normalizedQuery.match(gtRegex);
      if (gtMatch) {
        const threshold = parseFloat(gtMatch[1]);
        result = result.filter(r => toNumber(getVal(r, col.id)) >= threshold);
        matchedComparison = true;
      }

      const ltMatch = normalizedQuery.match(ltRegex);
      if (ltMatch) {
        const threshold = parseFloat(ltMatch[1]);
        result = result.filter(r => toNumber(getVal(r, col.id)) <= threshold);
        matchedComparison = true;
      }

      const eqMatch = normalizedQuery.match(eqRegex);
      if (eqMatch) {
        const target = parseFloat(eqMatch[1]);
        result = result.filter(r => toNumber(getVal(r, col.id)) === target);
        matchedComparison = true;
      }
    }
  }

  // 2. Generic numeric comparisons without column name: e.g. "over 100k", "after 2000", "under 90000", "rating above 4.8"
  if (!matchedComparison) {
    const genericGt = normalizedQuery.match(/(?:>|>=|over|above|greater than|more than|after|at least)\s*(\d+(?:\.\d+)?)/i);
    const genericLt = normalizedQuery.match(/(?:<|<=|under|below|less than|before|at most)\s*(\d+(?:\.\d+)?)/i);
    if (genericGt || genericLt) {
      const val = parseFloat((genericGt || genericLt)![1]);
      const isGt = !!genericGt;
      result = result.filter(r =>
        numericCols.some(col => {
          const n = toNumber(getVal(r, col.id));
          if (isNaN(n)) return false;
          // Match scale (e.g. 4-digit year vs rating vs salary)
          if (val >= 1900 && val <= 2100 && (n < 1800 || n > 2200)) return false;
          return isGt ? n >= val : n <= val;
        })
      );
      matchedComparison = true;
    }
  }

  // 3. Keyword / categorical matching (strip filler words)
  const stopWords = new Set([
    'show', 'me', 'all', 'find', 'list', 'get', 'filter', 'by', 'with', 'where', 'the', 'a', 'an',
    'in', 'from', 'who', 'are', 'is', 'making', 'earns', 'earning', 'having', 'movies', 'records',
    'rows', 'items', 'data', 'over', 'under', 'above', 'below', 'greater', 'less', 'than', 'more',
    'after', 'before', 'top', 'bottom', 'highest', 'lowest', 'sorted', 'sort', 'asc', 'desc'
  ]);

  const cleanedWords = normalizedQuery
    .replace(/(?:>|>=|<|<=|=|==)\s*\d+(?:\.\d+)?/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, (num) => (matchedComparison ? ' ' : num))
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w) && !columns.some(c => c.id.toLowerCase() === w || c.name.toLowerCase() === w));

  if (cleanedWords.length > 0) {
    result = result.filter(row => {
      const rowText = columns
        .map(c => String(getVal(row, c.id) ?? ''))
        .join(' ')
        .toLowerCase();
      return cleanedWords.every(word => {
        // Support singular/plural stem e.g. "engineers" -> "engineer"
        const stem = word.endsWith('s') && word.length > 4 ? word.slice(0, -1) : word;
        return rowText.includes(stem);
      });
    });
  }

  // 4. Handle "top N" or "highest / lowest <col>"
  const topMatch = normalizedQuery.match(/\b(?:top|first)\s+(\d+)/i);
  if ( normalizedQuery.includes('highest') || normalizedQuery.includes('lowest') || topMatch) {
    const sortDesc = !normalizedQuery.includes('lowest');
    const targetCol = numericCols.find(c => normalizedQuery.includes(c.id.toLowerCase()) || normalizedQuery.includes(c.name.toLowerCase())) || numericCols[numericCols.length - 1];
    if (targetCol) {
      result.sort((a, b) => {
        const na = toNumber(getVal(a, targetCol.id)) || 0;
        const nb = toNumber(getVal(b, targetCol.id)) || 0;
        return sortDesc ? nb - na : na - nb;
      });
    }
    if (topMatch) {
      result = result.slice(0, parseInt(topMatch[1], 10));
    }
  }

  return result;
}

/**
 * Deterministic Local Statistical Insights Generator
 */
export function generateSmartLocalInsights<T extends Record<string, any>>(
  rows: T[],
  columns: Array<{ id: string; name: string; selector?: (row: T, idx?: number) => any }>
): LLMInsightItem[] {
  if (!rows || rows.length === 0) {
    return [
      { title: 'Dataset Size', value: '0 rows', trend: 'neutral', description: 'No records are currently active in the view.' }
    ];
  }

  const getVal = (row: T, colId: string) => {
    const col = columns.find(c => c.id.toLowerCase() === colId.toLowerCase());
    return col?.selector ? col.selector(row) : row[colId];
  };

  const toNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[$,%\s,]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? NaN : n;
    }
    return NaN;
  };

  const insights: LLMInsightItem[] = [
    {
      title: 'Total Active Records',
      value: `${rows.length.toLocaleString()}`,
      trend: 'up',
      description: `Analyzing ${rows.length} active rows across ${columns.length} configured columns.`
    }
  ];

  // Find numeric columns for statistical KPIs
  for (const col of columns) {
    const nums = rows.map(r => toNumber(getVal(r, col.id))).filter(n => !isNaN(n));
    if (nums.length >= Math.max(2, Math.floor(rows.length * 0.5)) && col.id.toLowerCase() !== 'id') {
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = sum / nums.length;
      const max = Math.max(...nums);
      const min = Math.min(...nums);
      const first = nums[0];
      const last = nums[nums.length - 1];
      const trend: 'up' | 'down' | 'neutral' = last > first ? 'up' : last < first ? 'down' : 'neutral';

      const formattedAvg = avg > 1000 ? avg.toLocaleString(undefined, { maximumFractionDigits: 0 }) : avg.toFixed(2).replace(/\.00$/, '');
      const formattedMax = max > 1000 ? max.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(max);

      insights.push({
        title: `Avg ${col.name}`,
        value: formattedAvg,
        trend,
        description: `Ranges from ${min} to ${formattedMax} across ${nums.length} valid entries.`
      });
      if (insights.length >= 3) break;
    }
  }

  return insights.slice(0, 3);
}

/**
 * Deterministic Local Executive Summary Generator
 */
export function generateSmartLocalSummary<T extends Record<string, any>>(
  rows: T[],
  columns: Array<{ id: string; name: string; selector?: (row: T, idx?: number) => any }>
): string {
  if (!rows || rows.length === 0) {
    return 'The current table view contains 0 records. Clear active filters or add rows to generate an executive summary.';
  }

  const kpis = generateSmartLocalInsights(rows, columns);
  const metricParts = kpis
    .slice(1)
    .map(k => `${k.title} is ${k.value} (${k.description.toLowerCase()})`)
    .join('; ');

  const firstRow = rows[0];
  const titleCol = columns.find(c => ['title', 'name', 'server', 'month', 'project'].includes(c.id.toLowerCase())) || columns[0];
  const sampleName = titleCol ? (titleCol.selector ? titleCol.selector(firstRow) : firstRow[titleCol.id]) : '';

  return `Executive Summary: The active dataset comprises ${rows.length} records across ${columns.length} columns${sampleName ? ` (starting with "${sampleName}")` : ''}. ${metricParts ? `Key metrics indicate ${metricParts}.` : 'All records are synchronized and ready for filtering, grouping, or export.'}`;
}

/**
 * Safely reads environment variables across Vite (import.meta.env), Node/Next.js/CRA (process.env),
 * or global runtime environments without throwing when globals are absent.
 */
export function readEnvVar(...keys: string[]): string | undefined {
  for (const key of keys) {
    try {
      const metaEnv = (import.meta as any)?.env;
      if (metaEnv && typeof metaEnv[key] === 'string' && metaEnv[key].trim() !== '') {
        return metaEnv[key].trim();
      }
    } catch {
      // ignore if import.meta is unavailable
    }
    try {
      const procEnv = typeof globalThis !== 'undefined' ? (globalThis as any).process?.env : undefined;
      if (procEnv && typeof procEnv[key] === 'string' && procEnv[key].trim() !== '') {
        return procEnv[key].trim();
      }
    } catch {
      // ignore if process.env is unavailable
    }
  }
  return undefined;
}

function resolveProviderEnvApiKey(provider: LLMProviderType): string | undefined {
  if (provider === 'openai') {
    return readEnvVar(
      'OPENAI_API_KEY',
      'VITE_OPENAI_API_KEY',
      'NEXT_PUBLIC_OPENAI_API_KEY',
      'REACT_APP_OPENAI_API_KEY',
      'VITE_ENTERPRISEGRID_LLM_API_KEY',
      'ENTERPRISEGRID_LLM_API_KEY'
    );
  }
  if (provider === 'anthropic') {
    return readEnvVar(
      'ANTHROPIC_API_KEY',
      'VITE_ANTHROPIC_API_KEY',
      'NEXT_PUBLIC_ANTHROPIC_API_KEY',
      'REACT_APP_ANTHROPIC_API_KEY',
      'VITE_ENTERPRISEGRID_LLM_API_KEY',
      'ENTERPRISEGRID_LLM_API_KEY'
    );
  }
  if (provider === 'openrouter') {
    return readEnvVar(
      'OPENROUTER_API_KEY',
      'VITE_OPENROUTER_API_KEY',
      'NEXT_PUBLIC_OPENROUTER_API_KEY',
      'REACT_APP_OPENROUTER_API_KEY',
      'VITE_ENTERPRISEGRID_LLM_API_KEY',
      'ENTERPRISEGRID_LLM_API_KEY'
    );
  }
  if (provider === 'gemini') {
    return readEnvVar(
      'GEMINI_API_KEY',
      'VITE_GEMINI_API_KEY',
      'NEXT_PUBLIC_GEMINI_API_KEY',
      'REACT_APP_GEMINI_API_KEY',
      'VITE_ENTERPRISEGRID_LLM_API_KEY',
      'ENTERPRISEGRID_LLM_API_KEY'
    );
  }
  return readEnvVar(
    'CUSTOM_LLM_API_KEY',
    'VITE_CUSTOM_LLM_API_KEY',
    'VITE_ENTERPRISEGRID_LLM_API_KEY',
    'NEXT_PUBLIC_ENTERPRISEGRID_LLM_API_KEY',
    'REACT_APP_ENTERPRISEGRID_LLM_API_KEY',
    'ENTERPRISEGRID_LLM_API_KEY'
  );
}

function resolveProviderEnvEndpoint(provider: LLMProviderType): string | undefined {
  if (provider === 'openai') {
    return readEnvVar('OPENAI_BASE_URL', 'VITE_OPENAI_BASE_URL');
  }
  if (provider === 'anthropic') {
    return readEnvVar('ANTHROPIC_BASE_URL', 'VITE_ANTHROPIC_BASE_URL');
  }
  if (provider === 'openrouter') {
    return readEnvVar('OPENROUTER_BASE_URL', 'VITE_OPENROUTER_BASE_URL');
  }
  if (provider === 'ollama') {
    return readEnvVar('OLLAMA_BASE_URL', 'VITE_OLLAMA_BASE_URL');
  }
  return readEnvVar(
    'CUSTOM_LLM_ENDPOINT',
    'VITE_CUSTOM_LLM_ENDPOINT',
    'VITE_ENTERPRISEGRID_LLM_ENDPOINT',
    'NEXT_PUBLIC_ENTERPRISEGRID_LLM_ENDPOINT',
    'REACT_APP_ENTERPRISEGRID_LLM_ENDPOINT',
    'ENTERPRISEGRID_LLM_ENDPOINT'
  );
}

/**
 * Universal LLM Client Adapter
 * Executes prompts against OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or custom endpoints,
 * with automatic environment variable resolution and fallback to the built-in local analytical engine.
 */
export async function executeLLMTask<T extends Record<string, any>>(
  config: LLMConfig<T> | undefined,
  context: LLMTaskContext<T>,
  columns: Array<{ id: string; name: string; selector?: (row: T, idx?: number) => any }>
): Promise<any> {
  const envProvider = readEnvVar(
    'VITE_ENTERPRISEGRID_LLM_PROVIDER',
    'NEXT_PUBLIC_ENTERPRISEGRID_LLM_PROVIDER',
    'REACT_APP_ENTERPRISEGRID_LLM_PROVIDER',
    'ENTERPRISEGRID_LLM_PROVIDER'
  ) as LLMProviderType | undefined;
  const provider: LLMProviderType = config?.provider || envProvider || 'custom';
  const envModel = readEnvVar(
    'VITE_ENTERPRISEGRID_LLM_MODEL',
    'NEXT_PUBLIC_ENTERPRISEGRID_LLM_MODEL',
    'REACT_APP_ENTERPRISEGRID_LLM_MODEL',
    'ENTERPRISEGRID_LLM_MODEL',
    'GEMINI_MODEL'
  );
  const model = config?.model || envModel || DEFAULT_MODELS[provider] || 'gemini-3.8-flash';
  const resolvedApiKey = config?.apiKey || resolveProviderEnvApiKey(provider);
  const resolvedEndpoint = config?.endpoint || resolveProviderEnvEndpoint(provider);
  const temperature = config?.temperature ?? 0.1;
  const sampleRows = context.rows.slice(0, 25);

  const systemInstruction =
    config?.systemPrompt ||
    'You are an enterprise data grid intelligence engine. Respond accurately based on the provided dataset schema and rows.';

  const buildPrompt = (): string => {
    if (context.task === 'query') {
      return `Given the user natural language query "${context.query}", filter the dataset and return ONLY a JSON array of matching row indices (0-indexed integers from the provided rows array).
Schema: ${JSON.stringify(context.schema)}
Rows (with _idx): ${JSON.stringify(context.rows.slice(0, 100).map((r, i) => ({ _idx: i, ...r })))}
Return ONLY a valid JSON array of matching integer indices, e.g. [0, 2, 5].`;
    }
    if (context.task === 'insights') {
      return `Analyze this dataset (${context.totalRowCount} total rows) and return ONLY a JSON array of 3 key insights with keys: "title" (string), "value" (short metric string), "trend" ("up" | "down" | "neutral"), and "description" (1 concise sentence).
Sample Data: ${JSON.stringify(sampleRows)}`;
    }
    if (context.task === 'summary') {
      return `Provide a concise 2-3 sentence executive summary of the following dataset (${context.totalRowCount} rows):
Sample Data: ${JSON.stringify(sampleRows)}`;
    }
    return `User question about the data grid (${context.totalRowCount} rows): "${context.query}"
Schema: ${JSON.stringify(context.schema)}
Sample Data: ${JSON.stringify(sampleRows)}
Provide a concise, helpful answer.`;
  };

  const prompt = buildPrompt();

  try {
    // 1. Custom completion function provided by developer
    if (config?.complete) {
      const customResult = await config.complete(prompt, context);
      if (context.task === 'query') {
        if (Array.isArray(customResult)) {
          if (typeof customResult[0] === 'number') {
            return customResult.map((idx: number) => context.rows[idx]).filter(Boolean);
          }
          return customResult;
        }
        const parsed = typeof customResult === 'string' ? parseJsonSafe(customResult) : customResult;
        if (Array.isArray(parsed)) {
          return parsed.map((idx: any) => (typeof idx === 'number' ? context.rows[idx] : idx)).filter(Boolean);
        }
      }
      if (context.task === 'insights') {
        const parsed = typeof customResult === 'string' ? parseJsonSafe(customResult) : customResult;
        if (Array.isArray(parsed)) return parsed;
      }
      if (context.task === 'summary' || context.task === 'chat') {
        return typeof customResult === 'string' ? customResult : JSON.stringify(customResult);
      }
    }

    // 2. Direct Provider REST Adapters when apiKey or endpoint is configured (via props or env variables)
    if (provider !== 'local' && (resolvedApiKey || resolvedEndpoint)) {
      let rawText = '';

      if (provider === 'openai' || provider === 'openrouter' || provider === 'ollama') {
        const url =
          resolvedEndpoint ||
          (provider === 'ollama'
            ? 'http://localhost:11434/v1/chat/completions'
            : provider === 'openrouter'
            ? 'https://openrouter.ai/api/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions');

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resolvedApiKey ? { Authorization: `Bearer ${resolvedApiKey}` } : {}),
            ...(config?.headers || {}),
          },
          body: JSON.stringify({
            model,
            temperature,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || data.text || data.response || '';
      } else if (provider === 'anthropic') {
        const url = resolvedEndpoint || 'https://api.anthropic.com/v1/messages';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resolvedApiKey ? { 'x-api-key': resolvedApiKey, 'anthropic-version': '2023-06-01' } : {}),
            ...(config?.headers || {}),
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: systemInstruction,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
        const data = await res.json();
        rawText = data.content?.[0]?.text || '';
      } else if (resolvedEndpoint) {
        // Generic custom endpoint or backend proxy (e.g. /api/llm)
        const res = await fetch(resolvedEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resolvedApiKey ? { Authorization: `Bearer ${resolvedApiKey}` } : {}),
            ...(config?.headers || {}),
          },
          body: JSON.stringify({
            provider,
            model,
            task: context.task,
            query: context.query,
            prompt,
            systemInstruction,
            data: sampleRows,
          }),
        });
        if (!res.ok) throw new Error(`Custom Endpoint HTTP ${res.status}`);
        const data = await res.json();
        if (context.task === 'insights' && Array.isArray(data)) return data;
        if (context.task === 'insights' && Array.isArray(data.insights)) return data.insights;
        rawText = data.text || data.summary || data.insights || data.answer || JSON.stringify(data);
      }

      if (rawText) {
        if (context.task === 'query') {
          const indices = parseJsonSafe(rawText);
          if (Array.isArray(indices)) {
            return indices.map((idx: number) => context.rows[idx]).filter(Boolean);
          }
        } else if (context.task === 'insights') {
          const parsed = parseJsonSafe(rawText);
          if (Array.isArray(parsed)) return parsed;
        } else {
          return rawText;
        }
      }
    }

    // 3. Try built-in server routes (/api/ai-insights, /api/ai-summary) if available on same origin
    if (provider !== 'local' && typeof window !== 'undefined') {
      if (context.task === 'insights') {
        const res = await fetch('/api/ai-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ data: sampleRows }),
        });
        const ct = res.headers?.get?.('content-type') || '';
        if (res.ok && ct.toLowerCase().includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } else if (context.task === 'summary') {
        const res = await fetch('/api/ai-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ data: sampleRows }),
        });
        const ct = res.headers?.get?.('content-type') || '';
        if (res.ok && ct.toLowerCase().includes('application/json')) {
          const data = await res.json();
          if (data?.summary) return data.summary;
        }
      }
    }
  } catch (err) {
    if (config?.fallbackToLocal === false) {
      throw err;
    }
  }

  // 4. Built-in Zero-Dependency Smart Local Fallback Engine
  if (context.task === 'query') {
    return executeSmartLocalQuery(context.query || '', context.rows, columns);
  }
  if (context.task === 'insights') {
    return generateSmartLocalInsights(context.rows, columns);
  }
  if (context.task === 'summary') {
    return generateSmartLocalSummary(context.rows, columns);
  }
  // Chat / Q&A fallback
  const matched = executeSmartLocalQuery(context.query || '', context.rows, columns);
  const summary = generateSmartLocalSummary(matched.length > 0 ? matched : context.rows, columns);
  return `Matched ${matched.length} of ${context.rows.length} rows for "${context.query}". ${summary}`;
}
