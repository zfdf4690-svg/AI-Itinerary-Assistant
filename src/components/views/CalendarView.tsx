import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const CalendarView: React.FC = () => {
  const { schedules } = useApp();

  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 8 is September
  const [selectedDay, setSelectedDay] = useState<number>(29);

  const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];

  // Days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // First day of month (0 Sunday, 1 Monday, ...)
  const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Convert to Monday-first (0 Monday ... 6 Sunday)
  const firstDayIndex = (rawFirstDay + 6) % 7;

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

  // Find schedules for the selected day
  const daySchedules = schedules.filter((s) => {
    if (selectedDay === 29) {
      return s.dateLabel.includes('明天') || s.dateLabel.includes('29日') || s.task.includes('张总');
    }
    if (selectedDay === 28) {
      return s.dateLabel.includes('今天') || s.dateLabel.includes('今日') || s.dateLabel.includes('28日');
    }
    return false;
  });

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
              const hasEvent = dayNum === 28 || dayNum === 29;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => {
                    playAudioFeedback('tap');
                    setSelectedDay(dayNum);
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
              {currentMonth + 1}月{selectedDay}日 · {selectedDay === 29 ? '明天' : selectedDay === 28 ? '今天' : '日程安排'}
            </span>
          </div>

          {daySchedules.length > 0 ? (
            daySchedules.map((item) => (
              <div
                key={item.id}
                className="w-full bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] shadow-apple space-y-1"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-bold text-[#1D1D1F] tabular-nums">
                    {item.time}
                  </span>
                  <span className="text-[16px] font-medium text-[#1D1D1F]">
                    {item.title || item.task}
                  </span>
                </div>
                {item.location && (
                  <div className="text-[13px] text-[#86868B] pl-12">
                    {item.location}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-8 text-center bg-[#FFFFFF] rounded-[16px] border border-dashed border-[#D2D2D7] text-[#86868B] text-[13px]">
              当天暂无日程安排
            </div>
          )}
        </div>
      </div>

      {/* Global Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
};
