'use client';

import React, { useState, useRef, useEffect, Fragment, ReactNode } from 'react';
import { Bot, X, Send, Loader2, Sparkles, ChevronDown, RefreshCw } from 'lucide-react';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = text.split(regex);
  parts.forEach((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      nodes.push(<strong key={key} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>);
    } else if (/^`[^`]+`$/.test(part)) {
      nodes.push(
        <code key={key} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[0.88em] font-mono border border-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    } else if (/^\*[^*]+\*$/.test(part)) {
      nodes.push(<em key={key} className="italic text-slate-700">{part.slice(1, -1)}</em>);
    } else if (part) {
      nodes.push(<Fragment key={key}>{part}</Fragment>);
    }
  });
  return nodes;
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key} className="space-y-1 my-1.5 list-disc pl-5 text-slate-700 text-xs leading-relaxed">
        {listItems.map((it, i) => (
          <li key={`${key}-li-${i}`}>{renderInline(it, `${key}-li-${i}`)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `blk-${idx}`;
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);

    if (bullet) {
      listItems.push(bullet[1]);
    } else {
      flushList(`${key}-pre`);
      if (line.trim() !== '') {
        blocks.push(
          <p key={key} className="text-xs leading-relaxed text-slate-700 my-1">
            {renderInline(line, key)}
          </p>
        );
      }
    }
  });
  flushList('blk-final');

  return <div className="space-y-1">{blocks}</div>;
}

const QUICK_CHIPS = [
  '📦 สินค้าใกล้หมดสต็อกมีอะไรบ้าง',
  '📍 ค้นหาตำแหน่ง SKU ที่สต็อกเหลือน้อย',
  '🚚 สรุปสถานะออเดอร์จัดส่งวันนี้',
  '⚠️ มีสินค้าค้างนาน/หมดอายุไหม',
];

export default function GlobalAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; content: string }[]>([
    {
      role: 'bot',
      content: 'สวัสดีครับ! ผม **NEXUS AI Warehouse Assistant** ผู้ช่วยอัจฉริยะประจำคลังสินค้า สอบถามสต็อก ตำแหน่งชั้นวาง หรือสถานะออเดอร์ได้ทันทีครับ',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');
    const newHistory = [...messages, { role: 'user' as const, content: query }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: newHistory.slice(-6),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          content: data.reply || 'ขออภัยครับ ไม่ได้รับข้อมูลตอบกลับ กรุณาลองใหม่อีกครั้ง',
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          content: 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI กรุณาลองใหม่อีกครั้งครับ',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white rounded-full shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <Bot className="w-5 h-5 transition-transform group-hover:rotate-12" />
          <span className="font-semibold text-sm tracking-wide">AI ผู้ช่วยคลัง</span>
        </button>
      )}

      {/* Chat Drawer / Modal */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-inner">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <span>NEXUS AI Assistant</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-normal">
                    Live
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">ระบบคลังสินค้า & ขนส่งอัจฉริยะ</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([messages[0]])}
                title="ล้างการสนทนา"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Chips */}
          <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(chip)}
                disabled={loading}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 active:scale-95 transition-all"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Container */}
          <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'bot' && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm text-sm ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white text-slate-800 border border-slate-200/70 rounded-tl-sm'
                  }`}
                >
                  {m.role === 'user' ? (
                    <div className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <MarkdownLite text={m.content} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-slate-400 text-xs">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>กำลังวิเคราะห์ข้อมูลคลังสินค้า...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="พิมพ์ถาม เช่น SKU นี้อยู่ไหน, ของใกล้หมด..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
