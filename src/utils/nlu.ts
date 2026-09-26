import { ScheduleItem } from '../types';

export interface ExtractedSlots {
  time?: string;
  dateLabel?: string;
  title?: string;
  location?: string;
  task?: string;
  matters?: string;
  remindOffset?: string;
}

export function parseScheduleFromUtterance(text: string, existingDraft?: Partial<ScheduleItem>): ExtractedSlots {
  const normalized = text.trim();
  const result: ExtractedSlots = { ...(existingDraft || {}) };

  // Detect explicit multi-turn modifications
  // Case 1: Location correction ("地点不是虹桥，是陆家嘴", "改到陆家嘴", "地点在陆家嘴")
  const locCorrectionMatch = normalized.match(/(?:地点不是.*?[，, ]*是|改到|改成|地点(?:在|是)?)\s*([^，,。！？\s]+)/);
  if (locCorrectionMatch) {
    result.location = locCorrectionMatch[1].replace(/^(是|在)/, '').trim();
  }

  // Case 2: Time correction ("改到下午4点", "时间改成16:00", "改到明天下午3点")
  const timeCorrectionMatch = normalized.match(/(?:改到|改成|时间(?:是|在)?)\s*(明天|后天|今天)?\s*(上午|下午|晚上)?\s*([0-9一二两三四五六七八九十]+)点/);
  if (timeCorrectionMatch) {
    const day = timeCorrectionMatch[1];
    const period = timeCorrectionMatch[2];
    const hourRaw = timeCorrectionMatch[3];
    const hour = parseChineseNumber(hourRaw);
    let finalHour = hour;
    if (period === '下午' || period === '晚上') {
      if (finalHour < 12) finalHour += 12;
    }
    result.time = `${finalHour.toString().padStart(2, '0')}:00`;
    if (day) {
      result.dateLabel = day === '明天' ? '明天 (周二)' : day === '后天' ? '后天 (周三)' : '今天';
    }
  }

  // Case 3: Reminder offset correction ("提醒改成提前15分钟", "提前半小时提醒", "提前10分钟")
  const remindMatch = normalized.match(/提前\s*([0-9一二两三四五六七八九十半]+)\s*(小时|分钟)/);
  if (remindMatch) {
    const num = remindMatch[1];
    const unit = remindMatch[2];
    if (num === '半' && unit === '小时') {
      result.remindOffset = '提前30分钟';
    } else {
      const parsedNum = parseChineseNumber(num);
      result.remindOffset = `提前${parsedNum}${unit}`;
    }
  }

  // Case 4: Matters / Items correction ("事项改成讨论二期项目", "议题是二期项目")
  const mattersMatch = normalized.match(/(?:事项(?:改成|是)?|讨论|议题(?:是)?)\s*([^，,。！？]+)/);
  if (mattersMatch && (!result.matters || normalized.includes('事项') || normalized.includes('改成'))) {
    result.matters = mattersMatch[1].trim();
  }

  // If this is a fresh extraction from initial utterance
  if (!existingDraft || Object.keys(existingDraft).length === 0) {
    // 1. Time & Date parsing
    if (!result.time) {
      if (normalized.includes('下午三点') || normalized.includes('15:00') || normalized.includes('3点')) {
        result.time = '15:00';
      } else if (normalized.includes('上午十点') || normalized.includes('10:00')) {
        result.time = '10:00';
      } else if (normalized.includes('上午九点') || normalized.includes('09:00')) {
        result.time = '09:00';
      } else if (normalized.includes('晚上七点') || normalized.includes('19:00')) {
        result.time = '19:00';
      } else if (normalized.includes('下午四点') || normalized.includes('16:00')) {
        result.time = '16:00';
      } else {
        // Generic regex
        const generalTime = normalized.match(/(上午|下午|晚上)?\s*([0-9一二两三四五六七八九十]+)点/);
        if (generalTime) {
          const period = generalTime[1];
          let h = parseChineseNumber(generalTime[2]);
          if ((period === '下午' || period === '晚上') && h < 12) h += 12;
          result.time = `${h.toString().padStart(2, '0')}:00`;
        } else {
          result.time = '15:00';
        }
      }
    }

    if (!result.dateLabel) {
      if (normalized.includes('明天')) {
        result.dateLabel = '明天 (周二)';
      } else if (normalized.includes('后天')) {
        result.dateLabel = '后天 (周三)';
      } else if (normalized.includes('周五')) {
        result.dateLabel = '周五 (04/26)';
      } else {
        result.dateLabel = '明天 (周二)';
      }
    }

    // 2. Person & Task
    let person = '';
    const personMatch = normalized.match(/(?:和|与|跟)\s*([^，,。！？与跟和在喝开到]+?)(?:开会|喝咖啡|沟通|拜访|吃饭|聚餐|讨论)/);
    if (personMatch) {
      person = personMatch[1].trim();
    } else {
      const fallbackPerson = normalized.match(/(张总|陈赫铭|王工|李敏|陈先生|刘总|周总)/);
      if (fallbackPerson) person = fallbackPerson[1];
    }

    // 3. Task / Title
    if (person) {
      if (normalized.includes('开会')) {
        result.task = `与${person}开会`;
        result.title = `与${person}开会`;
      } else if (normalized.includes('喝咖啡')) {
        result.task = `与${person}喝咖啡`;
        result.title = `与${person}喝咖啡`;
      } else if (normalized.includes('吃饭') || normalized.includes('日料')) {
        result.task = `与${person}聚餐`;
        result.title = `与${person}共进晚餐`;
      } else {
        result.task = `与${person}会面`;
        result.title = `与${person}会面`;
      }
    } else {
      if (normalized.includes('开会') || normalized.includes('会议')) {
        result.task = '项目会议';
        result.title = '项目推进会议';
      } else {
        result.task = '重要行程';
        result.title = '新建行程安排';
      }
    }

    // 4. Location
    if (!result.location) {
      const locMatch = normalized.match(/(?:在|去|于)\s*([^，,。！？和与跟开会]+?)(?:开会|喝咖啡|吃饭|讨论|提前|$)/);
      if (locMatch) {
        result.location = locMatch[1].trim();
      } else if (normalized.includes('虹桥')) {
        result.location = '上海虹桥';
      } else if (normalized.includes('陆家嘴')) {
        result.location = '陆家嘴 · 3号楼';
      } else if (normalized.includes('星巴克')) {
        result.location = '星巴克 (陆家嘴店)';
      } else if (normalized.includes('线上')) {
        result.location = '线上腾讯会议';
      } else {
        result.location = '上海虹桥';
      }
    }

    // 5. Matters
    if (!result.matters) {
      if (normalized.includes('二期')) {
        result.matters = '讨论二期项目';
      } else if (normalized.includes('合作') || normalized.includes('业务')) {
        result.matters = '商务合作细节洽谈';
      } else if (normalized.includes('评审')) {
        result.matters = '方案评审与里程碑确认';
      } else {
        result.matters = '讨论二期项目';
      }
    }

    // 6. Reminder
    if (!result.remindOffset) {
      if (normalized.includes('提前半小时') || normalized.includes('提前30分钟')) {
        result.remindOffset = '提前30分钟';
      } else if (normalized.includes('提前10分钟')) {
        result.remindOffset = '提前10分钟';
      } else if (normalized.includes('提前15分钟')) {
        result.remindOffset = '提前15分钟';
      } else if (normalized.includes('提前1小时')) {
        result.remindOffset = '提前1小时';
      } else {
        result.remindOffset = '提前30分钟';
      }
    }
  }

  return result;
}

function parseChineseNumber(str: string): number {
  if (!str) return 0;
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;
  const map: Record<string, number> = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };
  return map[str] || 1;
}
