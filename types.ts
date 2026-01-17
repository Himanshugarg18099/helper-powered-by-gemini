export interface Attachment {
  mimeType: string;
  data: string; // Base64
  url?: string; // Preview URL
  name?: string; // Original filename
  size?: number; // File size in bytes
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isAudioPlaying?: boolean;
}

export enum TTSVoice {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export interface AppState {
  messages: Message[];
  isLoading: boolean;
  selectedVoice: TTSVoice;
  ttsSpeed: number;
  isAutoSpeak: boolean;
}