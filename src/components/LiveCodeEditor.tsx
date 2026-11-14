import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  RotateCcw,
  Terminal,
  Eye,
  Pencil,
  Search,
  AlertCircle,
  Download,
  WrapText,
  X,
} from 'lucide-react';

interface LiveCodeEditorProps {
  children?: string;
  code?: string;
  language?: string;
  style?: any;
  customStyle?: any;
  onChange?: (newCode: string) => void;
  title?: string;
}

function checkBalancedDelimiters(source: string): string | null {
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let line = 1;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    const prev = source[i - 1];

    if (ch === '\n') {
      line++;
      inLineComment = false;
      continue;
    }

    if (inLineComment) continue;
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (ch === "'" && !inDouble && !inTemplate && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && !inTemplate && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '`' && !inSingle && !inDouble && prev !== '\\') {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push({ char: ch, line });
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack[stack.length - 1];
      if (!top || top.char !== pairs[ch]) {
        return `Unexpected '${ch}' on line ${line}`;
      }
      stack.pop();
    }
  }

  if (inSingle || inDouble || inTemplate) {
    return 'Unterminated string literal';
  }
  if (inBlockComment) {
    return 'Unterminated block comment';
  }
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return `Unclosed '${unclosed.char}' opened on line ${unclosed.line}`;
  }
  return null;
}

