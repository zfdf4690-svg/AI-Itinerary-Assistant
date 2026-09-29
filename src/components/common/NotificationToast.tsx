import React from 'react';
import { Bell, Sparkles, X, CheckCircle } from 'lucide-react';
import { SchedulePriority } from '../../types';

export interface BackgroundNotificationToast {
  id: string;
  type: 'daily_briefing' | 'schedule_alarm' | 'evening_review';
  title: string;
  message: string;
  timeStr: string;
  priority?: SchedulePriority;
  personaName: string;
  /** 关联日程 id（schedule_alarm）：点击"查看详情"跳转日历并打开该日程详情卡片 */
  scheduleId?: string;
}

interface NotificationToastProps {
  notification: BackgroundNotificationToast | null;
  onDismiss: () => void;
  onViewSchedule?: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onViewSchedule
}) => {
  if (!notification) return null;

  const getPriorityBadge = (p?: SchedulePriority) => {
    switch (p) {
      case 'high':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">高优先</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-600">中优先</span>;
      case 'low':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">低优先</span>;
      default:
        return null;
    }
  };

  return (
    <div className="absolute top-12 left-4 right-4 z-50 animate-fadeIn select-none pointer-events-auto">
      <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-slate-700/80 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
          {notification.type === 'evening_review' ? (
            <Sparkles className="w-4 h-4 text-purple-400" />
          ) : (
            <Bell className="w-4 h-4 animate-bounce" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-100">{notification.title}</span>
              {getPriorityBadge(notification.priority)}
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">{notification.timeStr}</span>
          </div>

          <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          <div className="mt-2 flex items-center gap-2">
            {onViewSchedule && (
              <button
                type="button"
                onClick={onViewSchedule}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                查看详情
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
