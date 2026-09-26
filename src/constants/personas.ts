import { Persona, PersonaId } from '../types';

export const ROBOT_AVATAR = '/src/assets/images/ai_robot_avatar_1790390628851.jpg';

export const PERSONAS: Record<PersonaId, Persona> = {
  energetic: {
    id: 'energetic',
    name: '元气少女',
    tagline: '活泼 · 甜美',
    description: '像朋友一样陪伴你的每一天',
    traits: ['活泼', '甜美', '亲切'],
    avatar: '/src/assets/images/persona_energetic_girl_1790390640715.jpg',
    voiceStyle: '少女音 · 语速快 · 尾音微扬',
    speechPitch: 1.35,
    speechRate: 1.15,
    sampleAudioText: '收到收到～宝你今天也太满了吧！不管是开会还是喝咖啡，交给我统统搞定！',
    confirmReplyText: '好滴！已经帮你妥妥记下啦，到点我一定准时敲你！',
    reminderTemplate: (title, minutes) => `宝！！还有${minutes}分钟就要开始“${title}”啦！你可千万别忘了哦～`,
    eveningReviewText: (itemCount) => `宝～今天${itemCount}个行程全部打卡完成！你今天超棒的，快放下手机早点休息，明天又是元气满满的一天～`
  },
  gentle: {
    id: 'gentle',
    name: '温柔知性',
    tagline: '温暖 · 平静',
    description: '轻柔细致，让每一天都从容井然',
    traits: ['温暖', '知性', '从容'],
    avatar: '/src/assets/images/persona_gentle_intellectual_1790390655491.jpg',
    voiceStyle: '温润女声 · 语速平稳 · 治愈安宁',
    speechPitch: 1.0,
    speechRate: 0.95,
    sampleAudioText: '很高兴陪伴你。今天也要保持好心情，深呼吸，无论多少事务，我们一件一件从容做好。',
    confirmReplyText: '好的，已为你细心备忘。放宽心，时间到了我会轻声提醒你。',
    reminderTemplate: (title, minutes) => `距离“${title}”还有${minutes}分钟，稍微整理一下案头，从容准备出发吧。`,
    eveningReviewText: (itemCount) => `今天完成了${itemCount}项重要事务。辛苦了，喝一杯温水，愿你今夜有安稳的好眠。`
  },
  professional: {
    id: 'professional',
    name: '专业干练',
    tagline: '理性 · 高效',
    description: '精准高效管理日程，助你专注核心决策',
    traits: ['理性', '高效', '严谨'],
    avatar: '/src/assets/images/persona_professional_elite_1790390669202.jpg',
    voiceStyle: '干练女声 · 语速稳健 · 吐字清晰',
    speechPitch: 0.92,
    speechRate: 1.05,
    sampleAudioText: '日程规划就绪，目标明确，执行高效。随时准备为您提供专业的时间管理支持。',
    confirmReplyText: '收到，日程已建立，时间提醒与调度均已准确定位。',
    reminderTemplate: (title, minutes) => `提醒：距“${title}”还有${minutes}分钟，关键材料与路线建议已就绪。`,
    eveningReviewText: (itemCount) => `今日高效执行${itemCount}个关键节点，推进目标扎实有效。明日日程已排期，建议按时休整。`
  }
};
