import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Mic, Sparkles, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';
import { RealAudioCapturer } from '../../utils/voiceRecorder';
import type { ScheduleItem } from '../../types';

/**
 * PHASE 4-D · D1 Browser STT 状态机：
 * idle → listening（点击麦克风）→ transcribing（实时识别文本进输入框）→ text_ready（识别结束，用户手动发送）
 * error（权限拒绝 / 不支持 / 异常）。识别结果只写入输入框，绝不自动提交 / 自动创建日程。
 */

/**
 * 01 Home · 对话式聊天首页（PHASE 4-C）
 * 输入 → AI 聊天流回复 → 后端 SHOW_SCHEDULE_CARD 时渲染真实日程卡
 * （仅展示 draft 真实值，无编造 fallback）→ [编辑][确认创建] → 真正创建并刷新列表。
 */
export const HomeView: React.FC = () => {
  const {
    setCurrentView,
    chatMessages,
    currentDraft,
    resetChatWithUtterance,
    applyModification,
    confirmDraftSchedule,
    startNewConversation,
    schedules,
    backendStatus,
    isLlmProcessing,
  } = useApp();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- PHASE 4-D · D1 Browser STT 就地语音输入（识别只入输入框，由用户手动发送）----
  type VoiceState = 'idle' | 'listening' | 'transcribing' | 'text_ready' | 'error';
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState('');
  const capturerRef = useRef<RealAudioCapturer | null>(null);
  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const stopVoiceCapture = () => {
    if (capturerRef.current) capturerRef.current.stop();
    capturerRef.current = null;
  };

  const handleStartVoice = () => {
    // 正在识别中再次点击 → 手动停止：文本保留在输入框，由用户决定是否发送
    if (voiceState === 'listening' || voiceState === 'transcribing') {
      stopVoiceCapture();
      setVoiceState(inputText.trim() ? 'text_ready' : 'idle');
      playAudioFeedback('tap');
      return;
    }
    if (!speechSupported) {
      setVoiceError('当前浏览器暂不支持语音输入，请使用文字输入。');
      setVoiceState('error');
      playAudioFeedback('tap');
      return;
    }
    playAudioFeedback('wake');
    setVoiceError('');
    setVoiceState('listening');
    const capturer = new RealAudioCapturer();
    capturerRef.current = capturer;
    capturer.onTranscriptChange = (text, isFinal) => {
      // 实时/最终识别结果写入输入框（可编辑）；识别结束自动停止，等待用户手动发送
      setInputText(text);
      setVoiceState('transcribing');
      if (isFinal) {
        stopVoiceCapture();
        setVoiceState('text_ready');
      }
    };
    capturer.onError = (msg) => {
      setVoiceError(msg || '语音输入异常，请改用文字输入。');
      setVoiceState('error');
    };
    void capturer.start();
  };

  // 卸载时停止录音
  useEffect(() => {
    return () => stopVoiceCapture();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLlmProcessing]);

  const inConversation = chatMessages.length > 0;
  const todayCount = schedules.filter((s) => s.status !== 'completed').length;

  // ---- PHASE 4-D · D2 New Conversation：右上角入口 + 未确认草稿提示 ----
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const hasUnconfirmedDraft = Boolean(currentDraft && Object.keys(currentDraft).length > 0);
  const handleNewConversation = () => {
    if (hasUnconfirmedDraft) {
      setShowNewConfirm(true);
      playAudioFeedback('tap');
    } else {
      startNewConversation();
    }
  };

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

  /** 编辑：聚焦输入框，直接文字修改（对话式编辑，保持上下文） */
  const handleEditDraft = () => {
    playAudioFeedback('tap');
    inputRef.current?.focus();
  };

  /** 确认创建：调后端 confirm（convIdRef → POST /conversations/:id/confirm） */
  const handleConfirmDraft = async () => {
    playAudioFeedback('tap');
    await confirmDraftSchedule();
  };

  /**
   * Schedule Draft 卡片（PHASE 4-C）
   * 只展示 draft 真实值；空字段显示「未填写/未设置」，绝不编造 15:00/陆家嘴 等默认值。
   */
  const ScheduleDraftCard: React.FC<{ draft: Partial<ScheduleItem>; onEdit: () => void; onConfirm: () => void }> = ({ draft, onEdit, onConfirm }) => {
    const title = draft.task || draft.title || '未命名事项';
    const timeText = draft.time || '未指定时间';
    const dateTime = `${draft.dateLabel || '未指定日期'}${draft.time ? ` ${draft.time}` : ''}`;
    return (
      <div className="w-full bg-[#FFFFFF] rounded-[20px] p-5 border border-[#E5E5EA] shadow-apple space-y-4 transition-all animate-fadeIn">
        {/* 顶部：日期 / 时间 / 标题 */}
        <div className="space-y-1">
          <div className="text-[14px] font-medium text-[#86868B]">
            {draft.dateLabel || '未指定日期'}
          </div>
          <div className="text-[32px] font-bold text-[#1D1D1F] tabular-nums tracking-tight leading-none">
            {timeText}
          </div>
          <div className="text-[18px] font-semibold text-[#1D1D1F] pt-2">
            {title}
          </div>
        </div>

        <div className="border-t border-[#D2D2D7]/50 pt-3" />

        {/* 结构化明细 */}
        <div className="space-y-2 text-[14px]">
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">日期时间</span>
            <span className="font-medium text-[#1D1D1F]">{dateTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">地点</span>
            <span className="font-medium text-[#1D1D1F]">{draft.location || '未填写'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">任务</span>
            <span className="font-medium text-[#1D1D1F]">{title}</span>
          </div>
          {draft.matters && (
            <div className="flex items-center justify-between">
              <span className="text-[#86868B]">事项</span>
              <span className="font-medium text-[#1D1D1F]">{draft.matters}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">提醒</span>
            <span className="font-medium text-[#007AFF]">{draft.remindOffset || '未设置'}</span>
          </div>
        </div>

        <div className="border-t border-[#D2D2D7]/50 pt-1" />

        {/* 卡片操作：编辑 / 确认创建 */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="h-[44px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-98 text-[#1D1D1F] text-[15px] font-medium transition-all flex items-center justify-center cursor-pointer"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[44px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-98 text-[#FFFFFF] text-[15px] font-semibold shadow-apple transition-all flex items-center justify-center cursor-pointer"
          >
            确认创建
          </button>
        </div>
      </div>
    );
  };

  /** 底部输入条（聊天模式） */
  const inputBar = (
    <div className="px-5 py-3 border-t border-[#D2D2D7]/40 bg-[#FFFFFF]">
      {voiceError && (
        <div className="text-[12px] text-[#FF3B30] px-1 pb-1.5">{voiceError}</div>
      )}
      <div className="flex items-center gap-2 bg-[#F5F5F7] rounded-[14px] border border-[#D2D2D7] pl-4 pr-1.5 py-1.5 focus-within:border-[#007AFF]/60 focus-within:ring-2 focus-within:ring-[#007AFF]/15 transition-all">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (voiceError) setVoiceError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceState === 'listening' || voiceState === 'transcribing'
              ? '正在听，请说话…'
              : currentDraft
                ? '说出修改，如：地点改到虹桥…'
                : '说说你接下来要做什么'
          }
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none py-1"
        />
        <button
          type="button"
          onClick={handleStartVoice}
          title={voiceState === 'listening' || voiceState === 'transcribing' ? '停止语音输入' : '语音输入'}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[#FFFFFF] transition-all cursor-pointer ${
            voiceState === 'listening' || voiceState === 'transcribing'
              ? 'bg-[#FF3B30] animate-pulse'
              : 'bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95'
          }`}
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
        <div className="flex items-center gap-2">
          {/* PHASE 4-D · D2：新建对话（仅重置会话上下文，不删除任何日程/记忆） */}
          <button
            type="button"
            onClick={handleNewConversation}
            title="新建对话"
            className="h-8 px-3 rounded-full flex items-center gap-1 text-[13px] font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 active:scale-95 transition-all cursor-pointer"
          >
            ＋ New
          </button>
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
      </div>

      {/* PHASE 4-D · D2：存在未确认草稿时的 New 确认条 */}
      {showNewConfirm && (
        <div className="absolute top-[52px] left-0 right-0 z-20 px-5">
          <div className="bg-[#FFFFFF]/95 backdrop-blur rounded-[16px] border border-[#D2D2D7] shadow-apple p-4 space-y-3 animate-fadeIn">
            <div className="text-[14px] font-medium text-[#1D1D1F] leading-snug">
              当前还有一个未确认的日程，要开始新的对话吗？
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewConfirm(false);
                  playAudioFeedback('tap');
                }}
                className="h-[40px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] text-[14px] font-medium transition-all cursor-pointer"
              >
                继续当前对话
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewConfirm(false);
                  startNewConversation();
                }}
                className="h-[40px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 text-[#FFFFFF] text-[14px] font-semibold transition-all cursor-pointer"
              >
                新建对话
              </button>
            </div>
          </div>
        </div>
      )}

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
                {/* PHASE 4-C：仅 SHOW_SCHEDULE_CARD 时渲染真实 Schedule Card */}
                {m.actionRequired === 'SHOW_SCHEDULE_CARD' && m.scheduleDraft && (
                  <>
                    {/* PHASE 4-D · D3：冲突提醒（确定性结果；仅提醒，不阻止用户创建） */}
                    {m.conflict && m.conflict.hasConflict && m.conflict.conflicts.length > 0 && (
                      <div className="bg-[#FFF7E6] border border-[#FFB800]/50 rounded-[14px] p-3 space-y-1.5 animate-fadeIn">
                        <div className="text-[13px] font-semibold text-[#B25E00]">
                          {m.conflict.level === 'exact' ? '时间冲突提醒' : '时间相邻提醒'}
                        </div>
                        {m.conflict.conflicts.map((c) => (
                          <div key={c.scheduleId} className="text-[12px] text-[#8A5A00] leading-snug">
                            {c.date} {c.time} · {c.task}
                            {c.location ? ` · ${c.location}` : ''}
                          </div>
                        ))}
                        <div className="text-[11px] text-[#8A5A00] leading-snug">
                          {m.conflict.level === 'exact'
                            ? '与已有日程时间重叠。可点击编辑调整时间，或仍按此时间创建。'
                            : '与已有日程时间相邻，可能会比较赶。可点击编辑调整时间，或仍按此时间创建。'}
                        </div>
                      </div>
                    )}
                    <ScheduleDraftCard
                      draft={m.scheduleDraft}
                      onEdit={handleEditDraft}
                      onConfirm={handleConfirmDraft}
                    />
                  </>
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

            {voiceError && (
              <div className="w-full text-[12px] text-[#FF3B30] -mt-2">{voiceError}</div>
            )}
            <div className="w-full flex items-center gap-2 bg-[#FFFFFF] rounded-[16px] border border-[#D2D2D7] pl-4 pr-1.5 py-2 shadow-apple focus-within:border-[#007AFF]/60 focus-within:ring-2 focus-within:ring-[#007AFF]/15 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (voiceError) setVoiceError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  voiceState === 'listening' || voiceState === 'transcribing'
                    ? '正在听，请说话…'
                    : '例如：明天下午三点和张总开会'
                }
                className="flex-1 min-w-0 bg-transparent text-[16px] text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none py-1"
              />
              <button
                type="button"
                onClick={handleStartVoice}
                title={voiceState === 'listening' || voiceState === 'transcribing' ? '停止语音输入' : '语音输入'}
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[#FFFFFF] transition-all cursor-pointer ${
                  voiceState === 'listening' || voiceState === 'transcribing'
                    ? 'bg-[#FF3B30] animate-pulse'
                    : 'bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95'
                }`}
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
