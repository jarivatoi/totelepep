interface TotelepepMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  competitionId: string;
  marketBookNo?: string;
  marketCode?: string;
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
  private baseUrl = '/api/webapi';
  private cache: Map<string, { data: TotelepepMatch[]; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private rateLimitDelay = 2000; // 2 seconds between requests
  private lastRequestTime = 0;

  async extractMatches(targetDate?: string): Promise<TotelepepMatch[]> {
    try {
      // Check cache first
      const cacheKey = targetDate || 'default';
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log('📦 Returning cached data');
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      console.log('🔍 Fetching fresh data from Totelepep API using Power Query method...');
      
      // Use the exact same approach as your Power Query
      const matches = await this.extractUsingPowerQueryMethod(targetDate);
      
      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} matches from Totelepep API`);
        this.setCachedData(matches, cacheKey);
        return matches;
      }

      console.warn('⚠️ No matches found from Totelepep API');
      return [];
      
    } catch (error) {
      console.error('❌ Error extracting matches:', error);
      
      // Try to return cached data even if expired
      const cacheKey = targetDate || 'default';
      const cached = this.getCachedData(cacheKey, true);
      if (cached) {
        console.log('📦 Returning expired cached data as fallback');
        return cached;
      }
      
      return [];
    }
  }

  private async extractUsingPowerQueryMethod(targetDate?: string): Promise<TotelepepMatch[]> {
    console.log('🎯 Using Power Query extraction method...');
    
    // Step 1: Get competitions data (like Power Query)
    const competitions = await this.getCompetitionsData(targetDate);
    console.log(`📊 Found ${competitions.length} competitions`);
    
    const allMatches: TotelepepMatch[] = [];
    
    // Step 2: For each competition, get detailed match data
    for (const competition of competitions) {
      try {
        console.log(`🔍 Processing competition ${competition.id}: ${competition.name}`);
        
        const competitionMatches = await this.getCompetitionMatches(
          competition.id, 
          targetDate
        );
        
        if (competitionMatches.length > 0) {
          console.log(`✅ Found ${competitionMatches.length} matches in ${competition.name}`);
          allMatches.push(...competitionMatches);
        }
        
        // Rate limiting between competitions
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.warn(`⚠️ Error processing competition ${competition.id}:`, error);
      }
    }
    
    console.log(`🎯 Total matches extracted: ${allMatches.length}`);
    return this.deduplicateAndValidate(allMatches);
  }

  private async getCompetitionsData(targetDate?: string): Promise<Array<{id: string, name: string}>> {
    const dateToFetch = targetDate || this.getTodayDate();
    
    // Use the same endpoint as Power Query to get competitions
    const apiUrl = `${this.baseUrl}/GetSport?sportId=soccer&date=${dateToFetch}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`;
    
    console.log(`🌐 Getting competitions from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📄 Competitions response:', data);
    
    // Extract competitions from the response
    const competitions: Array<{id: string, name: string}> = [];
    
    if (data.competitions && Array.isArray(data.competitions)) {
      data.competitions.forEach((comp: any) => {
        if (comp.id && comp.name) {
          competitions.push({
            id: comp.id.toString(),
            name: comp.name
          });
        }
      });
    }
    
    // If no competitions found, extract from competitionData string (like Power Query)
    if (competitions.length === 0 && data.competitionData) {
      console.log('📊 Parsing competitionData string...');
      const competitionEntries = data.competitionData.split('|').filter((entry: string) => entry.trim());
      
      competitionEntries.forEach((entry: string) => {
        const fields = entry.split(';');
        if (fields.length >= 2) {
          competitions.push({
            id: fields[0],
            name: fields[1] || `Competition ${fields[0]}`
          });
        }
      });
    }
    
    console.log(`📊 Extracted ${competitions.length} competitions:`, competitions.map(c => `${c.id}: ${c.name}`));
    return competitions;
  }

  private async getCompetitionMatches(competitionId: string, targetDate?: string): Promise<TotelepepMatch[]> {
    const dateToFetch = targetDate || this.getTodayDate();
    
    // Use the exact Power Query endpoint: /webapi/GetMatch
    const apiUrl = `${this.baseUrl}/GetMatch?sportId=soccer&competitionId=${competitionId}&matchId=0&periodCode=all&date=${dateToFetch}`;
    
    console.log(`🔍 Getting matches for competition ${competitionId}: ${apiUrl}`);
    
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Competition ${competitionId} returned ${response.status}: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      console.log(`📄 Competition ${competitionId} response:`, data);

      // Parse the response using Power Query logic
      return this.parseCompetitionResponse(data, competitionId, dateToFetch);

    } catch (error) {
      console.error(`❌ Error fetching competition ${competitionId}:`, error);
      return [];
    }
  }

  private parseCompetitionResponse(data: any, competitionId: string, date: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    console.log(`🔧 Parsing competition ${competitionId} response...`);
    
    // Power Query equivalent: Navigate to competitions -> matches
    if (data.competitions && Array.isArray(data.competitions)) {
      data.competitions.forEach((competition: any) => {
        if (competition.matches && Array.isArray(competition.matches)) {
          console.log(`📊 Found ${competition.matches.length} matches in competition structure`);
          
          competition.matches.forEach((match: any) => {
            const parsedMatch = this.parseMatchFromAPI(match, competitionId, date);
            if (parsedMatch) {
              matches.push(parsedMatch);
            }
          });
        }
      });
    }
    
    // Also check for direct matches array
    if (data.matches && Array.isArray(data.matches)) {
      console.log(`📊 Found ${data.matches.length} matches in direct matches array`);
      
      data.matches.forEach((match: any) => {
        const parsedMatch = this.parseMatchFromAPI(match, competitionId, date);
        if (parsedMatch) {
          matches.push(parsedMatch);
        }
      });
    }
    
    console.log(`✅ Parsed ${matches.length} matches from competition ${competitionId}`);
    return matches;
  }

  private parseMatchFromAPI(match: any, competitionId: string, date: string): TotelepepMatch | null {
    try {
      console.log(`🔍 Parsing match:`, match);
      
      // Extract basic match info
      const matchId = match.id?.toString() || match.matchId?.toString();
      const homeTeam = match.homeTeam || match.home || match.participant1;
      const awayTeam = match.awayTeam || match.away || match.participant2;
      const kickoff = match.startTime || match.kickoff || match.time || '15:00';
      
      if (!matchId || !homeTeam || !awayTeam) {
        console.warn('⚠️ Missing required match data:', { matchId, homeTeam, awayTeam });
        return null;
      }
      
      // Extract odds from markets (Power Query equivalent: Table.ExpandTableColumn)
      const odds = this.extractOddsFromMarkets(match.markets || []);
      
      // Get competition name
      const league = this.getCompetitionName(competitionId);
      
      const totelepepMatch: TotelepepMatch = {
        id: matchId,
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        league,
        competitionId,
        marketBookNo: match.marketBookNo?.toString(),
        marketCode: match.marketCode,
        kickoff: this.formatTime(kickoff),
        date,
        status: this.parseMatchStatus(match.status || match.state),
        homeOdds: odds.home || 2.00,
        drawOdds: odds.draw || 3.00,
        awayOdds: odds.away || 2.50,
        overUnder: {
          over: odds.over25 || 1.85,
          under: odds.under25 || 1.95,
          line: 2.5,
        },
        bothTeamsScore: {
          yes: odds.bttsYes || 1.70,
          no: odds.bttsNo || 2.10,
        },
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: match.minute,
      };
      
      console.log(`✅ Parsed match: ${homeTeam} vs ${awayTeam} (${odds.home}/${odds.draw}/${odds.away})`);
      return totelepepMatch;
      
    } catch (error) {
      console.warn('⚠️ Error parsing match:', error, match);
      return null;
    }
  }

  private extractOddsFromMarkets(markets: any[]): any {
    const odds: any = {
      home: null,
      draw: null,
      away: null,
      over25: null,
      under25: null,
      bttsYes: null,
      bttsNo: null
    };
    
    console.log(`🎯 Extracting odds from ${markets.length} markets...`);
    
    markets.forEach((market: any, index: number) => {
      const marketCode = market.marketCode;
      const marketName = market.marketDisplayName?.toLowerCase() || '';
      
      console.log(`   Market ${index + 1}: "${market.marketDisplayName}" (${marketCode})`);
      
      // Extract 1X2 odds (CP market)
      if (marketCode === 'CP' || marketName.includes('1 x 2')) {
        this.extract1X2Odds(market, odds);
      }
      
      // Extract BTTS odds (Power Query: "Both Team To Score ")
      if (market.marketDisplayName === "Both Team To Score ") {
        this.extractBTTSOdds(market, odds);
      }
      
      // Extract Over/Under 2.5 odds
      if (marketName.includes('under over +2.5') || marketName.includes('total goals 2.5')) {
        this.extractOverUnderOdds(market, odds);
      }
      
      // Log all selections for debugging
      if (market.selectionList && Array.isArray(market.selectionList)) {
        market.selectionList.forEach((selection: any, selIndex: number) => {
          console.log(`     Selection ${selIndex + 1}: ${selection.name} = ${selection.companyOdds}`);
        });
      }
    });
    
    console.log(`📊 Final extracted odds:`, odds);
    return odds;
  }

  private extract1X2Odds(market: any, odds: any): void {
    console.log(`   🎯 Processing 1X2 market: "${market.marketDisplayName}"`);
    
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const selectionName = selection.name;
        const oddsValue = parseFloat(selection.companyOdds);
        
        if (!isNaN(oddsValue) && oddsValue >= 1.01 && oddsValue <= 50) {
          // Map selection names to odds types
          if (selectionName === '1' || selectionName.toLowerCase().includes('home')) {
            odds.home = oddsValue;
            console.log(`   ✅ Home odds: ${oddsValue}`);
          } else if (selectionName === 'X' || selectionName.toLowerCase().includes('draw')) {
            odds.draw = oddsValue;
            console.log(`   ✅ Draw odds: ${oddsValue}`);
          } else if (selectionName === '2' || selectionName.toLowerCase().includes('away')) {
            odds.away = oddsValue;
            console.log(`   ✅ Away odds: ${oddsValue}`);
          }
        }
      });
    }
  }

  private extractBTTSOdds(market: any, odds: any): void {
    console.log(`   🎯 Processing BTTS market: "${market.marketDisplayName}"`);
    
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const selectionName = selection.name;
        const oddsValue = parseFloat(selection.companyOdds);
        
        if (!isNaN(oddsValue) && oddsValue >= 1.01 && oddsValue <= 50) {
          if (selectionName === 'YES' || selectionName.toLowerCase().includes('yes')) {
            odds.bttsYes = oddsValue;
            console.log(`   ✅ BTTS Yes: ${oddsValue}`);
          } else if (selectionName === 'NO' || selectionName.toLowerCase().includes('no')) {
            odds.bttsNo = oddsValue;
            console.log(`   ✅ BTTS No: ${oddsValue}`);
          }
        }
      });
    }
  }

  private extractOverUnderOdds(market: any, odds: any): void {
    console.log(`   🎯 Processing Over/Under market: "${market.marketDisplayName}"`);
    
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const selectionName = selection.name;
        const oddsValue = parseFloat(selection.companyOdds);
        
        if (!isNaN(oddsValue) && oddsValue >= 1.01 && oddsValue <= 50) {
          if (selectionName === 'Over' || selectionName.toLowerCase().includes('over')) {
            odds.over25 = oddsValue;
            console.log(`   ✅ Over 2.5: ${oddsValue}`);
          } else if (selectionName === 'Under' || selectionName.toLowerCase().includes('under')) {
            odds.under25 = oddsValue;
            console.log(`   ✅ Under 2.5: ${oddsValue}`);
          }
        }
      });
    }
  }

  private getCompetitionName(competitionId: string): string {
    // Map competition IDs to names (from your Power Query data)
    const competitionMap: Record<string, string> = {
      '81': 'Austria - OFB Cup',
      '234': 'Croatia - Croatian Cup', 
      '112': 'Czechia - Czech Cup',
      '35': 'Egypt - Premier League',
      '126': 'England - EFL Cup',
      '138': 'Germany - DFB Pokal',
      '50': 'International Clubs - UEFA Champions League',
      '55': 'International Clubs - UEFA Conference League',
      '135': 'International Clubs - UEFA Europa League',
      '38': 'Lithuania - A Lyga',
      '52': 'Japan - Emperor Cup',
      '17': 'Iran - Pro League',
      '163': 'Spain - LaLiga',
      '144': 'Other Competition'
    };
    
    return competitionMap[competitionId] || `Competition ${competitionId}`;
  }

  private parseMatchStatus(status: any): 'upcoming' | 'live' | 'finished' {
    if (!status) return 'upcoming';
    
    const statusStr = status.toString().toLowerCase();
    if (statusStr.includes('live') || statusStr.includes('playing')) {
      return 'live';
    }
    if (statusStr.includes('finished') || statusStr.includes('ended') || statusStr.includes('ft')) {
      return 'finished';
    }
    return 'upcoming';
  }

  private formatTime(time: any): string {
    if (!time) return '15:00';
    
    if (typeof time === 'string') {
      // Extract time from various formats
      const timeMatch = time.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) return timeMatch[1];
    }
    
    try {
      return new Date(time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '15:00';
    }
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

  private getCachedData(cacheKey: string, ignoreExpiry = false): TotelepepMatch[] | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
    if (isExpired && !ignoreExpiry) return null;
    
    return cached.data;
  }

  private setCachedData(matches: TotelepepMatch[], cacheKey: string): void {
    this.cache.set(cacheKey, {
      data: matches,
      timestamp: Date.now()
    });
  }

  // Clear cache for fresh extraction
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared - next extraction will be fresh');
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