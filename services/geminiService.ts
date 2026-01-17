import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { Attachment, TTSVoice, Message } from "../types";

// Initialize Gemini Client
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Using gemini-3-flash-preview for chat as it's the recommended model for text tasks
const CHAT_MODEL = 'gemini-3-flash-preview'; 
// Using gemini-2.5-flash-preview-tts for dedicated TTS generation
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

let chatSession: Chat | null = null;

export const initializeChat = (systemInstruction?: string, historyMessages?: Message[]) => {
  const ai = getAiClient();
  let history: any[] = [];
  
  if (historyMessages) {
    history = historyMessages
      .filter(msg => msg.id !== 'welcome')
      .map(msg => ({
        role: msg.role,
        parts: [
            ...(msg.attachments || []).map(a => ({
                inlineData: { mimeType: a.mimeType, data: a.data }
            })),
            { text: msg.text }
        ]
    }));
  }

  chatSession = ai.chats.create({
    model: CHAT_MODEL,
    config: {
      systemInstruction: systemInstruction || "You are a helpful Windows assistant. You can see images and remember our conversation. You are concise and professional.",
    },
    history: history.length > 0 ? history : undefined
  });
  return chatSession;
};

export const sendMessageToGemini = async (text: string, attachments: Attachment[] = []) => {
  if (!chatSession) {
    initializeChat();
  }

  try {
    const parts: any[] = [];
    
    attachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });

    if (text) {
      parts.push({ text });
    }

    let response;
    
    if (attachments.length > 0) {
      response = await chatSession!.sendMessage({ 
        message: parts
      });
    } else {
      response = await chatSession!.sendMessage({ 
        message: text 
      });
    }

    return response.text;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string, voice: TTSVoice = TTSVoice.Kore): Promise<string | undefined> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};