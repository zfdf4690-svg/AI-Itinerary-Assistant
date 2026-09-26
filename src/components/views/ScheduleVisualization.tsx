import React, { useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';
import { PieChart as PieIcon, BarChart3, Clock, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { ScheduleItem } from '../../types';

interface ScheduleVisualizationProps {
  schedules: ScheduleItem[];
  onSelectSchedule?: (id: string) => void;
}

export const ScheduleVisualization: React.FC<ScheduleVisualizationProps> = ({
  schedules,
  onSelectSchedule
}) => {
  const [chartType, setChartType] = useState<'distribution' | 'timeline'>('distribution');
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (schedules.length === 0) return null;

  // 1. Process Task Distribution Categories
  const categoryMap: Record<string, { count: number; color: string; sample: string }> = {
    '会议沟通': { count: 0, color: '#3B82F6', sample: '例会、评审、对齐' },
    '商务拜访': { count: 0, color: '#EF4444', sample: '客户拜访、洽谈' },
    '社交餐饮': { count: 0, color: '#F59E0B', sample: '喝咖啡、晚餐、聚餐' },
    '个人与推进': { count: 0, color: '#10B981', sample: '备忘、推进' }
  };

  schedules.forEach((item) => {
    const text = `${item.title} ${item.task} ${item.matters}`.toLowerCase();
    if (text.includes('客户') || text.includes('拜访') || text.includes('洽谈')) {
      categoryMap['商务拜访'].count += 1;
    } else if (text.includes('餐') || text.includes('咖啡') || text.includes('喝') || text.includes('吃') || text.includes('晚宴')) {
      categoryMap['社交餐饮'].count += 1;
    } else if (text.includes('会') || text.includes('例会') || text.includes('评审') || text.includes('讨论') || text.includes('对齐')) {
      categoryMap['会议沟通'].count += 1;
    } else {
      categoryMap['个人与推进'].count += 1;
    }
  });

  const pieData = Object.entries(categoryMap)
    .filter(([_, data]) => data.count > 0)
    .map(([name, data]) => ({
      name,
      value: data.count,
      color: data.color
    }));

  // 2. Process 24h Timeline Distribution (Morning, Noon, Afternoon, Evening)
  const timeBuckets: { slot: string; count: number; items: string[] }[] = [
    { slot: '上午 (08-12)', count: 0, items: [] },
    { slot: '中午 (12-14)', count: 0, items: [] },
    { slot: '下午 (14-18)', count: 0, items: [] },
    { slot: '晚上 (18-22)', count: 0, items: [] }
  ];

  schedules.forEach((item) => {
    const hour = parseInt(item.time.split(':')[0] || '12', 10);
    if (hour < 12) {
      timeBuckets[0].count += 1;
      timeBuckets[0].items.push(item.title);
    } else if (hour >= 12 && hour < 14) {
      timeBuckets[1].count += 1;
      timeBuckets[1].items.push(item.title);
    } else if (hour >= 14 && hour < 18) {
      timeBuckets[2].count += 1;
      timeBuckets[2].items.push(item.title);
    } else {
      timeBuckets[3].count += 1;
      timeBuckets[3].items.push(item.title);
    }
  });

  const totalCount = schedules.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-3.5 mb-3 transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            {chartType === 'distribution' ? (
              <PieIcon className="w-3.5 h-3.5" />
            ) : (
              <BarChart3 className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">
              今日规划全景 · {chartType === 'distribution' ? '任务类型占比' : '时段分布统计'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Switch visualization type */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={() => setChartType('distribution')}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                chartType === 'distribution'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              占比饼图
            </button>
            <button
              type="button"
              onClick={() => setChartType('timeline')}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                chartType === 'timeline'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              时段分布
            </button>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-600"
            title={isCollapsed ? '展开可视化面板' : '折叠面板'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="mt-3 pt-2 border-t border-slate-50">
          {chartType === 'distribution' ? (
            <div className="flex items-center gap-3">
              {/* Donut Chart */}
              <div className="relative w-32 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={48}
                      paddingAngle={3}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val: any) => [`${val ?? 0} 项日程`, '数量']}
                      contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '4px 8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total count */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-extrabold text-slate-800 tabular-nums">
                    {totalCount}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">总事项</span>
                </div>
              </div>

              {/* Legends with percentage */}
              <div className="flex-1 space-y-1.5 min-w-0 pr-1">
                {pieData.map((item) => {
                  const percent = Math.round((item.value / totalCount) * 100);
                  return (
                    <div key={item.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-600 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-medium">
                        <span className="text-slate-800">{item.value}项</span>
                        <span className="text-slate-400 text-[10px]">({percent}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Mini Bar Chart for time of day */}
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeBuckets} margin={{ top: 8, right: 10, left: -25, bottom: 0 }}>
                    <XAxis 
                      dataKey="slot" 
                      tick={{ fontSize: 9, fill: '#64748B' }} 
                      tickLine={false} 
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fontSize: 9, fill: '#94A3B8' }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [`${val ?? 0} 项`, '安排']}
                      contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '4px 8px' }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Time highlight tag */}
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-blue-50/60 text-[10px] text-blue-700 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  忙碌峰值：{
                    timeBuckets.reduce((prev, curr) => (curr.count > prev.count ? curr : prev)).slot
                  }
                </span>
                <span className="text-slate-400">时间块紧凑度良好</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