export default function LiveCodeEditor({
  children,
  code: propCode,
  language = 'jsx',
  style = vscDarkPlus,
  onChange,
  title,
}: LiveCodeEditorProps) {
  const initialCode = (children || propCode || '').trim();
  const [code, setCode] = useState(initialCode);
  const [isEditing, setIsEditing] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<
    Array<{ type: 'info' | 'success' | 'error'; message: string; timestamp: string }>
  >([]);
  const [showConsole, setShowConsole] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchMatches, setSearchMatches] = useState<number>(0);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasMountedRef = useRef(false);

  // Keep external prop changes synced unless actively editing
  useEffect(() => {
    if (!isEditing) {
      setCode(initialCode);
    }
  }, [initialCode, isEditing]);

  // Syntax & delimiter check without false positives on TypeScript/JSX
  useEffect(() => {
    if (!code) {
      setSyntaxError(null);
      return;
    }

    const timestamp = new Date().toLocaleTimeString();

    if (language === 'json') {
      try {
        JSON.parse(code);
        setSyntaxError(null);
        if (hasMountedRef.current) {
          setConsoleLogs((prev) => [
            { type: 'success', message: 'Valid JSON configuration.', timestamp },
            ...prev.slice(0, 14),
          ]);
        }
      } catch (err: any) {
        setSyntaxError(err.message);
        setConsoleLogs((prev) => [
          { type: 'error', message: `JSON error: ${err.message}`, timestamp },
          ...prev.slice(0, 14),
        ]);
      }
    } else {
      const delimiterIssue = checkBalancedDelimiters(code);
      if (delimiterIssue) {
        setSyntaxError(delimiterIssue);
        if (hasMountedRef.current) {
          setConsoleLogs((prev) => [
            { type: 'error', message: delimiterIssue, timestamp },
            ...prev.slice(0, 14),
          ]);
        }
      } else {
        setSyntaxError(null);
        if (hasMountedRef.current && isEditing) {
          setConsoleLogs((prev) => [
            { type: 'success', message: 'Syntax check passed.', timestamp },
            ...prev.slice(0, 14),
          ]);
        }
      }
    }
    hasMountedRef.current = true;
  }, [code, language, isEditing]);

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs([
      { type: 'info', message: 'Editor ready. Switch to Edit Code to customize or test syntax.', timestamp },
    ]);
  }, []);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const el = document.createElement('textarea');
        el.value = code;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      const timestamp = new Date().toLocaleTimeString();
      setConsoleLogs((prev) => [
        { type: 'info', message: 'Copied snippet to clipboard.', timestamp },
        ...prev.slice(0, 14),
      ]);
    } catch {
      // Clipboard fallback ignored safely
    }
  };

  const handleDownload = () => {
    const filename = title || `snippet.${language === 'json' ? 'json' : language === 'typescript' ? 'ts' : 'tsx'}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setCode(initialCode);
    setSyntaxError(null);
    setIsEditing(false);
    if (onChange) onChange(initialCode);

    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs((prev) => [
      { type: 'info', message: 'Reset snippet to default.', timestamp },
      ...prev.slice(0, 14),
    ]);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    if (onChange) {
      onChange(newCode);
    }
  };

  const syncGutterScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      setCode(newVal);
      if (onChange) onChange(newVal);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      setSearchMatches(0);
      return;
    }
    try {
      const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      const matches = code.match(regex);
      setSearchMatches(matches ? matches.length : 0);
    } catch {
      setSearchMatches(0);
    }
  }, [searchQuery, code]);

  const jumpToNextMatch = () => {
    if (!searchQuery || !textareaRef.current) return;
    if (!isEditing) setIsEditing(true);
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const lowerCode = code.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase();
      const currentPos = textarea.selectionEnd || 0;
      let idx = lowerCode.indexOf(lowerQuery, currentPos);
      if (idx === -1) {
        idx = lowerCode.indexOf(lowerQuery, 0);
      }
      if (idx !== -1) {
        textarea.focus();
        textarea.setSelectionRange(idx, idx + searchQuery.length);
        const linesBefore = code.slice(0, idx).split('\n').length - 1;
        textarea.scrollTop = Math.max(0, linesBefore * 24 - 60);
        syncGutterScroll();
      }
    }, 0);
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);
  const isModified = code !== initialCode;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#181a1f] shadow-sm flex flex-col w-full text-slate-300 font-sans">
      {/* Editor Toolbar */}
      <div className="bg-[#21242b] border-b border-[#323640] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono text-slate-300 font-medium truncate">
            {title || `snippet.${language === 'json' ? 'json' : 'tsx'}`}
          </span>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums hidden sm:inline">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>

          <div className="flex bg-[#16181d] p-0.5 rounded-lg border border-slate-700/80 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                !isEditing
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#282c34]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isEditing
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#282c34]'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setWordWrap((w) => !w)}
            className={`p-1.5 rounded-lg transition-colors text-slate-400 hover:text-slate-100 hover:bg-[#2f343f] ${
              wordWrap ? 'bg-[#2f343f] text-indigo-400' : ''
            }`}
            title={wordWrap ? 'Disable line wrap' : 'Wrap long lines'}
            aria-label="Toggle line wrap"
            aria-pressed={wordWrap}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowSearch((prev) => !prev);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className={`p-1.5 rounded-lg transition-colors text-slate-400 hover:text-slate-100 hover:bg-[#2f343f] ${
              showSearch ? 'bg-[#2f343f] text-indigo-400' : ''
            }`}
            title="Find in snippet"
            aria-label="Find in code"
            aria-expanded={showSearch}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {isModified && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-[#2f343f] transition-colors text-amber-400 hover:text-amber-300"
              title="Reset to default code"
              aria-label="Reset code"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-[#2f343f] transition-colors text-slate-400 hover:text-slate-100"
            title="Download file"
            aria-label="Download snippet"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowConsole((prev) => !prev)}
            className={`px-2 py-1 rounded-lg hover:bg-[#2f343f] transition-colors text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showConsole ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/60' : 'text-slate-400 hover:text-slate-100'
            }`}
            title="Toggle syntax check console"
            aria-expanded={showConsole}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Console</span>
            {syntaxError && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Find Panel */}
      {showSearch && (
        <div className="bg-[#1d2026] border-b border-[#323640] px-3.5 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find text (Enter to jump, Esc to close)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  jumpToNextMatch();
                } else if (e.key === 'Escape') {
                  setShowSearch(false);
                  setSearchQuery('');
                }
              }}
              className="bg-[#131519] border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 w-full"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {searchQuery && (
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {searchMatches} {searchMatches === 1 ? 'match' : 'matches'}
              </span>
            )}
            {searchMatches > 0 && (
              <button
                type="button"
                onClick={jumpToNextMatch}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium whitespace-nowrap shrink-0"
              >
                Next
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              aria-label="Close find bar"
              className="p-1 text-slate-400 hover:text-slate-200 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex flex-1 relative min-h-[180px] max-h-[520px] overflow-hidden font-mono text-[13.5px]">
        {isEditing ? (
          <div className="flex flex-1 w-full h-[360px] overflow-hidden">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="bg-[#15171b] text-slate-500 select-none py-4 text-right pr-3 pl-3 min-w-[3.25rem] border-r border-[#2b2e37] overflow-hidden tabular-nums text-[12px] leading-[24px]"
            >
              {lineNumbers.map((num) => (
                <div key={num} className="h-[24px] leading-[24px]">
                  {num}
                </div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={code}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onScroll={syncGutterScroll}
              aria-label={`Code editor for ${title || language}`}
              className={`flex-1 w-full h-full p-4 bg-[#181a1f] text-slate-100 font-mono text-[13.5px] leading-[24px] resize-none outline-none border-none focus:ring-0 overflow-auto ${
                wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
              }`}
              spellCheck={false}
              placeholder="Write or edit code here..."
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <SyntaxHighlighter
              language={language}
              style={style}
              wrapLongLines={wordWrap}
              showLineNumbers
              lineNumberStyle={{
                minWidth: '2.75em',
                paddingRight: '1em',
                color: '#5c6370',
                userSelect: 'none',
                fontSize: '12px',
              }}
              customStyle={{
                margin: 0,
                padding: '1rem 1.25rem',
                background: 'transparent',
                fontSize: '13.5px',
                fontFamily: 'var(--font-mono)',
                lineHeight: '1.65',
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>

      {/* Syntax Alert */}
      {syntaxError && (
        <div className="bg-rose-950/90 border-t border-rose-800/70 px-4 py-2 flex items-center gap-2.5 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold text-rose-300 shrink-0">Syntax Check:</span>
          <span className="font-mono truncate flex-1">{syntaxError}</span>
        </div>
      )}

      {/* Collapsible Console Panel */}
      {showConsole && (
        <div className="bg-[#121317] border-t border-[#2c303a] flex flex-col h-[156px]">
          <div className="bg-[#1b1d23] px-4 py-1.5 flex items-center justify-between border-b border-[#2b2e37]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">Editor Console</span>
            </div>
            <button
              type="button"
              onClick={() => setShowConsole(false)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Hide
            </button>
          </div>
          <div className="p-3 overflow-y-auto flex-1 font-mono text-xs space-y-1.5 leading-relaxed">
            {consoleLogs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-500 select-none tabular-nums">[{log.timestamp}]</span>
                <span
                  className={
                    log.type === 'error'
                      ? 'text-rose-400 font-semibold'
                      : log.type === 'success'
                      ? 'text-emerald-400'
                      : 'text-indigo-400'
                  }
                >
                  {log.type === 'error' ? 'ERROR' : log.type === 'success' ? 'OK' : 'INFO'}
                </span>
                <span className="text-slate-300 break-words">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
