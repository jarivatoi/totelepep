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
      console.log(`🔧 Parsing Name/Value response for match ${matchId}...`);
      console.log(`📄 Response structure:`, JSON.stringify(data, null, 2));

      const oddsData: MatchOddsData = { matchId };

      // Handle different possible response structures
      if (Array.isArray(data)) {
        // Direct array of Name/Value pairs
        this.extractFromNameValueArray(data, oddsData);
      } else if (data.table && Array.isArray(data.table)) {
        // Table structure with Name/Value pairs
        this.extractFromNameValueArray(data.table, oddsData);
      } else if (data.odds && Array.isArray(data.odds)) {
        // Odds array structure
        this.extractFromNameValueArray(data.odds, oddsData);
      } else if (data.markets && Array.isArray(data.markets)) {
        // Markets array structure
        this.extractFromNameValueArray(data.markets, oddsData);
      } else {
        // Try to find Name/Value pairs in any nested structure
        this.extractFromNestedStructure(data, oddsData);
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

export { matchSpecificExtractor }