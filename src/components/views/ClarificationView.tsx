import React from 'react';
import { useApp } from '../../context/AppContext';
import { playAudioFeedback } from '../../utils/audio';

/**
 * 03 AI Clarification：AI 补充信息页。
 * 文案由后端会话流/理解结果动态生成（任务书 Phase 4：replyText / missingOptional），
 * 无后端时保留本地降级文案。
 */
export const ClarificationView: React.FC = () => {
  const { currentDraft, setCurrentDraft, setCurrentView, applyModification, chatMessages, backendStatus } = useApp();

  // 动态追问文案：优先取最近一条 AI 回复（后端回复 / 本地追问）
  const lastAiMessage = [...chatMessages].reverse().find((m) => m.sender === 'ai');
  const questionText = (lastAiMessage?.text || '好的，还需要知道会议地点吗？').replace(/\n/g, ' ');
  const subtitleText = currentDraft?.location
    ? '还需要补充其他信息吗？'
    : '还需要知道会议地点吗？';

  const handleSkipLocation = () => {
    playAudioFeedback('tap');
    // 后端在线：走会话流「拒绝补充」（任务书：用户拒绝可选信息不阻塞创建）
    if (backendStatus === 'online') {
      applyModification('不用了');
    } else {
      // Optional field does NOT block schedule creation
      setCurrentView('confirmation');
    }
  };

  const handleAddLocation = () => {
    playAudioFeedback('tap');
    if (backendStatus !== 'online' && currentDraft) {
      setCurrentDraft({
        ...currentDraft,
        location: '陆家嘴'
      });
    }
    applyModification('地点在陆家嘴');
  };

  return (
    <div className="relative flex flex-col h-full bg-[#F5F5F7] text-[#1D1D1F] select-none justify-between px-6 py-12 font-sans">
      <div />

      {/* Main Conversation Clarification Card */}
      <div className="max-w-[340px] mx-auto text-center space-y-6">
        {/* Natural AI Guidance Copy outside card */}
        <div className="space-y-3">
          <p className="text-[17px] font-semibold text-[#1D1D1F] leading-snug whitespace-pre-line">
            {questionText}
          </p>
          <p className="text-[15px] text-[#86868B]">
            {subtitleText}
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
