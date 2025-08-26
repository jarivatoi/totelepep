import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const DateSelector: React.FC<DateSelectorProps> = ({ 
  selectedDate, 
  onDateChange
}) => {
  // Generate calendar list similar to Power Query Table.FromList(calendarList)
  const generateCalendarList = () => {
    const dates = [];
    const today = new Date();
    
    // Generate dates for past 3 days, today, and next 14 days (18 total)
    for (let i = -3; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      let displayName = '';
      if (i === -3) displayName = '3 days ago';
      else if (i === -2) displayName = '2 days ago';
      else if (i === -1) displayName = 'Yesterday';
      else if (i === 0) displayName = 'Today';
      else if (i === 1) displayName = 'Tomorrow';
      else displayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      
      dates.push({
        date: dateString,
        matchCount: 0,
        displayName,
        isPast: i < 0,
        isToday: i === 0,
        isFuture: i > 0
      });
    }
    return dates;
  };

  const calendarList = generateCalendarList();
  
  const currentIndex = calendarList.findIndex(d => d.date === selectedDate);
  
  const goToPrevious = () => {
    if (currentIndex > 0) {
      onDateChange(calendarList[currentIndex - 1].date);
    }
  };
  
  const goToNext = () => {
    if (currentIndex < calendarList.length - 1) {
      onDateChange(calendarList[currentIndex + 1].date);
    }
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Select Date</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            disabled={currentIndex <= 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="text-center min-w-[200px]">
            <div className="font-semibold text-gray-900">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-sm text-gray-600">
              {new Date(selectedDate).toLocaleDateString('en-GB')}
            </div>
          </div>
          
          <button
            onClick={goToNext}
            disabled={currentIndex >= datesToShow.length - 1}
            disabled={currentIndex >= calendarList.length - 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {calendarList.map((dateInfo) => {
          const isSelected = dateInfo.date === selectedDate;
          const date = new Date(dateInfo.date);
          
          return (
            <button
              key={dateInfo.date}
              onClick={() => onDateChange(dateInfo.date)}
              className={`flex-shrink-0 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-w-[100px] ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : dateInfo.isPast
                  ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  : dateInfo.isToday
                  ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md'
              }`}
            >
              <div className="text-center">
                <div className={`font-semibold ${
                  isSelected ? 'text-white' : 
                  dateInfo.isToday ? 'text-green-700' : 
                  dateInfo.isPast ? 'text-gray-500' :
                  'text-gray-900'
                }`}>
                  {dateInfo.displayName || date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
                <div className={`text-xs ${
                  isSelected ? 'text-blue-100' : 
                  dateInfo.isPast ? 'text-gray-400' :
                  'text-gray-500'
                }`}>
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
                {dateInfo.matchCount > 0 && (
                  <div className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-blue-500 text-white' : 
                    dateInfo.isPast ? 'bg-gray-200 text-gray-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {dateInfo.matchCount} matches
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Manual date input */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Custom date selection:
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={() => onDateChange(new Date().toISOString().split('T')[0])}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-500">
          <p>📅 Calendar range: 3 days ago → Today → Next 14 days (18 total dates)</p>
          <p>🔍 Similar to Power Query: Table.FromList(calendarList)</p>
        </div>
      </div>
    </div>
  );
};

export default DateSelector;