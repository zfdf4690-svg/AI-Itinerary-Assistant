import React, { useState } from 'react';
import { Plus, Bell, Trash2, CheckCircle2, Clock, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback, speakText } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';
import { MonthCalendarBoard } from '../common/MonthCalendarBoard';

export const CalendarView: React.FC = () => {
  const {
    schedules,
    deleteSchedule,
    updateSchedule,
    setIsManualAddOpen,
    activePersona,
    setIsEveningReviewOpen
  } = useApp();

  // Calendar Date State: 2026年 4月(index 3) 23日
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(3);
  const [selectedDay, setSelectedDay] = useState<number>(23);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getAccentBarColor = (color: string) => {
    switch (color) {
      case 'red':
        return 'border-l-red-500 text-red-500';
      case 'orange':
        return 'border-l-amber-500 text-amber-500';
      case 'emerald':
        return 'border-l-emerald-500 text-emerald-500';
      default:
        return 'border-l-blue-600 text-blue-600';
    }
  };

  const getDotBg = (color: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-500';
      case 'orange':
        return 'bg-amber-500';
      case 'emerald':
        return 'bg-emerald-500';
      default:
        return 'bg-blue-600';
    }
  };

  const handleToggleComplete = (id: string, currentStatus: string) => {
    playAudioFeedback('tap');
    const nextStatus = currentStatus === 'completed' ? 'active' : 'completed';
    updateSchedule(id, { status: nextStatus });
  };

  const handleAuditionReminder = (title: string, time: string) => {
    playAudioFeedback('tap');
    speakText(activePersona.reminderTemplate(title, 10), {
      pitch: activePersona.speechPitch,
      rate: activePersona.speechRate
    });
  };

  // Filter schedules matching the selected date
  const filteredSchedules = schedules.filter((s) => {
    const formatted = `${currentMonth + 1}月${selectedDay}日`;
    if (s.dateLabel.includes(formatted)) return true;
    if (currentMonth === 3 && selectedDay === 23 && (s.dateLabel.includes('今日') || s.dateLabel.includes('今天') || s.dateLabel.includes('4月23日'))) return true;
    if (currentMonth === 3 && selectedDay === 24 && (s.dateLabel.includes('明天') || s.dateLabel.includes('4月24日'))) return true;
    if (currentMonth === 3 && selectedDay === 26 && (s.dateLabel.includes('周五') || s.dateLabel.includes('4月26日'))) return true;
    return false;
  });

  // Calculate day of week
  const selectedDateObj = new Date(currentYear, currentMonth, selectedDay);
  const weekDayStr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][selectedDateObj.getDay()];

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FC] text-slate-800 select-none overflow-hidden">
      {/* Top Header */}
      <div className="px-6 pt-3 pb-3 bg-white/70 backdrop-blur-md border-b border-slate-100 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">日历日程看板</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
              {currentMonth + 1}月{selectedDay}日 {weekDayStr}
            </span>
          </div>

          <button
            onClick={() => {
              playAudioFeedback('tap');
              setIsManualAddOpen(true);
            }}
            title="添加新日程"
            className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-xs font-medium text-slate-400">
            {filteredSchedules.length > 0 ? `该日共 ${filteredSchedules.length} 项行程待办` : '点击日历中日期查看各天安排'}
          </p>
          <button
            onClick={() => {
              playAudioFeedback('tap');
              setIsEveningReviewOpen(true);
            }}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
          >
            晚间复盘 & 金句 →
          </button>
        </div>
      </div>

      {/* Main Scrollable Content: Month Board + Schedule List */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {/* 1. Month Calendar Board at Top of Calendar Page */}
        <MonthCalendarBoard
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          currentYear={currentYear}
          setCurrentYear={setCurrentYear}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
        />

        {/* 2. Detailed Schedule Cards for the selected day */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-700">
              {currentMonth + 1}月{selectedDay}日 详细安排
            </h3>
            <span className="text-[11px] text-slate-400">
              共 {filteredSchedules.length} 项
            </span>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl bg-white border border-dashed border-slate-200">
              <Clock className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-500">{currentMonth + 1}月{selectedDay}日 暂无待办日程</p>
              <p className="text-[11px] text-slate-400 mt-1">点击右上方“+”号或通过语音快速创建</p>
            </div>
          ) : (
            filteredSchedules.map((item) => {
              const isCompleted = item.status === 'completed';
              const isSelected = selectedId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(isSelected ? null : item.id)}
                  className={`w-full bg-white rounded-2xl p-3.5 shadow-xs border transition-all cursor-pointer ${
                    isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200'
                  } ${isCompleted ? 'opacity-60 bg-slate-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="pt-1 flex items-center justify-center">
                        <span className={`w-2 h-2 rounded-full ${getDotBg(item.accentColor)} shrink-0`} />
                      </div>

                      <div className="pt-0.5">
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">
                          {item.time}
                        </span>
                      </div>

                      <div className={`h-9 w-0.5 rounded-full ${getDotBg(item.accentColor)} mx-1 shrink-0`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-bold text-slate-900 truncate ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                            {item.title}
                          </h3>
                          {item.priority === 'high' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-red-100 text-red-600 shrink-0">
                              高优
                            </span>
                          )}
                          {item.priority === 'medium' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-amber-100 text-amber-600 shrink-0">
                              中优
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {item.location}
                        </p>
                      </div>
                    </div>

                    {item.hasAlarm && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAuditionReminder(item.title, item.time);
                        }}
                        title="试听人设提醒音"
                        className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 hover:bg-blue-100 transition-colors ml-2 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs animate-fadeIn">
                      <span className="text-slate-400">提醒：{item.remindOffset}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(item.id, item.status);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isCompleted ? '标为未完成' : '标为已完成'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSchedule(item.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </div>
  );
};
