'use client';

import { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';

interface Recording {
  id: string;
  createdAt: Timestamp;
  [key: string]: any;
}

interface CalendarViewProps {
  recordings: Recording[];
  onSelectDate: (date: Date) => void;
}

export function CalendarView({ recordings, onSelectDate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  // Group recordings by date
  const recordingsByDate = useMemo(() => {
    const grouped: Record<string, Recording[]> = {};
    
    recordings.forEach(rec => {
      if (!rec.createdAt) return;
      
      const date = rec.createdAt.toDate();
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(rec);
    });
    
    return grouped;
  }, [recordings]);

  // Get count for a specific date
  const getCountForDate = (date: Date): number => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return recordingsByDate[key]?.length || 0;
  };

  // Month navigation
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const previousYear = () => {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth()));
  };

  const nextYear = () => {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth()));
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header with view toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Calendar View</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'year'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Year
            </button>
          </div>
        </div>

        {viewMode === 'month' ? (
          <MonthView
            currentDate={currentDate}
            recordingsByDate={recordingsByDate}
            getCountForDate={getCountForDate}
            onSelectDate={onSelectDate}
            previousMonth={previousMonth}
            nextMonth={nextMonth}
          />
        ) : (
          <YearView
            currentDate={currentDate}
            recordingsByDate={recordingsByDate}
            getCountForDate={getCountForDate}
            onSelectDate={onSelectDate}
            previousYear={previousYear}
            nextYear={nextYear}
          />
        )}
      </div>
    </div>
  );
}

// Monthly Calendar View
function MonthView({ currentDate, recordingsByDate, getCountForDate, onSelectDate, previousMonth, nextMonth }: any) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build calendar grid
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean; count: number }> = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i);
    calendarDays.push({
      date,
      isCurrentMonth: false,
      count: getCountForDate(date)
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    calendarDays.push({
      date,
      isCurrentMonth: true,
      count: getCountForDate(date)
    });
  }

  // Next month days to fill grid
  const remainingDays = 42 - calendarDays.length; // 6 weeks
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    calendarDays.push({
      date,
      isCurrentMonth: false,
      count: getCountForDate(date)
    });
  }

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    if (count === 1) return 'bg-green-500/30';
    if (count === 2) return 'bg-green-500/50';
    if (count === 3) return 'bg-green-500/70';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white/5 rounded-lg p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={previousMonth}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-xl font-bold text-white">
          {monthNames[month]} {year}
        </h3>
        
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, i) => (
          <button
            key={i}
            onClick={() => onSelectDate(day.date)}
            className={`
              aspect-square rounded-lg relative group transition-all
              ${day.isCurrentMonth ? 'text-white' : 'text-gray-600'}
              ${day.count > 0 ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
              ${getIntensityColor(day.count)}
            `}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium">{day.date.getDate()}</span>
            </div>
            
            {day.count > 0 && (
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                {Array.from({ length: Math.min(day.count, 3) }).map((_, i) => (
                  <div key={i} className="w-1 h-1 bg-white rounded-full"></div>
                ))}
                {day.count > 3 && (
                  <div className="text-[8px] text-white font-bold">+</div>
                )}
              </div>
            )}
            
            {/* Tooltip */}
            {day.count > 0 && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {day.count} recording{day.count !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
        <span>Menos</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-white/5"></div>
          <div className="w-4 h-4 rounded bg-green-500/30"></div>
          <div className="w-4 h-4 rounded bg-green-500/50"></div>
          <div className="w-4 h-4 rounded bg-green-500/70"></div>
          <div className="w-4 h-4 rounded bg-green-500"></div>
        </div>
        <span>Más</span>
      </div>
    </div>
  );
}

// Yearly Heatmap View (GitHub-style)
function YearView({ currentDate, recordingsByDate, getCountForDate, onSelectDate, previousYear, nextYear }: any) {
  const year = currentDate.getFullYear();
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build year data
  const yearData: Array<{ month: number; weeks: Array<Array<{ date: Date; count: number }>> }> = [];

  for (let month = 0; month < 12; month++) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const weeks: Array<Array<{ date: Date; count: number }>> = [[]];
    let currentWeek = 0;

    // Pad beginning of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      weeks[currentWeek].push({ date: new Date(0), count: -1 });
    }

    // Add all days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      
      if (weeks[currentWeek].length === 7) {
        currentWeek++;
        weeks[currentWeek] = [];
      }
      
      weeks[currentWeek].push({
        date,
        count: getCountForDate(date)
      });
    }

    // Pad end of month
    while (weeks[currentWeek].length < 7) {
      weeks[currentWeek].push({ date: new Date(0), count: -1 });
    }

    yearData.push({ month, weeks });
  }

  const getIntensityColor = (count: number) => {
    if (count === -1) return 'bg-transparent';
    if (count === 0) return 'bg-white/5';
    if (count === 1) return 'bg-green-500/30';
    if (count === 2) return 'bg-green-500/50';
    if (count === 3) return 'bg-green-500/70';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white/5 rounded-lg p-6">
      {/* Year Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={previousYear}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-xl font-bold text-white">{year}</h3>
        
        <button
          onClick={nextYear}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex gap-4">
          {yearData.map(({ month, weeks }) => (
            <div key={month} className="flex flex-col gap-1">
              {/* Month label */}
              <div className="text-xs text-gray-500 text-center mb-1">
                {monthNames[month]}
              </div>
              
              {/* Weeks */}
              <div className="flex gap-1">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1">
                    {week.map((day, dayIdx) => (
                      <button
                        key={dayIdx}
                        onClick={() => day.count >= 0 && onSelectDate(day.date)}
                        className={`
                          w-3 h-3 rounded-sm relative group transition-all
                          ${day.count > 0 ? 'hover:scale-125 cursor-pointer' : day.count === 0 ? 'cursor-pointer' : ''}
                          ${getIntensityColor(day.count)}
                        `}
                      >
                        {/* Tooltip */}
                        {day.count >= 0 && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                            <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {day.date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                              <br />
                              {day.count} recording{day.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
        <span>Menos</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-white/5"></div>
          <div className="w-3 h-3 rounded-sm bg-green-500/30"></div>
          <div className="w-3 h-3 rounded-sm bg-green-500/50"></div>
          <div className="w-3 h-3 rounded-sm bg-green-500/70"></div>
          <div className="w-3 h-3 rounded-sm bg-green-500"></div>
        </div>
        <span>Más</span>
      </div>
    </div>
  );
}
