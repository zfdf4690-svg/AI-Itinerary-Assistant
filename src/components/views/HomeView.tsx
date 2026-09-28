import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const HomeView: React.FC = () => {
  const { setCurrentView, schedules } = useApp();

  // Primary today's schedules
  const todaySchedules = schedules.filter((s) => 
    s.dateLabel.includes('今日') || s.dateLabel.includes('今天') || s.dateLabel.includes('4月23日') || s.dateLabel.includes('9月28日')
  );

  const displayList = todaySchedules.length > 0 ? todaySchedules : schedules.slice(0, 3);

  const handleStartVoice = () => {
    playAudioFeedback('wake');
    setCurrentView('listening');
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none overflow-hidden font-sans">
      {/* Top Quiet Header */}
      <div className="px-6 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-[#1D1D1F] tracking-tight">
          早上好，今天有什么安排？
        </h1>
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('calendar');
          }}
          title="日历视图"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#1D1D1F] hover:bg-[#F2F2F7] active:scale-95 transition-all cursor-pointer"
        >
          <CalendarIcon className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[14px] font-semibold text-[#86868B] tracking-tight">
            今天 · 9月28日
          </span>
          <span className="text-[12px] text-[#AEAEB2]">
            {displayList.length} 项日程
          </span>
        </div>

        {/* Schedule Cards List - Content-First, Apple Style */}
        <div className="space-y-3">
          {displayList.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                playAudioFeedback('tap');
                setCurrentView('calendar');
              }}
              className="w-full bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA]/60 shadow-apple hover:border-[#D2D2D7] active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-[15px] font-bold text-[#1D1D1F] tracking-tight tabular-nums">
                    {item.time}
                  </div>
                  <div className="text-[16px] font-medium text-[#1D1D1F] leading-snug">
                    {item.title}
                  </div>
                  {item.location && (
                    <div className="text-[13px] text-[#86868B] pt-0.5">
                      {item.location}
                    </div>
                  )}
                </div>

                {/* Right Notification Dot indicator */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[12px] text-[#86868B] tabular-nums font-medium">
                    {item.time}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quiet Voice Call to Action Container */}
        <div className="pt-6 pb-4 flex flex-col items-center justify-center text-center space-y-3.5">
          <p className="text-[14px] text-[#86868B]">
            说说你接下来要做什么
          </p>

          <button
            type="button"
            onClick={handleStartVoice}
            className="h-[44px] px-6 rounded-[12px] bg-[#FFFFFF] hover:bg-[#F2F2F7] border border-[#D2D2D7] text-[#1D1D1F] text-[15px] font-medium shadow-apple flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-[16px]">🎙</span>
            <span>开始说话</span>
          </button>
        </div>
      </div>

      {/* Global Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
};
