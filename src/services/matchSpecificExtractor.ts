interface MatchOddsData {
  matchId: string;
  bttsYes?: number;
  bttsNo?: number;
  over25?: number;
  under25?: number;
  additionalOdds?: Record<string, number>;
}

interface NameValuePair {
  Name: string;
  Value: string;
}

class MatchSpecificExtractor {
  private cache: Map<string, { data: MatchOddsData; timestamp: number }> = new Map();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes
  private rateLimitDelay = 1500; // 1.5 seconds between requests
  private lastRequestTime = 0;

  async extractMatchOdds(matchId: string, competitionId: string): Promise<MatchOddsData | null> {
    try {
      // Check cache first
      const cacheKey = `${matchId}-${competitionId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log(`📦 Returning cached odds for match ${matchId}`);
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      console.log(`🔍 Fetching detailed odds for match ${matchId} in competition ${competitionId}...`);
      
      // Use the Power Query endpoint structure
      const endpoint = `/api/webapi/GetMatch?sportId=soccer&competitionId=${competitionId}&matchId=${matchId}&periodCode=all`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Match ${matchId} endpoint returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log(`📄 Match ${matchId} response:`, data);

      // Parse the Name/Value structure (like Power Query Table.ExpandTableColumn)
      const oddsData = this.parseNameValueResponse(data, matchId);
      
      if (oddsData) {
        this.setCachedData(oddsData, cacheKey);
        console.log(`✅ Extracted detailed odds for match ${matchId}:`, oddsData);
        return oddsData;
      }

      return null;

    } catch (error) {
      console.error(`❌ Error extracting match ${matchId} odds:`, error);
      return null;
    }
  }

  private parseNameValueResponse(data: any, matchId: string): MatchOddsData | null {
    try {
      console.log(`🔧 Parsing markets response for match ${matchId}...`);
      console.log(`📄 Response structure:`, JSON.stringify(data, null, 2));

      // Find the match in the competitions array
      let targetMatch = null;
      if (data.competitions && Array.isArray(data.competitions)) {
        for (const competition of data.competitions) {
          if (competition.matches && Array.isArray(competition.matches)) {
            targetMatch = competition.matches.find((match: any) => match.id.toString() === matchId);
            if (targetMatch) break;
          }
        }
      }

      if (!targetMatch) {
        console.warn(`⚠️ Match ${matchId} not found in response`);
        return null;
      }

      // CRITICAL ANALYSIS: Market count vs actual markets
      const expectedMarkets = targetMatch.marketCount || 0;
      const actualMarkets = targetMatch.markets ? targetMatch.markets.length : 0;
      const missingMarkets = expectedMarkets - actualMarkets;

      console.log(`📊 MARKET ANALYSIS for match ${matchId}:`);
      console.log(`   Expected markets: ${expectedMarkets}`);
      console.log(`   Actual markets: ${actualMarkets}`);
      console.log(`   Missing markets: ${missingMarkets}`);
      
      if (missingMarkets > 0) {
        console.log(`🚨 MISSING ${missingMarkets} MARKETS! These likely contain BTTS/Over-Under odds`);
      }

      // Analyze available markets
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        console.log(`📋 Available markets:`);
        targetMatch.markets.forEach((market: any, index: number) => {
          console.log(`   ${index + 1}. ${market.marketDisplayName} (Code: ${market.marketCode}, Period: ${market.periodCode})`);
        });

        // Look for market codes that might indicate other market types
        const marketCodes = targetMatch.markets.map((m: any) => m.marketCode);
        const uniqueCodes = [...new Set(marketCodes)];
        console.log(`📊 Market codes found: ${uniqueCodes.join(', ')}`);
        
        if (uniqueCodes.length === 1 && uniqueCodes[0] === 'CP') {
          console.log(`⚠️ Only CP (1X2) markets found. Need to find parameters for other market types.`);
        }
      }

      const oddsData: MatchOddsData = { matchId };

      // Parse the markets structure
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        this.parseMarketsArray(targetMatch.markets, oddsData);
      }

      // Log all found odds
      console.log(`📊 Match ${matchId} extracted odds:`, {
        bttsYes: oddsData.bttsYes,
        bttsNo: oddsData.bttsNo,
        over25: oddsData.over25,
        under25: oddsData.under25,
        additionalOdds: oddsData.additionalOdds
      });

      return Object.keys(oddsData).length > 1 ? oddsData : null;

    } catch (error) {
      console.error(`❌ Error parsing match ${matchId} response:`, error);
      return null;
    }
  }

  private parseMarketsArray(markets: any[], oddsData: MatchOddsData): void {
    console.log(`🔍 Processing ${markets.length} markets...`);

    // Power Query equivalent: List.Transform([markets], each if [marketDisplayName] = "Both Team To Score " then [marketBookNo] else "")
    const bttsBookNumbers: string[] = [];
    const ouBookNumbers: string[] = [];
    
    markets.forEach((market, index) => {
      const marketCode = market.marketCode;
      const marketName = market.marketDisplayName?.toLowerCase() || '';
      const periodCode = market.periodCode;
      
      console.log(`   Market ${index + 1}: "${market.marketDisplayName}" (${marketCode}/${periodCode})`);
      
      // Power Query logic: Extract BookNo for BTTS markets
      if (market.marketDisplayName === "Both Team To Score ") {
        bttsBookNumbers.push(market.marketBookNo.toString());
        console.log(`   📋 BTTS BookNo collected: ${market.marketBookNo}`);
      }
      
      // Extract BookNo for Over/Under 2.5 markets
      if (marketName.includes('under over +2.5')) {
        ouBookNumbers.push(market.marketBookNo.toString());
        console.log(`   📋 O/U 2.5 BookNo collected: ${market.marketBookNo}`);
      }
      
      // Look for BTTS markets
      if (marketName.includes('both') || marketName.includes('score') || marketCode === 'BTTS') {
        console.log(`   🎯 Found potential BTTS market: ${market.marketDisplayName}`);
        this.extractBTTSOdds(market, oddsData);
      }
      
      // Look for Over/Under markets
      if (marketName.includes('total') || marketName.includes('over') || marketName.includes('under') || 
          marketName.includes('goals') || marketCode === 'OU' || marketCode === 'TG') {
        console.log(`   🎯 Found potential Over/Under market: ${market.marketDisplayName}`);
        this.extractOverUnderOdds(market, oddsData);
      }
      
      // Log all selections for analysis
      if (market.selectionList && Array.isArray(market.selectionList)) {
        market.selectionList.forEach((selection: any, selIndex: number) => {
          console.log(`     Selection ${selIndex + 1}: ${selection.name} = ${selection.companyOdds}`);
        });
      }
    });
    
    // Power Query equivalent: Text.Combine(List.Transform(_, Text.From))
    const combinedBTTSBookNos = bttsBookNumbers.join(',');
    const combinedOUBookNos = ouBookNumbers.join(',');
    
    console.log(`📋 Power Query BTTS BookNos: "${combinedBTTSBookNos}"`);
    console.log(`📋 Power Query O/U BookNos: "${combinedOUBookNos}"`);
    
    // Store Power Query compatible data
    if (!oddsData.additionalOdds) {
      oddsData.additionalOdds = {};
    }
    oddsData.additionalOdds['BookNoBTTS'] = combinedBTTSBookNos;
    oddsData.additionalOdds['BookNoOU'] = combinedOUBookNos;
  }

  private extractBTTSOdds(market: any, oddsData: MatchOddsData): void {
    console.log(`   🎯 Processing BTTS market: "${market.marketDisplayName}" (Book: ${market.marketBookNo})`);
    
    // Only process the exact "Both Team To Score " market (with trailing space)
    if (market.marketDisplayName !== "Both Team To Score ") {
      console.log(`   ⚠️ Skipping non-BTTS market: "${market.marketDisplayName}"`);
      return;
    }
    
    // Store the market book number for Power Query compatibility
    if (!oddsData.additionalOdds) {
      oddsData.additionalOdds = {};
    }
    oddsData.additionalOdds[`BookNoBTTS_${market.marketBookNo}`] = market.marketBookNo;
    
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const selectionName = selection.name?.toLowerCase() || '';
        const odds = parseFloat(selection.companyOdds);
        
        console.log(`     Selection: "${selection.name}" = ${selection.companyOdds} (${odds})`);
        
        if (!isNaN(odds) && odds >= 1.01 && odds <= 50) {
          // Use exact matching for BTTS selections
          if (selection.name === 'YES') {
            oddsData.bttsYes = odds;
            console.log(`   ✅ BTTS Yes extracted: ${odds}`);
          } else if (selection.name === 'NO') {
            oddsData.bttsNo = odds;
            console.log(`   ✅ BTTS No extracted: ${odds}`);
          }
        }
      });
    }
  }

  private extractOverUnderOdds(market: any, oddsData: MatchOddsData): void {
    const marketName = market.marketDisplayName?.toLowerCase() || '';
    console.log(`   🎯 Processing O/U market: "${market.marketDisplayName}" (Book: ${market.marketBookNo})`);
    
    // Only process the exact "Under Over +2.5" market
    if (!market.marketDisplayName?.includes('+2.5')) {
      console.log(`     Skipping non-2.5 market: "${market.marketDisplayName}"`);
      return;
    }
    
    // Store the market book number for Power Query compatibility
    if (!oddsData.additionalOdds) {
      oddsData.additionalOdds = {};
    }
    oddsData.additionalOdds[`BookNoOU_${market.marketBookNo}`] = market.marketBookNo;
    
    // Look for 2.5 goals markets specifically
    console.log(`     Found 2.5 goals market: "${market.marketDisplayName}"`);
      
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const odds = parseFloat(selection.companyOdds);
        
        console.log(`     Selection: "${selection.name}" = ${selection.companyOdds} (${odds})`);
        
        if (!isNaN(odds) && odds >= 1.01 && odds <= 50) {
          // Use exact matching for Over/Under selections
          if (selection.name === 'Under') {
            oddsData.under25 = odds;
            console.log(`   ✅ Under 2.5 extracted: ${odds}`);
          } else if (selection.name === 'Over') {
            oddsData.over25 = odds;
            console.log(`   ✅ Over 2.5 extracted: ${odds}`);
          }
        }
      });
    }
  }

  private extractFromNameValueArray(array: any[], oddsData: MatchOddsData): void {
    console.log(`🔍 Processing ${array.length} Name/Value pairs...`);

    array.forEach((item, index) => {
      if (item && typeof item === 'object') {
        const name = item.Name || item.name || item.key || item.type;
        const value = item.Value || item.value || item.odds || item.price;

        if (name && value) {
          console.log(`   ${index}: "${name}" = "${value}"`);
          this.mapOddsValue(name, value, oddsData);
        }
      }
    });
  }

  private extractFromNestedStructure(data: any, oddsData: MatchOddsData): void {
    console.log(`🔍 Searching nested structure for odds data...`);
    
    // Recursively search for Name/Value patterns
    const searchObject = (obj: any, path: string = '') => {
      if (typeof obj !== 'object' || obj === null) return;

      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (Array.isArray(value)) {
          // Check if this array contains Name/Value pairs
          if (value.length > 0 && value[0] && typeof value[0] === 'object') {
            const firstItem = value[0];
            if ((firstItem.Name || firstItem.name) && (firstItem.Value || firstItem.value)) {
              console.log(`📋 Found Name/Value array at ${currentPath}`);
              this.extractFromNameValueArray(value, oddsData);
            }
          }
        } else if (typeof value === 'object') {
          searchObject(value, currentPath);
        }
      });
    };

    searchObject(data);
  }

  private mapOddsValue(name: string, value: string, oddsData: MatchOddsData): void {
    const nameLower = name.toLowerCase();
    const numericValue = parseFloat(value);

    if (isNaN(numericValue) || numericValue < 1.01 || numericValue > 50) {
      return; // Invalid odds value
    }

    // Map common BTTS patterns
    if (nameLower.includes('btts') || nameLower.includes('both') || nameLower.includes('score')) {
      if (nameLower.includes('yes') || nameLower.includes('true') || nameLower === 'btts') {
        oddsData.bttsYes = numericValue;
        console.log(`   🎯 BTTS Yes: ${numericValue}`);
      } else if (nameLower.includes('no') || nameLower.includes('false')) {
        oddsData.bttsNo = numericValue;
        console.log(`   🎯 BTTS No: ${numericValue}`);
      }
    }

    // Map Over/Under patterns
    if (nameLower.includes('over') || nameLower.includes('total')) {
      if (nameLower.includes('2.5') || nameLower.includes('25') || nameLower === 'over') {
        oddsData.over25 = numericValue;
        console.log(`   🎯 Over 2.5: ${numericValue}`);
      }
    }

    if (nameLower.includes('under')) {
      if (nameLower.includes('2.5') || nameLower.includes('25') || nameLower === 'under') {
        oddsData.under25 = numericValue;
        console.log(`   🎯 Under 2.5: ${numericValue}`);
      }
    }

    // Store all additional odds for analysis
    if (!oddsData.additionalOdds) {
      oddsData.additionalOdds = {};
    }
    oddsData.additionalOdds[name] = numericValue;
  }

  async extractOddsForMatches(matches: Array<{id: string, competitionId?: string}>): Promise<Map<string, MatchOddsData>> {
    const oddsMap = new Map<string, MatchOddsData>();
    
    console.log(`🚀 Starting detailed odds extraction for ${matches.length} matches...`);

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      // Extract competition ID from match data or use default
      const competitionId = match.competitionId || this.extractCompetitionFromMatchId(match.id);
      
      if (competitionId) {
        const odds = await this.extractMatchOdds(match.id, competitionId);
        if (odds) {
          oddsMap.set(match.id, odds);
          console.log(`✅ ${i + 1}/${matches.length}: Got odds for match ${match.id}`);
        } else {
          console.log(`⚠️ ${i + 1}/${matches.length}: No odds for match ${match.id}`);
        }
      }

      // Progress update every 10 matches
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${matches.length} matches processed`);
      }
    }

    console.log(`🎯 Extraction complete: ${oddsMap.size}/${matches.length} matches have detailed odds`);
    return oddsMap;
  }

  private extractCompetitionFromMatchId(matchId: string): string | null {
    // Based on your data, try to map match IDs to competition IDs
    const competitionMappings = {
      '227932': '81',  // Austria Cup
      '227369': '126', // EFL Cup  
      '227375': '163', // La Liga
      '227365': '50',  // Champions League
      '227499': '55',  // Conference League
      '227368': '135', // Europa League
    };

    return competitionMappings[matchId as keyof typeof competitionMappings] || null;
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

  private getCachedData(cacheKey: string): MatchOddsData | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
    if (isExpired) return null;
    
    return cached.data;
  }

  private setCachedData(data: MatchOddsData, cacheKey: string): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Match-specific odds cache cleared');
  }
}

export const matchSpecificExtractor = new MatchSpecificExtractor();
export type { MatchOddsData };
