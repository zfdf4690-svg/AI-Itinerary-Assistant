import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { ScheduleItem } from '../../types';
import { BottomTabBar } from '../common/BottomTabBar';

export const CalendarView: React.FC = () => {
  const { schedules, updateSchedule, deleteSchedule } = useApp();

  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 8 is September
  const [selectedDay, setSelectedDay] = useState<number>(29);

  /** 当前展开"…"菜单的日程 id（null = 无） */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** 正在编辑的日程（null = 未编辑） */
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  /** 编辑表单字段 */
  const [editTime, setEditTime] = useState('');
  const [editTask, setEditTask] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRemind, setEditRemind] = useState('');
  /** 删除二次确认的日程 id */
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null);

  const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];

  // Days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // First day of month (0 Sunday, 1 Monday, ...)
  const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Convert to Monday-first (0 Monday ... 6 Sunday)
  const firstDayIndex = (rawFirstDay + 6) % 7;

  const pad = (n: number) => String(n).padStart(2, '0');
  const selectedDateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(selectedDay)}`;

  const handlePrevMonth = () => {
    playAudioFeedback('tap');
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setMenuFor(null);
  };

  const handleNextMonth = () => {
    playAudioFeedback('tap');
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setMenuFor(null);
  };

  /** 按真实 date 字段过滤（YYYY-MM-DD 与选中日一致），已完成日程置灰保留 */
  const daySchedules = schedules.filter((s) => s.date === selectedDateStr);

  /** 标记已完成 */
  const handleMarkCompleted = (item: ScheduleItem) => {
    updateSchedule(item.id, { status: 'completed' });
    setMenuFor(null);
    playAudioFeedback('tap');
  };

  /** 打开编辑浮层（初始值取该日程当前值；标题与卡片渲染一致：title 优先） */
  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setEditTime(item.time || '');
    setEditTask(item.title || item.task || '');
    setEditLocation(item.location || '');
    setEditRemind(item.remindOffset || '');
    setMenuFor(null);
  };

  /** 保存编辑 → PATCH 后端并更新本地 */
  const handleSaveEdit = () => {
    if (!editingItem) return;
    const updates: Partial<ScheduleItem> = {
      time: editTime.trim(),
      task: editTask.trim() || editingItem.task,
      title: editTask.trim() || editingItem.task,
      location: editLocation.trim() || undefined,
      remindOffset: editRemind.trim() || undefined,
    };
    updateSchedule(editingItem.id, updates);
    setEditingItem(null);
    playAudioFeedback('success');
  };

  /** 删除（带二次确认） */
  const handleDelete = (item: ScheduleItem) => {
    deleteSchedule(item.id);
    setConfirmDeleteFor(null);
    setMenuFor(null);
    playAudioFeedback('tap');
  };

  const isToday = selectedDateStr === new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = selectedDateStr === tomorrow.toISOString().slice(0, 10);

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none font-sans overflow-hidden">
      {/* Month Switcher Header */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] active:scale-95 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <h1 className="text-[17px] font-semibold text-[#1D1D1F] tracking-tight">
          {currentYear}年{currentMonth + 1}月
        </h1>

        <button
          onClick={handleNextMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] active:scale-95 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
        {/* Calendar Grid Container (Radius 16px Apple Surface) */}
        <div className="bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] shadow-apple">
          {/* Weekday Row */}
          <div className="grid grid-cols-7 text-center mb-2">
            {weekHeaders.map((w, idx) => (
              <span key={idx} className="text-[13px] font-medium text-[#86868B] py-1">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1.5 text-center">
            {/* Empty slots */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-9" />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const isSelected = selectedDay === dayNum;
              const dayStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(dayNum)}`;
              const hasEvent = schedules.some((s) => s.date === dayStr && s.status !== 'completed');

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => {
                    playAudioFeedback('tap');
                    setSelectedDay(dayNum);
                    setMenuFor(null);
                  }}
                  className={`h-9 w-9 mx-auto rounded-full flex flex-col items-center justify-center text-[15px] font-normal transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-[#007AFF] text-[#FFFFFF] font-semibold shadow-xs'
                      : 'hover:bg-[#F2F2F7] text-[#1D1D1F]'
                  }`}
                >
                  <span className="tabular-nums leading-none">{dayNum}</span>
                  {hasEvent && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#007AFF]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Summary & Day Schedules */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#86868B]">
              {currentMonth + 1}月{selectedDay}日{isToday ? ' · 今天' : isTomorrow ? ' · 明天' : ''} · 日程安排
            </span>
          </div>

          {daySchedules.length > 0 ? (
            daySchedules.map((item) => {
              const completed = item.status === 'completed';
              return (
                <div
                  key={item.id}
                  className={`w-full bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] shadow-apple space-y-1 ${
                    completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* "…" 操作菜单按钮（左侧） */}
                    <div className="relative shrink-0 pt-0.5">
                      <button
                        type="button"
                        title="日程操作"
                        onClick={() => {
                          playAudioFeedback('tap');
                          setMenuFor(menuFor === item.id ? null : item.id);
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1D1D1F] active:scale-95 transition-all cursor-pointer"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {menuFor === item.id && (
                        <>
                          {/* 点击外部关闭 */}
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setMenuFor(null)}
                          />
                          <div className="absolute left-8 top-0 z-30 w-[132px] bg-[#FFFFFF] rounded-[12px] border border-[#E5E5EA] shadow-apple py-1.5">
                            <button
                              type="button"
                              onClick={() => handleMarkCompleted(item)}
                              className="w-full px-3 py-2 text-left text-[14px] text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                            >
                              已完成
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="w-full px-3 py-2 text-left text-[14px] text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                            >
                              修改
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteFor(item.id);
                                setMenuFor(null);
                              }}
                              className="w-full px-3 py-2 text-left text-[14px] text-[#FF3B30] hover:bg-[#FFF1F0] transition-colors cursor-pointer"
                            >
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 日程主体 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[15px] font-bold tabular-nums ${
                            completed ? 'text-[#86868B] line-through' : 'text-[#1D1D1F]'
                          }`}
                        >
                          {item.time}
                        </span>
                        <span
                          className={`text-[16px] font-medium truncate ${
                            completed ? 'text-[#86868B] line-through' : 'text-[#1D1D1F]'
                          }`}
                        >
                          {item.title || item.task}
                        </span>
                        {completed && (
                          <span className="shrink-0 text-[11px] font-medium text-[#34C759] bg-[#34C759]/10 rounded-full px-2 py-0.5">
                            已完成
                          </span>
                        )}
                      </div>
                      {item.location && (
                        <div className="text-[13px] text-[#86868B] pl-0 mt-0.5">
                          {item.location}
                          {item.remindOffset ? ` · ${item.remindOffset}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center bg-[#FFFFFF] rounded-[16px] border border-dashed border-[#D2D2D7] text-[#86868B] text-[13px]">
              当天暂无日程安排
            </div>
          )}
        </div>
      </div>

      {/* 修改日程浮层 */}
      {editingItem && (
        <div
          className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="bg-[#FFFFFF] rounded-[16px] p-5 w-full max-w-[340px] space-y-3 shadow-apple"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-semibold text-[#1D1D1F]">修改日程</h2>
            <div className="space-y-2">
              <input
                type="text"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                placeholder="时间（如 14:00）"
                className="w-full h-[42px] rounded-[12px] bg-[#F2F2F7] px-3 text-[14px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
              <input
                type="text"
                value={editTask}
                onChange={(e) => setEditTask(e.target.value)}
                placeholder="事项（如 拜访徐兴客户）"
                className="w-full h-[42px] rounded-[12px] bg-[#F2F2F7] px-3 text-[14px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="地点"
                className="w-full h-[42px] rounded-[12px] bg-[#F2F2F7] px-3 text-[14px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
              <input
                type="text"
                value={editRemind}
                onChange={(e) => setEditRemind(e.target.value)}
                placeholder="提醒（如 提前30分钟）"
                className="w-full h-[42px] rounded-[12px] bg-[#F2F2F7] px-3 text-[14px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="h-[42px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] text-[14px] font-medium transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="h-[42px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 text-[#FFFFFF] text-[14px] font-semibold transition-all cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除二次确认浮层 */}
      {confirmDeleteFor && (() => {
        const target = schedules.find((s) => s.id === confirmDeleteFor);
        if (!target) return null;
        return (
          <div
            className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6"
            onClick={() => setConfirmDeleteFor(null)}
          >
            <div
              className="bg-[#FFFFFF] rounded-[16px] p-5 w-full max-w-[320px] space-y-3 shadow-apple"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[16px] font-semibold text-[#1D1D1F]">删除日程</h2>
              <p className="text-[13px] text-[#86868B] leading-snug">
                确定删除「{target.time} {target.title || target.task}」吗？此操作不可撤销。
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteFor(null)}
                  className="h-[42px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] text-[14px] font-medium transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(target)}
                  className="h-[42px] rounded-[12px] bg-[#FF3B30] hover:bg-[#FF3B30]/90 active:scale-95 text-[#FFFFFF] text-[14px] font-semibold transition-all cursor-pointer"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Global Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
};
