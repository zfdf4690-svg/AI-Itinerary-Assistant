/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { StatusBar } from './components/common/StatusBar';
import { HomeView } from './components/views/HomeView';
import { ListeningView } from './components/views/ListeningView';
import { ClarificationView } from './components/views/ClarificationView';
import { ConfirmScheduleView } from './components/views/ConfirmScheduleView';
import { ScheduleEditView } from './components/views/ScheduleEditView';
import { SuccessView } from './components/views/SuccessView';
import { CalendarView } from './components/views/CalendarView';
import { SettingsView } from './components/views/SettingsView';
import { PersonaDetailView } from './components/views/PersonaDetailView';
import { NotificationToast } from './components/common/NotificationToast';
import { ViewType } from './types';
import { 
  Smartphone, 
  Maximize2, 
  Volume2, 
  VolumeX
} from 'lucide-react';
import { playAudioFeedback } from './utils/audio';

const AppContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    autoVoiceEnabled,
    setAutoVoiceEnabled,
    previewDevice,
    setPreviewDevice,
    resetChatWithUtterance,
    currentDraft,
    activeNotification,
    dismissNotification
  } = useApp();

  // If user navigates directly to confirmation or clarification without existing chat, seed it
  useEffect(() => {
    if ((currentView === 'confirmation' || currentView === 'clarification') && !currentDraft) {
      resetChatWithUtterance('明天下午三点和张总开会');
    }
  }, [currentView, currentDraft, resetChatWithUtterance]);

  // Strictly align with P0 9-page Apple UI baseline
  const viewLabels: { id: ViewType; label: string; num: string }[] = [
    { id: 'home', label: 'Home', num: '01' },
    { id: 'listening', label: 'Listening', num: '02' },
    { id: 'clarification', label: 'AI Clarification', num: '03' },
    { id: 'confirmation', label: 'Schedule Card', num: '04' },
    { id: 'schedule_edit', label: 'Schedule Edit', num: '05' },
    { id: 'success', label: 'Created', num: '06' },
    { id: 'calendar', label: 'Calendar', num: '07' },
    { id: 'persona_detail', label: 'Persona', num: '08' },
    { id: 'settings', label: 'Settings', num: '09' }
  ];

  const renderActiveView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'listening':
        return <ListeningView />;
      case 'clarification':
        return <ClarificationView />;
      case 'confirmation':
        return <ConfirmScheduleView />;
      case 'schedule_edit':
        return <ScheduleEditView />;
      case 'success':
        return <SuccessView />;
      case 'calendar':
        return <CalendarView />;
      case 'persona_detail':
        return <PersonaDetailView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1D1D1F] text-[#F5F5F7] flex flex-col font-sans select-none antialiased">
      {/* Top Desktop Navigation & Preview Controller */}
      <header className="h-14 border-b border-[#323236] bg-[#1D1D1F]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-40 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[#007AFF] flex items-center justify-center text-white font-semibold text-xs shadow-xs">
            AI
          </div>
          <div>
            <span className="font-semibold text-[14px] tracking-tight text-[#F5F5F7]">
              AI 语音行程助手
            </span>
            <span className="hidden sm:inline-block text-[11px] text-[#86868B] ml-2 font-mono">
              Apple UI Design System · P0 9-Pages V1.0
            </span>
          </div>
        </div>

        {/* View Switcher Tabs (Desktop Quick Baseline Inspector) */}
        <div className="hidden lg:flex items-center gap-1 bg-[#2C2C2E] p-1 rounded-[10px] border border-[#3A3A3C]">
          {viewLabels.map((v) => {
            const isActive = currentView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => {
                  playAudioFeedback('tap');
                  setCurrentView(v.id);
                }}
                className={`px-2 py-1 rounded-[6px] text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#007AFF] text-white shadow-xs'
                    : 'text-[#86868B] hover:text-[#F5F5F7]'
                }`}
              >
                <span className="text-[10px] opacity-75 mr-1 font-mono">{v.num}</span>
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Voice Broadcast Toggle */}
          <button
            onClick={() => {
              playAudioFeedback('tap');
              setAutoVoiceEnabled(!autoVoiceEnabled);
            }}
            title={autoVoiceEnabled ? '自动语音播报已开启' : '语音播报已静音'}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] flex items-center justify-center text-[#86868B] hover:text-[#F5F5F7] transition-colors cursor-pointer"
          >
            {autoVoiceEnabled ? (
              <Volume2 className="w-4 h-4 text-[#007AFF]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#86868B]" />
            )}
          </button>

          {/* Device Mockup Toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#2C2C2E] p-0.5 rounded-[8px] border border-[#3A3A3C]">
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-1.5 rounded-[6px] text-xs transition-all cursor-pointer ${
                previewDevice === 'mobile'
                  ? 'bg-[#007AFF] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#F5F5F7]'
              }`}
              title="iPhone 视觉模式"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewDevice('responsive')}
              className={`p-1.5 rounded-[6px] text-xs transition-all cursor-pointer ${
                previewDevice === 'responsive'
                  ? 'bg-[#007AFF] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#F5F5F7]'
              }`}
              title="桌面窗口自适应模式"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden relative">
        {previewDevice === 'mobile' ? (
          /* High-Fidelity Apple Mobile Chassis */
          <div className="relative w-full max-w-[392px] h-[100dvh] sm:h-[844px] bg-[#F5F5F7] sm:rounded-[44px] sm:shadow-apple-prominent sm:border-[8px] sm:border-[#2C2C2E] flex flex-col overflow-hidden transition-all">
            {/* Dynamic Island */}
            <div className="hidden sm:block absolute top-3 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 shadow-xs pointer-events-none flex items-center justify-end px-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1C1C1E] border border-black" />
            </div>

            {/* Mobile Status Bar */}
            <StatusBar />

            {/* In-app Notification Toast */}
            <NotificationToast
              notification={activeNotification}
              onDismiss={dismissNotification}
              onViewSchedule={() => {
                dismissNotification();
                setCurrentView('calendar');
              }}
            />

            {/* Active Screen View */}
            <div className="flex-1 relative overflow-hidden flex flex-col bg-[#F5F5F7]">
              {renderActiveView()}
            </div>

            {/* Home Indicator Bar */}
            <div className="w-full pb-2 pt-1 flex justify-center bg-transparent z-30 pointer-events-none">
              <div className="w-32 h-1 bg-[#1D1D1F]/20 rounded-full" />
            </div>
          </div>
        ) : (
          /* Desktop App Window Layout (1180px maximum content width as per section 3) */
          <div className="w-full max-w-[1100px] h-[100dvh] sm:h-[820px] bg-[#F5F5F7] sm:rounded-[20px] sm:border border-[#3A3A3C] shadow-apple-prominent flex flex-col overflow-hidden">
            <StatusBar />
            <div className="flex-1 relative overflow-hidden flex flex-col max-w-[560px] mx-auto w-full bg-[#F5F5F7] border-x border-[#D2D2D7]/30">
              {renderActiveView()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
