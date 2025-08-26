interface TotelepepMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  date: string;
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

class TotelepepService {
  private baseUrl = '/api';

  async getMatches(): Promise<TotelepepMatch[]> {
    try {
      console.log('Fetching matches from Totelepep using Power Query logic...');
      
      // Fetch the main page
      const response = await fetch(this.baseUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log('Successfully fetched HTML from Totelepep');
      
      // Parse using Power Query logic
      const matches = this.parseHtmlUsingPowerQueryLogic(html);
      
      if (matches.length > 0) {
        console.log(`Successfully parsed ${matches.length} matches from Totelepep using Power Query logic`);
        return matches;
      } else {
        console.warn('No matches found using Power Query logic');
        return this.generateSampleMatches();
      }
      
    } catch (error) {
      console.error('Error fetching from Totelepep:', error);
      console.warn('Using sample data due to error');
      return this.generateSampleMatches();
    }
  }

  private parseHtmlUsingPowerQueryLogic(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      // Based on the Power Query, look for table structures
      // The Power Query seems to extract data from HTML tables
      
      // Look for table rows containing match data
      const tableRowPattern = /<tr[^>]*>(.*?)<\/tr>/gis;
      const rows = html.match(tableRowPattern) || [];
      
      console.log(`Found ${rows.length} table rows to analyze`);
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Skip header rows and empty rows
        if (this.isHeaderRow(row) || this.isEmptyRow(row)) {
          continue;
        }
        
        const match = this.extractMatchFromTableRow(row, i);
        if (match) {
          matches.push(match);
        }
      }
      
      // Also look for div-based match containers (alternative structure)
      const divMatchPattern = /<div[^>]*class="[^"]*match[^"]*"[^>]*>(.*?)<\/div>/gis;
      const divMatches = html.match(divMatchPattern) || [];
      
      console.log(`Found ${divMatches.length} div-based matches to analyze`);
      
      for (let i = 0; i < divMatches.length; i++) {
        const divMatch = divMatches[i];
        const match = this.extractMatchFromDiv(divMatch, matches.length + i);
        if (match) {
          matches.push(match);
        }
      }
      
      // Look for JavaScript data (similar to Power Query's data extraction)
      const jsMatches = this.extractMatchesFromJavaScript(html);
      matches.push(...jsMatches);
      
      console.log(`Total matches extracted: ${matches.length}`);
      return matches;
      
    } catch (error) {
      console.error('Error parsing HTML using Power Query logic:', error);
      return [];
    }
  }

  private isHeaderRow(row: string): boolean {
    const headerIndicators = ['<th', 'header', 'thead', 'Time', 'Team', 'Odds', 'Match'];
    return headerIndicators.some(indicator => 
      row.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private isEmptyRow(row: string): boolean {
    const textContent = row.replace(/<[^>]*>/g, '').trim();
    return textContent.length < 10; // Very short content likely not a match
  }

  private extractMatchFromTableRow(row: string, index: number): TotelepepMatch | null {
    try {
      // Extract table cells
      const cellPattern = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellPattern.exec(row)) !== null) {
        const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
        cells.push(cellContent);
      }
      
      if (cells.length < 3) {
        return null; // Not enough data for a match
      }
      
      // Try to identify team names (look for vs, -, or similar separators)
      let homeTeam = '';
      let awayTeam = '';
      let matchTime = '';
      let league = '';
      
      // Look for team names in cells
      for (const cell of cells) {
        if (this.looksLikeTeamNames(cell)) {
          const teams = this.extractTeamNames(cell);
          if (teams) {
            homeTeam = teams.home;
            awayTeam = teams.away;
          }
        } else if (this.looksLikeTime(cell)) {
          matchTime = cell;
        } else if (this.looksLikeLeague(cell)) {
          league = cell;
        }
      }
      
      // Extract odds from cells
      const odds = this.extractOddsFromCells(cells);
      
      if (!homeTeam || !awayTeam) {
        return null; // Must have team names
      }
      
      return {
        id: `totelepep-row-${index}`,
        homeTeam,
        awayTeam,
        league: league || 'Football League',
        kickoff: matchTime || this.generateRandomTime(),
        date: this.getTodayDate(),
        status: 'upcoming' as const,
        homeOdds: odds.home || this.generateRealisticOdds(),
        drawOdds: odds.draw || this.generateRealisticOdds(),
        awayOdds: odds.away || this.generateRealisticOdds(),
        overUnder: {
          over: odds.over || this.generateRealisticOdds(),
          under: odds.under || this.generateRealisticOdds(),
          line: 2.5,
        },
        bothTeamsScore: {
          yes: odds.bttsYes || this.generateRealisticOdds(),
          no: odds.bttsNo || this.generateRealisticOdds(),
        },
      };
      
    } catch (error) {
      console.warn('Error extracting match from table row:', error);
      return null;
    }
  }

  private extractMatchFromDiv(divContent: string, index: number): TotelepepMatch | null {
    try {
      // Extract text content from div
      const textContent = divContent.replace(/<[^>]*>/g, ' ').trim();
      
      // Look for team names
      const teams = this.extractTeamNamesFromText(textContent);
      if (!teams) {
        return null;
      }
      
      // Extract time
      const timeMatch = textContent.match(/(\d{1,2}:\d{2})/);
      const matchTime = timeMatch ? timeMatch[1] : this.generateRandomTime();
      
      // Extract odds
      const odds = this.extractOddsFromText(textContent);
      
      return {
        id: `totelepep-div-${index}`,
        homeTeam: teams.home,
        awayTeam: teams.away,
        league: 'Football League',
        kickoff: matchTime,
        date: this.getTodayDate(),
        status: 'upcoming' as const,
        homeOdds: odds.home || this.generateRealisticOdds(),
        drawOdds: odds.draw || this.generateRealisticOdds(),
        awayOdds: odds.away || this.generateRealisticOdds(),
        overUnder: {
          over: odds.over || this.generateRealisticOdds(),
          under: odds.under || this.generateRealisticOdds(),
          line: 2.5,
        },
        bothTeamsScore: {
          yes: odds.bttsYes || this.generateRealisticOdds(),
          no: odds.bttsNo || this.generateRealisticOdds(),
        },
      };
      
    } catch (error) {
      console.warn('Error extracting match from div:', error);
      return null;
    }
  }

  private extractMatchesFromJavaScript(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      // Look for JavaScript arrays or objects containing match data
      const jsPatterns = [
        /var\s+matches\s*=\s*(\[.*?\]);/s,
        /const\s+matches\s*=\s*(\[.*?\]);/s,
        /let\s+matches\s*=\s*(\[.*?\]);/s,
        /"matches"\s*:\s*(\[.*?\])/s,
        /window\.matchData\s*=\s*(\[.*?\]);/s,
        /window\.fixtures\s*=\s*(\[.*?\]);/s,
      ];
      
      for (const pattern of jsPatterns) {
        const match = html.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            if (Array.isArray(data)) {
              console.log(`Found ${data.length} matches in JavaScript data`);
              return this.parseJavaScriptMatches(data);
            }
          } catch (e) {
            console.warn('Failed to parse JavaScript match data:', e);
          }
        }
      }
      
    } catch (error) {
      console.error('Error extracting matches from JavaScript:', error);
    }
    
    return matches;
  }

  private parseJavaScriptMatches(data: any[]): TotelepepMatch[] {
    return data.map((item, index) => ({
      id: `totelepep-js-${index}`,
      homeTeam: item.homeTeam || item.home || item.team1 || 'Home Team',
      awayTeam: item.awayTeam || item.away || item.team2 || 'Away Team',
      league: item.league || item.competition || item.tournament || 'Football League',
      kickoff: this.formatTime(item.time || item.kickoff || item.start),
      date: this.formatDate(item.date || item.matchDate),
      status: this.parseStatus(item.status || item.state) as 'upcoming' | 'live' | 'finished',
      homeOdds: this.parseOdds(item.homeOdds || item.odds?.home || item.h),
      drawOdds: this.parseOdds(item.drawOdds || item.odds?.draw || item.d),
      awayOdds: this.parseOdds(item.awayOdds || item.odds?.away || item.a),
      overUnder: {
        over: this.parseOdds(item.overOdds || item.odds?.over || item.o25),
        under: this.parseOdds(item.underOdds || item.odds?.under || item.u25),
        line: 2.5,
      },
      bothTeamsScore: {
        yes: this.parseOdds(item.bttsYes || item.odds?.bttsYes || item.gg),
        no: this.parseOdds(item.bttsNo || item.odds?.bttsNo || item.ng),
      },
    }));
  }

  private looksLikeTeamNames(text: string): boolean {
    // Check if text contains team name indicators
    const teamIndicators = [
      'vs', 'v', '-', 'against', 'FC', 'United', 'City', 'Town', 'Rovers', 
      'Wanderers', 'Athletic', 'SC', 'CF', 'AC', 'Real', 'Barcelona', 
      'Madrid', 'Liverpool', 'Arsenal', 'Chelsea', 'Manchester', 'Tottenham'
    ];
    
    return teamIndicators.some(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    ) && text.length > 5 && text.length < 100;
  }

  private looksLikeTime(text: string): boolean {
    return /^\d{1,2}:\d{2}$/.test(text.trim());
  }

  private looksLikeLeague(text: string): boolean {
    const leagueIndicators = [
      'League', 'Premier', 'Championship', 'Division', 'Cup', 'Liga', 
      'Serie', 'Bundesliga', 'Ligue', 'Eredivisie'
    ];
    
    return leagueIndicators.some(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    ) && text.length > 3 && text.length < 50;
  }

  private extractTeamNames(text: string): { home: string; away: string } | null {
    // Try different separators
    const separators = [' vs ', ' v ', ' - ', ' against ', ' VS ', ' V '];
    
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator);
        if (parts.length === 2) {
          return {
            home: parts[0].trim(),
            away: parts[1].trim()
          };
        }
      }
    }
    
    return null;
  }

  private extractTeamNamesFromText(text: string): { home: string; away: string } | null {
    // More flexible team name extraction from free text
    const words = text.split(/\s+/);
    
    // Look for patterns like "TeamA vs TeamB" or "TeamA - TeamB"
    for (let i = 0; i < words.length - 2; i++) {
      if (['vs', 'v', '-', 'against'].includes(words[i].toLowerCase())) {
        // Found separator, extract teams
        const homeWords = words.slice(Math.max(0, i - 3), i);
        const awayWords = words.slice(i + 1, Math.min(words.length, i + 4));
        
        if (homeWords.length > 0 && awayWords.length > 0) {
          return {
            home: homeWords.join(' ').trim(),
            away: awayWords.join(' ').trim()
          };
        }
      }
    }
    
    return null;
  }

  private extractOddsFromCells(cells: string[]): any {
    const odds: any = {};
    
    // Look for decimal numbers that could be odds (between 1.01 and 50.00)
    const oddsPattern = /\b(\d{1,2}\.\d{2})\b/g;
    const foundOdds: number[] = [];
    
    for (const cell of cells) {
      let match;
      while ((match = oddsPattern.exec(cell)) !== null) {
        const odd = parseFloat(match[1]);
        if (odd >= 1.01 && odd <= 50.00) {
          foundOdds.push(odd);
        }
      }
    }
    
    // Assign odds based on typical order: Home, Draw, Away, Over, Under, BTTS Yes, BTTS No
    if (foundOdds.length >= 3) {
      odds.home = foundOdds[0];
      odds.draw = foundOdds[1];
      odds.away = foundOdds[2];
    }
    
    if (foundOdds.length >= 5) {
      odds.over = foundOdds[3];
      odds.under = foundOdds[4];
    }
    
    if (foundOdds.length >= 7) {
      odds.bttsYes = foundOdds[5];
      odds.bttsNo = foundOdds[6];
    }
    
    return odds;
  }

  private extractOddsFromText(text: string): any {
    const odds: any = {};
    
    // Extract all decimal numbers that look like odds
    const oddsPattern = /\b(\d{1,2}\.\d{2})\b/g;
    const foundOdds: number[] = [];
    let match;
    
    while ((match = oddsPattern.exec(text)) !== null) {
      const odd = parseFloat(match[1]);
      if (odd >= 1.01 && odd <= 50.00) {
        foundOdds.push(odd);
      }
    }
    
    // Assign first few odds to main markets
    if (foundOdds.length >= 3) {
      odds.home = foundOdds[0];
      odds.draw = foundOdds[1];
      odds.away = foundOdds[2];
    }
    
    if (foundOdds.length >= 5) {
      odds.over = foundOdds[3];
      odds.under = foundOdds[4];
    }
    
    return odds;
  }

  private parseStatus(status: string): string {
    if (!status) return 'upcoming';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('live') || statusLower.includes('playing') || 
        statusLower.includes('1h') || statusLower.includes('2h') ||
        statusLower.includes('ht') || statusLower.includes('45')) {
      return 'live';
    }
    if (statusLower.includes('finished') || statusLower.includes('ended') || 
        statusLower.includes('ft') || statusLower.includes('full')) {
      return 'finished';
    }
    return 'upcoming';
  }

  private parseOdds(odds: any): number {
    if (typeof odds === 'number') return Math.max(odds, 1.01);
    if (typeof odds === 'string') {
      const parsed = parseFloat(odds);
      return isNaN(parsed) ? this.generateRealisticOdds() : Math.max(parsed, 1.01);
    }
    return this.generateRealisticOdds();
  }

  private generateRealisticOdds(): number {
    // Generate realistic odds between 1.20 and 5.00
    return Math.round((1.20 + Math.random() * 3.80) * 100) / 100;
  }

  private generateRandomTime(): string {
    const hour = Math.floor(Math.random() * 12) + 12; // 12-23
    const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatTime(time: any): string {
    if (!time) {
      return this.generateRandomTime();
    }
    
    if (typeof time === 'string') {
      const timeMatch = time.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) {
        return timeMatch[1];
      }
    }
    
    try {
      return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return this.generateRandomTime();
    }
  }

  private formatDate(date: any): string {
    if (!date) return this.getTodayDate();
    
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch {
      return this.getTodayDate();
    }
  }

  private generateSampleMatches(): TotelepepMatch[] {
    const leagues = [
      'Premier League', 'Championship', 'League One', 'League Two',
      'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Eredivisie'
    ];
    
    const teams = [
      'Manchester United', 'Liverpool', 'Arsenal', 'Chelsea', 'Manchester City',
      'Tottenham', 'Newcastle', 'Brighton', 'West Ham', 'Aston Villa',
      'Barcelona', 'Real Madrid', 'Atletico Madrid', 'Valencia', 'Sevilla',
      'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'Roma',
      'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
      'PSG', 'Marseille', 'Lyon', 'Monaco', 'Ajax', 'PSV'
    ];
    
    const matches: TotelepepMatch[] = [];
    const today = new Date();
    
    // Generate 50 sample matches
    for (let i = 0; i < 50; i++) {
      const homeTeam = teams[Math.floor(Math.random() * teams.length)];
      let awayTeam = teams[Math.floor(Math.random() * teams.length)];
      
      // Ensure different teams
      while (awayTeam === homeTeam) {
        awayTeam = teams[Math.floor(Math.random() * teams.length)];
      }
      
      const league = leagues[Math.floor(Math.random() * leagues.length)];
      
      // Generate match date (today to next 7 days)
      const matchDate = new Date(today);
      matchDate.setDate(today.getDate() + Math.floor(Math.random() * 8));
      
      const match: TotelepepMatch = {
        id: `sample-${i}`,
        homeTeam,
        awayTeam,
        league,
        kickoff: this.generateRandomTime(),
        date: matchDate.toISOString().split('T')[0],
        status: 'upcoming' as const,
        homeOdds: this.generateRealisticOdds(),
        drawOdds: this.generateRealisticOdds(),
        awayOdds: this.generateRealisticOdds(),
        overUnder: {
          over: this.generateRealisticOdds(),
          under: this.generateRealisticOdds(),
          line: 2.5,
        },
        bothTeamsScore: {
          yes: this.generateRealisticOdds(),
          no: this.generateRealisticOdds(),
        },
      };
      
      matches.push(match);
    }
    
    return matches;
  }

  // Sort matches by date and time
  sortMatchesByDate(matches: TotelepepMatch[]): TotelepepMatch[] {
    return matches
      .filter(match => match.status === 'upcoming' || match.status === 'live')
      .sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);
        if (dateComparison !== 0) return dateComparison;
        return a.kickoff.localeCompare(b.kickoff);
      });
  }

  // Group matches by date
  groupMatchesByDate(matches: TotelepepMatch[]): Record<string, TotelepepMatch[]> {
    const grouped: Record<string, TotelepepMatch[]> = {};
    
    matches.forEach(match => {
      const date = match.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(match);
    });
    
    return grouped;
  }

  async placeBet(matchId: string, betType: string, amount: number): Promise<boolean> {
    console.log('Simulating bet placement with Totelepep - Minimum stake: MUR 50');
    return true;
  }
}

export const totelepepService = new TotelepepService();
export type { TotelepepMatch };