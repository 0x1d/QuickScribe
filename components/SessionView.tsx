import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Session, TranscriptSegment, ConnectionStatus } from '../types';
import { GeminiLiveService } from '../services/geminiLiveService';
import { downloadSessionJson } from '../services/storage';

interface SessionViewProps {
  session: Session;
  onUpdate: (session: Session) => void;
  onMenuToggle?: () => void;
}

const LANGUAGES = [
  "Swiss German",
  "Standard German",
  "English",
  "French",
  "Italian",
  "Spanish",
  "Portuguese"
];

// Fix for window.aistudio type conflict: 
// The environment already defines a global AIStudio interface.
// We extend it with the required methods and use it for the Window property.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    /* Fixed: Removed readonly modifier to match existing global declaration */
    aistudio: AIStudio;
  }
}

export const SessionView: React.FC<SessionViewProps> = ({ session, onUpdate, onMenuToggle }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const [name, setName] = useState(session.name);
  const [renderedSegments, setRenderedSegments] = useState<TranscriptSegment[]>(session.segments);
  const [justFinalizedIds, setJustFinalizedIds] = useState<Set<string>>(new Set());
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  const sessionRef = useRef(session);
  const onUpdateRef = useRef(onUpdate);
  const localSegmentsRef = useRef<TranscriptSegment[]>(session.segments);

  // Sync session ref for usage in callbacks
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Handle session switching
  useEffect(() => {
    localSegmentsRef.current = session.segments;
    setRenderedSegments(session.segments);
    setName(session.name);
    setLiveTranscript('');
    setIsRecording(false);
    setStatus(ConnectionStatus.DISCONNECTED);
    setJustFinalizedIds(new Set());
    if (geminiServiceRef.current) {
        geminiServiceRef.current.disconnect();
    }
  }, [session.id]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    geminiServiceRef.current = new GeminiLiveService();
    return () => {
      if (geminiServiceRef.current) {
        geminiServiceRef.current.disconnect();
      }
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (isRecording) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    } else {
       bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [renderedSegments.length, liveTranscript, isRecording]);

  const handleTranscription = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      const currentSegments = localSegmentsRef.current;
      const newId = crypto.randomUUID();
      
      const newSegment: TranscriptSegment = {
        id: newId,
        text: text.trim(),
        timestamp: Date.now(),
        isFinal: true
      };
      
      const updatedSegments = [...currentSegments, newSegment];
      localSegmentsRef.current = updatedSegments;
      
      setJustFinalizedIds(prev => {
        const next = new Set(prev);
        next.add(newId);
        return next;
      });

      // Clear the highlighting delay
      setTimeout(() => {
        setJustFinalizedIds(prev => {
            const next = new Set(prev);
            next.delete(newId);
            return next;
        });
      }, 1000);
      
      setRenderedSegments(updatedSegments);
      setLiveTranscript('');

      const updatedSession = {
        ...sessionRef.current,
        segments: updatedSegments,
        updatedAt: Date.now()
      };
      onUpdateRef.current(updatedSession);
    } else {
      setLiveTranscript(text);
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error(error);
    setStatus(ConnectionStatus.ERROR);
    setIsRecording(false);
    
    // Check if we need to re-prompt for API Key
    if (error.message.includes('API Key Error') || error.message.includes('Requested entity was not found')) {
      if (window.aistudio) {
        window.aistudio.openSelectKey().catch(console.error);
      } else {
        alert(error.message);
      }
    } else {
      alert(`Error: ${error.message}`);
    }
  }, []);

  const toggleRecording = async () => {
    if (isRecording) {
      geminiServiceRef.current?.disconnect();
      setIsRecording(false);
      setStatus(ConnectionStatus.DISCONNECTED);
      setLiveTranscript('');
      onUpdateRef.current({ ...sessionRef.current, updatedAt: Date.now() });
    } else {
      // Ensure API Key is selected if using AI Studio environment
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          // Assume success as per guidelines
        }
      }

      setStatus(ConnectionStatus.CONNECTING);
      try {
        await geminiServiceRef.current?.connect(
          sessionRef.current.inputLanguage || 'Swiss German',
          sessionRef.current.outputLanguage || 'Standard German',
          handleTranscription, 
          handleError
        );
        setIsRecording(true);
        setStatus(ConnectionStatus.CONNECTED);
      } catch (e: any) {
        console.error("Recording Start Failure:", e);
        setStatus(ConnectionStatus.ERROR);
        setIsRecording(false);
      }
    }
  };

  const handleLanguageChange = (type: 'input' | 'output', value: string) => {
    const updatedSession = { 
      ...session, 
      [type === 'input' ? 'inputLanguage' : 'outputLanguage']: value 
    };
    onUpdate(updatedSession);
  };
  
  const handleNameBlur = () => {
    if (name.trim() !== session.name) {
      onUpdate({ ...session, name: name.trim() || 'Untitled Session' });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleDownload = () => {
    downloadSessionJson(session);
  };

  const segmentsToDisplay = [...renderedSegments];
  if (liveTranscript) {
    segmentsToDisplay.push({
      id: 'live-pending',
      text: liveTranscript,
      timestamp: Date.now(),
      isFinal: false
    });
  }

  return (
    <div className="flex flex-col h-full bg-white md:bg-slate-50/50">
      {/* Header */}
      <div className="sticky top-0 px-4 md:px-6 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm flex-shrink-0 z-30">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={onMenuToggle}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Toggle Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
               <input 
                 type="text"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 onBlur={handleNameBlur}
                 onKeyDown={handleNameKeyDown}
                 className="text-base md:text-lg font-bold text-slate-800 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded px-2 -ml-2 transition-all w-full outline-none truncate"
                 placeholder="Session Name"
               />
               <div className="flex items-center gap-2 mt-0.5 px-1">
                 <div className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : status === ConnectionStatus.ERROR ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   {status === ConnectionStatus.CONNECTED ? 'Live' : status}
                 </span>
               </div>
            </div>

            {/* Mobile Recording Button (Existing) */}
            <button
               onClick={toggleRecording}
               disabled={status === ConnectionStatus.CONNECTING}
               className={`
                  md:hidden p-2.5 rounded-full shadow-lg transition-all active:scale-90
                  ${isRecording ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}
                  ${status === ConnectionStatus.CONNECTING ? 'opacity-50' : ''}
               `}
               aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
             >
               {isRecording ? (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                   <path d="M6 19h12V5H6v14z" />
                 </svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 ml-0.5">
                   <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-2a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" /><circle cx="12" cy="12" r="4" />
                 </svg>
               )}
            </button>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-50 pt-2 md:pt-0 md:border-t-0">
             <div className="flex items-center gap-1.5 text-xs">
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Input</label>
                  <select 
                    disabled={isRecording}
                    value={session.inputLanguage || 'Swiss German'}
                    onChange={(e) => handleLanguageChange('input', e.target.value)}
                    className="appearance-none bg-slate-100 border-none rounded-lg px-2 py-1 text-slate-700 font-bold text-[11px] focus:ring-2 focus:ring-indigo-200 cursor-pointer disabled:opacity-50"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={`in-${lang}`} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                
                <div className="pt-3 text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>

                <div className="flex flex-col">
                  <label className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">To</label>
                  <select 
                     disabled={isRecording}
                     value={session.outputLanguage || 'Standard German'}
                     onChange={(e) => handleLanguageChange('output', e.target.value)}
                     className="appearance-none bg-slate-100 border-none rounded-lg px-2 py-1 text-slate-700 font-bold text-[11px] focus:ring-2 focus:ring-indigo-200 cursor-pointer disabled:opacity-50"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={`out-${lang}`} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
             </div>

             <div className="hidden md:flex items-center gap-3">
               <button
                 onClick={handleDownload}
                 className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                 title="Download JSON"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                 </svg>
               </button>

               <button
                 onClick={toggleRecording}
                 disabled={status === ConnectionStatus.CONNECTING}
                 className={`
                    px-5 py-2 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2.5 text-sm
                    ${isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-100' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-100'
                    }
                    ${status === ConnectionStatus.CONNECTING ? 'opacity-70 cursor-wait' : ''}
                 `}
               >
                 {status === ConnectionStatus.CONNECTING ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Connecting...
                    </>
                 ) : isRecording ? (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                        <path d="M6 19h12V5H6v14z" />
                     </svg>
                     Stop
                   </>
                 ) : (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                       <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-2a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" /><circle cx="12" cy="12" r="4" />
                     </svg>
                     Record
                   </>
                 )}
               </button>
             </div>

             <button
               onClick={handleDownload}
               className="md:hidden p-2 text-slate-400"
               title="Download"
             >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
               </svg>
             </button>
          </div>
        </div>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
          {segmentsToDisplay.length === 0 && (
             <div className="text-center py-20 opacity-40">
                <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-slate-400">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </div>
                <p className="text-base text-slate-500 font-medium px-10">Start recording to capture the conversation in {session.inputLanguage}.</p>
             </div>
          )}

          {segmentsToDisplay.map((segment) => {
            const isJustFinalized = justFinalizedIds.has(segment.id);
            const isProcessing = !segment.isFinal;
            
            return (
            <div key={segment.id} className={`flex flex-col md:flex-row gap-1 md:gap-4 group ${isProcessing ? 'opacity-90' : ''}`}>
               <div className="flex-shrink-0 md:w-16 pt-0 md:pt-4 text-left md:text-right flex md:flex-col items-center md:items-end gap-2 md:gap-1">
                 <span className={`text-[10px] font-black tracking-tighter transition-colors duration-500 px-1.5 py-0.5 rounded md:px-0 md:py-0 ${isProcessing ? 'text-indigo-600 bg-indigo-50 md:bg-transparent' : 'text-slate-300'}`}>
                   {isProcessing 
                     ? 'LIVE' 
                     : new Date(segment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                   }
                 </span>
                 {isProcessing && (
                    <div className="rounded-full h-2 w-2 md:h-3 md:w-3 border-b-2 border-indigo-500 animate-spin"></div>
                 )}
               </div>
               
               <div className={`flex-1 p-4 rounded-2xl transition-all duration-500 shadow-sm border ${isProcessing ? 'bg-indigo-50/50 border-indigo-100 ring-4 ring-indigo-50/20' : isJustFinalized ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 group-hover:border-slate-200'}`}>
                 <p className={`${isProcessing ? 'text-indigo-900 font-medium' : 'text-slate-800'} text-base md:text-lg leading-relaxed whitespace-pre-line`}>
                    {segment.text}
                 </p>
                 {isProcessing && (
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-indigo-400 font-black uppercase tracking-widest">
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                       Processing Audio
                    </div>
                 )}
               </div>
            </div>
          )})}
          
          <div ref={bottomRef} className="h-20" />
        </div>
      </div>
    </div>
  );
};