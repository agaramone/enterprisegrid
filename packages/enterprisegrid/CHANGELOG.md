# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-11-13

### Added
- **Animated DataTable Preview (`assets/table-preview.gif`)**: Included in the package README and distribution archive.
- **Automatic Environment Variable Resolution**: Universal LLM Adapter (`executeLLMTask` and `readEnvVar`) and backend proxy automatically detect secret API keys, endpoints, providers, and models from `.env` variables (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`, `CUSTOM_LLM_API_KEY`, `VITE_ENTERPRISEGRID_LLM_*`, `ENTERPRISEGRID_LLM_*`).
- **Enterprise Security Hardening**: CSV formula/DDE injection neutralization (`sanitizeCsvCell`), CSV & JSON prototype pollution guards, RegExp metacharacter escaping in natural language queries, and validated URL `viewState` deserialization.
- **Enterprise Productivity Suite**: Windowed 60fps row virtualization, container-aware responsive mobile cards, column auto-aggregations (`sum`, `avg`, `min`, `max`, `count`, `unique`), external `<TableSummary />` component, drag column resizing, quick filter chips, bulk action bar, CSV/TSV import & multi-format export (`.csv`, `.json`, `.md`, `.html`), and full keyboard navigation.

---

## [1.0.0] - 2026-06-28

### Added
- **Initial Release** of `@enterprisegrid/grid` package.
- **Interactive Live Code Editors** integrated across all documentation and playground components, allowing real-time sandbox edits and syntax verification.
- **Multi-View Modes**: Fluid transitions between traditional grid list layout, responsive calendar layout, and geospatial interactive maps.
- **Embedded Sparklines & Heatmaps**: Out-of-the-box micro-visualization overlays directly inside cells for trend identification.
- **Time-Travel Undo/Redo Engine**: Native local history management supporting complete state rollbacks.
- **TypeScript Typings**: Production-ready, fully typed declaration files exported automatically on build.
- **UMD and ESM Build Formats**: Multi-bundle setups using Vite & Rollup for cross-compatible imports.
