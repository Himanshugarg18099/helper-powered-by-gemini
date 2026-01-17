import React, { useState, useEffect, useRef } from 'react';
import { Message, TTSVoice, Attachment } from './types';
import { initializeChat, sendMessageToGemini, generateSpeech } from './services/geminiService';
import { decodeBase64, decodeAudioData, playAudioBuffer } from './utils/audioUtils';
import { InputArea } from './components/InputArea';
import { ChatMessage } from './components/ChatMessage';
import { Sparkles, MessageSquare, Settings, Volume2, Mic, Trash2, History, Search, X, Sliders } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [speakingLoading, setSpeakingLoading] = useState(false);
  
  // Settings State
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice>(TTSVoice.Kore);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Interaction State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastSpokenMessageId = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize Chat & Load Settings on mount
  useEffect(() => {
    // Load History
    const saved = localStorage.getItem('gemini_chat_history');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                setMessages(parsed);
                try { initializeChat(undefined, parsed); } catch(e) {}
            } else {
                initNewChat();
            }
        } catch (e) {
            initNewChat();
        }
    } else {
        initNewChat();
    }

    // Load Settings
    const savedSpeed = localStorage.getItem('gemini_tts_speed');
    if (savedSpeed) setTtsSpeed(parseFloat(savedSpeed));
    
    const savedVoice = localStorage.getItem('gemini_tts_voice');
    if (savedVoice) setSelectedVoice(savedVoice as TTSVoice);

    return () => {
        stopAudio();
        if (audioContextRef.current?.state !== 'closed') {
            audioContextRef.current?.close();
        }
    };
  }, []);

  // Save Settings when changed
  useEffect(() => {
     localStorage.setItem('gemini_tts_speed', ttsSpeed.toString());
     localStorage.setItem('gemini_tts_voice', selectedVoice);
  }, [ttsSpeed, selectedVoice]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N: New Chat
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        initNewChat();
      }
      // Alt+I: Focus Input
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        const textarea = document.querySelector('textarea');
        textarea?.focus();
      }
      // Alt+S: Toggle Settings
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowSettings(prev => !prev);
      }
      // Esc
      if (e.key === 'Escape') {
        if (isSearchActive) handleClearSearch();
        if (showSettings) setShowSettings(false);
        if (quotedMessage) setQuotedMessage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchActive, showSettings, quotedMessage]);

  const initNewChat = () => {
      setMessages([{
        id: 'welcome',
        role: 'model',
        text: "Hello! I'm your Gemini Assistant. I can help you with text, analyze images you paste or upload, and I can even read my responses aloud.",
        timestamp: Date.now()
      }]);
      setSearchQuery('');
      setIsSearchActive(false);
      setQuotedMessage(null);
      
      try { initializeChat(); } catch(e) {}
  };

  const handleClearSearch = () => {
      setSearchQuery('');
      setIsSearchActive(false);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, searchQuery, isSearchActive, quotedMessage]);

  // Auto-Save History
  useEffect(() => {
    if (messages.length > 0) {
        try {
            const toSave = messages.map(({ isAudioPlaying, ...rest }) => rest);
            localStorage.setItem('gemini_chat_history', JSON.stringify(toSave));
        } catch (e) {
            console.warn("Could not save to localStorage", e);
        }
    }
  }, [messages]);

  // Handle Auto-Speak
  useEffect(() => {
    if (!autoSpeak || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'model' && lastMessage.id !== lastSpokenMessageId.current) {
        lastSpokenMessageId.current = lastMessage.id;
        setTimeout(() => handleSpeak(lastMessage), 100);
    }
  }, [messages, autoSpeak]);

  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (searchQuery) {
        setSearchQuery('');
        setIsSearchActive(false);
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      attachments,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    try {
      const responseText = await sendMessageToGemini(text, attachments);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I couldn't generate a text response.",
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      console.error(error);
      const errText = error.message || "Unknown error";
      // Improved error message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Error: ${errText}.\n\nPlease check your internet connection and ensure your API KEY is set correctly in your environment variables.`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopAudio = () => {
      if (activeSourceRef.current) {
          try {
            activeSourceRef.current.stop();
          } catch(e) { /* ignore */ }
          activeSourceRef.current = null;
      }
      setIsSpeakingId(null);
  };

  const handleSpeak = async (message: Message) => {
    if (isSpeakingId === message.id) {
        stopAudio();
        return;
    }

    stopAudio();
    setSpeakingLoading(true);
    setIsSpeakingId(message.id);

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const base64Audio = await generateSpeech(message.text, selectedVoice);
      
      if (!base64Audio) throw new Error("No audio generated");

      const bytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(bytes, audioContextRef.current, 24000); 
      
      await playAudioBuffer(audioBuffer, audioContextRef.current, ttsSpeed);
      
      setIsSpeakingId(null);
      activeSourceRef.current = null;
      setSpeakingLoading(false); 

    } catch (error) {
      console.error("TTS Error:", error);
      if (!autoSpeak) alert("Failed to generate speech. Please check your API Key.");
      setIsSpeakingId(null);
      setSpeakingLoading(false);
    }
  };

  const handleReply = (message: Message) => {
     setQuotedMessage(message);
     setTimeout(() => {
        const textarea = document.querySelector('textarea');
        textarea?.focus();
     }, 50);
  };

  const handleClearHistory = () => {
      if (window.confirm("Are you sure you want to clear your chat history?")) {
          localStorage.removeItem('gemini_chat_history');
          initNewChat();
      }
  };

  const handleLoadHistory = () => {
      const saved = localStorage.getItem('gemini_chat_history');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              setMessages(parsed);
              initializeChat(undefined, parsed);
          } catch(e) {
              alert("Failed to load history.");
          }
      } else {
          alert("No saved history found.");
      }
  };

  const filteredMessages = searchQuery
    ? messages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex h-screen bg-background text-slate-100 font-sans overflow-hidden">
      
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md">
        Skip to main content
      </a>

      {/* Sidebar - Desktop */}
      <aside 
        className="w-16 md:w-64 bg-slate-900 border-r border-slate-700 flex flex-col items-center md:items-stretch py-6 z-10 hidden md:flex"
        aria-label="Sidebar Navigation"
      >
        <div className="px-6 mb-8 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-primary to-accent rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden md:block">Gemini Win</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
            <button onClick={initNewChat} className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800 rounded-lg text-white border border-slate-700 transition-all hover:bg-slate-700">
                <MessageSquare size={18} />
                <span className="hidden md:block text-sm font-medium">New Chat</span>
            </button>

             {isSearchActive ? (
                <div className="w-full relative">
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                    <button onClick={handleClearSearch} className="absolute right-2 top-2 text-slate-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <button onClick={() => setIsSearchActive(true)} className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                    <Search size={18} />
                    <span className="hidden md:block text-sm font-medium">Search History</span>
                </button>
            )}
            
            <button onClick={handleLoadHistory} className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                <History size={18} />
                <span className="hidden md:block text-sm font-medium">Load Last Session</span>
            </button>

             <button onClick={handleClearHistory} className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all">
                <Trash2 size={18} />
                <span className="hidden md:block text-sm font-medium">Clear History</span>
            </button>
        </nav>

        {/* Audio Settings */}
        <div className="px-4 py-4 border-t border-slate-800">
            <div className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:block">Audio Settings</div>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="voice-select" className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                        <Mic size={14} className="hidden md:block" />
                        <span>Voice Model</span>
                    </label>
                    <select 
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value as TTSVoice)}
                        className="w-full bg-slate-800 border border-slate-700 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-primary text-slate-300"
                    >
                        {Object.values(TTSVoice).map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>
                
                 <div>
                    <label htmlFor="speed-slider" className="flex items-center justify-between gap-2 mb-2 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <Sliders size={14} className="hidden md:block" />
                            <span>Speed: {ttsSpeed}x</span>
                        </div>
                    </label>
                    <input 
                        id="speed-slider"
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={ttsSpeed}
                        onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                </div>

                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Volume2 size={16} />
                        <span className="text-sm hidden md:block">Auto-speak</span>
                    </div>
                    <button 
                        onClick={() => setAutoSpeak(!autoSpeak)}
                        className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${autoSpeak ? 'bg-primary' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${autoSpeak ? 'left-5' : 'left-1'}`} />
                    </button>
                </div>
            </div>
        </div>

      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Mobile Header */}
        <header className="md:hidden h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
            <span className="font-bold">Gemini Win</span>
            <button onClick={() => setShowSettings(!showSettings)}>
                <Settings size={20} />
            </button>
        </header>

        {/* Mobile Settings Modal */}
        {showSettings && (
             <div className="absolute top-14 left-0 w-full bg-slate-800 p-4 border-b border-slate-600 z-50 md:hidden animate-in slide-in-from-top-2 shadow-xl">
                 <div className="space-y-4">
                     <button onClick={initNewChat} className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-700 rounded-lg">
                        <MessageSquare size={18} /><span className="text-sm">New Chat</span>
                     </button>
                 </div>
             </div>
        )}

        {/* Chat Area */}
        <main 
            id="main-content"
            className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth focus:outline-none"
            tabIndex={-1}
        >
          <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-end">
            
            {searchQuery && (
                <div className="mb-4 p-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-center text-slate-400 flex items-center justify-between">
                    <span>Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''} matching "{searchQuery}"</span>
                    <button onClick={handleClearSearch} className="text-xs underline hover:text-white">Clear</button>
                </div>
            )}

            {filteredMessages.length > 0 ? (
                filteredMessages.map((msg) => (
                    <ChatMessage 
                        key={msg.id} 
                        message={msg} 
                        onSpeak={handleSpeak}
                        onReply={handleReply}
                        isPlaying={isSpeakingId === msg.id}
                        isSpeakingLoading={isSpeakingId === msg.id && speakingLoading}
                    />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 py-20">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p>No messages found matching your search.</p>
                </div>
            )}
            
            {isLoading && !searchQuery && (
               <div className="flex gap-2 items-center text-slate-500 text-sm ml-2 animate-pulse mb-4">
                   <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                   <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                   <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                   <span>Gemini is thinking...</span>
               </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </main>

        <InputArea 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading} 
            quotedMessage={quotedMessage}
            onClearQuote={() => setQuotedMessage(null)}
        />
        
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-background to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
};

export default App;