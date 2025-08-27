import React, { useState } from 'react';
import { Trash2, Calculator, DollarSign } from 'lucide-react';

// Totelepep betting API integration
const placeTotelepepBet = async (selections: ParlaySelection[], stake: number) => {
  try {
    // Build the form data in Totelepep's exact format
    const formData = new URLSearchParams();
    
    // Multi-bet data (empty for single bets)
    formData.append('data[MultiStake]', '');
    
    // Add each selection as SingleBets array
    selections.forEach((selection, index) => {
      // Generate betRef (format: matchId-optionNo)
      const betRef = `${selection.matchId}-1`;
      
      // Map selection type to option details
      const optionDetails = getOptionDetails(selection);
      
      formData.append(`data[SingleBets][${index}][betRef]`, betRef);
      formData.append(`data[SingleBets][${index}][isRacing]`, 'false');
      formData.append(`data[SingleBets][${index}][legNo]`, '1');
      formData.append(`data[SingleBets][${index}][matchName]`, `${selection.homeTeam} v ${selection.awayTeam}`);
      formData.append(`data[SingleBets][${index}][matchStartTime]`, selection.kickoff || '15:00');
      formData.append(`data[SingleBets][${index}][matchRunTime]`, '0');
      formData.append(`data[SingleBets][${index}][optionNo]`, optionDetails.optionNo);
      formData.append(`data[SingleBets][${index}][optionCode]`, optionDetails.optionCode);
      formData.append(`data[SingleBets][${index}][optionName]`, optionDetails.optionName);
      formData.append(`data[SingleBets][${index}][optionOdd]`, selection.odds.toString());
      formData.append(`data[SingleBets][${index}][optionPreviousOdd]`, selection.odds.toString());
      formData.append(`data[SingleBets][${index}][sportName]`, 'Soccer');
      formData.append(`data[SingleBets][${index}][sportIcon]`, 'soccer_icn');
      formData.append(`data[SingleBets][${index}][competitionName]`, selection.league || 'Football League');
      formData.append(`data[SingleBets][${index}][competitionId]`, '52'); // Default competition ID
      formData.append(`data[SingleBets][${index}][marketId]`, selection.matchId);
      formData.append(`data[SingleBets][${index}][marketBookNo]`, '93605'); // Default market book number
      formData.append(`data[SingleBets][${index}][marketCode]`, 'CP'); // 1X2 market code
      formData.append(`data[SingleBets][${index}][marketLine]`, '');
      formData.append(`data[SingleBets][${index}][marketIsLive]`, '0');
      formData.append(`data[SingleBets][${index}][marketIsRacing]`, '0');
      formData.append(`data[SingleBets][${index}][marketPeriodCode]`, 'FT');
      formData.append(`data[SingleBets][${index}][marketDisplayName]`, '1 X 2');
      formData.append(`data[SingleBets][${index}][stake]`, stake.toString());
      formData.append(`data[SingleBets][${index}][returnAmount]`, (stake * selection.odds).toFixed(2));
      formData.append(`data[SingleBets][${index}][potentialPayout]`, '');
      formData.append(`data[SingleBets][${index}][ticketNo]`, '');
      formData.append(`data[SingleBets][${index}][taxAmount]`, '');
      formData.append(`data[SingleBets][${index}][rebatePercentage]`, '0');
      formData.append(`data[SingleBets][${index}][rebateAmount]`, '');
      formData.append(`data[SingleBets][${index}][bonusPercentage]`, '0');
      formData.append(`data[SingleBets][${index}][bonusAmount]`, '');
      formData.append(`data[SingleBets][${index}][betErrorCode]`, '0');
      formData.append(`data[SingleBets][${index}][betErrorMessage]`, 'null');
      formData.append(`data[SingleBets][${index}][legErrorCode]`, '0');
      formData.append(`data[SingleBets][${index}][legErrorMessage]`, 'None');
      formData.append(`data[SingleBets][${index}][meetingId]`, '0');
      formData.append(`data[SingleBets][${index}][raceId]`, '0');
      formData.append(`data[SingleBets][${index}][raceNo]`, '');
      formData.append(`data[SingleBets][${index}][runnerNo]`, '');
      formData.append(`data[SingleBets][${index}][runnerName]`, '');
      formData.append(`data[SingleBets][${index}][barrierNo]`, '0');
      formData.append(`data[SingleBets][${index}][racingName]`, '');
      formData.append(`data[SingleBets][${index}][priceTag]`, '');
      formData.append(`data[SingleBets][${index}][market]`, '');
    });
    
    // Proxy bet flag
    formData.append('data[ProxyBet]', '0');
    
    console.log('📡 Sending Totelepep bet request:', formData.toString());
    
    const response = await fetch('/api/webapi/placebet', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📄 Totelepep response:', result);
    
    return {
      success: !result.errorMessage || result.ticketNo,
      ticketNo: result.ticketNo,
      potentialPayout: result.potentialPayout,
      errorMessage: result.errorMessage,
      multiErrorMessage: result.multiErrorMessage,
      balanceAmount: result.balanceAmount,
      betList: result.betList
    };
    
  } catch (error) {
    console.error('❌ Totelepep API error:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Network error'
    };
  }
};

// Map selection types to Totelepep option format
const getOptionDetails = (selection: ParlaySelection) => {
  switch (selection.priceType) {
    case 'home':
      return {
        optionNo: '1',
        optionCode: 'H',
        optionName: selection.homeTeam
      };
    case 'draw':
      return {
        optionNo: '2',
        optionCode: 'D',
        optionName: 'Draw'
      };
    case 'away':
      return {
        optionNo: '3',
        optionCode: 'A',
        optionName: selection.awayTeam
      };
    default:
      return {
        optionNo: '1',
        optionCode: 'H',
        optionName: selection.homeTeam
      };
  }
};

export interface ParlaySelection {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  priceType: string;
  odds: number;
  league?: string;
  kickoff?: string;
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
      
      // Use real Totelepep booking API
      const bookingResult = await placeTotelepepBet(selections, betAmount);
      
      if (bookingResult.success && bookingResult.ticketNo) {
        console.log('✅ Totelepep booking successful:', bookingResult);
        
        alert(`Booking successful!\nTicket Number: ${bookingResult.ticketNo}\nPotential Payout: MUR ${bookingResult.potentialPayout}`);
        
        // Clear selections after successful booking
        onClearAll();
        setBetAmount(50);
      } else {
        console.error('❌ Totelepep booking failed:', bookingResult);
        alert(`Booking failed: ${bookingResult.errorMessage || 'Please try again'}`);
      }
      
    } catch (error) {
      console.error('❌ Error placing Totelepep bet:', error);
      alert('Failed to connect to Totelepep. Please try again.');
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
               <div className="text-sm text-gray-600">
                 {selection.priceType === 'home' ? selection.homeTeam : 
                  selection.priceType === 'draw' ? 'Draw' : 
                  selection.priceType === 'away' ? selection.awayTeam :
                  selection.priceType === 'over' ? 'Over 2.5' :
                  selection.priceType === 'under' ? 'Under 2.5' :
                  selection.priceType === 'btts_yes' ? 'Both Teams to Score - Yes' :
                  selection.priceType === 'btts_no' ? 'Both Teams to Score - No' :
                  selection.priceType}
               </div>
               <div className="text-xs text-gray-500">
                 {selection.league} • {selection.kickoff}
               </div>
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