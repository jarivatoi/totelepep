import React from 'react';
import { Clock, PlayCircle, CheckCircle } from 'lucide-react';
import { MatchData } from '../types/MatchData';
import PriceButton from './PriceButton';

interface MatchTableProps {
  matches: MatchData[];
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number) => void;
  selectedPrices: string[];
  showDate?: boolean;
}

const MatchTable: React.FC<MatchTableProps> = ({ 
  matches, 
  loading, 
  onPriceClick, 
  selectedPrices,
  showDate = true 
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'live':
        return <PlayCircle className="w-4 h-4 text-red-500" />;
      case 'finished':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'text-blue-600 bg-blue-50';
      case 'live':
        return 'text-red-600 bg-red-50';
      case 'finished':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading && matches.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading match data...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">No matches found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Match</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">1X2</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">O/U 2.5</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">BTTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {matches.map((match) => (
            <tr key={match.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">
                    {match.homeTeam} vs {match.awayTeam}
                  </div>
                  <div className="text-sm text-gray-600">{match.league}</div>
                  <div className="text-sm text-gray-500">
                    {showDate && match.date && (
                      <span className="mr-2">{new Date(match.date).toLocaleDateString('en-GB')}</span>
                    )}
                    {match.kickoff}
                  </div>
                  {match.status === 'live' && (
                    <div className="text-sm font-medium text-red-600">
                      {match.homeScore} - {match.awayScore} ({match.minute}')
                    </div>
                  )}
                </div>
              </td>
              
              <td className="px-6 py-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(match.status)}`}>
                  {getStatusIcon(match.status)}
                  {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                </div>
              </td>
              
              <td className="px-6 py-4">
                <div className="flex gap-2 justify-center">
                  <PriceButton
                    odds={match.homeOdds}
                    type="home"
                    onClick={() => onPriceClick(match.id, 'home', match.homeOdds)}
                    selected={selectedPrices.includes(`${match.id}-home`)}
                  />
                  <PriceButton
                    odds={match.drawOdds}
                    type="draw"
                    onClick={() => onPriceClick(match.id, 'draw', match.drawOdds)}
                    selected={selectedPrices.includes(`${match.id}-draw`)}
                  />
                  <PriceButton
                    odds={match.awayOdds}
                    type="away"
                    onClick={() => onPriceClick(match.id, 'away', match.awayOdds)}
                    selected={selectedPrices.includes(`${match.id}-away`)}
                  />
                </div>
              </td>
              
              <td className="px-6 py-4">
                <div className="flex gap-2 justify-center">
                  <PriceButton
                    odds={match.overUnder.over}
                    type="over"
                    onClick={() => onPriceClick(match.id, 'over', match.overUnder.over)}
                    selected={selectedPrices.includes(`${match.id}-over`)}
                  />
                  <PriceButton
                    odds={match.overUnder.under}
                    type="under"
                    onClick={() => onPriceClick(match.id, 'under', match.overUnder.under)}
                    selected={selectedPrices.includes(`${match.id}-under`)}
                  />
                </div>
              </td>
              
              <td className="px-6 py-4">
                <div className="flex gap-2 justify-center">
                  <PriceButton
                    odds={match.bothTeamsScore.yes}
                    type="yes"
                    onClick={() => onPriceClick(match.id, 'btts_yes', match.bothTeamsScore.yes)}
                    selected={selectedPrices.includes(`${match.id}-btts_yes`)}
                  />
                  <PriceButton
                    odds={match.bothTeamsScore.no}
                    type="no"
                    onClick={() => onPriceClick(match.id, 'btts_no', match.bothTeamsScore.no)}
                    selected={selectedPrices.includes(`${match.id}-btts_no`)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MatchTable;