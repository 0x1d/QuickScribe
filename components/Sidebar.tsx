import React from 'react';
import { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  selectedSessionId, 
  onSelect, 
  onCreate, 
  onDelete,
  onClose
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-white">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-amber-500">⚡</span> QuickScribe
          </h1>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-0.5">Live Transcription</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-slate-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4">
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 text-sm font-bold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {sessions.length === 0 && (
          <div className="text-center text-slate-400 text-sm mt-12 py-8 px-4 border-2 border-dashed border-slate-100 rounded-2xl">
            No active sessions.
          </div>
        )}
        
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`
              group relative flex flex-col p-4 rounded-xl cursor-pointer border transition-all active:scale-[0.98]
              ${selectedSessionId === session.id 
                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100 shadow-sm' 
                : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }
            `}
          >
            <div className="flex justify-between items-start">
              <span className={`font-bold text-sm truncate pr-6 ${selectedSessionId === session.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                {session.name}
              </span>
              <button
                onClick={(e) => onDelete(session.id, e)}
                className={`
                  absolute right-3 top-4 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity
                  ${selectedSessionId === session.id ? 'opacity-100 text-indigo-300' : ''}
                `}
                title="Delete Session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex justify-between items-center">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedSessionId === session.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {session.segments.length} LOGS
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};