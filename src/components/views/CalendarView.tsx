import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { ScheduleItem, SchedulePriority } from '../../types';
import { BottomTabBar } from '../common/BottomTabBar';
import { WheelPicker } from '../common/WheelPicker';

export const CalendarView: React.FC = () => {
  const { schedules, updateSchedule, deleteSchedule, reminderFocusId, consumeReminderFocus } = useApp();

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
  /** PHASE 4-F · 提醒滚轮：以分钟数为取值（0 = 不提醒） */
  const [editRemindMin, setEditRemindMin] = useState('0');
  /** 删除二次确认的日程 id */
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null);
  /** PHASE 4-G：详情卡片浮层（提醒弹窗"查看详情"进入） */
  const [detailFor, setDetailFor] = useState<ScheduleItem | null>(null);

  /**
   * PHASE 4-G：日程卡片左侧优先级色条（高=红 / 中=橙 / 低=绿 / 默认=蓝 / 已完成=灰）。
   * 仅视觉标识，不改变业务逻辑。
   */
  const getPriorityBorderClass = (p?: SchedulePriority, completed?: boolean): string => {
    if (completed) return 'border-l-[#C7C7CC]';
    switch (p) {
      case 'high': return 'border-l-[#FF3B30]';
      case 'medium': return 'border-l-[#FF9F0A]';
      case 'low': return 'border-l-[#34C759]';
      default: return 'border-l-[#007AFF]';
    }
  };

  /** 详情浮层中的优先级徽章 */
  const getPriorityBadge = (p?: SchedulePriority) => {
    switch (p) {
      case 'high':
        return <span className="shrink-0 text-[11px] font-medium text-[#FF3B30] bg-[#FF3B30]/10 rounded-full px-2 py-0.5">高优先</span>;
      case 'medium':
        return <span className="shrink-0 text-[11px] font-medium text-[#FF9F0A] bg-[#FF9F0A]/10 rounded-full px-2 py-0.5">中优先</span>;
      case 'low':
        return <span className="shrink-0 text-[11px] font-medium text-[#34C759] bg-[#34C759]/10 rounded-full px-2 py-0.5">低优先</span>;
      default:
        return null;
    }
  };

  /**
   * PHASE 4-G：提醒弹窗"查看详情"→ 定位到该日程日期并打开详情卡片。
   * 消费焦点 id（consumeReminderFocus），避免切页后重复弹窗。
   */
  useEffect(() => {
    const id = reminderFocusId;
    if (!id) return;
    const target = schedules.find((s) => s.id === id);
    consumeReminderFocus();
    if (!target) return;
    const parts = (target.date || '').split('-').map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      setCurrentYear(parts[0]);
      setCurrentMonth(parts[1] - 1);
      setSelectedDay(parts[2]);
    }
    setMenuFor(null);
    setDetailFor(target);
  }, [reminderFocusId, consumeReminderFocus, schedules]);

  /**
   * PHASE 4-F · Bug 2：时间下拉选项（00:00–23:45，每 15 分钟，共 96 项，程序生成）。
   * 编辑浮层只允许从固定时间窗口选择，杜绝自由文本乱填。
   */
  const TIME_OPTIONS: string[] = (() => {
    const opts: string[] = [];
    for (let m = 0; m < 24 * 60; m += 15) {
      opts.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    return opts;
  })();

  /**
   * PHASE 4-F · 提醒滚轮选项（value = 提前分钟数，0 = 不提醒）。
   * 与后端字段一致：remindOffset 文本 + remindOffsetMinutes 数值。
   */
  const REMIND_OPTIONS: { value: string; label: string; offset: number }[] = [
    { value: '0', label: '不提醒', offset: 0 },
    { value: '5', label: '提前5分钟', offset: 5 },
    { value: '10', label: '提前10分钟', offset: 10 },
    { value: '15', label: '提前15分钟', offset: 15 },
    { value: '30', label: '提前30分钟', offset: 30 },
    { value: '45', label: '提前45分钟', offset: 45 },
    { value: '60', label: '提前1小时', offset: 60 },
    { value: '120', label: '提前2小时', offset: 120 },
    { value: '1440', label: '提前1天', offset: 1440 },
  ];

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
    // 提醒滚轮：以分钟数为取值；无提醒（hasAlarm=false 或 offset 缺失）→ 0（不提醒）
    setEditRemindMin(String(
      item.hasAlarm === false || !item.remindOffsetMinutes
        ? 0
        : item.remindOffsetMinutes,
    ));
    setMenuFor(null);
  };

  /** 保存编辑 → PATCH 后端并更新本地（时间/提醒均来自滚轮选择） */
  const handleSaveEdit = () => {
    if (!editingItem) return;
    const remindMin = Number(editRemindMin) || 0;
    const remindOpt = REMIND_OPTIONS.find((o) => o.value === String(remindMin));
    const updates: Partial<ScheduleItem> = {
      time: editTime.trim(),
      task: editTask.trim() || editingItem.task,
      title: editTask.trim() || editingItem.task,
      location: editLocation.trim() || undefined,
      remindOffset: remindMin > 0 && remindOpt ? remindOpt.label : undefined,
      remindOffsetMinutes: remindMin,
      hasAlarm: remindMin > 0,
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
                  className={`w-full bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] border-l-4 shadow-apple space-y-1 ${
                    completed ? `opacity-60 ${getPriorityBorderClass(item.priority, true)}` : getPriorityBorderClass(item.priority)
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

      {/* PHASE 4-G · 详情卡片浮层：提醒弹窗"查看详情"进入；只读展示 + 修改入口 */}
      {detailFor && (() => {
        const it = schedules.find((s) => s.id === detailFor.id) || detailFor;
        const completed = it.status === 'completed';
        return (
          <div
            className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6"
            onClick={() => setDetailFor(null)}
          >
            <div
              className="bg-[#FFFFFF] rounded-[16px] p-5 w-full max-w-[340px] space-y-3 shadow-apple"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-semibold text-[#1D1D1F] truncate">
                  {it.title || it.task || '日程详情'}
                </h2>
                {completed ? (
                  <span className="shrink-0 text-[11px] font-medium text-[#34C759] bg-[#34C759]/10 rounded-full px-2 py-0.5">
                    已完成
                  </span>
                ) : (
                  getPriorityBadge(it.priority)
                )}
              </div>
              <div className="space-y-1.5 text-[13px]">
                {it.date && (
                  <div className="flex gap-2"><span className="w-[36px] shrink-0 text-[#86868B]">日期</span><span className="text-[#1D1D1F]">{it.date}</span></div>
                )}
                <div className="flex gap-2"><span className="w-[36px] shrink-0 text-[#86868B]">时间</span><span className="text-[#1D1D1F] tabular-nums">{it.time || '—'}</span></div>
                {it.location && (
                  <div className="flex gap-2"><span className="w-[36px] shrink-0 text-[#86868B]">地点</span><span className="text-[#1D1D1F]">{it.location}</span></div>
                )}
                {it.matters && (
                  <div className="flex gap-2"><span className="w-[36px] shrink-0 text-[#86868B]">事项</span><span className="text-[#1D1D1F]">{it.matters}</span></div>
                )}
                {it.remindOffset && (
                  <div className="flex gap-2"><span className="w-[36px] shrink-0 text-[#86868B]">提醒</span><span className="text-[#1D1D1F]">{it.remindOffset}</span></div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDetailFor(null)}
                  className="h-[42px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] text-[14px] font-medium transition-all cursor-pointer"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailFor(null);
                    handleOpenEdit(it);
                  }}
                  className="h-[42px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 text-[#FFFFFF] text-[14px] font-semibold transition-all cursor-pointer"
                >
                  修改
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
              {/* PHASE 4-F · 时间滚轮：15 分钟粒度；若原日程时间不在选项内（历史非整点），并入当前值可保存 */}
              <div>
                <div className="text-[12px] font-medium text-[#86868B] mb-1">时间</div>
                <WheelPicker
                  items={
                    TIME_OPTIONS.includes(editTime)
                      ? TIME_OPTIONS
                      : [editTime, ...TIME_OPTIONS]
                  }
                  values={
                    TIME_OPTIONS.includes(editTime)
                      ? TIME_OPTIONS
                      : [editTime, ...TIME_OPTIONS]
                  }
                  value={editTime}
                  onChange={setEditTime}
                  className="w-full bg-[#FFFFFF] rounded-[12px] border border-[#E5E5EA]"
                />
              </div>
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
              {/* PHASE 4-F · 提醒滚轮：提前分钟数（不提醒/5~1440 分钟）；当前值不在选项内并入 */}
              <div>
                <div className="text-[12px] font-medium text-[#86868B] mb-1">提醒</div>
                <WheelPicker
                  items={(() => {
                    const base = REMIND_OPTIONS.map((o) => o.label);
                    return REMIND_OPTIONS.some((o) => o.value === editRemindMin)
                      ? base
                      : [`提前${editRemindMin}分钟`, ...base];
                  })()}
                  values={(() => {
                    const base = REMIND_OPTIONS.map((o) => o.value);
                    return REMIND_OPTIONS.some((o) => o.value === editRemindMin)
                      ? base
                      : [editRemindMin, ...base];
                  })()}
                  value={editRemindMin}
                  onChange={(v) => {
                    setEditRemindMin(v);
                    const opt = REMIND_OPTIONS.find((o) => o.value === v);
                    setEditRemind(opt && Number(v) > 0 ? opt.label : '');
                  }}
                  className="w-full bg-[#FFFFFF] rounded-[12px] border border-[#E5E5EA]"
                />
              </div>
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
