import { Session } from '../types';

const STORAGE_KEY = 'quick_scribe_sessions';

export const loadSessions = (): Session[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
};

export const saveSession = (session: Session) => {
  const sessions = loadSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export const createSession = (): Session => {
  const now = Date.now();
  const newSession: Session = {
    id: crypto.randomUUID(),
    name: `Session ${new Date().toLocaleString()}`,
    createdAt: now,
    updatedAt: now,
    inputLanguage: 'Swiss German',
    outputLanguage: 'Standard German',
    segments: []
  };
  saveSession(newSession);
  return newSession;
};

export const deleteSession = (id: string) => {
  const sessions = loadSessions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export const downloadSessionJson = (session: Session) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `${session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};