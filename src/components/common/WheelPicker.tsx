import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * PHASE 4-F · 滚轮选择器（iOS 风格 Wheel Picker）
 * - 无第三方库，纯 React + 原生滚动：中间高亮、上下淡出、滚动结束吸附、点击直选
 * - 受控组件：value 变化时自动滚到对应项
 */
interface WheelPickerProps {
  /** 每项显示文本 */
  items: string[];
  /** 与 items 一一对应的取值（默认与 items 相同） */
  values?: string[];
  value: string;
  onChange: (value: string) => void;
  /** 每项高度 px（默认 40） */
  itemHeight?: number;
  /** 可见项数（默认 3，奇数效果最佳） */
  visibleCount?: number;
  className?: string;
}

export const WheelPicker: React.FC<WheelPickerProps> = ({
  items,
  values = items,
  value,
  onChange,
  itemHeight = 40,
  visibleCount = 3,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);

  const currentIndex = Math.max(0, values.indexOf(value));
  const height = itemHeight * visibleCount;
  const halfPad = itemHeight * Math.floor(visibleCount / 2);

  // 受控：value 变化 → 滚动到该项（用户拖拽期间不打断）
  useEffect(() => {
    if (containerRef.current && !dragging) {
      containerRef.current.scrollTop = currentIndex * itemHeight;
    }
  }, [currentIndex, itemHeight, dragging]);

  // 滚动结束（100ms 防抖）后吸附并上报选中项
  const snap = useCallback(
    (target: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!containerRef.current) return;
        const idx = Math.round(target / itemHeight);
        const clamped = Math.max(0, Math.min(values.length - 1, idx));
        if (values[clamped] !== undefined && values[clamped] !== value) {
          onChange(values[clamped]);
        }
      }, 100);
    },
    [itemHeight, values, value, onChange],
  );

  const handleScroll = () => {
    if (containerRef.current) snap(containerRef.current.scrollTop);
  };

  const handlePick = (idx: number) => {
    if (values[idx] !== undefined && values[idx] !== value) onChange(values[idx]);
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height }}>
      {/* 中间高亮带 */}
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-[#007AFF]/10 rounded-[12px] pointer-events-none border border-[#007AFF]/20"
        style={{ height: itemHeight }}
      />
      {/* 上/下渐隐遮罩 */}
      <div className="absolute left-0 right-0 top-0 h-[calc(50%-20px)] bg-gradient-to-b from-[#FFFFFF] to-transparent pointer-events-none" style={{ height: halfPad }} />
      <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-[#FFFFFF] to-transparent pointer-events-none" style={{ height: halfPad }} />

      {/* 滚动列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
        className="h-full overflow-y-auto overscroll-contain cursor-pointer"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ height: halfPad }} />
        {items.map((label, i) => (
          <div
            key={`${values[i]}-${i}`}
            onClick={() => handlePick(i)}
            className="flex items-center justify-center select-none transition-all duration-150"
            style={{
              height: itemHeight,
              opacity: i === currentIndex ? 1 : 0.4,
              transform: i === currentIndex ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <span className="text-[15px] font-medium text-[#1D1D1F] tabular-nums">
              {label}
            </span>
          </div>
        ))}
        <div style={{ height: halfPad }} />
      </div>
    </div>
  );
};
