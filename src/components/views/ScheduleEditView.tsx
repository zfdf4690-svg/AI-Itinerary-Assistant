import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

export const ScheduleEditView: React.FC = () => {
  const { currentDraft, setCurrentDraft, setCurrentView, applyModification } = useApp();

  const [dateStr, setDateStr] = useState(currentDraft?.dateLabel || '09月29日');
  const [timeStr, setTimeStr] = useState(currentDraft?.time || '15:00');
  const [locationStr, setLocationStr] = useState(currentDraft?.location || '陆家嘴');
  const [taskStr, setTaskStr] = useState(currentDraft?.task || '与张总开会');
  const [mattersStr, setMattersStr] = useState(currentDraft?.matters || '二期项目');
  const [remindStr, setRemindStr] = useState(currentDraft?.remindOffset || '提前 30 分钟');

  const handleSave = () => {
    if (!currentDraft) return;
    playAudioFeedback('tap');

    const updated = {
      ...currentDraft,
      dateLabel: dateStr,
      time: timeStr,
      location: locationStr,
      task: taskStr,
      title: taskStr,
      matters: mattersStr,
      remindOffset: remindStr
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
        {/* 时间 */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#86868B] block">
            时间
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors"
            />
            <input
              type="text"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full h-[42px] px-3.5 bg-[#FFFFFF] rounded-[12px] border border-[#D2D2D7] text-[15px] text-[#1D1D1F] outline-none focus:border-[#007AFF] transition-colors tabular-nums"
            />
          </div>
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
