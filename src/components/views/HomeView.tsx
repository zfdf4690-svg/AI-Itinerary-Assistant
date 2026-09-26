import React from 'react';
import { Settings, Sparkles, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';
import { VoiceInputDock } from '../common/VoiceInputDock';

export const HomeView: React.FC = () => {
  const { setCurrentView, activePersona, setIsEveningReviewOpen, schedules } = useApp();

  // Quick summary of today's schedule for the Home glance card
  const todaySchedules = schedules.filter((s) => 
    s.dateLabel.includes('今日') || s.dateLabel.includes('今天') || s.dateLabel.includes('4月23日')
  );

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-[#F6F8FC] via-[#F8FAFF] to-[#EFF3FA] text-slate-800 select-none overflow-y-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-6 pt-1 pb-2">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setIsEveningReviewOpen(true);
          }}
          title="查看今日小结与复盘金句"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-slate-700 hover:bg-white/60 active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center bg-white shadow-xs">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
        </button>

        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('settings');
          }}
          title="AI 助手设置"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-slate-700 hover:bg-white/60 active:scale-95 transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center px-6 pt-2 pb-4 text-center">
        {/* Floating Persona Avatar with Glow & Direct Link */}
        <div 
          className="relative mb-3 group cursor-pointer" 
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('persona_detail');
          }}
          title="点击切换或查看人设详情"
        >
          <div className="absolute -inset-3 bg-gradient-to-tr from-blue-300/30 via-indigo-200/40 to-pink-300/30 rounded-full blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-full p-1.5 bg-gradient-to-b from-white/90 via-blue-50/50 to-indigo-100/50 shadow-lg shadow-blue-500/10 flex items-center justify-center backdrop-blur-xs">
            <img
              src={activePersona.avatar}
              alt={activePersona.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </div>

        {/* Hero Title */}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
          你好，我是你的<span className="text-blue-600">AI 行程助手</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500 max-w-[260px]">
          告诉我你的计划，随时为你规划与提醒。
        </p>

        {/* Current Active Persona Badge */}
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('persona_detail');
          }}
          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/70 text-[11px] font-medium text-blue-700 hover:bg-blue-100/70 active:scale-95 transition-all shadow-2xs cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          当前人设：{activePersona.name} · {activePersona.tagline}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 space-y-3 pb-3">
        {/* Card: 今日行程速览卡片 (点击直达日历页面) */}
        <div
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('calendar');
          }}
          className="w-full bg-white/95 hover:bg-white rounded-3xl p-4 shadow-sm border border-slate-100 transition-all cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>查看今日行程与日历看板</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-600 rounded-md font-semibold">
                    4月23日
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  今天共有 {todaySchedules.length} 项日程待办安排
                </p>
              </div>
            </div>

            <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              <span>日历看板</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Quick Preview of up to 3 items */}
          <div className="pt-2.5 space-y-1.5">
            {todaySchedules.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-50/80 hover:bg-blue-50/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-slate-700 tabular-nums px-1.5 py-0.5 rounded-md bg-white border border-slate-200/60 shadow-2xs text-[11px]">
                    {item.time}
                  </span>
                  <span className="font-medium text-slate-800 truncate max-w-[190px]">{item.title}</span>
                </div>
                <span className="text-[10px] text-blue-600 font-semibold">{item.remindOffset}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Voice & Text Input Dock in HomeView */}
      <div className="px-5 pt-1 pb-4">
        <VoiceInputDock 
          placeholder="说出或输入日程，如：明天下午3点开会..." 
          showSuggestions={true}
        />
      </div>

      {/* Global Bottom Navigation Bar */}
      <BottomTabBar />
    </div>
  );
};
