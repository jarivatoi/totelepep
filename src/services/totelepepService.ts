import { totelepepExtractor, TotelepepMatch } from './totelepepExtractor';

class TotelepepService {
  async getMatches(targetDate?: string): Promise<TotelepepMatch[]> {
    return await totelepepExtractor.extractMatches(targetDate);
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