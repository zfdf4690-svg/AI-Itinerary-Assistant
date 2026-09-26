import React from 'react';
import { ChevronLeft, Check, Calendar, MapPin, ClipboardList, FileText, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const SuccessView: React.FC = () => {
  const { setCurrentView, confirmedItem, currentDraft, activePersona } = useApp();

  const item = confirmedItem || currentDraft || {
    time: '15:00',
    dateLabel: '明天',
    title: '与张总开会',
    location: '陆家嘴',
    task: '与张总开会',
    matters: '讨论二期项目',
    remindOffset: '提前30分钟'
  };

  // Calculate reminder time preview
  const getReminderTimeText = () => {
    if (item.time === '15:00' && item.remindOffset?.includes('30')) {
      return '14:30';
    }
    if (item.time === '16:00' && item.remindOffset?.includes('30')) {
      return '15:30';
    }
    return '日程开始前 30分钟';
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FC] text-slate-800 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-3 z-20">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('calendar');
          }}
          title="返回"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-full text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main Success Content */}
      <div className="flex-1 flex flex-col items-center px-6 pt-2 pb-6 text-center">
        {/* Glowing Blue Checkmark */}
        <div className="relative mb-5">
          <div className="absolute -inset-2 bg-blue-500/25 rounded-full blur-xl animate-pulse" />
          <div className="relative w-18 h-18 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Check className="w-9 h-9 stroke-[3]" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight">已创建日程</h1>
        <p className="mt-1 text-xs text-slate-500">
          我会在 <span className="font-semibold text-blue-600">{getReminderTimeText()}</span> 提前提醒你
        </p>

        {/* Schedule Summary Card */}
        <div className="w-full mt-7 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm text-left space-y-4">
          <div className="space-y-1 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
              <Calendar className="w-4 h-4" />
              <span>{item.dateLabel || '明天'} {item.time || '15:00'}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 pt-0.5">
              {item.title || '与张总开会'}
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <MapPin className="w-3.5 h-3.5" />
                <span>地点</span>
              </div>
              <span className="font-semibold text-slate-800">{item.location || '陆家嘴'}</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <ClipboardList className="w-3.5 h-3.5" />
                <span>任务</span>
              </div>
              <span className="font-semibold text-slate-800">{item.task || '与张总开会'}</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <FileText className="w-3.5 h-3.5" />
                <span>事项</span>
              </div>
              <span className="font-semibold text-slate-800">{item.matters || '讨论二期项目'}</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <Bell className="w-3.5 h-3.5" />
                <span>提醒</span>
              </div>
              <span className="font-semibold text-slate-800">{item.remindOffset || '提前30分钟'}</span>
            </div>
          </div>
        </div>

        {/* Persona quote reminder */}
        <div className="mt-4 px-4 py-2.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 text-center leading-relaxed">
          <span className="font-semibold">{activePersona.name}：</span>
          “{activePersona.confirmReplyText}”
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-6 pb-4 pt-2">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('calendar');
          }}
          className="w-full h-12 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-105 active:scale-98 text-white text-sm font-semibold shadow-md shadow-blue-500/25 transition-all flex items-center justify-center"
        >
          查看日历
        </button>
      </div>

      {/* Global Bottom Navigation Bar */}
      <BottomTabBar />
    </div>
  );
};
