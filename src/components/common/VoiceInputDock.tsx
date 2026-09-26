import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Sparkles, X, AlertCircle } from 'lucide-react';
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
  className = "",
  showSuggestions = true
}) => {
  const { resetChatWithUtterance, activePersona } = useApp();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [realVolume, setRealVolume] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [statusTip, setStatusTip] = useState('');
  const [hasMicError, setHasMicError] = useState(false);

  const capturerRef = useRef<RealAudioCapturer | null>(null);
  const autoSubmitTimerRef = useRef<any>(null);

  const handleSubmit = (text: string) => {
    const finalVal = text.trim();
    if (!finalVal) return;

    if (capturerRef.current) {
      capturerRef.current.stop();
    }
    setIsRecording(false);
    setLiveTranscript('');
    setInputText('');
    setStatusTip('');
    setHasMicError(false);

    playAudioFeedback('success');

    if (onSendMessage) {
      onSendMessage(finalVal);
    } else {
      resetChatWithUtterance(finalVal);
    }
  };

  const stopRecording = () => {
    if (capturerRef.current) {
      capturerRef.current.stop();
    }
    setIsRecording(false);
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }
  };

  const startRecording = async () => {
    stopRecording();
    playAudioFeedback('wake');
    setIsRecording(true);
    setLiveTranscript('');
    setHasMicError(false);
    setStatusTip('正在聆听中，请说话...');

    const capturer = new RealAudioCapturer();
    capturerRef.current = capturer;

    capturer.onVolumeChange = (vol) => {
      setRealVolume(vol);
    };

    capturer.onTranscriptChange = (text, isFinal) => {
      setLiveTranscript(text);
      setInputText(text);

      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }

      if (isFinal && text.trim().length >= 2) {
        setStatusTip('识别完成，即将提交...');
        autoSubmitTimerRef.current = setTimeout(() => {
          handleSubmit(text);
        }, 1200);
      }
    };

    capturer.onError = (err) => {
      setStatusTip(err);
      setHasMicError(true);
      // Keep voice island visible with clear feedback and manual buttons, do NOT immediately crash/vanish!
    };

    await capturer.start();
  };

  const toggleMic = () => {
    if (isRecording) {
      if (liveTranscript.trim() || inputText.trim()) {
        handleSubmit(liveTranscript.trim() || inputText.trim());
      } else {
        stopRecording();
        setStatusTip('');
      }
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const suggestions = [
    '明天下午三点和张总开会',
    '周五上午十点在徐家汇见王工',
    '今晚八点和李敏吃日料'
  ];

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      {/* Optional Quick Suggestion Pills */}
      {showSuggestions && !isRecording && (
        <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 px-1">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-blue-500" />
            快速建议:
          </span>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                playAudioFeedback('tap');
                handleSubmit(item);
              }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/90 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/90 text-slate-600 shrink-0 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Floating Active Voice Island when recording (Stable, will not flash close on idle) */}
      {isRecording && (
        <div className="w-full mb-3 p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              <span className="text-xs font-semibold tracking-wide">
                {activePersona.name} 正在聆听您的声音
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                stopRecording();
                setStatusTip('');
                setHasMicError(false);
              }}
              className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              title="取消录音"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Real Audio Volume Wave */}
          <div className="flex items-center justify-center gap-1.5 h-7 my-1">
            <span
              className="w-1 bg-white/70 rounded-full transition-all duration-75"
              style={{ height: `${Math.max(6, realVolume * 24)}px` }}
            />
            <span
              className="w-1 bg-white/90 rounded-full transition-all duration-75"
              style={{ height: `${Math.max(10, realVolume * 32)}px` }}
            />
            <span
              className="w-1.5 bg-white rounded-full transition-all duration-75"
              style={{ height: `${Math.max(14, realVolume * 36)}px` }}
            />
            <span
              className="w-1 bg-white/90 rounded-full transition-all duration-75"
              style={{ height: `${Math.max(10, realVolume * 30)}px` }}
            />
            <span
              className="w-1 bg-white/70 rounded-full transition-all duration-75"
              style={{ height: `${Math.max(6, realVolume * 20)}px` }}
            />
          </div>

          <div className="text-center px-1">
            <p className="text-sm font-bold min-h-[22px] tracking-tight leading-snug">
              {liveTranscript ? `“ ${liveTranscript} ”` : statusTip || '请直接说出您的日程安排...'}
            </p>
            {hasMicError && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] bg-red-500/20 px-2 py-0.5 rounded-md text-red-100">
                <AlertCircle className="w-3 h-3 text-red-200" />
                <span>若未听到声音，可点击下方示例或直接键盘输入</span>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-100">
            <span>说完了？点击完成立即提交</span>
            <button
              type="button"
              onClick={() => handleSubmit(liveTranscript || inputText || '明天下午三点和张总开会')}
              className="px-2.5 py-0.5 rounded-lg bg-white text-blue-700 font-semibold shadow-2xs hover:bg-blue-50 active:scale-95 transition-all cursor-pointer"
            >
              立即完成
            </button>
          </div>
        </div>
      )}

      {/* Main Unified Input Capsule (Text + Mic in one unified bar) */}
      <div className="w-full flex items-center gap-2">
        <div
          className={`flex-1 flex items-center bg-white rounded-full pl-4 pr-1.5 py-1.5 border transition-all shadow-sm ${
            isRecording
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/10'
              : 'border-slate-200/90 hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20'
          }`}
        >
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
            placeholder={isRecording ? "正在听你说，也可直接在此敲字..." : placeholder}
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none leading-relaxed"
          />

          {inputText.trim() && !isRecording && (
            <button
              type="button"
              onClick={() => handleSubmit(inputText)}
              title="提交日程"
              className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform shadow-xs shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dynamic Voice Action Button */}
        <button
          type="button"
          onClick={toggleMic}
          title={isRecording ? "点击完成并提交" : "点击说话"}
          className={`relative h-11 px-3.5 rounded-full flex items-center justify-center gap-1.5 font-medium text-xs shrink-0 active:scale-95 transition-all cursor-pointer ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/25 ring-4 ring-red-100 animate-pulse'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 text-white shadow-md shadow-blue-500/20'
          }`}
        >
          <Mic className={`w-4 h-4 ${isRecording ? 'animate-bounce' : ''}`} />
          <span className="hidden sm:inline font-semibold">
            {isRecording ? '完成' : '语音'}
          </span>
        </button>
      </div>
    </div>
  );
};
