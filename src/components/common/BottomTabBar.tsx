import React from 'react';
import { Home, Calendar as CalendarIcon, Users, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

interface BottomTabBarProps {
  className?: string;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ className = '' }) => {
  const { currentView, setCurrentView } = useApp();

  const isHome = currentView === 'home';
  const isCalendar = currentView === 'calendar';
  const isPersona = currentView === 'persona_detail';
  const isSettings = currentView === 'settings';

  return (
    <nav
      aria-label="底部主导航"
      className={`h-[56px] bg-[#FFFFFF]/90 backdrop-blur-md border-t border-[#D2D2D7]/50 px-6 flex items-center justify-around shrink-0 z-30 font-sans ${className}`}
    >
      {/* 1. Home */}
      <button
        type="button"
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('home');
        }}
        className={`flex flex-col items-center gap-0.5 min-w-[48px] py-1 cursor-pointer transition-colors ${
          isHome ? 'text-[#007AFF] font-semibold' : 'text-[#86868B] hover:text-[#1D1D1F]'
        }`}
      >
        <Home className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] leading-tight">首页</span>
      </button>

      {/* 2. Calendar */}
      <button
        type="button"
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('calendar');
        }}
        className={`flex flex-col items-center gap-0.5 min-w-[48px] py-1 cursor-pointer transition-colors ${
          isCalendar ? 'text-[#007AFF] font-semibold' : 'text-[#86868B] hover:text-[#1D1D1F]'
        }`}
      >
        <CalendarIcon className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] leading-tight">日历</span>
      </button>

      {/* 3. Persona */}
      <button
        type="button"
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('persona_detail');
        }}
        className={`flex flex-col items-center gap-0.5 min-w-[48px] py-1 cursor-pointer transition-colors ${
          isPersona ? 'text-[#007AFF] font-semibold' : 'text-[#86868B] hover:text-[#1D1D1F]'
        }`}
      >
        <Users className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] leading-tight">声音人设</span>
      </button>

      {/* 4. Settings */}
      <button
        type="button"
        onClick={() => {
          playAudioFeedback('tap');
          setCurrentView('settings');
        }}
        className={`flex flex-col items-center gap-0.5 min-w-[48px] py-1 cursor-pointer transition-colors ${
          isSettings ? 'text-[#007AFF] font-semibold' : 'text-[#86868B] hover:text-[#1D1D1F]'
        }`}
      >
        <SettingsIcon className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] leading-tight">设置</span>
      </button>
    </nav>
  );
};
