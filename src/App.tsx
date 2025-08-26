import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Calendar, AlertCircle, Calculator } from 'lucide-react';
import DateGroupedMatches from './components/DateGroupedMatches';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import ParlayBuilder, { ParlaySelection } from './components/ParlayBuilder';
import { totelepepService, TotelepepMatch } from './services/totelepepService';

function App() {
  const [matches, setMatches] = useState<TotelepepMatch[]>([]);
  const [groupedMatches, setGroupedMatches] = useState<Record<string, TotelepepMatch[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [parlaySelections, setParlaySelections] = useState<ParlaySelection[]>([]);
  const [showParlay, setShowParlay] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching data from Totelepep...');
      const fetchedMatches = await totelepepService.getMatches();
      
      // Sort matches by date and time
      const sortedMatches = totelepepService.sortMatchesByDate(fetchedMatches);
      setMatches(sortedMatches);
      
      // Group matches by date
      const grouped = totelepepService.groupMatchesByDate(sortedMatches);
      setGroupedMatches(grouped);
      
      setLastUpdated(new Date());
      console.log(`Loaded ${sortedMatches.length} matches from Totelepep`);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data from Totelepep.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Auto-reload every 5 minutes for live data
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">All Totelepep Matches - Global Coverage</h1>
              <p className="text-gray-600">
                Last updated: {lastUpdated.toLocaleTimeString()} • All leagues worldwide • Auto-refresh every 5 minutes
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
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Reload Data'}
              </button>
            </div>
          </div>

          <StatsCards matches={matches} />
          
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
    </div>
  );
}

export default App;