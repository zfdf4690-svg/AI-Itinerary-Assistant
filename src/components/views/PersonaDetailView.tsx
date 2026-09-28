import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PERSONAS } from '../../constants/personas';
import { PersonaId } from '../../types';
import { playAudioFeedback, speakText, stopSpeaking, isSpeaking } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const PersonaDetailView: React.FC = () => {
  const { activePersonaId, setActivePersonaId } = useApp();
  const [playingId, setPlayingId] = useState<PersonaId | null>(null);

  const personaList = (Object.keys(PERSONAS) as PersonaId[]).map((id) => PERSONAS[id]);

  const handleAudition = (id: PersonaId, text: string, pitch: number, rate: number) => {
    playAudioFeedback('tap');
    if (playingId === id && isSpeaking()) {
      stopSpeaking();
      setPlayingId(null);
      return;
    }

    setPlayingId(id);
    speakText(text, {
      pitch,
      rate,
      personaId: id,
      onEnd: () => setPlayingId(null)
    });
  };

  const handleSelect = (id: PersonaId) => {
    playAudioFeedback('tap');
    setActivePersonaId(id);
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none font-sans overflow-hidden">
      {/* Top Header */}
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-[20px] font-bold text-[#1D1D1F] tracking-tight">
          人格与声音
        </h1>
        <p className="text-[13px] text-[#86868B] mt-0.5">
          个性化表达与播报音色，不影响日程核心逻辑
        </p>
      </div>

      {/* Main Lightweight Card List (Page 08 Persona spec) */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
        {personaList.map((p) => {
          const isSelected = activePersonaId === p.id;
          const isAudioPlaying = playingId === p.id;

          return (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`w-full bg-[#FFFFFF] rounded-[16px] p-5 border transition-all cursor-pointer shadow-apple space-y-3 ${
                isSelected ? 'border-[#007AFF] ring-1 ring-[#007AFF]/20' : 'border-[#E5E5EA] hover:border-[#D2D2D7]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
                    {p.name}
                  </h2>
                  <p className="text-[13px] text-[#86868B] mt-0.5">
                    {p.tagline}
                  </p>
                </div>

                {/* Audio Sample Audition Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAudition(p.id, p.sampleAudioText, p.speechPitch, p.speechRate);
                  }}
                  className={`h-8 px-3 rounded-[8px] text-[13px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isAudioPlaying
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F]'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isAudioPlaying ? '播放中' : '播放示例'}</span>
                </button>
              </div>

              {/* Status Radio */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#F2F2F7]">
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-[#007AFF]' : 'border-[#D2D2D7]'
                  }`}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-[#007AFF]" />}
                </span>
                <span className={`text-[13px] ${isSelected ? 'text-[#007AFF] font-medium' : 'text-[#86868B]'}`}>
                  {isSelected ? '当前使用' : '点击选择'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
};
