import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';
import { RealAudioCapturer } from '../../utils/voiceRecorder';

interface VoiceInputDockProps {
  onSendMessage?: (text: string) => void;
  placeholder?: string;
  className?: string;
  showSuggestions?: boolean;
}

export const VoiceInputDock: React.FC<VoiceInputDockProps> = ({
  onSendMessage,
  placeholder = "输入或说话，如：明天下午3点和张总开会...",
  className = ""
}) => {
  const { resetChatWithUtterance } = useApp();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const capturerRef = useRef<RealAudioCapturer | null>(null);

  const handleSubmit = (text: string) => {
    const finalVal = text.trim();
    if (!finalVal) return;

    if (capturerRef.current) {
      capturerRef.current.stop();
    }
    setIsRecording(false);
    setInputText('');

    playAudioFeedback('tap');

    if (onSendMessage) {
      onSendMessage(finalVal);
    } else {
      resetChatWithUtterance(finalVal);
    }
  };

  const toggleMic = () => {
    if (isRecording) {
      if (capturerRef.current) {
        capturerRef.current.stop();
      }
      setIsRecording(false);
      if (inputText.trim()) {
        handleSubmit(inputText);
      }
    } else {
      playAudioFeedback('wake');
      setIsRecording(true);
      const capturer = new RealAudioCapturer();
      capturerRef.current = capturer;

      capturer.onTranscriptChange = (text, isFinal) => {
        setInputText(text);
        if (isFinal && text.trim().length >= 2) {
          handleSubmit(text);
        }
      };

      capturer.start();
    }
  };

  useEffect(() => {
    return () => {
      if (capturerRef.current) capturerRef.current.stop();
    };
  }, []);

  return (
    <div className={`w-full flex items-center gap-2 ${className}`}>
      <div className="flex-1 relative flex items-center bg-[#F2F2F7] rounded-[12px] px-3.5 h-[42px] transition-colors focus-within:bg-[#FFFFFF] focus-within:ring-1 focus-within:ring-[#007AFF] border border-transparent focus-within:border-[#007AFF]">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit(inputText);
            }
          }}
          placeholder={isRecording ? '正在听，请说话...' : placeholder}
          className="w-full bg-transparent text-[14px] text-[#1D1D1F] placeholder-[#86868B] outline-none"
        />

        {inputText.trim() && (
          <button
            type="button"
            onClick={() => handleSubmit(inputText)}
            className="w-7 h-7 rounded-full bg-[#007AFF] text-white flex items-center justify-center shrink-0 ml-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Low-Key Native Mic Button */}
      <button
        type="button"
        onClick={toggleMic}
        title={isRecording ? '停止录音并提交' : '开始语音输入'}
        className={`w-[42px] h-[42px] rounded-[12px] flex items-center justify-center shrink-0 transition-all cursor-pointer ${
          isRecording
            ? 'bg-[#FF3B30] text-white animate-pulse'
            : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F]'
        }`}
      >
        <Mic className="w-4 h-4" />
      </button>
    </div>
  );
};
