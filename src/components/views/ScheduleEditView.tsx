import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

/**
 * PHASE 4-F · Bug 2：编辑日程输入规范化。
 * 1) 时间改为下拉选择固定时间（00:00–23:45，每 15 分钟，程序生成 96 项）；
 * 2) 日期改为 <input type="date">（YYYY-MM-DD 合法输入）；
 * 3) 彻底删除编造默认值（09月29日/15:00/陆家嘴/与张总开会/二期项目/提前30分钟）：
 *    初始化优先级 = currentDraft 真实值 → 空值占位，placeholder 不作为实际 value。
 */

/** 15 分钟粒度时间选项（程序生成，勿手写） */
function buildTimeOptions(): string[] {
  const opts: string[] = [];
  for (let m = 0; m < 24 * 60; m += 15) {
    opts.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return opts;
}
const TIME_OPTIONS = buildTimeOptions();

/** YYYY-MM-DD → 人类可读日期标签（如 2026-09-30 → 2026年9月30日）；非法输入返回空 */
function formatDateLabel(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return '';
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

export const ScheduleEditView: React.FC = () => {
  const { currentDraft, setCurrentDraft, setCurrentView, applyModification } = useApp();

  // PHASE 4-F：只从 currentDraft 真实回填；无值则为空（placeholder 仅为提示，不参与保存）
  const [dateValue, setDateValue] = useState(currentDraft?.date || '');
  const [timeStr, setTimeStr] = useState(currentDraft?.time || '');
  const [locationStr, setLocationStr] = useState(currentDraft?.location || '');
  const [taskStr, setTaskStr] = useState(currentDraft?.task || '');
  const [mattersStr, setMattersStr] = useState(currentDraft?.matters || '');
  const [remindStr, setRemindStr] = useState(currentDraft?.remindOffset || '');

  const handleSave = () => {
    if (!currentDraft) return;
    playAudioFeedback('tap');

    const dateLabel = formatDateLabel(dateValue) || currentDraft.dateLabel;
    const updated = {
      ...currentDraft,
      ...(dateValue ? { date: dateValue, dateLabel } : {}),
      time: timeStr,
      location: locationStr || undefined,
      task: taskStr,
      title: taskStr,
      matters: mattersStr || undefined,
      remindOffset: remindStr || undefined,
    };

    setCurrentDraft(updated);
    applyModification(`修改信息：${locationStr}，${timeStr}，${mattersStr}`);
    setCurrentView('confirmation');
  };

  const handleCancel = () => {
    playAudioFeedback('tap');
    setCurrentView('confirmation');
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none font-sans overflow-y-auto">
      {/* Top Header */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-[#D2D2D7]/40 bg-[#FFFFFF]">
        <h1 className="text-[17px] font-semibold text-[#1D1D1F]">
          编辑日程
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="text-[15px] text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="text-[15px] font-semibold text-[#007AFF] hover:text-[#007AFF]/80 transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>

      {/* Structured Lightweight Form */}
      <div className="flex-1 px-6 py-5 space-y-4">
        {/* 日期（PHASE 4-F：合法日期输入，不再自由文本） */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            日期
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors tabular-nums"
          />
        </div>

        {/* 时间（PHASE 4-F：下拉选择固定时间，15 分钟粒度） */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            时间
          </label>
          <select
            value={TIME_OPTIONS.includes(timeStr) ? timeStr : timeStr || ''}
            onChange={(e) => setTimeStr(e.target.value)}
            className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors tabular-nums cursor-pointer appearance-none"
          >
            {!TIME_OPTIONS.includes(timeStr) && timeStr && (
              <option value={timeStr}>{timeStr}（当前）</option>
            )}
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* 地点 */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            地点
          </label>
          <input
            type="text"
            value={locationStr}
            onChange={(e) => setLocationStr(e.target.value)}
            className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors"
            placeholder="如：陆家嘴"
          />
        </div>

        {/* 任务 */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            任务
          </label>
          <input
            type="text"
            value={taskStr}
            onChange={(e) => setTaskStr(e.target.value)}
            className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors"
            placeholder="如：与张总开会"
          />
        </div>

        {/* 事项 */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            事项
          </label>
          <input
            type="text"
            value={mattersStr}
            onChange={(e) => setMattersStr(e.target.value)}
            className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors"
            placeholder="如：二期项目"
          />
        </div>

        {/* 提醒 */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            提醒
          </label>
          <input
            type="text"
            value={remindStr}
            onChange={(e) => setRemindStr(e.target.value)}
            className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors"
            placeholder="如：提前 30 分钟"
          />
        </div>
      </div>
    </div>
  );
};
