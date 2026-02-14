export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  inputLanguage: string;
  outputLanguage: string;
  segments: TranscriptSegment[];
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}