import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SessionView } from './components/SessionView';
import { Session } from './types';
import { loadSessions, saveSession, deleteSession, createSession } from './services/storage';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const handleCreateSession = () => {
    const newSession = createSession();
    setSessions(prev => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    setIsSidebarOpen(false); // Close sidebar on mobile after creation
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selectedSessionId === id) {
      setSelectedSessionId(null);
    }
  };

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleUpdateSession = (updatedSession: Session) => {
    saveSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Drawer on Mobile, Fixed on Desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:flex-shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar 
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full relative flex flex-col min-w-0">
        {selectedSession ? (
          <SessionView 
            key={selectedSession.id}
            session={selectedSession} 
            onUpdate={handleUpdateSession}
            onMenuToggle={() => setIsSidebarOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            {/* Mobile Header for Empty State */}
            <div className="absolute top-0 left-0 w-full p-4 flex md:hidden">
               <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>
            
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 opacity-20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
            <p className="text-lg font-medium">Select or create a session to start</p>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="mt-4 md:hidden px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium"
            >
              Open Session List
            </button>
          </div>
        )}
      </div>
    </div>
  );
}