interface MatchOddsData {
  matchId: string;
  bttsYes?: number;
  bttsNo?: number;
  over25?: number;
  under25?: number;
  additionalOdds?: Record<string, number>;
  allMarkets?: any[];
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
      
      // Use the exact Power Query endpoint structure
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

      // Parse using Power Query logic (Table.ExpandTableColumn equivalent)
      const oddsData = this.parseMatchResponse(data, matchId);
      
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

  private parseMatchResponse(data: any, matchId: string): MatchOddsData | null {
    try {
      console.log(`🔧 Parsing match response for ${matchId}...`);
      
      // Find the target match in the response
      let targetMatch = null;
      
      // Check competitions array first
      if (data.competitions && Array.isArray(data.competitions)) {
        for (const competition of data.competitions) {
          if (competition.matches && Array.isArray(competition.matches)) {
            targetMatch = competition.matches.find((match: any) => 
              match.id?.toString() === matchId || match.matchId?.toString() === matchId
            );
            if (targetMatch) break;
          }
        }
      }
      
      // Check direct matches array
      if (!targetMatch && data.matches && Array.isArray(data.matches)) {
        targetMatch = data.matches.find((match: any) => 
          match.id?.toString() === matchId || match.matchId?.toString() === matchId
        );
      }

      if (!targetMatch) {
        console.warn(`⚠️ Match ${matchId} not found in response`);
        return null;
      }

      console.log(`📊 Found target match:`, targetMatch);

      const oddsData: MatchOddsData = { 
        matchId,
        allMarkets: targetMatch.markets || []
      };

      // Extract odds from all markets (Power Query: Table.ExpandTableColumn)
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        console.log(`📋 Processing ${targetMatch.markets.length} markets for match ${matchId}...`);
        
        targetMatch.markets.forEach((market: any, index: number) => {
          console.log(`   Market ${index + 1}: "${market.marketDisplayName}" (${market.marketCode})`);
          
          // Power Query exact match: "Both Team To Score "
          if (market.marketDisplayName === "Both Team To Score ") {
            this.extractBTTSFromMarket(market, oddsData);
          }
          
          // Over/Under 2.5 markets
          if (market.marketDisplayName?.includes('+2.5')) {
            this.extractOverUnderFromMarket(market, oddsData);
          }
        });
      }

      console.log(`📊 Match ${matchId} final odds:`, {
        bttsYes: oddsData.bttsYes,
        bttsNo: oddsData.bttsNo,
        over25: oddsData.over25,
        under25: oddsData.under25
      });

      return Object.keys(oddsData).length > 1 ? oddsData : null;

    } catch (error) {
      console.error(`❌ Error parsing match ${matchId} response:`, error);
      return null;
    }
  }

  private extractBTTSFromMarket(market: any, oddsData: MatchOddsData): void {
    console.log(`   🎯 Extracting BTTS odds from market: "${market.marketDisplayName}"`);
    
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const oddsValue = parseFloat(selection.companyOdds);
        
        if (!isNaN(oddsValue) && oddsValue >= 1.01 && oddsValue <= 50) {
          if (selection.name === 'YES') {
            oddsData.bttsYes = oddsValue;
            console.log(`   ✅ BTTS Yes extracted: ${oddsValue}`);
          } else if (selection.name === 'NO') {
            oddsData.bttsNo = oddsValue;
            console.log(`   ✅ BTTS No extracted: ${oddsValue}`);
          }
        }
      });
    }
  }

  private extractOverUnderFromMarket(market: any, oddsData: MatchOddsData): void {
    console.log(`   🎯 Extracting Over/Under odds from market: "${market.marketDisplayName}"`);
    
    if (market.selectionList && Array.isArray(market.selectionList)) {
      market.selectionList.forEach((selection: any) => {
        const oddsValue = parseFloat(selection.companyOdds);
        
        if (!isNaN(oddsValue) && oddsValue >= 1.01 && oddsValue <= 50) {
          if (selection.name === 'Over') {
            oddsData.over25 = oddsValue;
            console.log(`   ✅ Over 2.5 extracted: ${oddsValue}`);
          } else if (selection.name === 'Under') {
            oddsData.under25 = oddsValue;
            console.log(`   ✅ Under 2.5 extracted: ${oddsValue}`);
          }
        }
      });
    }
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