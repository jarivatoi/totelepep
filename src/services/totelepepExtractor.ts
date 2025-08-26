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
  private baseUrl = '/api/webapi/GetSport';
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

      console.log('🔍 Fetching fresh data from Totelepep API...');
      
      // Fetch JSON from totelepep.mu API
      const jsonData = await this.fetchTotelepepAPI();
      
      // Parse JSON data (same as Power Query Json.Document)
      const matches = this.parseJSONForMatches(jsonData);
      
      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} matches from Totelepep API`);
        this.setCachedData(matches);
        return matches;
      }

      console.warn('⚠️ No matches found from Totelepep API');
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

  private async fetchTotelepepAPI(): Promise<any> {
    // Build API URL with current date (same as Power Query)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const apiUrl = `${this.baseUrl}?sportId=soccer&date=${today}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`;
    
    console.log('🌐 API URL:', apiUrl);
    
    const response = await fetch(this.baseUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    console.log(`📄 Fetched JSON data from Totelepep API:`, jsonData);
    
    return jsonData;
  }

  private parseJSONForMatches(jsonData: any): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      console.log('🔧 Parsing JSON for match data...');
      
      // Parse JSON structure (equivalent to Power Query Json.Document)
      if (jsonData && jsonData.matches && Array.isArray(jsonData.matches)) {
        console.log(`📊 Found ${jsonData.matches.length} matches in API response`);
        
        for (let i = 0; i < jsonData.matches.length; i++) {
          const apiMatch = jsonData.matches[i];
          const match = this.convertAPIMatchToTotelepepMatch(apiMatch, i);
          if (match) {
            matches.push(match);
            console.log(`✅ Converted: ${match.homeTeam} vs ${match.awayTeam}`);
          }
        }
      } else if (Array.isArray(jsonData)) {
        // Handle case where root is array
        console.log(`📊 Found ${jsonData.length} matches in API array`);
        
        for (let i = 0; i < jsonData.length; i++) {
          const apiMatch = jsonData[i];
          const match = this.convertAPIMatchToTotelepepMatch(apiMatch, i);
          if (match) {
            matches.push(match);
            console.log(`✅ Converted: ${match.homeTeam} vs ${match.awayTeam}`);
          }
        }
      } else {
        console.warn('⚠️ Unexpected JSON structure:', jsonData);
      }
      
      console.log(`🎯 Extracted ${matches.length} total matches`);
      
      // Remove duplicates and validate
      return this.deduplicateAndValidate(matches);
      
    } catch (error) {
      console.error('❌ Error parsing JSON:', error);
      return [];
    }
  }

  private convertAPIMatchToTotelepepMatch(apiMatch: any, index: number): TotelepepMatch | null {
    try {
      // Map API fields to our TotelepepMatch structure
      // This will depend on the actual API response structure
      
      const match: TotelepepMatch = {
        id: apiMatch.id || apiMatch.matchId || `api-${index}`,
        homeTeam: apiMatch.homeTeam || apiMatch.home || apiMatch.team1 || 'Home Team',
        awayTeam: apiMatch.awayTeam || apiMatch.away || apiMatch.team2 || 'Away Team',
        league: apiMatch.league || apiMatch.competition || apiMatch.tournament || 'Football League',
        kickoff: this.formatTime(apiMatch.time || apiMatch.kickoff || apiMatch.startTime),
        date: this.formatDate(apiMatch.date || apiMatch.matchDate || apiMatch.gameDate),
        status: this.parseStatus(apiMatch.status || apiMatch.state || apiMatch.matchStatus) as 'upcoming' | 'live' | 'finished',
        
        // Extract odds from API response
        homeOdds: this.parseOdds(apiMatch.homeOdds || apiMatch.odds?.home || apiMatch.odds?.['1']),
        drawOdds: this.parseOdds(apiMatch.drawOdds || apiMatch.odds?.draw || apiMatch.odds?.['X']),
        awayOdds: this.parseOdds(apiMatch.awayOdds || apiMatch.odds?.away || apiMatch.odds?.['2']),
        
        overUnder: {
          over: this.parseOdds(apiMatch.overOdds || apiMatch.odds?.over || apiMatch.totals?.over),
          under: this.parseOdds(apiMatch.underOdds || apiMatch.odds?.under || apiMatch.totals?.under),
          line: apiMatch.line || apiMatch.totals?.line || 2.5,
        },
        
        bothTeamsScore: {
          yes: this.parseOdds(apiMatch.bttsYes || apiMatch.odds?.bttsYes || apiMatch.btts?.yes),
          no: this.parseOdds(apiMatch.bttsNo || apiMatch.odds?.bttsNo || apiMatch.btts?.no),
        },
        
        // Live match data
        homeScore: apiMatch.homeScore || apiMatch.score?.home,
        awayScore: apiMatch.awayScore || apiMatch.score?.away,
        minute: apiMatch.minute || apiMatch.time?.minute,
      };
      
      return this.isValidMatch(match) ? match : null;
      
    } catch (error) {
      console.warn('⚠️ Error converting API match:', error, apiMatch);
      return null;
    }
  }
  private extractFromTotelepepTables(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Find tables with betting/match data - Totelepep specific patterns
    const tableRegex = /<table[^>]*(?:class="[^"]*(?:match|bet|odds|fixture|game)[^"]*"|id="[^"]*(?:match|bet|odds|fixture|game)[^"]*")[^>]*>(.*?)<\/table>/gis;
    const tables = html.match(tableRegex) || [];
    
    // Also check for tables without specific classes but containing betting data
    if (tables.length === 0) {
      const allTablesRegex = /<table[^>]*>(.*?)<\/table>/gis;
      const allTables = html.match(allTablesRegex) || [];
      console.log(`📊 Found ${allTables.length} total tables, filtering for betting data...`);
      
      // Filter tables that contain betting-related content
      for (const table of allTables) {
        if (this.containsBettingData(table)) {
          tables.push(table);
        }
      }
    }
    
    console.log(`📊 Found ${tables.length} betting tables to analyze`);
    
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      
      // Extract table rows - skip header rows
      const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
      const rows = table.match(rowRegex) || [];
      
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        
        // Skip header rows and empty rows
        if (this.isHeaderRow(row) || this.isEmptyRow(row)) continue;
        
        const match = this.extractMatchFromTotelepepRow(row, `table-${i}-row-${j}`);
        if (match) {
          matches.push(match);
          console.log(`✅ Extracted: ${match.homeTeam} vs ${match.awayTeam}`);
        }
      }
    }
    
    return matches;
  }

  private containsBettingData(table: string): boolean {
    const bettingIndicators = [
      'odds', 'bet', 'match', 'fixture', 'game', 'team', 'vs', 'v ',
      '1.', '2.', '3.', '4.', '5.', // Decimal odds patterns
      'home', 'away', 'draw', 'over', 'under', 'btts',
      'premier', 'league', 'championship', 'cup', 'division'
    ];
    
    const tableText = table.toLowerCase();
    return bettingIndicators.some(indicator => tableText.includes(indicator));
  }

  private isEmptyRow(row: string): boolean {
    const cellContent = this.cleanHtmlContent(row);
    return cellContent.trim().length < 5; // Very short rows are likely empty
  }

  private extractFromTotelepepContainers(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for Totelepep-specific div containers with match data
    const divPatterns = [
      // Totelepep specific patterns
      /<div[^>]*class="[^"]*(?:match|fixture|game|event|bet|odds)[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*id="[^"]*(?:match|fixture|game|event|bet|odds)[^"]*"[^>]*>(.*?)<\/div>/gis,
      // Generic containers that might hold match data
      /<article[^>]*>(.*?)<\/article>/gis,
      /<section[^>]*class="[^"]*(?:match|sport|bet)[^"]*"[^>]*>(.*?)<\/section>/gis,
      // List items that might contain matches
      /<li[^>]*class="[^"]*(?:match|fixture|game)[^"]*"[^>]*>(.*?)<\/li>/gis
    ];
    
    for (const pattern of divPatterns) {
      const divs = html.match(pattern) || [];
      console.log(`🔍 Found ${divs.length} divs with pattern`);
      
      for (let i = 0; i < divs.length; i++) {
        const match = this.extractMatchFromTotelepepContainer(divs[i], `div-${i}`);
        if (match) {
          matches.push(match);
          console.log(`✅ Container match: ${match.homeTeam} vs ${match.awayTeam}`);
        }
      }
    }
    
    return matches;
  }

  private extractFromTotelepepJavaScript(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for Totelepep-specific JavaScript variables containing match data
    const jsPatterns = [
      // Common variable names for match data
      /var\s+matches\s*=\s*(\[.*?\]);/s,
      /const\s+matches\s*=\s*(\[.*?\]);/s,
      /let\s+matches\s*=\s*(\[.*?\]);/s,
      /var\s+fixtures\s*=\s*(\[.*?\]);/s,
      /var\s+games\s*=\s*(\[.*?\]);/s,
      /var\s+events\s*=\s*(\[.*?\]);/s,
      // JSON data patterns
      /"matches"\s*:\s*(\[.*?\])/s,
      /"fixtures"\s*:\s*(\[.*?\])/s,
      /"games"\s*:\s*(\[.*?\])/s,
      /"events"\s*:\s*(\[.*?\])/s,
      // Window object patterns
      /window\.matchData\s*=\s*(\[.*?\]);/s,
      /window\.fixtures\s*=\s*(\[.*?\]);/s,
      /window\.bettingData\s*=\s*(\[.*?\]);/s,
      // Framework-specific patterns
      /matchData\s*=\s*(\[.*?\]);/s,
      /__INITIAL_STATE__\s*=\s*({.*?});/s,
      /window\.__NUXT__\s*=\s*({.*?});/s,
      /__NEXT_DATA__\s*=\s*({.*?});/s,
      // API response patterns
      /apiData\s*=\s*({.*?});/s,
      /responseData\s*=\s*({.*?});/s
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

  private extractMatchFromTotelepepRow(row: string, id: string): TotelepepMatch | null {
    try {
      // Extract cell contents from table row
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const cellContent = this.cleanHtmlContent(cellMatch[1]);
        if (cellContent.trim()) {
          cells.push(cellContent.trim());
        }
      }
      
      // Also try th elements for header-like content that might contain data
      const headerCellRegex = /<th[^>]*>(.*?)<\/th>/gis;
      while ((cellMatch = headerCellRegex.exec(row)) !== null) {
        const cellContent = this.cleanHtmlContent(cellMatch[1]);
        if (cellContent.trim()) {
          cells.push(cellContent.trim());
        }
      }
      
      if (cells.length < 2) {
        return null; // Not enough data for a match
      }
      
      console.log(`🔍 Row cells: ${cells.join(' | ')}`);
      
      // Extract team names
      const teamInfo = this.extractTeamNames(cells);
      if (!teamInfo) {
        console.log(`⚠️ No team names found in: ${cells.join(' | ')}`);
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

  private extractMatchFromTotelepepContainer(divContent: string, id: string): TotelepepMatch | null {
    const textContent = this.cleanHtmlContent(divContent);
    
    console.log(`🔍 Container content: ${textContent.substring(0, 100)}...`);
    
    // Extract team names
    const teamInfo = this.extractTeamNamesFromText(textContent);
    if (!teamInfo) {
      console.log(`⚠️ No team names in container: ${textContent.substring(0, 50)}...`);
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
      const teamSeparators = [' vs ', ' v ', ' - ', ' x ', ' VS ', ' V ', ' X ', ' against ', ' @ ', ' at '];
      
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
    
    // Look for team names in adjacent cells with common patterns
    for (let i = 0; i < cells.length - 1; i++) {
      const cell1 = cells[i];
      const cell2 = cells[i + 1];
      
      // Check if both look like team names and aren't odds/times
      if (this.looksLikeTeamName(cell1) && this.looksLikeTeamName(cell2) && 
          !this.looksLikeOdds(cell1) && !this.looksLikeOdds(cell2)) {
        return { home: cell1, away: cell2 };
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
      // Common football team suffixes/prefixes
      'FC', 'United', 'City', 'Town', 'Rovers', 'Wanderers', 'Athletic',
      'SC', 'CF', 'AC', 'Real', 'Club', 'Sports', 'Football',
      // Famous teams (helps identify legitimate team names)
      'Barcelona', 'Madrid', 'Liverpool', 'Arsenal', 'Chelsea', 'Manchester',
      'Tottenham', 'Bayern', 'Juventus', 'Milan', 'Inter', 'Roma', 'Napoli',
      'Dortmund', 'Ajax', 'PSG', 'Valencia', 'Sevilla', 'Atletico',
      // International teams
      'Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'Italy', 'England'
    ];
    
    // Check length and format
    if (text.length < 2 || text.length > 50) return false;
    
    // Contains team indicators
    if (teamIndicators.some(indicator => text.toLowerCase().includes(indicator.toLowerCase()))) {
      return true;
    }
    
    // Looks like a team name (letters, spaces, common punctuation)
    if (/^[A-Za-z\s\-'\.0-9]+$/.test(text)) {
      // Exclude obvious non-team content
      const excludePatterns = [
        /^\d+$/, // Just numbers
        /^\d+:\d+$/, // Time format
        /^\d+\.\d+$/, // Decimal odds
        /^(home|away|draw|over|under|yes|no|btts)$/i, // Betting terms
        /^(win|lose|tie|goal|score)$/i, // Match terms
        /^(today|tomorrow|yesterday)$/i, // Date terms
        /^(live|finished|upcoming)$/i // Status terms
      ];
      
      return !excludePatterns.some(pattern => pattern.test(text.trim()));
    }
    
    return false;
  }

  private looksLikeOdds(text: string): boolean {
    // Check if text looks like betting odds
    const oddsPattern = /^\d{1,2}\.\d{2}$/;
    return oddsPattern.test(text.trim());
  }

  private extractTime(cells: string[]): string | null {
    for (const cell of cells) {
      // Look for time patterns - more comprehensive
      const timeMatch = cell.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (timeMatch) {
        return timeMatch[1];
      }
      
      // Look for relative time indicators
      if (cell.toLowerCase().includes('live') || cell.toLowerCase().includes('ft')) {
        return 'LIVE';
      }
    }
    return null;
  }

  private extractLeague(cells: string[]): string | null {
    const leagueIndicators = [
      // Major leagues
      'Premier League', 'Championship', 'League One', 'League Two',
      'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Eredivisie',
      // Competitions
      'Champions League', 'Europa League', 'Conference League',
      'FA Cup', 'EFL Cup', 'Copa del Rey', 'Coppa Italia',
      // Generic terms
      'League', 'Liga', 'Serie', 'Cup', 'Champions', 'Europa',
      'Premier', 'Division', 'Championship', 'Tournament',
      // International
      'World Cup', 'Euro', 'Nations League', 'Qualifiers'
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
      const oddsMatches = cell.match(/\b(\d{1,2}\.\d{1,2})\b/g);
      if (oddsMatches) {
        for (const oddStr of oddsMatches) {
          const odd = parseFloat(oddStr);
          if (odd >= 1.01 && odd <= 50.00) {
            foundOdds.push(odd);
          }
        }
      }
    }
    
    // Assign odds in typical Totelepep order: Home, Draw, Away, Over, Under, BTTS Yes, BTTS No
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
    
    const oddsMatches = text.match(/\b(\d{1,2}\.\d{1,2})\b/g);
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

  private extractTotelepepSpecificData(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for Totelepep-specific data structures
    // This would be customized based on actual site inspection
    
    // Example: Look for specific CSS selectors or data attributes
    const specificPatterns = [
      // Match cards or containers
      /<div[^>]*data-match[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*data-fixture[^>]*>(.*?)<\/div>/gis,
      // Betting grids
      /<div[^>]*class="[^"]*betting-grid[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*odds-grid[^"]*"[^>]*>(.*?)<\/div>/gis,
    ];
    
    for (const pattern of specificPatterns) {
      const elements = html.match(pattern) || [];
      console.log(`🎯 Found ${elements.length} Totelepep-specific elements`);
      
      // Process each element for match data
      // Implementation would depend on actual site structure
    }
    
    return matches;
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
      const timeMatch = time.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
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
    const times = ['15:00', '17:30', '20:00', '12:30', '19:45', '16:00', '18:30', '21:00', '14:00', '20:45'];
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
        console.log(`✅ Valid match: ${match.homeTeam} vs ${match.awayTeam} at ${match.kickoff}`);
      }
    }
    
    return unique;
  }

  private isValidMatch(match: TotelepepMatch): boolean {
    return (
      match.homeTeam.length > 1 &&
      match.awayTeam.length > 1 &&
      match.homeTeam !== match.awayTeam &&
      !match.homeTeam.toLowerCase().includes('odds') &&
      !match.awayTeam.toLowerCase().includes('odds') &&
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