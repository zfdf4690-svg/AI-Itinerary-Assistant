import React from 'react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

export const ClarificationView: React.FC = () => {
  const { currentDraft, setCurrentDraft, setCurrentView, applyModification } = useApp();

  const handleSkipLocation = () => {
    playAudioFeedback('tap');
    // Optional field does NOT block schedule creation
    setCurrentView('confirmation');
  };

  const handleAddLocation = () => {
    playAudioFeedback('tap');
    if (currentDraft) {
      setCurrentDraft({
        ...currentDraft,
        location: '陆家嘴'
      });
    }
    applyModification('地点在陆家嘴');
    setCurrentView('confirmation');
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none justify-between px-6 py-12 font-sans">
      <div />

      {/* Main Conversation Clarification Card */}
      <div className="max-w-[340px] mx-auto text-center space-y-6">
        {/* Natural AI Guidance Copy outside card */}
        <div className="space-y-3">
          <p className="text-[17px] font-semibold text-[#1D1D1F] leading-snug">
            好的，我先帮你安排明天下午 3 点和张总的会议。
          </p>
          <p className="text-[15px] text-[#86868B]">
            还需要知道会议地点吗？
          </p>
        </div>

        {/* Action Choice Buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleAddLocation}
            className="w-full h-[46px] rounded-[12px] bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-98 text-[#FFFFFF] text-[15px] font-semibold shadow-apple transition-all cursor-pointer"
          >
            添加地点（如：陆家嘴）
          </button>

          <button
            type="button"
            onClick={handleSkipLocation}
            className="w-full h-[46px] rounded-[12px] bg-[#FFFFFF] hover:bg-[#F2F2F7] border border-[#D2D2D7] active:scale-98 text-[#1D1D1F] text-[15px] font-medium transition-all cursor-pointer"
          >
            暂时不用
          </button>
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="text-center pb-4">
        <p className="text-[13px] text-[#AEAEB2]">
          随时可以直接说出补充信息
        </p>
      </div>
    </div>
  );
};
