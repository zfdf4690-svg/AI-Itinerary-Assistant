import React, { useState } from 'react';
import { X, Sparkles, Share2, Volume2, Copy, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback, speakText } from '../../utils/audio';

export const EveningReviewModal: React.FC = () => {
  const {
    isEveningReviewOpen,
    setIsEveningReviewOpen,
    activePersona,
    schedules
  } = useApp();

  const [copied, setCopied] = useState(false);

  if (!isEveningReviewOpen) return null;

  const count = schedules.length;
  const reviewText = activePersona.eveningReviewText(count);

  const handleCopy = () => {
    navigator.clipboard.writeText(`【AI 行程助手 · ${activePersona.name}今日复盘】\n${reviewText}`);
    setCopied(true);
    playAudioFeedback('tap');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    playAudioFeedback('tap');
    speakText(reviewText, {
      pitch: activePersona.speechPitch,
      rate: activePersona.speechRate
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-gradient-to-b from-white via-white to-blue-50/40 rounded-3xl p-6 shadow-2xl border border-slate-100 relative text-slate-800">
        {/* Close Button */}
        <button
          onClick={() => {
            playAudioFeedback('tap');
            setIsEveningReviewOpen(false);
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-95 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Sparkles */}
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          <span>今日晚间复盘 · 情绪陪伴</span>
        </div>

        {/* Persona Header */}
        <div className="flex items-center gap-3 mt-4 mb-4">
          <img
            src={activePersona.avatar}
            alt={activePersona.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-blue-200 shadow-xs"
          />
          <div>
            <h3 className="text-sm font-bold text-slate-900">{activePersona.name}</h3>
            <p className="text-xs text-slate-400">{activePersona.voiceStyle}</p>
          </div>
        </div>

        {/* Quote Card (Rolly style shareable snippet) */}
        <div className="bg-gradient-to-tr from-blue-50/80 to-indigo-50/80 rounded-2xl p-4 border border-blue-100/80 shadow-inner relative">
          <span className="text-3xl text-blue-300 font-serif leading-none absolute top-2 left-2">“</span>
          <p className="text-sm font-medium text-slate-800 leading-relaxed indent-4 pt-1">
            {reviewText}
          </p>
          <span className="text-3xl text-blue-300 font-serif leading-none absolute bottom-1 right-2">”</span>
        </div>

        {/* Schedule Metric Tag */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
          <span>今日已达成行程：<strong className="text-slate-900">{count} 项</strong></span>
          <span>完成率：<strong className="text-blue-600">100%</strong></span>
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={handleSpeak}
            className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Volume2 className="w-4 h-4 text-blue-600" />
            声线播报
          </button>

          <button
            onClick={handleCopy}
            className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-blue-500/20"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> 已复制金句
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" /> 分享金句
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
