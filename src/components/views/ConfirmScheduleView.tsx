import React, { useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SpeakerButton } from '../common/SpeakerButton';
import { VoiceInputDock } from '../common/VoiceInputDock';
import { playAudioFeedback } from '../../utils/audio';

export const ConfirmScheduleView: React.FC = () => {
  const {
    setCurrentView,
    chatMessages,
    currentDraft,
    applyModification,
    confirmDraftSchedule
  } = useApp();

  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendModification = (text: string) => {
    const val = text.trim();
    if (!val) return;
    applyModification(val);
  };

  const handleConfirm = () => {
    playAudioFeedback('success');
    confirmDraftSchedule();
  };

  const handleOpenEdit = () => {
    playAudioFeedback('tap');
    setCurrentView('schedule_edit');
  };

  const lastAiMessage = [...chatMessages].reverse().find((m) => m.sender === 'ai');

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none font-sans overflow-hidden">
      {/* Top Quiet Bar */}
      <div className="flex items-center justify-between px-6 pt-3 pb-2">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('home');
          }}
          className="text-[15px] text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
        >
          取消
        </button>

        <span className="text-[15px] font-semibold text-[#1D1D1F]">
          日程确认
        </span>

        <SpeakerButton textToSpeak={lastAiMessage?.text} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
        {/* Natural AI Dialog Prompt outside Card */}
        <div className="text-center pt-1 pb-1">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] whitespace-pre-line">
            {lastAiMessage?.text || '这样安排可以吗？'}
          </h2>
          <p className="text-[13px] text-[#86868B] mt-0.5">
            可直接说修改，或点击下方按钮确认创建
          </p>
        </div>

        {/* Structured Schedule Card (Radius 20px, Apple Card) */}
        {currentDraft && (
          <div className="w-full bg-[#FFFFFF] rounded-[20px] p-5 border border-[#E5E5EA] shadow-apple space-y-4 transition-all animate-fadeIn">
            {/* Top Date & Time & Title */}
            <div className="space-y-1">
              <div className="text-[14px] font-medium text-[#86868B]">
                {currentDraft.dateLabel || '未指定日期'}
              </div>
              <div className="text-[32px] font-bold text-[#1D1D1F] tabular-nums tracking-tight leading-none">
                {currentDraft.time || '未指定时间'}
              </div>
              <div className="text-[18px] font-semibold text-[#1D1D1F] pt-2">
                {currentDraft.task || currentDraft.title || '未命名事项'}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#D2D2D7]/50 pt-3" />

            {/* Structured Key-Value Rows */}
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">时间</span>
                <span className="font-medium text-[#1D1D1F]">
                  {currentDraft.dateLabel || '未指定日期'} {currentDraft.time || ''}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">地点</span>
                <span className="font-medium text-[#1D1D1F]">
                  {currentDraft.location || '未填写'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">任务</span>
                <span className="font-medium text-[#1D1D1F]">
                  {currentDraft.task || currentDraft.title || '未命名事项'}
                </span>
              </div>

              {currentDraft.matters && (
                <div className="flex items-center justify-between">
                  <span className="text-[#86868B]">事项</span>
                  <span className="font-medium text-[#1D1D1F]">
                    {currentDraft.matters}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">提醒</span>
                <span className="font-medium text-[#007AFF]">
                  {currentDraft.remindOffset || '未设置'}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#D2D2D7]/50 pt-1" />

            {/* Card Actions: 编辑 / 确认 */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleOpenEdit}
                className="h-[44px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-98 text-[#1D1D1F] text-[15px] font-medium transition-all flex items-center justify-center cursor-pointer"
              >
                编辑
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="h-[44px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-98 text-[#FFFFFF] text-[15px] font-semibold shadow-apple transition-all flex items-center justify-center cursor-pointer"
              >
                确认
              </button>
            </div>
          </div>
        )}

        <div ref={scrollBottomRef} />
      </div>

      {/* Quiet Voice & Text Input Dock at Bottom */}
      <div className="px-5 py-3 border-t border-[#D2D2D7]/40 bg-[#FFFFFF]">
        <VoiceInputDock
          onSendMessage={handleSendModification}
          placeholder="说出修改，如：地点改到虹桥..."
          showSuggestions={false}
        />
      </div>
    </div>
  );
};
