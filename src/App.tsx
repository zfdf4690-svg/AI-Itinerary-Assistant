/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { StatusBar } from './components/common/StatusBar';
import { HomeView } from './components/views/HomeView';
import { ListeningView } from './components/views/ListeningView';
import { ConfirmScheduleView } from './components/views/ConfirmScheduleView';
import { SuccessView } from './components/views/SuccessView';
import { CalendarView } from './components/views/CalendarView';
import { SettingsView } from './components/views/SettingsView';
import { PersonaDetailView } from './components/views/PersonaDetailView';
import { EveningReviewModal } from './components/views/EveningReviewModal';
import { ManualAddModal } from './components/views/ManualAddModal';
import { NotificationToast } from './components/common/NotificationToast';
import { ViewType } from './types';
import { 
  Smartphone, 
  Maximize2, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  Compass
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
    setIsEveningReviewOpen,
    resetChatWithUtterance,
    currentDraft,
    activeNotification,
    dismissNotification
  } = useApp();

  // If user navigates directly to confirmation without existing chat, seed it
  useEffect(() => {
    if (currentView === 'confirmation' && !currentDraft) {
      resetChatWithUtterance('明天下午三点和张总开会，提前半小时提醒我');
    }
  }, [currentView, currentDraft, resetChatWithUtterance]);

  const viewLabels: { id: ViewType; label: string; num: string }[] = [
    { id: 'home', label: '首页', num: '01' },
    { id: 'listening', label: '语音输入', num: '02' },
    { id: 'confirmation', label: '日程卡片与修改', num: '03/04' },
    { id: 'success', label: '创建成功', num: '08' },
    { id: 'calendar', label: '今日行程', num: '05' },
    { id: 'settings', label: '人格设置', num: '06' },
    { id: 'persona_detail', label: '人格详情', num: '07' }
  ];

  const renderActiveView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'listening':
        return <ListeningView />;
      case 'confirmation':
        return <ConfirmScheduleView />;
      case 'success':
        return <SuccessView />;
      case 'calendar':
        return <CalendarView />;
      case 'settings':
        return <SettingsView />;
      case 'persona_detail':
        return <PersonaDetailView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Desktop Navigation & Preview Controller */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-40 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 text-sm">
            AI
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">AI 语音行程助手</span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400 ml-2">
              说人话记日程 · 情绪陪伴型产品
            </span>
          </div>
        </div>

        {/* View Switcher Tabs (Desktop Quick Tour) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {viewLabels.map((v) => {
            const isActive = currentView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => {
                  playAudioFeedback('tap');
                  setCurrentView(v.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="text-[10px] opacity-70 mr-1">{v.num}</span>
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Evening Review Modal Trigger */}
          <button
            onClick={() => {
              playAudioFeedback('tap');
              setIsEveningReviewOpen(true);
            }}
            title="晚间复盘金句"
            className="h-8 px-3 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">今日金句复盘</span>
          </button>

          {/* Voice Broadcast Toggle */}
          <button
            onClick={() => {
              playAudioFeedback('tap');
              setAutoVoiceEnabled(!autoVoiceEnabled);
            }}
            title={autoVoiceEnabled ? '自动语音播报已开启' : '语音播报已静音'}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            {autoVoiceEnabled ? (
              <Volume2 className="w-4 h-4 text-blue-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Device Mockup Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                previewDevice === 'mobile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="手机真机模型视角"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewDevice('responsive')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                previewDevice === 'responsive'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="全屏自适应视角"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden relative">
        {/* Ambient subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

        {previewDevice === 'mobile' ? (
          /* High-Fidelity Mobile Chassis */
          <div className="relative w-full max-w-[392px] h-[100dvh] sm:h-[844px] bg-[#F6F8FC] sm:rounded-[48px] sm:shadow-2xl sm:shadow-black/60 sm:border-[8px] sm:border-slate-800 flex flex-col overflow-hidden transition-all">
            {/* Dynamic Island / Earpiece pill (on larger screens) */}
            <div className="hidden sm:block absolute top-3 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 shadow-xs pointer-events-none flex items-center justify-end px-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
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
            <div className="flex-1 relative overflow-hidden flex flex-col">
              {renderActiveView()}
            </div>

            {/* Home Indicator Bar */}
            <div className="w-full pb-2 pt-1 flex justify-center bg-transparent z-30 pointer-events-none">
              <div className="w-32 h-1 bg-slate-900/30 rounded-full" />
            </div>
          </div>
        ) : (
          /* Responsive Layout */
          <div className="w-full max-w-xl h-[100dvh] sm:h-[860px] bg-[#F6F8FC] sm:rounded-3xl sm:border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden">
            <StatusBar />
            <div className="flex-1 relative overflow-hidden flex flex-col">
              {renderActiveView()}
            </div>
            <div className="w-full pb-2 pt-1 flex justify-center bg-transparent z-30 pointer-events-none">
              <div className="w-32 h-1 bg-slate-900/30 rounded-full" />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <EveningReviewModal />
      <ManualAddModal />
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
