import React from 'react';
import { Volume2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { speakText, stopSpeaking, isSpeaking, playAudioFeedback } from '../../utils/audio';

interface SpeakerButtonProps {
  textToSpeak?: string;
  className?: string;
}

export const SpeakerButton: React.FC<SpeakerButtonProps> = ({ textToSpeak, className = '' }) => {
  const { activePersona } = useApp();
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setPlaying(isSpeaking());
    }, 250);
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
    }
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      title={playing ? '正在播放中，点击停止' : '播放语音'}
      className={`w-7 h-7 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] active:scale-95 transition-all cursor-pointer ${
        playing ? 'text-[#007AFF] bg-[#007AFF]/10' : ''
      } ${className}`}
    >
      <Volume2 className="w-3.5 h-3.5" />
    </button>
  );
};
