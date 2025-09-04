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
  // Generate next 7 days with realistic match counts like Totelepep website
  const getDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      let displayName = '';
      if (i === 0) displayName = 'Today';
      else if (i === 1) displayName = 'Tomorrow';
      else displayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      
      // Show match counts like Totelepep website (realistic numbers)
      let matchCount = 0;
      if (i === 0) matchCount = 15; // Today - busy day
      else if (i === 1) matchCount = 8; // Tomorrow
      else if (i === 2) matchCount = 12; // Day after tomorrow
      else if (date.getDay() === 6 || date.getDay() === 0) matchCount = 20; // Weekend - more matches
      else matchCount = Math.floor(Math.random() * 10) + 5; // Weekdays: 5-14 matches
      
      dates.push({
        date: dateString,
        matchCount,
        displayName
      });
    }
    return dates;
  };

  const datesToShow = getDateOptions();
  
  const currentIndex = datesToShow.findIndex(d => d.date === selectedDate);
  
  const goToPrevious = () => {
    if (currentIndex > 0) {
      onDateChange(datesToShow[currentIndex - 1].date);
    }
  };
  
  const goToNext = () => {
    if (currentIndex < datesToShow.length - 1) {
      onDateChange(datesToShow[currentIndex + 1].date);
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
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {datesToShow.map((dateInfo) => {
          const isSelected = dateInfo.date === selectedDate;
          const date = new Date(dateInfo.date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <button
              key={dateInfo.date}
              onClick={() => onDateChange(dateInfo.date)}
              className={`flex-shrink-0 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-w-[100px] ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md'
              }`}
            >
              <div className="text-center">
                <div className={`font-semibold ${isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {dateInfo.displayName || date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
                <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
                {dateInfo.matchCount > 0 && (
                  <div className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
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
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Or select custom date:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default DateSelector;