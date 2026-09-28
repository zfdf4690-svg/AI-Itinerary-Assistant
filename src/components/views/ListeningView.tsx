import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { RealAudioCapturer } from '../../utils/voiceRecorder';

export const ListeningView: React.FC = () => {
  const { setCurrentView, resetChatWithUtterance } = useApp();
  const [transcript, setTranscript] = useState('');
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const [realVolume, setRealVolume] = useState(0);

  const capturerRef = useRef<RealAudioCapturer | null>(null);
  const silenceTimerRef = useRef<any>(null);

  const defaultSample = '明天下午三点和张总开会';

  useEffect(() => {
    playAudioFeedback('wake');

    const capturer = new RealAudioCapturer();
    capturerRef.current = capturer;

    capturer.onVolumeChange = (vol) => {
      setRealVolume(vol);
    };

    capturer.onTranscriptChange = (text, isFinal) => {
      setTranscript(text);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      if (text.trim().length >= 2) {
        silenceTimerRef.current = setTimeout(() => {
          handleUserStop(text);
        }, 1200);
      }
    };

    capturer.start();

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      capturer.stop();
    };
  }, []);

  const handleUserStop = (finalText: string) => {
    if (capturerRef.current) {
      capturerRef.current.stop();
    }
    setIsUnderstanding(true);
    playAudioFeedback('tap');

    const resultText = finalText.trim() || defaultSample;
    setTimeout(() => {
      resetChatWithUtterance(resultText);
    }, 450);
  };

  const handleCancel = () => {
    if (capturerRef.current) {
      capturerRef.current.stop();
    }
    playAudioFeedback('tap');
    setCurrentView('home');
  };

  // Subtle Waveform dots calculation (Low-key Apple style)
  const getDotScale = (index: number) => {
    const base = 0.8;
    const offset = Math.abs(2 - index) * 0.15;
    const dynamic = realVolume * 0.8;
    return Math.min(1.5, Math.max(0.6, base + dynamic - offset));
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none justify-between items-center px-6 py-12 font-sans">
      {/* Top spacing */}
      <div />

      {/* Center Listening Content */}
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
          {isUnderstanding ? '正在理解…' : '正在听'}
        </h2>

        {/* Quiet Low-Key Waveform Dots */}
        <div className="flex items-center gap-2 h-8">
          {[0, 1, 2, 3, 4].map((idx) => {
            const isCenter = idx === 2;
            const scale = getDotScale(idx);
            return (
              <span
                key={idx}
                style={{ transform: `scale(${scale})` }}
                className={`transition-transform duration-75 rounded-full ${
                  isCenter ? 'w-2.5 h-2.5 bg-[#007AFF]' : 'w-2 h-2 bg-[#86868B]'
                }`}
              />
            );
          })}
        </div>

        {/* Live speech preview */}
        <p className="text-[16px] text-[#1D1D1F] min-h-[28px] max-w-[280px] font-normal leading-relaxed">
          {transcript ? `“${transcript}”` : '“明天下午三点……”'}
        </p>

        {/* Quick Simulation Trigger button */}
        {!transcript && (
          <button
            onClick={() => handleUserStop(defaultSample)}
            className="text-[12px] text-[#86868B] hover:text-[#007AFF] underline underline-offset-4 pt-2 cursor-pointer transition-colors"
          >
            模拟说话完成
          </button>
        )}
      </div>

      {/* Bottom Cancel Action */}
      <div className="pb-4">
        <button
          type="button"
          onClick={handleCancel}
          className="text-[15px] font-medium text-[#86868B] hover:text-[#1D1D1F] px-6 py-2.5 rounded-[12px] active:scale-95 transition-colors cursor-pointer"
        >
          取消
        </button>
      </div>
    </div>
  );
};
