import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { float32ToInt16, base64EncodeAudio } from './audioUtils';

export type TranscriptionCallback = (text: string, isFinal: boolean) => void;
export type ErrorCallback = (error: Error) => void;

export class GeminiLiveService {
  private session: any | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;
  private onTranscription: TranscriptionCallback | null = null;
  private onError: ErrorCallback | null = null;
  
  private currentInputText = '';
  private currentOutputText = '';

  constructor() {}

  /**
   * Connects to the Gemini Live API and sets up audio streaming.
   */
  async connect(
    inputLanguage: string, 
    outputLanguage: string, 
    onTranscription: TranscriptionCallback, 
    onError: ErrorCallback
  ) {
    if (this.isConnected) return;

    this.onTranscription = onTranscription;
    this.onError = onError;
    this.currentInputText = '';
    this.currentOutputText = '';

    try {
      // Create a fresh instance for every connection attempt to ensure latest API key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, 
      });

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live: WebSocket opened");
            this.isConnected = true;
            this.startAudioStreaming(sessionPromise);
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onerror: (e: any) => {
            console.error("Gemini Live: Socket Error", e);
            // Don't call handleRuntimeError if we're not yet connected, 
            // the main catch block will handle initial connection failures.
            if (this.isConnected) {
              this.handleRuntimeError(new Error("The connection was interrupted. Please check your network or API key status."));
            }
          },
          onclose: (e: CloseEvent) => {
            console.log("Gemini Live: WebSocket closed", e);
            const wasConnected = this.isConnected;
            this.isConnected = false;
            
            // If it closed unexpectedly (not by user stop)
            if (wasConnected && e.code !== 1000) {
              this.handleRuntimeError(new Error("Connection closed unexpectedly."));
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}, 
          systemInstruction: `You are a precision simultaneous interpreter. 
Source: ${inputLanguage} (Swiss German dialects supported).
Target: ${outputLanguage}.

CRITICAL INSTRUCTIONS:
1. **TRANSLATE EVERYTHING**: Do not summarize. Do not skip details.
2. **SENTENCE STRUCTURE**: Output complete, grammatically correct sentences.
3. **PUNCTUATION**: Use standard punctuation (. ? !) to clearly mark the end of sentences.
4. **NO META-COMMENTARY**: Do not engage in conversation. Only output the translation.`,
        }
      });

      this.session = await sessionPromise;

    } catch (err: any) {
      console.error("Gemini Live: Failed to connect", err);
      let errorMessage = "Network error: Unable to establish connection.";
      
      // Handle specific API errors
      if (err.message && (err.message.includes('404') || err.message.includes('not found'))) {
        errorMessage = "API Key Error: Requested model or project not found. You likely need a paid billing account and a valid API key.";
      } else if (err.message && (err.message.includes('403') || err.message.includes('permission'))) {
        errorMessage = "API Key Error: Access denied. Ensure your API key has the correct permissions for the Live API.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      if (this.onError) this.onError(new Error(errorMessage));
      this.disconnect();
    }
  }

  private async startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.audioContext || !this.mediaStream) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const int16Data = float32ToInt16(inputData);
      const base64Data = base64EncodeAudio(int16Data);

      // Use the promise to ensure we don't send before connection is ready
      sessionPromise.then((session) => {
        if (!this.isConnected) return;
        try {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        } catch (err) {
          // Swallow sporadic send errors during shutdown
        }
      }).catch(() => {});
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private handleMessage(message: LiveServerMessage) {
    if (!this.onTranscription) return;

    // Handle user input transcription (visual feedback only)
    const inputTx = message.serverContent?.inputTranscription;
    if (inputTx?.text) {
      this.currentInputText += inputTx.text;
    }

    // Handle model output translation
    const outputTx = message.serverContent?.outputTranscription;
    if (outputTx?.text) {
      this.currentOutputText += outputTx.text;
      this.currentInputText = ''; // Clear input buffer when model starts responding
      
      // Look for sentence boundaries to finalize segments
      let match;
      while ((match = this.currentOutputText.match(/([.?!])\s+/))) {
        if (match.index !== undefined) {
          const punctuationIndex = match.index + match[1].length;
          const totalMatchLength = match[0].length;
          
          const completeSentence = this.currentOutputText.substring(0, punctuationIndex).trim();
          const remainder = this.currentOutputText.substring(match.index + totalMatchLength);
          
          if (completeSentence) {
            this.onTranscription(completeSentence, true);
          }
          this.currentOutputText = remainder;
        } else {
          break;
        }
      }
    }

    if (message.serverContent?.turnComplete) {
      this.currentInputText = '';
      if (this.currentOutputText.trim()) {
        this.onTranscription(this.currentOutputText.trim(), true);
        this.currentOutputText = '';
      }
    }
    
    // Provide live preview
    if (this.currentOutputText.trim()) {
      this.onTranscription(this.currentOutputText, false);
    } else if (this.currentInputText.trim()) {
      this.onTranscription(`${this.currentInputText}`, false);
    }
  }

  private handleRuntimeError(error: Error) {
    if (this.isConnected) {
      if (this.onError) this.onError(error);
      this.disconnect();
    }
  }

  /**
   * Stops all audio tracks and disconnects from the API.
   */
  disconnect() {
    // Finalize any pending text
    if (this.isConnected && this.onTranscription && this.currentOutputText.trim()) {
      this.onTranscription(this.currentOutputText.trim(), true);
    }

    this.isConnected = false;
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
      }
      this.audioContext = null;
    }
    
    this.session = null;
    this.onTranscription = null;
    this.onError = null;
    this.currentInputText = '';
    this.currentOutputText = '';
  }
}
