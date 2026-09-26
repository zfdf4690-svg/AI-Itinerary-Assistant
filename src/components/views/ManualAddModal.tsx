import React, { useState } from 'react';
import { X, Calendar, MapPin, Clock, Bell, Check, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SchedulePriority } from '../../types';
import { playAudioFeedback } from '../../utils/audio';

export const ManualAddModal: React.FC = () => {
  const { isManualAddOpen, setIsManualAddOpen, addSchedule, dailyReminderConfig } = useApp();

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('15:00');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<SchedulePriority>('medium');
  const [remindOffset, setRemindOffset] = useState('提前30分钟');
  const [accentColor, setAccentColor] = useState<'blue' | 'red' | 'orange' | 'emerald'>('blue');

  if (!isManualAddOpen) return null;

  const handlePriorityChange = (p: SchedulePriority) => {
    setPriority(p);
    // Auto sync suggested remind offset from user's priority preferences
    const pref = dailyReminderConfig.priorityPreferences[p];
    if (pref) {
      setRemindOffset(`提前${pref.offsetMinutes}分钟`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addSchedule({
      time: time || '15:00',
      dateLabel: '4月23日 周二',
      title: title.trim(),
      location: location.trim() || '上海',
      task: title.trim(),
      matters: '常规工作推进',
      remindOffset,
      accentColor,
      priority,
      hasAlarm: dailyReminderConfig.priorityPreferences[priority]?.enabled ?? true,
      status: 'active'
    });

    setIsManualAddOpen(false);
    setTitle('');
    setLocation('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 relative text-slate-800">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setIsManualAddOpen(false);
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-95 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          新建日程安排
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">日程主题 / 任务 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：与李总商讨合作方案"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" /> 日程优先级与提醒规则
              </span>
              <span className="text-[10px] text-blue-600 font-normal">联动提醒偏好</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePriorityChange('high')}
                className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                  priority === 'high'
                    ? 'border-red-500 bg-red-50 text-red-700 font-bold ring-2 ring-red-100'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                高优先
              </button>
              <button
                type="button"
                onClick={() => handlePriorityChange('medium')}
                className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                  priority === 'medium'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold ring-2 ring-amber-100'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                中优先
              </button>
              <button
                type="button"
                onClick={() => handlePriorityChange('low')}
                className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                  priority === 'low'
                    ? 'border-slate-400 bg-slate-100 text-slate-800 font-bold ring-2 ring-slate-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                低优先
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> 开始时间
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-slate-400" /> 提醒设置
              </label>
              <select
                value={remindOffset}
                onChange={(e) => setRemindOffset(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none bg-white"
              >
                <option value="提前10分钟">提前10分钟</option>
                <option value="提前15分钟">提前15分钟</option>
                <option value="提前30分钟">提前30分钟</option>
                <option value="提前1小时">提前1小时</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> 地点
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例如：陆家嘴 · 3号楼会议室"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1.5">时间轴色标</label>
            <div className="flex items-center gap-3">
              {(['blue', 'red', 'orange', 'emerald'] as const).map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === 'blue'
                      ? 'bg-blue-600'
                      : color === 'red'
                      ? 'bg-red-500'
                      : color === 'orange'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  } ${accentColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-70'}`}
                />
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Check className="w-4 h-4" /> 保存并生效
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
