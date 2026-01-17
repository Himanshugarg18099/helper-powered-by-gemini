import React, { useState, useRef, ClipboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, X, UploadCloud, Trash2, Ban, Mic, MicOff, Reply, FileText } from 'lucide-react';
import { Attachment, Message } from '../types';

interface InputAreaProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  quotedMessage: Message | null;
  onClearQuote: () => void;
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading, 
  quotedMessage, 
  onClearQuote 
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const activeReaders = useRef<FileReader[]>([]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          // We need to append to existing input if it was manually typed
          // However, simpler strategy is to just take the current stream for now to avoid cursor jumping issues
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
             setInput(prev => {
                const spacer = prev && !prev.endsWith(' ') ? ' ' : '';
                return prev + spacer + finalTranscript;
             });
             // Auto-resize
             if(textareaRef.current) {
                 textareaRef.current.style.height = 'auto';
                 textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
             }
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
        return;
    }
    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
    } else {
        recognitionRef.current.start();
        setIsListening(true);
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || isProcessing) return;
    
    // Construct final text with quote if present
    let finalText = input;
    if (quotedMessage) {
       finalText = `[Replying to]: "${quotedMessage.text.substring(0, 200)}${quotedMessage.text.length > 200 ? '...' : ''}"\n\n[My Message]: ${input}`;
       onClearQuote();
    }

    onSendMessage(finalText, attachments);
    setInput('');
    setAttachments([]);
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) files.push(blob);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0 && files.length > 0) {
      alert('Only image files are supported.');
      return;
    }

    setIsProcessing(true);

    validFiles.forEach(file => {
      const reader = new FileReader();
      activeReaders.current.push(reader);

      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Extract base64 data (remove data:image/png;base64, prefix)
        const base64Data = result.split(',')[1];
        
        const newAttachment: Attachment = {
          mimeType: file.type,
          data: base64Data,
          url: result, // For preview
          name: file.name,
          size: file.size
        };
        setAttachments(prev => [...prev, newAttachment]);
        cleanupReader(reader);
      };

      reader.onerror = () => {
          console.error("Error reading file");
          cleanupReader(reader);
      };

      reader.onabort = () => {
          cleanupReader(reader);
      };

      reader.readAsDataURL(file);
    });
  };

  const cleanupReader = (reader: FileReader) => {
      const index = activeReaders.current.indexOf(reader);
      if (index > -1) {
          activeReaders.current.splice(index, 1);
      }
      if (activeReaders.current.length === 0) {
          setIsProcessing(false);
      }
  };

  const cancelUpload = () => {
      activeReaders.current.forEach(reader => reader.abort());
      activeReaders.current = [];
      setIsProcessing(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    cancelUpload();
    setAttachments([]);
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const formatFileSize = (bytes?: number) => {
      if (!bytes) return '';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div 
      className={`bg-surface border-t border-slate-700 relative transition-all duration-200 ${isDragging ? 'bg-slate-800 border-primary border-dashed' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="region" 
      aria-label="Message Input Area"
    >
      {/* Quote Banner */}
      {quotedMessage && (
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 overflow-hidden">
                  <Reply size={16} className="text-primary flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                      <span className="text-xs text-primary font-medium">
                          Replying to {quotedMessage.role === 'user' ? 'You' : 'Gemini'}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[300px] md:max-w-xl block">
                          {quotedMessage.text}
                      </span>
                  </div>
              </div>
              <button 
                  onClick={onClearQuote}
                  className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                  aria-label="Cancel reply"
              >
                  <X size={14} />
              </button>
          </div>
      )}

      <div className="p-4">
        {/* Drag & Drop Overlay */}
        {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 pointer-events-none backdrop-blur-sm">
            <UploadCloud size={48} className="text-primary mb-2 animate-bounce" aria-hidden="true" />
            <span className="text-xl font-bold text-white">Drop images to upload</span>
            </div>
        )}

        {/* Enhanced Attachments Preview */}
        {(attachments.length > 0 || isProcessing) && (
            <div className="mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300" aria-label="Attachments">
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-2" role="status">
                    {isProcessing ? (
                    <>
                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse"/>
                        Processing images...
                    </>
                    ) : (
                    `${attachments.length} File${attachments.length > 1 ? 's' : ''} attached`
                    )}
                </span>
                
                <div className="flex items-center gap-2">
                    {isProcessing && (
                        <button 
                            onClick={cancelUpload} 
                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label="Cancel image upload"
                        >
                            <Ban size={12} aria-hidden="true" />
                            Cancel
                        </button>
                    )}
                    <button 
                        onClick={clearAttachments} 
                        className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-400/10 focus-visible:ring-2 focus-visible:ring-red-400"
                        aria-label="Remove all attachments"
                    >
                        <Trash2 size={12} aria-hidden="true" />
                        Clear All
                    </button>
                </div>
            </div>
            
            {attachments.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {attachments.map((att, idx) => (
                    <div key={idx} className="relative group flex items-start gap-3 bg-slate-800 border border-slate-600 rounded-lg p-2 overflow-hidden">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 flex-shrink-0 bg-black/30 rounded overflow-hidden">
                             <img 
                                src={att.url} 
                                alt="" 
                                className="w-full h-full object-cover"
                             />
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                            <span className="text-xs text-slate-200 truncate font-medium block w-full" title={att.name}>{att.name || `Image ${idx+1}`}</span>
                            <span className="text-[10px] text-slate-500">{formatFileSize(att.size)}</span>
                        </div>

                        {/* Remove Button */}
                        <button
                            onClick={() => removeAttachment(idx)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-700 transition-colors"
                            title="Remove file"
                            aria-label={`Remove ${att.name || 'image'}`}
                        >
                            <X size={14} aria-hidden="true" />
                        </button>
                    </div>
                    ))}
                </div>
            )}
            </div>
        )}

        <div className="flex items-end gap-2 max-w-4xl mx-auto">
            {/* File Upload Button */}
            <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-primary"
            title="Upload images"
            aria-label="Upload images"
            disabled={isLoading || isProcessing}
            >
            <ImageIcon size={20} aria-hidden="true" />
            </button>
            <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            tabIndex={-1}
            />

            {/* Voice Input Button */}
            <button
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all relative focus-visible:ring-2 focus-visible:ring-primary ${
                isListening 
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title={isListening ? "Stop listening" : "Start voice input"}
            aria-label={isListening ? "Stop listening" : "Start voice input"}
            aria-pressed={isListening}
            disabled={isLoading || isProcessing}
            >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            {isListening && (
                 <span className="absolute inset-0 rounded-full border border-red-500 animate-ping opacity-50"></span>
            )}
            </button>

            {/* Text Input */}
            <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-600 focus-within:border-primary transition-colors flex items-center px-4 py-2 relative">
            <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isListening ? "Listening..." : quotedMessage ? "Type your reply..." : "Type a message or paste/drop images (Alt+I to focus)"}
                className="w-full bg-transparent text-white placeholder-slate-400 focus:outline-none resize-none max-h-[150px] py-2"
                rows={1}
                disabled={isLoading}
                aria-label={quotedMessage ? `Reply to ${quotedMessage.role}` : "Message input"}
            />
            </div>

            {/* Send Button */}
            <button
            onClick={handleSend}
            disabled={isLoading || isProcessing || (!input.trim() && attachments.length === 0)}
            className={`p-3 rounded-full transition-all flex-shrink-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-primary ${
                isLoading || isProcessing || (!input.trim() && attachments.length === 0)
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-900/20'
            }`}
            aria-label="Send message"
            >
            <Send size={20} aria-hidden="true" />
            </button>
        </div>
        <div className="text-center text-xs text-slate-500 mt-2 select-none" aria-hidden="true">
            {isListening ? (
                 <span className="text-red-400 font-medium animate-pulse">Microphone Active - Speak now</span>
            ) : (
                 "Drag & drop images • Paste clipboard • Voice input supported"
            )}
        </div>
      </div>
    </div>
  );
};