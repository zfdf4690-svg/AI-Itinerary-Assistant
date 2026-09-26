import React, { useState } from 'react';
import { ChevronLeft, Play, Pause, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PERSONAS } from '../../constants/personas';
import { PersonaId } from '../../types';
import { playAudioFeedback, speakText, stopSpeaking, isSpeaking } from '../../utils/audio';
import { BottomTabBar } from '../common/BottomTabBar';

export const PersonaDetailView: React.FC = () => {
  const { setCurrentView, activePersonaId, setActivePersonaId } = useApp();
  const [previewId, setPreviewId] = useState<PersonaId>(activePersonaId);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentPersona = PERSONAS[previewId];
  const isCurrentActive = activePersonaId === previewId;

  const handleAudition = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    playAudioFeedback('tap');
    setIsPlaying(true);
    speakText(currentPersona.sampleAudioText, {
      pitch: currentPersona.speechPitch,
      rate: currentPersona.speechRate,
      personaId: previewId,
      onEnd: () => setIsPlaying(false)
    });
  };

  const handleSelectPersona = (id: PersonaId) => {
    playAudioFeedback('tap');
    setPreviewId(id);
    setActivePersonaId(id);
    stopSpeaking();
    setIsPlaying(false);
  };

  return (
    <div className="relative flex flex-col h-full bg-[#FAF7F9] text-slate-800 select-none overflow-y-auto">
      {/* Top Floating Back Button */}
      <div className="absolute top-3 left-4 z-30">
        <button
          onClick={() => {
            stopSpeaking();
            playAudioFeedback('tap');
            setCurrentView('settings');
          }}
          title="返回"
          className="w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-white/60 shadow-xs flex items-center justify-center text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Hero Big Portrait Image */}
      <div className="relative w-full h-[320px] bg-gradient-to-b from-pink-100/60 via-purple-50/50 to-[#FAF7F9] flex items-center justify-center overflow-hidden">
        <img
          src={currentPersona.avatar}
          alt={currentPersona.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-top transition-all duration-300 transform scale-105"
        />
        {/* Soft gradient scrim towards bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F9] via-transparent to-black/10" />
      </div>

      {/* Main Persona Information Card (Overlapping portrait) */}
      <div className="relative -mt-10 px-5 pb-6 flex-1 flex flex-col justify-between">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          {/* Header Title + Current Badge */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {currentPersona.name}
            </h1>
            {isCurrentActive ? (
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold">
                当前使用
              </span>
            ) : (
              <button
                onClick={() => handleSelectPersona(previewId)}
                className="px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 active:scale-95 transition-all"
              >
                设为当前人设
              </button>
            )}
          </div>

          {/* Slogan */}
          <p className="text-xs text-slate-500 font-normal">
            {currentPersona.description}
          </p>

          {/* Persona Traits Tags */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {currentPersona.traits.map((trait, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-full bg-pink-50 border border-pink-100/80 text-[11px] font-medium text-pink-700 flex items-center gap-1"
              >
                <span>✨</span>
                <span>{trait}</span>
              </span>
            ))}
          </div>

          {/* Play Sample Voice Button */}
          <div className="pt-2">
            <button
              onClick={handleAudition}
              className="w-full h-11 rounded-full bg-[#FFF1F2] hover:bg-[#FFE4E6] active:scale-98 text-pink-700 text-xs font-semibold border border-pink-200/60 transition-all flex items-center justify-center gap-2 shadow-2xs"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-pink-600 text-pink-600" />
                  <span>暂停试听</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-pink-600 text-pink-600" />
                  <span>试听语音 ({currentPersona.voiceStyle.split('·')[0]})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom 3-Card Persona Selector */}
        <div className="mt-5 space-y-2">
          <p className="text-[11px] font-medium text-slate-400 px-1">选择陪伴人设：</p>
          <div className="grid grid-cols-3 gap-2.5">
            {(Object.keys(PERSONAS) as PersonaId[]).map((id) => {
              const p = PERSONAS[id];
              const isSelected = previewId === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    setPreviewId(id);
                    setActivePersonaId(id);
                    playAudioFeedback('tap');
                  }}
                  className={`relative rounded-2xl p-2 bg-white flex flex-col items-center text-center border transition-all active:scale-95 shadow-2xs ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {/* Thumbnail Avatar */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden mb-1.5 shadow-2xs relative">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {activePersonaId === id && (
                      <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
                    )}
                  </div>

                  <span className={`text-xs font-bold truncate w-full ${isSelected ? 'text-blue-600' : 'text-slate-700'}`}>
                    {p.name}
                  </span>
                </button>
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
