import { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { getLLMConfig } from './lib/llm';
import { sessionService } from './services/sessionService';
import { workoutService } from './services/workoutService';
import { api } from './lib/api';
import { useChatSession } from './hooks/useChatSession';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { InputBox } from './components/InputBox';
import { NewChatScreen } from './components/NewChatScreen';
import { TrainingLogView } from './components/TrainingLogView';

function App() {
  const llmConfig = getLLMConfig();

  const [currentView, setCurrentView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSessions, setSidebarSessions] = useState([]);
  const [trainingLog, setTrainingLog] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const inputBoxRef = useRef(null);

  const { messages, isStreaming, currentSessionId, sendMessage, loadSession, startNewChat } =
    useChatSession(llmConfig, () => {
      if (currentView === 'history') refreshTrainingLog();
    });

  // ─── session list ────────────────────────────────────────────────────────────

  useEffect(() => {
    sessionService.list().then(setSidebarSessions);
  }, []);

  // ─── training log ────────────────────────────────────────────────────────────

  const refreshTrainingLog = async () => {
    const entries = await workoutService.getTrainingLog();
    setTrainingLog(entries);
  };

  useEffect(() => {
    if (currentView === 'history') refreshTrainingLog();
  }, [currentView]);

  useEffect(() => {
    if (!isStreaming) inputBoxRef.current?.focus();
  }, [isStreaming]);

  // ─── send ────────────────────────────────────────────────────────────────────

  const handleSend = (textOverride) => {
    const text = textOverride ?? inputValue.trim();
    if (!text) return;
    if (!textOverride) setInputValue('');

    sendMessage(
      text,
      (session) => setSidebarSessions((prev) => [session, ...prev]),
      (sessionId, title) =>
        setSidebarSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        )
    );
  };

  // ─── session management ──────────────────────────────────────────────────────

  const handleLoadSession = async (sessionId) => {
    await loadSession(sessionId);
    setCurrentView('chat');
    setSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId) => {
    await sessionService.delete(sessionId);
    setSidebarSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      startNewChat();
      setCurrentView('chat');
    }
  };

  const handleNewChat = () => {
    startNewChat();
    setCurrentView('chat');
    setSidebarOpen(false);
  };

  // ─── render ──────────────────────────────────────────────────────────────────

  const isNewChat = messages.length === 0 && currentView === 'chat';

  return (
    <div className="app-container">
      <Sidebar
        sessions={sidebarSessions}
        currentSessionId={currentSessionId}
        currentView={currentView}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onViewChange={(view) => { setCurrentView(view); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        <div className="header-mobile">
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <Menu size={20} />
          </button>
          <span className="header-brand">Strength Coach</span>
        </div>

        {currentView === 'history' ? (
          <TrainingLogView
            trainingLog={trainingLog}
            onClearHistory={async () => {
              await api.clearHistory();
              await refreshTrainingLog();
            }}
          />
        ) : isNewChat ? (
          <NewChatScreen
            inputRef={inputBoxRef}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={handleSend}
            isStreaming={isStreaming}
          />
        ) : (
          <>
            <ChatArea messages={messages} isStreaming={isStreaming} />
            <InputBox
              ref={inputBoxRef}
              value={inputValue}
              onChange={setInputValue}
              onSend={() => handleSend()}
              disabled={isStreaming}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
