import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  Calendar, 
  MapPin, 
  ClipboardList, 
  FileText, 
  Bell, 
  Edit3, 
  Check, 
  Sparkles, 
  Loader2,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SpeakerButton } from '../common/SpeakerButton';
import { BottomTabBar } from '../common/BottomTabBar';
import { VoiceInputDock } from '../common/VoiceInputDock';
import { playAudioFeedback } from '../../utils/audio';

export const ConfirmScheduleView: React.FC = () => {
  const {
    setCurrentView,
    chatMessages,
    currentDraft,
    setCurrentDraft,
    applyModification,
    confirmDraftSchedule,
    activePersona,
    isLlmProcessing,
    deepSeekConfig
  } = useApp();

  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineLocation, setInlineLocation] = useState(currentDraft?.location || '上海虹桥');
  const [inlineTime, setInlineTime] = useState(currentDraft?.time || '15:00');
  const [inlineMatters, setInlineMatters] = useState(currentDraft?.matters || '讨论二期项目');
  const [inlineRemind, setInlineRemind] = useState(currentDraft?.remindOffset || '提前30分钟');

  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isEditingInline]);

  // Keep inline fields in sync if draft updates from chat
  useEffect(() => {
    if (currentDraft) {
      setInlineLocation(currentDraft.location || '上海虹桥');
      setInlineTime(currentDraft.time || '15:00');
      setInlineMatters(currentDraft.matters || '讨论二期项目');
      setInlineRemind(currentDraft.remindOffset || '提前30分钟');
    }
  }, [currentDraft]);

  const handleSendModification = (text: string) => {
    const val = text.trim();
    if (!val) return;
    applyModification(val);
  };

  const handleSaveInlineEdit = () => {
    if (!currentDraft) return;
    setCurrentDraft({
      ...currentDraft,
      location: inlineLocation,
      time: inlineTime,
      matters: inlineMatters,
      remindOffset: inlineRemind
    });
    setIsEditingInline(false);
    playAudioFeedback('tap');
    applyModification(`修改信息：地点已调整为${inlineLocation}，时间为${inlineTime}`);
  };

  const lastAiMessage = [...chatMessages].reverse().find((m) => m.sender === 'ai');

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FC] text-slate-800 select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-3 bg-white/80 backdrop-blur-md border-b border-slate-200/60 z-20">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('home');
          }}
          title="返回首页"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-full text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-700">日程确认与修改</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
            {activePersona.name}
          </span>
        </div>

        <SpeakerButton textToSpeak={lastAiMessage?.text.replace('\n', ' ')} />
      </div>

      {/* Chat & Schedule Card Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {chatMessages.map((msg) => {
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="flex justify-end animate-fadeIn">
                <div className="max-w-[82%] px-4 py-2.5 rounded-2xl rounded-tr-xs bg-blue-600 text-white text-xs font-medium shadow-sm">
                  {msg.text}
                </div>
              </div>
            );
          }

          // AI message
          return (
            <div key={msg.id} className="flex items-start gap-2.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  playAudioFeedback('tap');
                  setCurrentView('persona_detail');
                }}
                title={`查看人设详情：${activePersona.name}`}
                className="w-9 h-9 rounded-full bg-white shadow-xs p-0.5 border border-slate-200 shrink-0 mt-0.5 overflow-hidden hover:ring-2 hover:ring-blue-400 active:scale-95 transition-all cursor-pointer"
              >
                <img
                  src={activePersona.avatar}
                  alt={activePersona.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </button>
              <div className="flex-1">
                <div className="inline-block px-4 py-2.5 rounded-2xl rounded-tl-xs bg-white text-slate-800 text-xs font-medium border border-slate-100 shadow-xs whitespace-pre-line leading-relaxed">
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Schedule Confirmation Card */}
        {currentDraft && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4 transition-all animate-fadeIn">
            {/* Header: Date badge, Big Time & Event Name */}
            <div className="space-y-1.5 pb-1 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                  <Calendar className="w-4 h-4" />
                  <span>日程卡片</span>
                </div>
                {isLlmProcessing ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> DeepSeek 语义精析中...
                  </span>
                ) : deepSeekConfig.enabled && deepSeekConfig.apiKey.trim() ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                    <Sparkles className="w-2.5 h-2.5" /> DeepSeek 驱动
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    本地轻量语义
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                  {currentDraft.time || '15:00'}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {currentDraft.dateLabel || '明天 (周二)'}
                </span>
              </div>

              <h2 className="text-base font-bold text-slate-900 pt-0.5">
                {currentDraft.title || '与张总开会'}
              </h2>
            </div>

            {/* Structured Slots Rows */}
            {!isEditingInline ? (
              <div className="space-y-2.5 text-xs">
                {/* 1. 地点 */}
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2 text-slate-400 font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>地点</span>
                  </div>
                  <span className="font-semibold text-slate-800 max-w-[200px] truncate text-right">
                    {currentDraft.location || '上海虹桥'}
                  </span>
                </div>

                {/* 2. 任务 */}
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2 text-slate-400 font-medium">
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>任务</span>
                  </div>
                  <span className="font-semibold text-slate-800 max-w-[200px] truncate text-right">
                    {currentDraft.task || '与张总开会'}
                  </span>
                </div>

                {/* 3. 事项 */}
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2 text-slate-400 font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    <span>事项</span>
                  </div>
                  <span className="font-semibold text-slate-800 max-w-[200px] truncate text-right">
                    {currentDraft.matters || '讨论二期项目'}
                  </span>
                </div>

                {/* 4. 提醒 */}
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2 text-slate-400 font-medium">
                    <Bell className="w-3.5 h-3.5" />
                    <span>提醒</span>
                  </div>
                  <span className="font-semibold text-blue-600 max-w-[200px] truncate text-right">
                    {currentDraft.remindOffset || '提前30分钟'}
                  </span>
                </div>
              </div>
            ) : (
              /* Inline Edit Mode */
              <div className="space-y-3 pt-1 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">地点</label>
                  <input
                    type="text"
                    value={inlineLocation}
                    onChange={(e) => setInlineLocation(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-xs focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">时间</label>
                    <input
                      type="text"
                      value={inlineTime}
                      onChange={(e) => setInlineTime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">提醒</label>
                    <input
                      type="text"
                      value={inlineRemind}
                      onChange={(e) => setInlineRemind(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">讨论事项</label>
                  <input
                    type="text"
                    value={inlineMatters}
                    onChange={(e) => setInlineMatters(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-xs focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setIsEditingInline(false)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveInlineEdit}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white font-medium flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> 保存修改
                  </button>
                </div>
              </div>
            )}

            {/* Banner prompt */}
            <div className="py-2.5 px-4 rounded-xl bg-blue-50/70 border border-blue-100/60 text-center">
              <p className="text-xs font-medium text-blue-600">这样安排可以吗？</p>
            </div>

            {/* Action Buttons: "修改" and "确认" */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => {
                  playAudioFeedback('tap');
                  setIsEditingInline(!isEditingInline);
                }}
                className="flex-1 h-11 rounded-full bg-slate-100/90 hover:bg-slate-200/80 active:scale-98 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditingInline ? '关闭手改' : '手动修改'}
              </button>

              <button
                onClick={() => {
                  confirmDraftSchedule();
                }}
                className="flex-1 h-11 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-105 active:scale-98 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                确认创建
              </button>
            </div>
          </div>
        )}

        {/* Quick Multi-Turn Correction Chips */}
        <div className="pt-2">
          <p className="text-[11px] text-slate-400 mb-1.5 px-1 font-medium">快捷口令修改微调：</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSendModification('地点不是虹桥，是陆家嘴。')}
              className="text-[11px] px-3 py-1.5 rounded-xl bg-white border border-blue-200/70 text-blue-700 hover:bg-blue-50 font-medium active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              “地点不是虹桥，是陆家嘴”
            </button>
            <button
              onClick={() => handleSendModification('改到下午4点')}
              className="text-[11px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              “改到下午4点”
            </button>
            <button
              onClick={() => handleSendModification('提醒改成提前15分钟')}
              className="text-[11px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              “提前15分钟提醒”
            </button>
          </div>
        </div>

        <div ref={scrollBottomRef} />
      </div>

      {/* Unified Voice & Text Input Dock at the Bottom */}
      <div className="p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/60 z-20">
        <VoiceInputDock
          onSendMessage={handleSendModification}
          placeholder="说出修改，如：地点改为徐家汇，或提前1小时提醒..."
          showSuggestions={false}
        />
      </div>

      {/* Global Bottom Navigation Bar */}
      <BottomTabBar />
    </div>
  );
};
