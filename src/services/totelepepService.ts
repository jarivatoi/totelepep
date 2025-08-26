import { totelepepExtractor, TotelepepMatch } from './totelepepExtractor';
import { matchSpecificExtractor } from './matchSpecificExtractor';

class TotelepepService {
  async getMatches(targetDate?: string): Promise<TotelepepMatch[]> {
    // Get basic match data first
    const basicMatches = await totelepepExtractor.extractMatches(targetDate);
    
    // Enhance with real BTTS/Over-Under odds
    const enhancedMatches = await this.enhanceWithRealOdds(basicMatches);
    
    return enhancedMatches;
  }

  private async enhanceWithRealOdds(matches: TotelepepMatch[]): Promise<TotelepepMatch[]> {
    console.log(`🎯 Enhancing ${matches.length} matches with real BTTS/Over-Under odds...`);
    
    const enhanced: TotelepepMatch[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      try {
        // Extract competition ID from match data
        const competitionId = this.extractCompetitionId(match);
        
        if (competitionId) {
          console.log(`🔍 Getting real odds for ${match.homeTeam} vs ${match.awayTeam} (Match ${match.id})`);
          
          const realOdds = await matchSpecificExtractor.extractMatchOdds(match.id, competitionId);
          
          if (realOdds && (realOdds.bttsYes || realOdds.over25)) {
            // Use real odds
            const enhancedMatch: TotelepepMatch = {
              ...match,
              bothTeamsScore: {
                yes: realOdds.bttsYes || match.bothTeamsScore.yes,
                no: realOdds.bttsNo || match.bothTeamsScore.no,
              },
              overUnder: {
                over: realOdds.over25 || match.overUnder.over,
                under: realOdds.under25 || match.overUnder.under,
                line: 2.5,
              },
            };
            
            enhanced.push(enhancedMatch);
            console.log(`✅ Enhanced ${match.homeTeam} vs ${match.awayTeam} with real odds`);
          } else {
            // Keep original match with mock odds
            enhanced.push(match);
            console.log(`⚠️ No real odds found for ${match.homeTeam} vs ${match.awayTeam}, using mock odds`);
          }
        } else {
          // Keep original match
          enhanced.push(match);
          console.log(`⚠️ No competition ID for ${match.homeTeam} vs ${match.awayTeam}`);
        }
        
        // Small delay to respect rate limits
        if (i < matches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.warn(`⚠️ Error enhancing match ${match.id}:`, error);
        enhanced.push(match); // Keep original match
      }
    }
    
    console.log(`🎯 Enhanced ${enhanced.length} matches with real odds data`);
    return enhanced;
  }

  private extractCompetitionId(match: TotelepepMatch): string | null {
    // Try to extract competition ID from the match data
    // This would need to be implemented based on your match data structure
    
    // For now, use common competition mappings
    const leagueToCompetition: Record<string, string> = {
      'Austria - OFB Cup': '81',
      'England - EFL Cup': '126',
      'Spain - LaLiga': '163',
      'International Clubs - UEFA Champions League': '50',
      'International Clubs - UEFA Conference League': '55',
      'International Clubs - UEFA Europa League': '135',
      'Lithuania - A Lyga': '38',
      'Japan - Emperor Cup': '52',
      'Czechia - Czech Cup': '112', // Add Czech Cup
    };
    
    return leagueToCompetition[match.league] || null;
  }

  sortMatchesByDate(matches: TotelepepMatch[]): TotelepepMatch[] {
    return totelepepExtractor.sortMatchesByDate(matches);
  }

  groupMatchesByDate(matches: TotelepepMatch[]): Record<string, TotelepepMatch[]> {
    return totelepepExtractor.groupMatchesByDate(matches);
  }
}

export const totelepepService = new TotelepepService();
export type { TotelepepMatch };