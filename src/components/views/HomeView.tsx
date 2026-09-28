import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Mic, Sparkles, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';
import { ScheduleItem } from '../../types';

/**
 * 01 Home · 对话式聊天首页（去演示化）
 * 输入 → AI 在聊天流内回复（含日程卡片）→ 多轮修改/确认 → 创建成功消息，全程不跳页。
 */
export const HomeView: React.FC = () => {
  const {
    setCurrentView,
    chatMessages,
    currentDraft,
    resetChatWithUtterance,
    applyModification,
    confirmDraftSchedule,
    schedules,
    backendStatus,
    isLlmProcessing,
  } = useApp();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLlmProcessing]);

  const inConversation = chatMessages.length > 0;
  const todayCount = schedules.filter((s) => s.status !== 'completed').length;

  const handleSend = (text: string) => {
    const val = text.trim();
    if (!val) return;
    playAudioFeedback('tap');
    setInputText('');
    // 对话中且有草稿 → 多轮修改/补充；否则开启新会话
    if (inConversation && currentDraft) applyModification(val);
    else resetChatWithUtterance(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend(inputText);
  };

  const handleStartVoice = () => {
    playAudioFeedback('wake');
    setCurrentView('listening');
  };

  const handleConfirm = () => {
    if (!currentDraft) return;
    playAudioFeedback('success');
    void confirmDraftSchedule();
  };

  /** 日程卡片（Apple Card 风格） */
  const renderScheduleCard = (draft: Partial<ScheduleItem>) => (
    <div className="w-full bg-[#FFFFFF] rounded-[20px] p-5 border border-[#E5E5EA] shadow-apple space-y-4 transition-all animate-fadeIn">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#86868B]">
            {draft.dateLabel || '明天'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFD60A]/15 text-[#B8860B] text-[11px] font-semibold">
            ⏳ 待确认
          </span>
        </div>
        <div className="text-[32px] font-bold text-[#1D1D1F] tabular-nums tracking-tight leading-none">
          {draft.time || '15:00'}
        </div>
        <div className="text-[18px] font-semibold text-[#1D1D1F] pt-2">
          {draft.task || draft.title || '日程安排'}
        </div>
      </div>

      <div className="border-t border-[#D2D2D7]/50 pt-3" />

      <div className="space-y-2 text-[14px]">
        <div className="flex items-center justify-between">
          <span className="text-[#86868B]">时间</span>
          <span className="font-medium text-[#1D1D1F]">
            {draft.dateLabel || '明天'} {draft.time || '15:00'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#86868B]">地点</span>
          <span className="font-medium text-[#1D1D1F]">{draft.location || '未指定'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#86868B]">任务</span>
          <span className="font-medium text-[#1D1D1F]">{draft.task || draft.title || '日程安排'}</span>
        </div>
        {draft.matters && (
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">事项</span>
            <span className="font-medium text-[#1D1D1F]">{draft.matters}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[#86868B]">提醒</span>
          <span className="font-medium text-[#007AFF]">{draft.remindOffset || '提前 30 分钟'}</span>
        </div>
      </div>

      <div className="border-t border-[#D2D2D7]/50 pt-1" />

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('schedule_edit');
          }}
          className="h-[44px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-98 text-[#1D1D1F] text-[15px] font-medium transition-all flex items-center justify-center cursor-pointer"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLlmProcessing}
          className="h-[44px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-98 text-[#FFFFFF] text-[15px] font-semibold shadow-apple transition-all flex items-center justify-center cursor-pointer disabled:opacity-60"
        >
          确认创建
        </button>
      </div>
    </div>
  );

  /** 底部输入条（聊天模式） */
  const inputBar = (
    <div className="px-5 py-3 border-t border-[#D2D2D7]/40 bg-[#FFFFFF]">
      <div className="flex items-center gap-2 bg-[#F5F5F7] rounded-[14px] border border-[#D2D2D7] pl-4 pr-1.5 py-1.5 focus-within:border-[#007AFF]/60 focus-within:ring-2 focus-within:ring-[#007AFF]/15 transition-all">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentDraft ? '说出修改，如：地点改到虹桥…' : '说说你接下来要做什么'}
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none py-1"
        />
        <button
          type="button"
          onClick={handleStartVoice}
          title="语音输入"
          className="shrink-0 w-9 h-9 rounded-full bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 flex items-center justify-center text-[#FFFFFF] transition-all cursor-pointer"
        >
          <Mic className="w-[18px] h-[18px] stroke-[2]" />
        </button>
        <button
          type="button"
          onClick={() => handleSend(inputText)}
          disabled={!inputText.trim()}
          title="发送"
          className="shrink-0 w-9 h-9 rounded-full bg-[#34C759] hover:bg-[#34C759]/90 active:scale-95 flex items-center justify-center text-[#FFFFFF] transition-all cursor-pointer disabled:opacity-40"
        >
          <Send className="w-[16px] h-[16px] stroke-[2]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none overflow-hidden font-sans">
      {/* Top Quiet Header */}
      <div className="px-6 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-[#1D1D1F] tracking-tight">
          AI 语音行程助手
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

      {inConversation ? (
        /* ===== 聊天流模式 ===== */
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {chatMessages.map((m) =>
            m.sender === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[78%] bg-[#007AFF] text-[#FFFFFF] rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[15px] leading-snug shadow-apple whitespace-pre-line">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-3">
                <div className="flex justify-start">
                  <div className="max-w-[85%] bg-[#FFFFFF] text-[#1D1D1F] rounded-[18px] rounded-bl-[6px] px-4 py-2.5 text-[15px] leading-snug shadow-apple whitespace-pre-line">
                    {m.text}
                  </div>
                </div>
                {m.scheduleDraft && Object.keys(m.scheduleDraft).length > 0 && (
                  <div className="pl-1">{renderScheduleCard(m.scheduleDraft)}</div>
                )}
              </div>
            )
          )}

          {isLlmProcessing && (
            <div className="flex justify-start">
              <div className="bg-[#FFFFFF] text-[#86868B] rounded-[18px] rounded-bl-[6px] px-4 py-2.5 text-[14px] shadow-apple">
                正在理解…
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      ) : (
        /* ===== 空态欢迎：对话式入口 ===== */
        <div className="flex-1 overflow-y-auto px-6 flex flex-col justify-center items-center">
          <div className="w-full max-w-[380px] flex flex-col items-center text-center space-y-6 -mt-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-[12px] font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                AI 智能理解
              </div>
              <h2 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight leading-tight">
                说句话，帮你记下
                <br />
                今天的安排
              </h2>
              <p className="text-[14px] text-[#86868B] leading-relaxed">
                支持语音或文字，AI 自动识别
                <br />
                时间、地点与事项
              </p>
            </div>

            <div className="w-full flex items-center gap-2 bg-[#FFFFFF] rounded-[16px] border border-[#D2D2D7] pl-4 pr-1.5 py-2 shadow-apple focus-within:border-[#007AFF]/60 focus-within:ring-2 focus-within:ring-[#007AFF]/15 transition-all">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例如：明天下午三点和张总开会"
                className="flex-1 min-w-0 bg-transparent text-[16px] text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none py-1"
              />
              <button
                type="button"
                onClick={handleStartVoice}
                title="语音输入"
                className="shrink-0 w-10 h-10 rounded-full bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 flex items-center justify-center text-[#FFFFFF] transition-all cursor-pointer"
              >
                <Mic className="w-[20px] h-[20px] stroke-[2]" />
              </button>
            </div>

            <p className="text-[12px] text-[#AEAEB2]">
              回车发送 · 或点击麦克风说话
            </p>

            {todayCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  playAudioFeedback('tap');
                  setCurrentView('calendar');
                }}
                className="text-[13px] text-[#007AFF] hover:text-[#007AFF]/80 underline-offset-4 hover:underline transition-colors cursor-pointer"
              >
                查看今日 {todayCount} 项日程 →
              </button>
            )}
            {todayCount === 0 && backendStatus === 'online' && (
              <p className="text-[12px] text-[#AEAEB2]">
                今天还没有日程，说一句话创建一个吧
              </p>
            )}
          </div>
        </div>
      )}

      {inConversation && inputBar}

      {/* Global Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
};
