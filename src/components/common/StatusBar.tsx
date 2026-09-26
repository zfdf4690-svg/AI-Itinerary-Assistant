import React, { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';

export const StatusBar: React.FC<{ lightTheme?: boolean }> = ({ lightTheme = false }) => {
  const [timeStr, setTimeStr] = useState('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const textColor = lightTheme ? 'text-slate-800' : 'text-slate-900';

  return (
    <div className={`w-full flex items-center justify-between px-6 pt-3 pb-2 text-xs font-semibold select-none ${textColor} tracking-tight z-30`}>
      <span className="tabular-nums font-medium text-[13px]">{timeStr}</span>
      <div className="flex items-center gap-1.5 opacity-90">
        {/* Cellular signal bars */}
        <div className="flex items-end gap-0.5 h-3">
          <span className="w-0.5 h-1.5 bg-current rounded-full" />
          <span className="w-0.5 h-2 bg-current rounded-full" />
          <span className="w-0.5 h-2.5 bg-current rounded-full" />
          <span className="w-0.5 h-3 bg-current rounded-full" />
        </div>
        {/* Wifi */}
        <Wifi className="w-3.5 h-3.5" />
        {/* Battery */}
        <div className="w-5 h-2.5 border border-current rounded-[3px] p-[1px] flex items-center">
          <div className="h-full w-[80%] bg-current rounded-[1px]" />
        </div>
      </div>
    </div>
  );
};
