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
      console.log('🔍 Fetching matches from Totelepep using Power Query logic...');
      
      // Fetch the main Totelepep page
      const response = await fetch(this.baseUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log('✅ Successfully fetched HTML from Totelepep');
      console.log(`📄 HTML length: ${html.length} characters`);
      
      // Use Power Query extraction logic
      const matches = this.extractMatchesUsingPowerQuery(html);
      
      console.log(`🎯 Extracted ${matches.length} matches using Power Query logic`);
      return matches;
      
    } catch (error) {
      console.error('❌ Error fetching from Totelepep:', error);
      throw new Error(`Failed to fetch matches from Totelepep: ${error.message}`);
    }
  }

  private extractMatchesUsingPowerQuery(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      console.log('🔧 Starting Power Query extraction...');
      
      // Step 1: Look for HTML tables (Power Query typically extracts from tables)
      const tableMatches = /<table[^>]*>(.*?)<\/table>/gis;
      const tables = html.match(tableMatches) || [];
      
      console.log(`📊 Found ${tables.length} tables to analyze`);
      
      for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
        const table = tables[tableIndex];
        console.log(`🔍 Analyzing table ${tableIndex + 1}...`);
        
        // Extract rows from this table
        const rowMatches = /<tr[^>]*>(.*?)<\/tr>/gis;
        const rows = table.match(rowMatches) || [];
        
        console.log(`📋 Found ${rows.length} rows in table ${tableIndex + 1}`);
        
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          
          // Skip header rows
          if (this.isHeaderRow(row)) {
            continue;
          }
          
          const match = this.extractMatchFromRow(row, `table${tableIndex}-row${rowIndex}`);
          if (match) {
            matches.push(match);
            console.log(`✅ Extracted match: ${match.homeTeam} vs ${match.awayTeam}`);
          }
        }
      }
      
      // Step 2: Look for div-based match containers
      const divMatches = this.extractFromDivContainers(html);
      matches.push(...divMatches);
      
      // Step 3: Look for JavaScript embedded data
      const jsMatches = this.extractFromJavaScript(html);
      matches.push(...jsMatches);
      
      console.log(`🎯 Total matches extracted: ${matches.length}`);
      
      if (matches.length === 0) {
        console.warn('⚠️ No matches found using Power Query logic');
        console.log('📝 HTML sample for debugging:');
        console.log(html.substring(0, 1000) + '...');
      }
      
      return matches;
      
    } catch (error) {
      console.error('❌ Error in Power Query extraction:', error);
      return [];
    }
  }

  private isHeaderRow(row: string): boolean {
    const headerIndicators = [
      '<th', 'thead', 'header', 'Header', 'HEADER',
      'Time', 'Team', 'Teams', 'Match', 'Odds', 'League',
      'Competition', 'Event', 'Fixture'
    ];
    
    return headerIndicators.some(indicator => 
      row.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private extractMatchFromRow(row: string, id: string): TotelepepMatch | null {
    try {
      // Extract all cell contents
      const cellMatches = /<td[^>]*>(.*?)<\/td>/gis;
      const cells: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellMatches.exec(row)) !== null) {
        const cellContent = this.cleanHtmlContent(cellMatch[1]);
        if (cellContent.trim()) {
          cells.push(cellContent.trim());
        }
      }
      
      if (cells.length < 3) {
        return null; // Not enough data for a match
      }
      
      console.log(`🔍 Analyzing row with ${cells.length} cells:`, cells);
      
      // Extract team names
      const teamInfo = this.extractTeamNames(cells);
      if (!teamInfo) {
        return null;
      }
      
      // Extract time
      const matchTime = this.extractTime(cells);
      
      // Extract league
      const league = this.extractLeague(cells);
      
      // Extract odds
      const odds = this.extractOdds(cells);
      
      return {
        id,
        homeTeam: teamInfo.home,
        awayTeam: teamInfo.away,
        league: league || 'Football League',
        kickoff: matchTime || this.generateTime(),
        date: this.getTodayDate(),
        status: 'upcoming' as const,
        homeOdds: odds.home || 2.50,
        drawOdds: odds.draw || 3.20,
        awayOdds: odds.away || 2.80,
        overUnder: {
          over: odds.over || 1.90,
          under: odds.under || 1.90,
          line: 2.5,
        },
        bothTeamsScore: {
          yes: odds.bttsYes || 1.80,
          no: odds.bttsNo || 2.00,
        },
      };
      
    } catch (error) {
      console.warn('⚠️ Error extracting match from row:', error);
      return null;
    }
  }

  private cleanHtmlContent(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')   // Replace &nbsp; with space
      .replace(/&amp;/g, '&')   // Replace &amp; with &
      .replace(/&lt;/g, '<')    // Replace &lt; with <
      .replace(/&gt;/g, '>')    // Replace &gt; with >
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();
  }

  private extractTeamNames(cells: string[]): { home: string; away: string } | null {
    // Look for cells containing team names (vs, -, etc.)
    for (const cell of cells) {
      const teamSeparators = [' vs ', ' v ', ' - ', ' x ', ' VS ', ' V ', ' X '];
      
      for (const separator of teamSeparators) {
        if (cell.includes(separator)) {
          const parts = cell.split(separator);
          if (parts.length === 2) {
            return {
              home: parts[0].trim(),
              away: parts[1].trim()
            };
          }
        }
      }
      
      // Also check for team names in separate cells
      if (this.looksLikeTeamName(cell)) {
        // Find the next cell that also looks like a team name
        const cellIndex = cells.indexOf(cell);
        for (let i = cellIndex + 1; i < cells.length; i++) {
          if (this.looksLikeTeamName(cells[i])) {
            return {
              home: cell,
              away: cells[i]
            };
          }
        }
      }
    }
    
    return null;
  }

  private looksLikeTeamName(text: string): boolean {
    // Team name indicators
    const teamIndicators = [
      'FC', 'United', 'City', 'Town', 'Rovers', 'Wanderers', 'Athletic', 
      'SC', 'CF', 'AC', 'Real', 'Barcelona', 'Madrid', 'Liverpool', 
      'Arsenal', 'Chelsea', 'Manchester', 'Tottenham', 'Bayern', 'Juventus'
    ];
    
    // Should be reasonable length and contain team indicators
    return text.length > 2 && text.length < 50 && 
           (teamIndicators.some(indicator => text.includes(indicator)) || 
            /^[A-Za-z\s]+$/.test(text)); // Only letters and spaces
  }

  private extractTime(cells: string[]): string | null {
    for (const cell of cells) {
      // Look for time patterns (HH:MM)
      const timeMatch = cell.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) {
        return timeMatch[1];
      }
    }
    return null;
  }

  private extractLeague(cells: string[]): string | null {
    const leagueIndicators = [
      'Premier League', 'Championship', 'League', 'Liga', 'Serie', 
      'Bundesliga', 'Ligue', 'Eredivisie', 'Cup', 'Champions', 'Europa'
    ];
    
    for (const cell of cells) {
      if (leagueIndicators.some(indicator => 
        cell.toLowerCase().includes(indicator.toLowerCase())
      )) {
        return cell;
      }
    }
    return null;
  }

  private extractOdds(cells: string[]): any {
    const odds: any = {};
    const foundOdds: number[] = [];
    
    // Extract all decimal numbers that look like odds
    for (const cell of cells) {
      const oddsMatches = cell.match(/\b(\d{1,2}\.\d{2})\b/g);
      if (oddsMatches) {
        for (const oddStr of oddsMatches) {
          const odd = parseFloat(oddStr);
          if (odd >= 1.01 && odd <= 50.00) {
            foundOdds.push(odd);
          }
        }
      }
    }
    
    // Assign odds in typical order: Home, Draw, Away, Over, Under, BTTS Yes, BTTS No
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

  private extractFromDivContainers(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for div containers that might contain match data
    const divPatterns = [
      /<div[^>]*class="[^"]*match[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*fixture[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*game[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*event[^"]*"[^>]*>(.*?)<\/div>/gis
    ];
    
    for (const pattern of divPatterns) {
      const divMatches = html.match(pattern) || [];
      console.log(`🔍 Found ${divMatches.length} div containers with pattern`);
      
      for (let i = 0; i < divMatches.length; i++) {
        const match = this.extractMatchFromDiv(divMatches[i], `div-${i}`);
        if (match) {
          matches.push(match);
        }
      }
    }
    
    return matches;
  }

  private extractMatchFromDiv(divContent: string, id: string): TotelepepMatch | null {
    const textContent = this.cleanHtmlContent(divContent);
    
    // Extract team names
    const teamInfo = this.extractTeamNamesFromText(textContent);
    if (!teamInfo) {
      return null;
    }
    
    // Extract time
    const timeMatch = textContent.match(/(\d{1,2}:\d{2})/);
    const matchTime = timeMatch ? timeMatch[1] : null;
    
    // Extract odds
    const odds = this.extractOddsFromText(textContent);
    
    return {
      id,
      homeTeam: teamInfo.home,
      awayTeam: teamInfo.away,
      league: 'Football League',
      kickoff: matchTime || this.generateTime(),
      date: this.getTodayDate(),
      status: 'upcoming' as const,
      homeOdds: odds.home || 2.50,
      drawOdds: odds.draw || 3.20,
      awayOdds: odds.away || 2.80,
      overUnder: {
        over: odds.over || 1.90,
        under: odds.under || 1.90,
        line: 2.5,
      },
      bothTeamsScore: {
        yes: odds.bttsYes || 1.80,
        no: odds.bttsNo || 2.00,
      },
    };
  }

  private extractTeamNamesFromText(text: string): { home: string; away: string } | null {
    const separators = [' vs ', ' v ', ' - ', ' x ', ' VS ', ' V ', ' X ', ' against '];
    
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator);
        if (parts.length >= 2) {
          return {
            home: parts[0].trim(),
            away: parts[1].trim()
          };
        }
      }
    }
    
    return null;
  }

  private extractOddsFromText(text: string): any {
    const odds: any = {};
    const foundOdds: number[] = [];
    
    const oddsMatches = text.match(/\b(\d{1,2}\.\d{2})\b/g);
    if (oddsMatches) {
      for (const oddStr of oddsMatches) {
        const odd = parseFloat(oddStr);
        if (odd >= 1.01 && odd <= 50.00) {
          foundOdds.push(odd);
        }
      }
    }
    
    if (foundOdds.length >= 3) {
      odds.home = foundOdds[0];
      odds.draw = foundOdds[1];
      odds.away = foundOdds[2];
    }
    
    return odds;
  }

  private extractFromJavaScript(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for JavaScript variables containing match data
    const jsPatterns = [
      /var\s+matches\s*=\s*(\[.*?\]);/s,
      /const\s+matches\s*=\s*(\[.*?\]);/s,
      /let\s+matches\s*=\s*(\[.*?\]);/s,
      /"matches"\s*:\s*(\[.*?\])/s,
      /window\.matchData\s*=\s*(\[.*?\]);/s,
      /window\.fixtures\s*=\s*(\[.*?\]);/s,
      /matchData\s*=\s*(\[.*?\]);/s
    ];
    
    for (const pattern of jsPatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          if (Array.isArray(data)) {
            console.log(`📊 Found ${data.length} matches in JavaScript data`);
            const jsMatches = this.parseJavaScriptMatches(data);
            matches.push(...jsMatches);
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse JavaScript match data:', e);
        }
      }
    }
    
    return matches;
  }

  private parseJavaScriptMatches(data: any[]): TotelepepMatch[] {
    return data.map((item, index) => ({
      id: `js-${index}`,
      homeTeam: item.homeTeam || item.home || item.team1 || 'Home Team',
      awayTeam: item.awayTeam || item.away || item.team2 || 'Away Team',
      league: item.league || item.competition || item.tournament || 'Football League',
      kickoff: this.formatTime(item.time || item.kickoff || item.start),
      date: this.formatDate(item.date || item.matchDate),
      status: this.parseStatus(item.status || item.state) as 'upcoming' | 'live' | 'finished',
      homeOdds: this.parseOdds(item.homeOdds || item.odds?.home),
      drawOdds: this.parseOdds(item.drawOdds || item.odds?.draw),
      awayOdds: this.parseOdds(item.awayOdds || item.odds?.away),
      overUnder: {
        over: this.parseOdds(item.overOdds || item.odds?.over),
        under: this.parseOdds(item.underOdds || item.odds?.under),
        line: 2.5,
      },
      bothTeamsScore: {
        yes: this.parseOdds(item.bttsYes || item.odds?.bttsYes),
        no: this.parseOdds(item.bttsNo || item.odds?.bttsNo),
      },
    }));
  }

  private parseStatus(status: string): string {
    if (!status) return 'upcoming';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('live') || statusLower.includes('playing')) {
      return 'live';
    }
    if (statusLower.includes('finished') || statusLower.includes('ended')) {
      return 'finished';
    }
    return 'upcoming';
  }

  private parseOdds(odds: any): number {
    if (typeof odds === 'number') return Math.max(odds, 1.01);
    if (typeof odds === 'string') {
      const parsed = parseFloat(odds);
      return isNaN(parsed) ? 2.00 : Math.max(parsed, 1.01);
    }
    return 2.00;
  }

  private formatTime(time: any): string {
    if (!time) return this.generateTime();
    
    if (typeof time === 'string') {
      const timeMatch = time.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) return timeMatch[1];
    }
    
    try {
      return new Date(time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return this.generateTime();
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

  private generateTime(): string {
    const hour = Math.floor(Math.random() * 12) + 12; // 12-23
    const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
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
}

export const totelepepService = new TotelepepService();
export type { TotelepepMatch };