import React from 'react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const SettingsView: React.FC = () => {
  const {
    autoVoiceEnabled,
    setAutoVoiceEnabled,
    dailyReminderConfig,
    updateDailyReminderConfig
  } = useApp();

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none font-sans overflow-hidden">
      {/* Top Header */}
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-[20px] font-bold text-[#1D1D1F] tracking-tight">
          系统设置
        </h1>
      </div>

      {/* Main Settings Group List (Page 09 Apple Settings) */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5">
        {/* Group 1: 通用 */}
        <div className="space-y-1.5">
          <span className="text-[12px] font-semibold text-[#86868B] px-1 uppercase tracking-wider">
            通用
          </span>
          <div className="bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] shadow-apple flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium text-[#1D1D1F]">
                自动播放 AI 语音
              </div>
              <div className="text-[12px] text-[#86868B] mt-0.5">
                AI 回复时是否自动朗读播报
              </div>
            </div>

            {/* Apple style toggle */}
            <button
              onClick={() => {
                playAudioFeedback('tap');
                setAutoVoiceEnabled(!autoVoiceEnabled);
              }}
              role="switch"
              aria-checked={autoVoiceEnabled}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                autoVoiceEnabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  autoVoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Group 2: 语音 */}
        <div className="space-y-1.5">
          <span className="text-[12px] font-semibold text-[#86868B] px-1 uppercase tracking-wider">
            语音
          </span>
          <div className="bg-[#FFFFFF] rounded-[16px] divide-y divide-[#F2F2F7] border border-[#E5E5EA] shadow-apple">
            <div className="p-4 flex items-center justify-between text-[15px]">
              <span className="text-[#1D1D1F]">输入语言</span>
              <span className="text-[#86868B]">中文（普通话）</span>
            </div>
            <div className="p-4 flex items-center justify-between text-[15px]">
              <span className="text-[#1D1D1F]">输出声音</span>
              <span className="text-[#86868B]">自然拟真</span>
            </div>
          </div>
        </div>

        {/* Group 3: 提醒 */}
        <div className="space-y-1.5">
          <span className="text-[12px] font-semibold text-[#86868B] px-1 uppercase tracking-wider">
            提醒
          </span>
          <div className="bg-[#FFFFFF] rounded-[16px] divide-y divide-[#F2F2F7] border border-[#E5E5EA] shadow-apple">
            <div className="p-4 flex items-center justify-between text-[15px]">
              <div>
                <span className="text-[#1D1D1F] block">默认提醒时间</span>
                <span className="text-[12px] text-[#86868B]">日程创建时的预设提醒策略</span>
              </div>
              <span className="text-[#007AFF] font-medium text-[14px]">提前 30 分钟</span>
            </div>
          </div>
        </div>

        {/* Group 4: AI */}
        <div className="space-y-1.5">
          <span className="text-[12px] font-semibold text-[#86868B] px-1 uppercase tracking-wider">
            AI
          </span>
          <div className="bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] shadow-apple flex items-center justify-between text-[15px]">
            <span className="text-[#1D1D1F]">AI 服务状态</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" />
              <span className="text-[13px] text-[#86868B]">服务运行正常</span>
            </div>
          </div>
        </div>

        {/* Group 5: 关于 */}
        <div className="space-y-1.5">
          <span className="text-[12px] font-semibold text-[#86868B] px-1 uppercase tracking-wider">
            关于
          </span>
          <div className="bg-[#FFFFFF] rounded-[16px] p-4 border border-[#E5E5EA] shadow-apple flex items-center justify-between text-[15px]">
            <span className="text-[#1D1D1F]">版本</span>
            <span className="text-[#86868B] font-mono text-[13px]">1.0.0 (Apple UI V1)</span>
          </div>
        </div>
      </div>

      {/* Global Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
};
