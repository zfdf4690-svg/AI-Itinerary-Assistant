import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  Bell,
  Trash2,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback, speakText } from '../../utils/audio';

interface MonthCalendarBoardProps {
  onDateChange?: (year: number, month: number, day: number) => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  currentYear: number;
  setCurrentYear: (year: number) => void;
  currentMonth: number;
  setCurrentMonth: (month: number) => void;
}

export const MonthCalendarBoard: React.FC<MonthCalendarBoardProps> = ({
  selectedDay,
  setSelectedDay,
  currentYear,
  setCurrentYear,
  currentMonth,
  setCurrentMonth,
}) => {
  const { schedules, setIsManualAddOpen } = useApp();

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    playAudioFeedback('tap');
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    playAudioFeedback('tap');
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Helper to check schedules on each day
  const getDaySchedules = (dayNum: number) => {
    const formatted = `${currentMonth + 1}月${dayNum}日`;
    return schedules.filter((s) => {
      if (s.dateLabel.includes(formatted)) return true;
      if (currentMonth === 3 && dayNum === 23 && (s.dateLabel.includes('今日') || s.dateLabel.includes('今天') || s.dateLabel.includes('4月23日'))) return true;
      if (currentMonth === 3 && dayNum === 24 && (s.dateLabel.includes('明天') || s.dateLabel.includes('4月24日'))) return true;
      if (currentMonth === 3 && dayNum === 26 && (s.dateLabel.includes('周五') || s.dateLabel.includes('4月26日'))) return true;
      return false;
    });
  };

  return (
    <div className="w-full bg-white rounded-3xl p-4 shadow-xs border border-slate-100 transition-all select-none">
      {/* Month Navigation & Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {currentYear}年 {monthNames[currentMonth]}
            </h3>
            <p className="text-[10px] text-slate-400">
              {currentMonth === 3 && selectedDay === 23 ? '今日为 4月23日' : `已选中 ${currentMonth + 1}月${selectedDay}日`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            title="上个月"
            className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            title="下个月"
            className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              playAudioFeedback('tap');
              setIsManualAddOpen(true);
            }}
            title="新建日程"
            className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ml-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week Day Header */}
      <div className="pt-2">
        <div className="grid grid-cols-7 text-center mb-1">
          {weekDays.map((wd, idx) => (
            <span
              key={idx}
              className={`text-[11px] font-semibold py-1 ${
                idx === 0 || idx === 6 ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {wd}
            </span>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-8" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const isSelected = selectedDay === dayNum;
            const isToday = currentMonth === 3 && dayNum === 23;
            const dayEvents = getDaySchedules(dayNum);
            const hasEvents = dayEvents.length > 0;

            return (
              <button
                key={`day-${dayNum}`}
                type="button"
                onClick={() => {
                  playAudioFeedback('tap');
                  setSelectedDay(dayNum);
                }}
                className={`relative h-8 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/30 scale-105'
                    : isToday
                    ? 'bg-blue-50 text-blue-600 font-bold border border-blue-200'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className="text-xs leading-none tabular-nums">{dayNum}</span>
                <div className="flex items-center gap-0.5 h-1 mt-0.5">
                  {hasEvents && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-blue-500'
                      }`}
                    />
                  )}
                  {dayEvents.length > 2 && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-blue-200' : 'bg-amber-500'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
