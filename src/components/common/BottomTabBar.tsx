import React from 'react';
import { Home, Calendar as CalendarIcon, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

interface BottomTabBarProps {
  className?: string;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ className = '' }) => {
  const { currentView, setCurrentView } = useApp();

  const isHome = currentView === 'home';
  const isCalendar = currentView === 'calendar';
  const isSettings = currentView === 'settings' || currentView === 'persona_detail';

  return (
    <nav
      aria-label="底部主导航"
      className={`h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/70 px-8 flex items-center justify-around shrink-0 z-30 ${className}`}
    >
      {/* Tab 1: 首页 */}
      <button
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('home');
        }}
        className={`flex flex-col items-center gap-1 transition-colors min-w-[50px] ${
          isHome ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-700 font-medium'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">首页</span>
      </button>

      {/* Tab 2: 日历 */}
      <button
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('calendar');
        }}
        className={`flex flex-col items-center gap-1 transition-colors min-w-[50px] ${
          isCalendar ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-700 font-medium'
        }`}
      >
        <CalendarIcon className="w-5 h-5" />
        <span className="text-[10px]">日历</span>
      </button>

      {/* Tab 3: 我的 */}
      <button
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('settings');
        }}
        className={`flex flex-col items-center gap-1 transition-colors min-w-[50px] ${
          isSettings ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-700 font-medium'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">我的</span>
      </button>
    </nav>
  );
};
