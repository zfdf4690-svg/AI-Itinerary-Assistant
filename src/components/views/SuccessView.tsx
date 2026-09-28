import React from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

export const SuccessView: React.FC = () => {
  const { setCurrentView, confirmedItem, currentDraft } = useApp();

  const item = confirmedItem || currentDraft || {
    time: '15:00',
    dateLabel: '明天',
    title: '与张总开会',
    location: '陆家嘴',
    task: '与张总开会',
    matters: '二期项目',
    remindOffset: '提前 30 分钟'
  };

  const handleReturnHome = () => {
    playAudioFeedback('tap');
    setCurrentView('home');
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none font-sans justify-between items-center px-6 py-12">
      <div />

      {/* Main Quiet Success Card */}
      <div className="w-full max-w-[340px] flex flex-col items-center text-center space-y-6">
        {/* Soft Success Tick */}
        <div className="w-12 h-12 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center animate-fadeIn">
          <Check className="w-6 h-6 stroke-[3]" />
        </div>

        <div className="space-y-1">
          <h1 className="text-[20px] font-bold text-[#1D1D1F] tracking-tight">
            已经安排好了
          </h1>
          <p className="text-[13px] text-[#86868B]">
            已同步至你的日程库
          </p>
        </div>

        {/* Minimal Schedule Card */}
        <div className="w-full bg-[#FFFFFF] rounded-[16px] p-5 border border-[#E5E5EA] shadow-apple text-left space-y-2">
          <div className="text-[15px] font-semibold text-[#1D1D1F] tabular-nums">
            {item.dateLabel || '明天'} {item.time || '15:00'}
          </div>
          <div className="text-[16px] font-medium text-[#1D1D1F]">
            {item.task || item.title || '与张总开会'}
          </div>
          {item.location && (
            <div className="text-[13px] text-[#86868B]">
              {item.location}
            </div>
          )}
          <div className="text-[13px] text-[#007AFF] pt-1">
            {item.remindOffset ? `${item.remindOffset}提醒` : '提前 30 分钟提醒'}
          </div>
        </div>
      </div>

      {/* Bottom Primary Return Action */}
      <div className="w-full max-w-[340px] pb-4">
        <button
          type="button"
          onClick={handleReturnHome}
          className="w-full h-[46px] rounded-[12px] bg-[#FFFFFF] hover:bg-[#F2F2F7] border border-[#D2D2D7] active:scale-98 text-[#1D1D1F] text-[15px] font-medium shadow-apple transition-all cursor-pointer"
        >
          返回首页
        </button>
      </div>
    </div>
  );
};
