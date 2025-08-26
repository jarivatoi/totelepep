export interface MatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  date?: string;
  status: 'upcoming' | 'live' | 'finished';
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  overUnder: {
    over: number;
    under: number;
    line: number;
  };
  bothTeamsScore: {
    yes: number;
    no: number;
  };
  homeScore?: number;
  awayScore?: number;
  minute?: number;
}

export interface PriceButtonProps {
  odds: number;
  onClick: () => void;
  type: 'home' | 'draw' | 'away' | 'over' | 'under' | 'yes' | 'no';
  disabled?: boolean;
  selected?: boolean;
}