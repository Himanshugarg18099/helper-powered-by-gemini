import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Volume2, Loader2, StopCircle, Copy, Check, Reply } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  onSpeak: (message: Message) => void;
  onReply: (message: Message) => void;
  isPlaying: boolean;
  isSpeakingLoading: boolean;
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const text = String(children).replace(/\n$/, '');
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="not-prose relative my-4 rounded-lg overflow-hidden border border-slate-700/50 bg-[#1e1e1e] shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-slate-700/50">
          <span className="text-xs text-slate-400 font-mono font-medium lowercase">
            {match[1]}
          </span>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
            title="Copy code"
            aria-label="Copy code block"
          >
            {isCopied ? (
              <>
                <Check size={14} className="text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.85rem',
            lineHeight: '1.6',
            overflowX: 'auto',
          }}
          codeTagProps={{
            style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code 
      className={`${className} bg-black/20 text-slate-200 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-white/10`} 
      {...props}
    >
      {children}
    </code>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onSpeak, 
  onReply,
  isPlaying, 
  isSpeakingLoading 
}) => {
  const isUser = message.role === 'user';

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
      return timeStr;
    }
    
    return `${date.toLocaleDateString()} ${timeStr}`;
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-lg ${
          isUser ? 'bg-indigo-600' : 'bg-emerald-600'
        }`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} min-w-0`}>
          {/* Sender Name */}
          <span className="text-[10px] text-slate-400 font-medium px-1">
            {isUser ? 'You' : 'Gemini'}
          </span>

          <div className={`rounded-2xl px-5 py-3 shadow-md w-full overflow-hidden ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-surface border border-slate-700 text-slate-200 rounded-tl-none'
          }`}>
            
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {message.attachments.map((att, idx) => (
                  <img 
                    key={idx}
                    src={att.url} 
                    alt={`Attachment ${idx + 1}`} 
                    className="max-w-full h-auto max-h-[300px] rounded-lg border border-white/20 shadow-sm"
                  />
                ))}
              </div>
            )}

            {/* Text Content */}
            <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed select-text">
              <ReactMarkdown 
                components={{
                  code: CodeBlock
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          </div>

          {/* Metadata Row: Actions + Timestamp */}
          <div className="flex items-center gap-2 px-1 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
            {/* Timestamp */}
            <span 
              className="text-[10px] text-slate-500 font-medium mr-2" 
              title={new Date(message.timestamp).toLocaleString()}
            >
              {formatTimestamp(message.timestamp)}
            </span>

             {/* Reply Action */}
             <button
                onClick={() => onReply(message)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-slate-400 border border-transparent hover:border-slate-700 hover:bg-slate-800 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                aria-label={`Reply to ${isUser ? 'your' : 'Gemini'} message`}
             >
                <Reply size={12} />
                <span className="hidden sm:inline">Reply</span>
             </button>

            {/* Read Aloud Action (Only for AI) */}
            {!isUser && (
                <button 
                  onClick={() => onSpeak(message)}
                  disabled={isSpeakingLoading}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors border ${
                      isPlaying 
                      ? 'text-red-300 bg-red-900/30 border-red-800' 
                      : 'text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700 focus-visible:ring-1 focus-visible:ring-primary'
                  }`}
                  aria-label={isPlaying ? "Stop reading" : "Read message aloud"}
                >
                  {isSpeakingLoading && isPlaying ? ( 
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  ) : isPlaying ? (
                    <>
                      <StopCircle size={12} aria-hidden="true" />
                      <span className="hidden sm:inline">Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={12} aria-hidden="true" />
                      <span className="hidden sm:inline">Read</span>
                    </>
                  )}
                </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};