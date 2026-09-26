import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { speakText, stopSpeaking, isSpeaking, playAudioFeedback } from '../../utils/audio';

interface SpeakerButtonProps {
  textToSpeak?: string;
  className?: string;
}

export const SpeakerButton: React.FC<SpeakerButtonProps> = ({ textToSpeak, className = '' }) => {
  const { autoVoiceEnabled, setAutoVoiceEnabled, activePersona } = useApp();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const checkPlaying = () => {
      setPlaying(isSpeaking());
    };
    const timer = setInterval(checkPlaying, 250);
    return () => clearInterval(timer);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playAudioFeedback('tap');

    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }

    if (textToSpeak) {
      speakText(textToSpeak, {
        pitch: activePersona.speechPitch,
        rate: activePersona.speechRate,
        personaId: activePersona.id,
        onStart: () => setPlaying(true),
        onEnd: () => setPlaying(false)
      });
    } else {
      // Toggle auto voice broadcast mode
      const nextState = !autoVoiceEnabled;
      setAutoVoiceEnabled(nextState);
      if (nextState) {
        speakText('语音播报已开启', {
          pitch: activePersona.speechPitch,
          rate: activePersona.speechRate,
          personaId: activePersona.id
        });
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      title={autoVoiceEnabled ? '语音播报开启中（点击静音或试听）' : '语音播报已静音（点击播放）'}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 active:scale-95 transition-all ${className}`}
    >
      {playing ? (
        <span className="relative flex items-center justify-center text-blue-600">
          <Volume2 className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
        </span>
      ) : autoVoiceEnabled ? (
        <Volume2 className="w-5 h-5" />
      ) : (
        <VolumeX className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );
};
