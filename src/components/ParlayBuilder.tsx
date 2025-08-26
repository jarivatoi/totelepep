import React, { useState } from 'react';
import { Trash2, Calculator, DollarSign } from 'lucide-react';

export interface ParlaySelection {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  odds: number;
}

interface ParlayBuilderProps {
  selections: ParlaySelection[];
  onRemoveSelection: (matchId: string) => void;
  onClearAll: () => void;
}

const ParlayBuilder: React.FC<ParlayBuilderProps> = ({
  selections,
  onRemoveSelection,
  onClearAll,
}) => {
  const [betAmount, setBetAmount] = useState<number>(50);
  const [isPlacing, setIsPlacing] = useState(false);

  const totalOdds = selections.reduce((acc, selection) => acc * selection.odds, 1);
  const potentialPayout = betAmount * totalOdds;

  const handlePlaceBet = async () => {
    console.log('🎯 Place bet button clicked');
    console.log('📊 Current selections:', selections);
    console.log('💰 Bet amount:', betAmount);
    console.log('📈 Total odds:', totalOdds);

    if (selections.length === 0) {
      alert('Please add at least one selection to your parlay');
      return;
    }

    if (betAmount < 50) {
      alert('Minimum stake is MUR 50');
      return;
    }

    setIsPlacing(true);

    try {
      console.log('🚀 Attempting to place bet...');
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const ticket = {
        ticketId: `TICKET-${Date.now()}`,
        betAmount,
        totalOdds: Math.round(totalOdds * 100) / 100,
        potentialPayout: Math.round(potentialPayout * 100) / 100,
        selections: selections.map(sel => ({
          matchId: sel.matchId,
          homeTeam: sel.homeTeam,
          awayTeam: sel.awayTeam,
          selection: sel.selection,
          odds: sel.odds,
        })),
        timestamp: new Date().toISOString(),
        status: 'pending' as const,
      };

      console.log('✅ Bet placed successfully:', ticket);
      
      alert(`Bet placed successfully!\nTicket ID: ${ticket.ticketId}\nPotential Payout: MUR ${ticket.potentialPayout.toFixed(2)}`);
      
      // Clear selections after successful bet
      onClearAll();
      setBetAmount(50);
      
    } catch (error) {
      console.error('❌ Error placing bet:', error);
      alert('Failed to place bet. Please try again.');
    } finally {
      setIsPlacing(false);
    }
  };

  if (selections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Parlay Builder</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-2">No selections yet</p>
          <p className="text-sm text-gray-400">Click on odds to add them to your parlay</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Parlay Builder</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
            {selections.length} selection{selections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {selections.map((selection) => (
          <div
            key={selection.matchId}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium text-gray-800">
                {selection.homeTeam} vs {selection.awayTeam}
              </div>
              <div className="text-sm text-gray-600">{selection.selection}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-blue-600">{selection.odds.toFixed(2)}</span>
              <button
                onClick={() => onRemoveSelection(selection.matchId)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stake Amount (MUR)
            </label>
            <input
              type="number"
              min="50"
              step="10"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(50, parseInt(e.target.value) || 50))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum: MUR 50</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Odds
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md font-bold text-lg text-blue-600">
              {totalOdds.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Potential Payout:</span>
            <span className="text-2xl font-bold text-blue-600">
              MUR {potentialPayout.toFixed(2)}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Stake: MUR {betAmount.toFixed(2)} × Odds: {totalOdds.toFixed(2)}
          </div>
        </div>

        <button
          onClick={handlePlaceBet}
          disabled={isPlacing || selections.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isPlacing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Placing Bet...
            </>
          ) : (
            <>
              <DollarSign className="w-5 h-5" />
              Place Parlay Bet
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ParlayBuilder;