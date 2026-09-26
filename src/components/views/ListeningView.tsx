import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Send, 
  Keyboard, 
  AudioWaveform, 
  Sparkles, 
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SpeakerButton } from '../common/SpeakerButton';
import { BottomTabBar } from '../common/BottomTabBar';
import { playAudioFeedback } from '../../utils/audio';
import { RealAudioCapturer } from '../../utils/voiceRecorder';

export const ListeningView: React.FC = () => {
  const { setCurrentView, resetChatWithUtterance, miniMaxConfig, deepSeekConfig, activePersona } = useApp();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [realVolume, setRealVolume] = useState(0); // 0.0 ~ 1.0 real volume level
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [statusNotice, setStatusNotice] = useState<string>('正在启动麦克风拾音...');
  const [useTextInput, setUseTextInput] = useState(false);
  const [inputText, setInputText] = useState('');

  const capturerRef = useRef<RealAudioCapturer | null>(null);
  const autoSubmitTimerRef = useRef<any>(null);

  const defaultSample = '明天下午三点和张总开会，提前半小时提醒我';

  // Initialize Real Audio Capturer with browser mic permission
  useEffect(() => {
    playAudioFeedback('wake');

    const capturer = new RealAudioCapturer();
    capturerRef.current = capturer;

    capturer.onVolumeChange = (vol) => {
      setRealVolume(vol);
    };

    capturer.onTranscriptChange = (text, isFinal) => {
      setTranscript(text);
      setStatusNotice(isFinal ? '识别完成，准备提交...' : '正在实时识别您的语音...');

      // If user pauses after speaking, auto-submit
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }

      if (text.trim().length >= 2) {
        autoSubmitTimerRef.current = setTimeout(() => {
          handleSubmit(text);
        }, 1500); // 1.5s silence triggers auto-submission
      }
    };

    capturer.onError = (err) => {
      setStatusNotice(err);
      if (err.includes('拒绝') || err.includes('权限')) {
        setMicPermissionGranted(false);
      }
    };

    capturer.onStateChange = (recording) => {
      setIsRecording(recording);
      if (recording) {
        setMicPermissionGranted(true);
        setStatusNotice('麦克风已就绪，请直接清晰说话...');
      }
    };

    // Trigger start
    capturer.start().then((started) => {
      if (started) {
        setMicPermissionGranted(true);
      }
    });

    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
      capturer.stop();
    };
  }, []);

  const handleSubmit = (finalText: string) => {
    const textToSubmit = finalText.trim() || defaultSample;
    if (capturerRef.current) {
      capturerRef.current.stop();
    }
    playAudioFeedback('success');
    resetChatWithUtterance(textToSubmit);
  };

  const handleMicClick = () => {
    if (transcript.trim()) {
      handleSubmit(transcript);
    } else {
      if (!isRecording && capturerRef.current) {
        capturerRef.current.start();
      } else {
        setStatusNotice('正在拾音中，你可以直接大声说出您的日程安排...');
      }
    }
  };

  // Dynamic bar height based on real acoustic volume
  const getBarHeight = (baseHeight: number, multiplier: number) => {
    const dynamic = baseHeight + realVolume * multiplier * 40;
    return Math.min(68, Math.max(12, dynamic));
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-[#FAFBFD] via-[#F6F8FC] to-[#EEF2F9] text-slate-800 select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-3 z-20">
        <button
          onClick={() => {
            if (capturerRef.current) capturerRef.current.stop();
            playAudioFeedback('tap');
            setCurrentView('home');
          }}
          title="关闭并返回首页"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Dynamic Engine Pill */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              playAudioFeedback('tap');
              setCurrentView('persona_detail');
            }}
            className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-white text-slate-700 font-medium border border-slate-200 shadow-2xs hover:bg-slate-50 cursor-pointer"
          >
            <img
              src={activePersona.avatar}
              alt={activePersona.name}
              className="w-3.5 h-3.5 rounded-full object-cover"
            />
            <span>{activePersona.name}</span>
          </button>
          {miniMaxConfig.enabled && miniMaxConfig.apiKey.trim() ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium border border-rose-200 shadow-2xs">
              <AudioWaveform className="w-3 h-3" /> MiniMax
            </span>
          ) : null}
          {deepSeekConfig.enabled && deepSeekConfig.apiKey.trim() ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium border border-indigo-200 shadow-2xs">
              <Sparkles className="w-3 h-3" /> DeepSeek
            </span>
          ) : null}
        </div>

        <SpeakerButton />
      </div>

      {/* Center Acoustic Orb & Voice Prompts */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-6 text-center z-10">
        {/* Soft Glowing Gradient Acoustic Orb with REAL volume reactivity */}
        <div className="relative w-48 h-48 flex items-center justify-center mb-4">
          <div 
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-300/40 via-blue-400/30 to-purple-400/40 blur-2xl transition-transform duration-100" 
            style={{ transform: `scale(${1 + realVolume * 0.4})` }}
          />
          <div 
            className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-300/60 via-indigo-300/40 to-pink-300/50 blur-xl opacity-90 transition-transform duration-100" 
            style={{ transform: `scale(${1 + realVolume * 0.3})` }}
          />
          
          <div className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-sky-200/80 via-blue-300/70 to-purple-200/80 backdrop-blur-md shadow-inner flex items-center justify-center">
            {/* Real Audio Waveform visualizer bars */}
            <div className="flex items-center justify-center gap-1.5 h-16">
              <span 
                className="w-1.5 bg-blue-600/80 rounded-full transition-all duration-75" 
                style={{ height: `${getBarHeight(18, 0.7)}px` }} 
              />
              <span 
                className="w-1.5 bg-indigo-600/90 rounded-full transition-all duration-75" 
                style={{ height: `${getBarHeight(28, 1.2)}px` }} 
              />
              <span 
                className="w-1.5 bg-purple-600/90 rounded-full transition-all duration-75" 
                style={{ height: `${getBarHeight(36, 1.5)}px` }} 
              />
              <span 
                className="w-1.5 bg-blue-600/90 rounded-full transition-all duration-75" 
                style={{ height: `${getBarHeight(26, 1.1)}px` }} 
              />
              <span 
                className="w-1.5 bg-sky-500/80 rounded-full transition-all duration-75" 
                style={{ height: `${getBarHeight(16, 0.6)}px` }} 
              />
            </div>
          </div>
        </div>

        {/* Real-time Status and Recognized Text */}
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          {isRecording ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              正在聆听您的声音...
            </>
          ) : (
            '我在听...'
          )}
        </h2>

        {/* Real Live Transcript Display */}
        {transcript ? (
          <div className="mt-3.5 px-4 py-3 bg-white/90 border border-blue-200 shadow-sm rounded-2xl text-sm font-semibold text-blue-900 animate-fadeIn max-w-[320px] leading-relaxed">
            <span className="text-blue-500 mr-1 text-xs">“</span>
            {transcript}
            <span className="text-blue-500 ml-1 text-xs">”</span>
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => handleSubmit(transcript)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                立即确认提交
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-1 max-w-[300px]">
            <p className="text-xs text-slate-500 font-medium">
              {statusNotice}
            </p>
            {micPermissionGranted === false && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 flex items-start gap-1.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>未获得麦克风授权。请点击浏览器地址栏的锁形/权限图标允许麦克风访问，或点击下方示例/键盘输入。</span>
              </div>
            )}
          </div>
        )}

        {/* Quick utterance suggestions - Allows 1-click testing or speaking reference */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-[320px]">
          <span className="w-full text-[10px] text-slate-400 mb-0.5">你可以直接念出下列日程，或点击填入：</span>
          <button
            onClick={() => {
              setTranscript('明天下午三点和张总开会，提前半小时提醒我');
              handleSubmit('明天下午三点和张总开会，提前半小时提醒我');
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            例：和张总开会
          </button>
          <button
            onClick={() => {
              setTranscript('周五上午十点在徐家汇和王工讨论架构，提前15分钟提醒');
              handleSubmit('周五上午十点在徐家汇和王工讨论架构，提前15分钟提醒');
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            例：周五见王工
          </button>
          <button
            onClick={() => {
              setTranscript('今晚八点和李敏在三里屯吃日料');
              handleSubmit('今晚八点和李敏在三里屯吃日料');
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            例：今晚吃日料
          </button>
        </div>
      </div>

      {/* Bottom Area */}
      <div className="relative px-6 pt-2 pb-8 flex flex-col items-center justify-center">
        {useTextInput ? (
          <div className="w-full flex items-center gap-2 bg-white rounded-2xl p-2 border border-slate-200 shadow-sm animate-fadeIn">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputText.trim()) {
                  handleSubmit(inputText);
                }
              }}
              placeholder="输入日程内容，如：明天下午3点开会..."
              autoFocus
              className="flex-1 px-3 py-2 text-sm outline-none text-slate-800 placeholder-slate-400"
            />
            <button
              onClick={() => {
                if (inputText.trim()) handleSubmit(inputText);
              }}
              className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* Concentric pulsing acoustic rings reacting to real mic state */}
            {isRecording && (
              <>
                <div 
                  className="absolute inset-0 -m-3 rounded-full bg-blue-400/20 transition-transform duration-100 pointer-events-none" 
                  style={{ transform: `scale(${1 + realVolume * 0.8})` }} 
                />
                <div 
                  className="absolute inset-0 -m-6 rounded-full border border-blue-400/30 transition-transform duration-100 pointer-events-none"
                  style={{ transform: `scale(${1 + realVolume * 0.5})` }} 
                />
              </>
            )}

            {/* Big Mic Button */}
            <button
              onClick={handleMicClick}
              title={transcript ? "点击提交识别文字" : "点击说话"}
              className={`relative w-18 h-18 rounded-full border shadow-lg flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                transcript
                  ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/25 ring-4 ring-blue-100'
                  : isRecording
                  ? 'bg-white text-blue-600 border-blue-200 shadow-blue-500/15 hover:bg-blue-50/50'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              <Mic className="w-8 h-8" />
            </button>

            <button
              onClick={() => setUseTextInput(true)}
              className="mt-4 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5" />
              切换为键盘文字输入
            </button>
          </div>
        )}
      </div>

      {/* Global Bottom Navigation Bar */}
      <BottomTabBar />
    </div>
  );
};
