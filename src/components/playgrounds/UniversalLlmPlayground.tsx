import React, { useState } from 'react';
import LiveCodeEditor from '../LiveCodeEditor';
import { Bot } from 'lucide-react';
import { DataTable, LLMProviderType, TableColumn } from '@enterprisegrid/grid';

interface TelemetryRow {
  id: number;
  service: string;
  region: string;
  latencyMs: number;
  errorRate: number;
  status: string;
}

const telemetryRows: TelemetryRow[] = [
  { id: 1, service: 'Auth Gateway', region: 'us-east-1', latencyMs: 42, errorRate: 0.02, status: 'Healthy' },
  { id: 2, service: 'Billing Worker', region: 'eu-west-1', latencyMs: 185, errorRate: 1.4, status: 'Degraded' },
  { id: 3, service: 'Search Indexer', region: 'ap-south-1', latencyMs: 68, errorRate: 0.1, status: 'Healthy' },
  { id: 4, service: 'Stream Ingest', region: 'us-west-2', latencyMs: 312, errorRate: 3.8, status: 'Alert' },
  { id: 5, service: 'Edge Cache', region: 'eu-central-1', latencyMs: 19, errorRate: 0.0, status: 'Healthy' },
];

const telemetryCols: TableColumn<TelemetryRow>[] = [
  { id: 'service', name: 'Service', selector: (r) => r.service, sortable: true },
  { id: 'region', name: 'Region', selector: (r) => r.region, sortable: true },
  { id: 'latencyMs', name: 'P95 Latency (ms)', selector: (r) => r.latencyMs, sortable: true, right: true, filterType: 'number' },
  { id: 'errorRate', name: 'Error Rate (%)', selector: (r) => r.errorRate, sortable: true, right: true, filterType: 'number' },
  { id: 'status', name: 'Status', selector: (r) => r.status, sortable: true },
];

const PROVIDER_DEFAULTS: Record<LLMProviderType, { model: string; endpoint: string; label: string }> = {
  local: { model: 'built-in-engine', endpoint: '(zero-network deterministic)', label: 'Built-in Local Engine' },
  gemini: { model: 'gemini-3.8-flash', endpoint: '/api/ai-proxy (or direct SDK)', label: 'Google Gemini' },
  openai: { model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions', label: 'OpenAI' },
  anthropic: { model: 'claude-3-5-sonnet-latest', endpoint: 'https://api.anthropic.com/v1/messages', label: 'Anthropic Claude' },
  ollama: { model: 'llama3.2', endpoint: 'http://localhost:11434/api/chat', label: 'Local Ollama' },
  openrouter: { model: 'openai/gpt-4o-mini', endpoint: 'https://openrouter.ai/api/v1/chat/completions', label: 'OpenRouter' },
  custom: { model: 'custom-model', endpoint: '/api/my-llm-proxy', label: 'Custom Proxy / SDK' },
};

export function UniversalLlmPlayground() {
  const [provider, setProvider] = useState<LLMProviderType>('gemini');
  const activePreset = PROVIDER_DEFAULTS[provider];

  const codeSnippet =
    provider === 'custom'
      ? `import { DataTable } from '@enterprisegrid/grid';

<DataTable
  columns={columns}
  data={data}
  enableAiQuery
  enableAiInsights
  enableAiSummary
  llmConfig={{
    provider: 'custom',
    fallbackToLocal: true,
    // Connect ANY SDK (LangChain, Vercel AI SDK, Azure OpenAI, Bedrock, internal proxy)
    complete: async (prompt, context) => {
      const response = await fetch('/api/my-llm-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: context.systemPrompt,
          prompt,
          schema: context.schema,
        }),
      });
      const json = await response.json();
      return json.text;
    },
  }}
/>`
      : `import { DataTable } from '@enterprisegrid/grid';

<DataTable
  columns={columns}
  data={data}
  enableAiQuery
  enableAiInsights
  enableAiSummary
  llmConfig={{
    provider: '${provider}',
    model: '${activePreset.model}',
    ${provider !== 'local' ? `endpoint: '${activePreset.endpoint}', // Recommended: route via your backend proxy\n    ` : ''}fallbackToLocal: true, // Always falls back cleanly if offline or key is missing
  }}
/>`;

  return (
    <div id="universal-llm-guide" className="mb-16 scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-2xl font-display font-semibold text-slate-900 flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          Universal LLM Integration (<code>llmConfig</code>)
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Plug in any LLM provider with zero vendor lock-in: <strong>Google Gemini (<code>gemini-3.8-flash</code>)</strong>, <strong>OpenAI</strong>, <strong>Anthropic Claude</strong>, <strong>Local Ollama</strong>, <strong>OpenRouter</strong>, or a custom <code>complete(prompt, context)</code> callback. With <code>fallbackToLocal: true</code>, natural language filtering, KPI insights, and summaries continue working seamlessly even offline or without API keys.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-50 border border-slate-200">
        {(Object.keys(PROVIDER_DEFAULTS) as LLMProviderType[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setProvider(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              provider === key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            {PROVIDER_DEFAULTS[key].label}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          id="universal-llm-docs-grid"
          title={`Service Telemetry (${activePreset.label})`}
          columns={telemetryCols}
          data={telemetryRows}
          searchable
          enableAiQuery
          enableAiInsights
          enableAiSummary
          llmConfig={{
            provider,
            model: activePreset.model,
            fallbackToLocal: true,
          }}
        />
      </div>

      <LiveCodeEditor language="tsx" title={`llm-config-${provider}.tsx`}>
        {codeSnippet}
      </LiveCodeEditor>
    </div>
  );
}
