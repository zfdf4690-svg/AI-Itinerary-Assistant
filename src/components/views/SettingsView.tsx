import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Volume2, 
  Users, 
  Bell, 
  Clock, 
  ShieldAlert, 
  Sparkles, 
  Play,
  User
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PERSONAS } from '../../constants/personas';
import { PersonaId, SchedulePriority } from '../../types';
import { playAudioFeedback, speakText } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const SettingsView: React.FC = () => {
  const {
    setCurrentView,
    activePersonaId,
    setActivePersonaId,
    autoVoiceEnabled,
    setAutoVoiceEnabled,
    dailyReminderConfig,
    updateDailyReminderConfig,
    updatePriorityPreference,
    triggerManualReminderTest
  } = useApp();

  const handleSelectPersona = (id: PersonaId) => {
    playAudioFeedback('tap');
    setActivePersonaId(id);
    const target = PERSONAS[id];
    if (autoVoiceEnabled) {
      speakText(`已切换为人格：${target.name}。${target.sampleAudioText}`, {
        pitch: target.speechPitch,
        rate: target.speechRate
      });
    }
  };

  const handleOpenDetail = (id: PersonaId) => {
    setActivePersonaId(id);
    setCurrentView('persona_detail');
  };

  const priorities: { key: SchedulePriority; label: string; desc: string; badgeColor: string }[] = [
    { key: 'high', label: '高优先级日程', desc: '如：客户拜访、高管会议、商务谈判', badgeColor: 'bg-red-50 text-red-600 border-red-200' },
    { key: 'medium', label: '中优先级日程', desc: '如：例会、方案评审、对齐沟通', badgeColor: 'bg-amber-50 text-amber-600 border-amber-200' },
    { key: 'low', label: '低优先级日程', desc: '如：日常聚餐、常规备忘事项', badgeColor: 'bg-slate-100 text-slate-600 border-slate-200' }
  ];

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FC] text-slate-800 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center px-6 pt-2 pb-4 bg-white/60 backdrop-blur-md border-b border-slate-100 z-10">
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setCurrentView('home');
          }}
          title="返回"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-full text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold text-slate-900 ml-1">我的设置</h1>
      </div>

      <div className="flex-1 px-5 py-5 space-y-6">
        {/* Section 1: 每日定时提醒与后台任务 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">每日定时提醒</h2>
                <p className="text-xs text-slate-400 mt-0.5">后台守护与日程定点推送</p>
              </div>
            </div>

            {/* Master Alarm Switch */}
            <button
              onClick={() => {
                updateDailyReminderConfig({
                  dailyAlarmEnabled: !dailyReminderConfig.dailyAlarmEnabled
                });
              }}
              role="switch"
              aria-checked={dailyReminderConfig.dailyAlarmEnabled}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                dailyReminderConfig.dailyAlarmEnabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                  dailyReminderConfig.dailyAlarmEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {dailyReminderConfig.dailyAlarmEnabled && (
            <div className="space-y-3.5 pt-2 border-t border-slate-50 text-xs animate-fadeIn">
              {/* Morning Briefing Time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>每日晨间简报时间</span>
                </div>
                <input
                  type="time"
                  value={dailyReminderConfig.dailyReminderTime}
                  onChange={(e) => updateDailyReminderConfig({ dailyReminderTime: e.target.value })}
                  className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-semibold tabular-nums outline-none"
                />
              </div>

              {/* Evening Review Switch & Time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>晚间复盘金句提醒</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={dailyReminderConfig.eveningReviewTime}
                    onChange={(e) => updateDailyReminderConfig({ eveningReviewTime: e.target.value })}
                    className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-semibold tabular-nums outline-none"
                  />
                  <input
                    type="checkbox"
                    checked={dailyReminderConfig.eveningReviewEnabled}
                    onChange={(e) => updateDailyReminderConfig({ eveningReviewEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Test Notification Trigger */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-400">模拟到点推送：</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => triggerManualReminderTest('high')}
                    className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-medium flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" /> 测试高优
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerManualReminderTest('medium')}
                    className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] font-medium flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" /> 测试中优
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: 日程优先级提醒偏好设置 */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">日程优先级提醒偏好</h2>
              <p className="text-xs text-slate-400 mt-0.5">按重要程度定制提前提醒时长与声线播报</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {priorities.map((item) => {
              const pref = dailyReminderConfig.priorityPreferences[item.key];

              return (
                <div
                  key={item.key}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{item.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                          {item.key.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>

                    <input
                      type="checkbox"
                      checked={pref.enabled}
                      onChange={(e) => updatePriorityPreference(item.key, { enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {pref.enabled && (
                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span>提前提醒：</span>
                        <select
                          value={pref.offsetMinutes}
                          onChange={(e) => updatePriorityPreference(item.key, { offsetMinutes: Number(e.target.value) })}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium outline-none"
                        >
                          <option value={10}>提前 10 分钟</option>
                          <option value={15}>提前 15 分钟</option>
                          <option value={30}>提前 30 分钟</option>
                          <option value={60}>提前 1 小时</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={pref.soundAlert}
                          onChange={(e) => updatePriorityPreference(item.key, { soundAlert: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600"
                        />
                        <span className="text-[11px]">声线语音播报</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: 语音反馈 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">语音反馈</h2>
              <p className="text-xs text-slate-400 mt-0.5">AI 回复时的语音播报设置</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <span className="text-xs font-semibold text-slate-800">自动语音播报</span>
            {/* iOS style toggle */}
            <button
              onClick={() => {
                playAudioFeedback('tap');
                setAutoVoiceEnabled(!autoVoiceEnabled);
              }}
              role="switch"
              aria-checked={autoVoiceEnabled}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                autoVoiceEnabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                  autoVoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section 4: 选择 AI 人格 */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">选择 AI 人格</h2>
              <p className="text-xs text-slate-400 mt-0.5">不同人格有不同的语音和风格</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {(Object.keys(PERSONAS) as PersonaId[]).map((id) => {
              const persona = PERSONAS[id];
              const isSelected = activePersonaId === id;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectPersona(id)}
                  className={`w-full bg-white rounded-2xl p-4 flex items-center justify-between border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover shrink-0 shadow-2xs border border-slate-100"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {persona.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {persona.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Right Action */}
                  <div className="flex items-center gap-1">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Bottom Navigation Bar */}
      <BottomTabBar />
    </div>
  );
};
