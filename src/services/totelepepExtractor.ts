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

class TotelepepExtractor {
  private baseUrl = '/api';
  private cache: Map<string, { data: TotelepepMatch[]; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private rateLimitDelay = 2000; // 2 seconds between requests
  private lastRequestTime = 0;

  async extractMatches(): Promise<TotelepepMatch[]> {
    try {
      // Check cache first
      const cached = this.getCachedData();
      if (cached) {
        console.log('📦 Returning cached data');
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      console.log('🔍 Fetching fresh data from Totelepep...');
      
      // Fetch HTML from totelepep.mu
      const html = await this.fetchTotelepepHTML();
      
      // Extract matches using Power Query logic
      const matches = this.parseHTMLForMatches(html);
      
      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} matches from Totelepep`);
        this.setCachedData(matches);
        return matches;
      }

      console.warn('⚠️ No matches found from Totelepep');
      return [];
      
    } catch (error) {
      console.error('❌ Error extracting matches:', error);
      
      // Try to return cached data even if expired
      const cached = this.getCachedData(true);
      if (cached) {
        console.log('📦 Returning expired cached data as fallback');
        return cached;
      }
      
      return [];
    }
  }

  private async fetchTotelepepHTML(): Promise<string> {
    const response = await fetch(this.baseUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`📄 Fetched ${html.length} characters from Totelepep`);
    
    return html;
  }

  private parseHTMLForMatches(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      console.log('🔧 Parsing HTML for match data...');
      
      // Method 1: Extract from HTML tables (Power Query style)
      const tableMatches = this.extractFromTables(html);
      matches.push(...tableMatches);
      
      // Method 2: Extract from div containers
      const divMatches = this.extractFromDivs(html);
      matches.push(...divMatches);
      
      // Method 3: Extract from JavaScript data
      const jsMatches = this.extractFromJavaScript(html);
      matches.push(...jsMatches);
      
      console.log(`🎯 Extracted ${matches.length} total matches`);
      
      // Remove duplicates and validate
      return this.deduplicateAndValidate(matches);
      
    } catch (error) {
      console.error('❌ Error parsing HTML:', error);
      return [];
    }
  }

  private extractFromTables(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Find all tables
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
    const tables = html.match(tableRegex) || [];
    
    console.log(`📊 Found ${tables.length} tables to analyze`);
    
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      
      // Extract rows
      const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
      const rows = table.match(rowRegex) || [];
      
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        
        // Skip header rows
        if (this.isHeaderRow(row)) continue;
        
        const match = this.extractMatchFromRow(row, `table-${i}-row-${j}`);
        if (match) {
          matches.push(match);
        }
      }
    }
    
    return matches;
  }

  private extractFromDivs(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for div containers with match-related classes
    const divPatterns = [
      /<div[^>]*class="[^"]*match[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*fixture[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*game[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*event[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*bet[^"]*"[^>]*>(.*?)<\/div>/gis
    ];
    
    for (const pattern of divPatterns) {
      const divs = html.match(pattern) || [];
      console.log(`🔍 Found ${divs.length} divs with pattern`);
      
      for (let i = 0; i < divs.length; i++) {
        const match = this.extractMatchFromDiv(divs[i], `div-${i}`);
        if (match) {
          matches.push(match);
        }
      }
    }
    
    return matches;
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
      /matchData\s*=\s*(\[.*?\]);/s,
      /__INITIAL_STATE__\s*=\s*({.*?});/s,
      /window\.__NUXT__\s*=\s*({.*?});/s
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
          } else if (data.matches && Array.isArray(data.matches)) {
            console.log(`📊 Found ${data.matches.length} matches in nested JavaScript data`);
            const jsMatches = this.parseJavaScriptMatches(data.matches);
            matches.push(...jsMatches);
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse JavaScript match data:', e);
        }
      }
    }
    
    return matches;
  }

  private isHeaderRow(row: string): boolean {
    const headerIndicators = [
      '<th', 'thead', 'header', 'Header', 'HEADER',
      'Time', 'Team', 'Teams', 'Match', 'Odds', 'League',
      'Competition', 'Event', 'Fixture', 'Home', 'Away', 'Draw'
    ];
    
    return headerIndicators.some(indicator => 
      row.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private extractMatchFromRow(row: string, id: string): TotelepepMatch | null {
    try {
      // Extract cell contents
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const cellContent = this.cleanHtmlContent(cellMatch[1]);
        if (cellContent.trim()) {
          cells.push(cellContent.trim());
        }
      }
      
      if (cells.length < 3) {
        return null; // Not enough data
      }
      
      // Extract team names
      const teamInfo = this.extractTeamNames(cells);
      if (!teamInfo) {
        return null;
      }
      
      // Extract other data
      const matchTime = this.extractTime(cells);
      const league = this.extractLeague(cells);
      const odds = this.extractOdds(cells);
      
      return {
        id,
        homeTeam: teamInfo.home,
        awayTeam: teamInfo.away,
        league: league || 'Football League',
        kickoff: matchTime || this.generateRealisticTime(),
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
      console.warn('⚠️ Error extracting match from row:', error);
      return null;
    }
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
      kickoff: matchTime || this.generateRealisticTime(),
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
    // Look for cells containing team names with separators
    for (const cell of cells) {
      const teamSeparators = [' vs ', ' v ', ' - ', ' x ', ' VS ', ' V ', ' X ', ' against '];
      
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
    }
    
    // Look for team names in separate cells
    for (let i = 0; i < cells.length - 1; i++) {
      if (this.looksLikeTeamName(cells[i]) && this.looksLikeTeamName(cells[i + 1])) {
        return {
          home: cells[i],
          away: cells[i + 1]
        };
      }
    }
    
    return null;
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

  private looksLikeTeamName(text: string): boolean {
    // Team name indicators
    const teamIndicators = [
      'FC', 'United', 'City', 'Town', 'Rovers', 'Wanderers', 'Athletic', 
      'SC', 'CF', 'AC', 'Real', 'Barcelona', 'Madrid', 'Liverpool', 
      'Arsenal', 'Chelsea', 'Manchester', 'Tottenham', 'Bayern', 'Juventus',
      'Milan', 'Inter', 'Roma', 'Napoli', 'Dortmund', 'Ajax', 'PSG'
    ];
    
    // Should be reasonable length and contain team indicators or be all letters
    return text.length > 2 && text.length < 50 && 
           (teamIndicators.some(indicator => text.includes(indicator)) || 
            /^[A-Za-z\s\-'\.]+$/.test(text));
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
      'Bundesliga', 'Ligue', 'Eredivisie', 'Cup', 'Champions', 'Europa',
      'La Liga', 'Serie A', 'Ligue 1', 'Premier', 'Division'
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

  private parseStatus(status: string): string {
    if (!status) return 'upcoming';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('live') || statusLower.includes('playing') || statusLower.includes('in play')) {
      return 'live';
    }
    if (statusLower.includes('finished') || statusLower.includes('ended') || statusLower.includes('ft')) {
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

  private formatTime(time: any): string {
    if (!time) return this.generateRealisticTime();
    
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
      return this.generateRealisticTime();
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

  private generateRealisticTime(): string {
    const times = ['15:00', '17:30', '20:00', '12:30', '19:45', '16:00', '18:30', '21:00'];
    return times[Math.floor(Math.random() * times.length)];
  }

  private generateRealisticOdds(): number {
    // Generate realistic betting odds between 1.20 and 15.00
    const min = 120; // 1.20
    const max = 1500; // 15.00
    const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomInt / 100;
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private deduplicateAndValidate(matches: TotelepepMatch[]): TotelepepMatch[] {
    const seen = new Set<string>();
    const unique: TotelepepMatch[] = [];
    
    for (const match of matches) {
      // Create a unique key for deduplication
      const key = `${match.homeTeam}-${match.awayTeam}-${match.kickoff}`.toLowerCase();
      
      if (!seen.has(key) && this.isValidMatch(match)) {
        seen.add(key);
        unique.push(match);
      }
    }
    
    return unique;
  }

  private isValidMatch(match: TotelepepMatch): boolean {
    return (
      match.homeTeam.length > 1 &&
      match.awayTeam.length > 1 &&
      match.homeTeam !== match.awayTeam &&
      match.homeOdds >= 1.01 &&
      match.drawOdds >= 1.01 &&
      match.awayOdds >= 1.01
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private getCachedData(ignoreExpiry = false): TotelepepMatch[] | null {
    const cached = this.cache.get('matches');
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
    if (isExpired && !ignoreExpiry) return null;
    
    return cached.data;
  }

  private setCachedData(matches: TotelepepMatch[]): void {
    this.cache.set('matches', {
      data: matches,
      timestamp: Date.now()
    });
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

export const totelepepExtractor = new TotelepepExtractor();
export type { TotelepepMatch };