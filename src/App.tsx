import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Calendar, AlertCircle, Calculator, Database, Lightbulb } from 'lucide-react';
import { Target } from 'lucide-react';
import DateGroupedMatches from './components/DateGroupedMatches';
import DateSelector from './components/DateSelector';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import ParlayBuilder, { ParlaySelection } from './components/ParlayBuilder';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import DataExtractor from './components/DataExtractor';
import EndpointDiscovery from './components/EndpointDiscovery';
import ResponseAnalyzer from './components/ResponseAnalyzer';
import AlternativeSolutions from './components/AlternativeSolutions';
import MatchSpecificTester from './components/MatchSpecificTester';
import { totelepepService, TotelepepMatch } from './services/totelepepService';
import { registerServiceWorker, requestNotificationPermission, scheduleBackgroundSync } from './utils/pwaUtils';
import { usePWA } from './hooks/usePWA';

function App() {
  const [matches, setMatches] = useState<TotelepepMatch[]>([]);
  const [groupedMatches, setGroupedMatches] = useState<Record<string, TotelepepMatch[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [parlaySelections, setParlaySelections] = useState<ParlaySelection[]>([]);
  const [showParlay, setShowParlay] = useState(false);
  const [showExtractor, setShowExtractor] = useState(false);
  const [showEndpointDiscovery, setShowEndpointDiscovery] = useState(false);
  const [showResponseAnalyzer, setShowResponseAnalyzer] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showMatchTester, setShowMatchTester] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const { isOnline } = usePWA();

  // Initialize PWA features
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
    scheduleBackgroundSync();
  }, []);
  
  const loadData = async (targetDate?: string) => {
    setLoading(true);
    setError(null);
    const dateToFetch = targetDate || selectedDate;
    try {
      console.log('🔍 Fetching data from Totelepep...');
      const fetchedMatches = await totelepepService.getMatches(dateToFetch);
      
      // Sort matches by date and time
      const sortedMatches = totelepepService.sortMatchesByDate(fetchedMatches);
      setMatches(sortedMatches);
      
      // Group matches by date
      const grouped = totelepepService.groupMatchesByDate(sortedMatches);
      setGroupedMatches(grouped);
      
      setLastUpdated(new Date());
      console.log(`✅ Loaded ${sortedMatches.length} matches from Totelepep for ${dateToFetch}`);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(isOnline ? 'Failed to load data from Totelepep. Try the data extractor below.' : 'You are offline. Showing cached data if available.');
    } finally {
      setLoading(false);
    }
  };

  // Load data when selected date changes
  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    loadData(selectedDate);
    
    // Auto-reload every 5 minutes for live data (only when online)
    const interval = setInterval(() => {
      if (isOnline) {
        loadData(selectedDate);
      }
    }, 300000);
    return () => clearInterval(interval);
  }, [isOnline, selectedDate]);

  // Filter matches and maintain grouping
  const filteredGroupedMatches = React.useMemo(() => {
    if (!searchTerm) return groupedMatches;
    
    const filtered: Record<string, TotelepepMatch[]> = {};
    
    Object.entries(groupedMatches).forEach(([date, dateMatches]) => {
      const filteredDateMatches = dateMatches.filter(match =>
        match.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.league.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (filteredDateMatches.length > 0) {
        filtered[date] = filteredDateMatches;
      }
    });
    
    return filtered;
  }, [groupedMatches, searchTerm]);

  const totalMatches = matches.length;
  const totalFilteredMatches = Object.values(filteredGroupedMatches)
    .reduce((sum, dateMatches) => sum + dateMatches.length, 0);
  
  // Debug: Log grouped matches to see what dates we have
  React.useEffect(() => {
    console.log('📅 Available dates in groupedMatches:', Object.keys(groupedMatches));
    console.log('📊 Matches per date:', Object.entries(groupedMatches).map(([date, matches]) => `${date}: ${matches.length}`));
  }, [groupedMatches]);

  const handlePriceClick = (matchId: string, priceType: string, odds: number) => {
    // Find the match details
    const match = matches.find(m => m.id === matchId);
    if (match) {
      // Check if this selection already exists
      const existingIndex = parlaySelections.findIndex(
        s => s.matchId === matchId && s.priceType === priceType
      );
      
      if (existingIndex >= 0) {
        // Remove existing selection
        setParlaySelections(prev => prev.filter((_, index) => index !== existingIndex));
      } else {
        // Add new selection
        const newSelection: ParlaySelection = {
          matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          priceType,
          odds,
          league: match.league,
          kickoff: match.kickoff,
        };
        setParlaySelections(prev => [...prev, newSelection]);
        setShowParlay(true);
      }
    }
  };

  const handleRemoveSelection = (index: number) => {
    setParlaySelections(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setParlaySelections([]);
    setShowParlay(false);
  };
  const handleDataExtracted = (extractedData: any[]) => {
    // Convert extracted data to TotelepepMatch format
    const convertedMatches: TotelepepMatch[] = extractedData.map(match => ({
      ...match,
      // Ensure all required fields are present
      overUnder: match.overUnder || { over: 1.85, under: 1.85, line: 2.5 },
      bothTeamsScore: match.bothTeamsScore || { yes: 1.70, no: 2.10 }
    }));

    setMatches(convertedMatches);
    
    // Group matches by date
    const grouped = totelepepService.groupMatchesByDate(convertedMatches);
    setGroupedMatches(grouped);
    
    setLastUpdated(new Date());
    setError(null);
    setShowExtractor(false);
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    // loadData will be called automatically by useEffect
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <DateSelector
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
            />
            
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Totelepep Matches - {new Date(selectedDate).toLocaleDateString('en-GB', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </h1>
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => setShowExtractor(!showExtractor)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  <Database className="w-4 h-4" />
                  {showExtractor ? 'Hide' : 'Show'} Data Extractor
                </button>
                <button
                  onClick={() => setShowEndpointDiscovery(!showEndpointDiscovery)}
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  <Search className="w-4 h-4" />
                  {showEndpointDiscovery ? 'Hide' : 'Show'} Endpoint Discovery
                </button>
                <button
                  onClick={() => setShowResponseAnalyzer(!showResponseAnalyzer)}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  <Database className="w-4 h-4" />
                  {showResponseAnalyzer ? 'Hide' : 'Show'} Response Analyzer
                </button>
                <button
                  onClick={() => setShowAlternatives(!showAlternatives)}
                  className="flex items-center gap-2 text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                >
                  <Lightbulb className="w-4 h-4" />
                  {showAlternatives ? 'Hide' : 'Show'} Alternative Solutions
                </button>
                <button
                  onClick={() => setShowMatchTester(!showMatchTester)}
                  className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  <Target className="w-4 h-4" />
                  {showMatchTester ? 'Hide' : 'Show'} Match-Specific Tester
                </button>
              </div>
              <p className="text-gray-600">
                Last updated: {lastUpdated.toLocaleTimeString()} • {selectedDate} • Auto-refresh every 5 minutes {!isOnline && '(Offline)'}
              </p>
              {error && (
                <div className="flex items-center gap-2 mt-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {parlaySelections.length > 0 && (
                <button
                  onClick={() => setShowParlay(!showParlay)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
                >
                  <Calculator className="w-4 h-4" />
                  Parlay ({parlaySelections.length})
                </button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search teams or leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                />
              </div>
              
              <button
                onClick={() => loadData(selectedDate)}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 ${
                  isOnline 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-400 text-white cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : isOnline ? 'Reload Data' : 'Offline'}
              </button>
              
              <button
                onClick={() => {
                  console.log('🔍 Manual extraction triggered');
                  // Force fresh extraction by clearing cache first
                  if (window.totelepepExtractor) {
                    window.totelepepExtractor.clearCache();
                  }
                  loadData(selectedDate);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                <Database className="w-4 h-4" />
                Extract Matches
              </button>
            </div>
          </div>

          <StatsCards matches={matches} />
          
          {showExtractor && (
            <DataExtractor onDataExtracted={handleDataExtracted} />
          )}
          
          {showEndpointDiscovery && (
            <EndpointDiscovery />
          )}
          
          {showResponseAnalyzer && (
            <ResponseAnalyzer />
          )}
          
          {showAlternatives && (
            <AlternativeSolutions />
          )}
          
          {showMatchTester && (
            <MatchSpecificTester />
          )}
          
          {searchTerm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-blue-800">
                <Search className="w-4 h-4" />
                <span className="font-medium">
                  Search Results: {totalFilteredMatches} of {totalMatches} matches
                </span>
              </div>
              {totalFilteredMatches === 0 && (
                <p className="text-blue-600 text-sm mt-1">
                  No matches found for "{searchTerm}". Try a different search term.
                </p>
              )}
            </div>
          )}
        </div>

        <DateGroupedMatches
          groupedMatches={filteredGroupedMatches}
          loading={loading}
          onPriceClick={handlePriceClick}
          selectedPrices={parlaySelections.map(s => `${s.matchId}-${s.priceType}`)}
        />
          </div>
          
          {showParlay && (
            <div className="lg:w-96">
              <ParlayBuilder
                selections={parlaySelections}
                onRemoveSelection={handleRemoveSelection}
                onClearAll={handleClearAll}
              />
            </div>
          )}
        </div>
      </main>
      
      <PWAInstallPrompt />
    </div>
  );
}

export default App;