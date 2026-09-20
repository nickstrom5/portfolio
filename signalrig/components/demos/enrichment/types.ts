export type IcpTest = { id: string; label: string; weight: number };

export type Icp = {
  name: string;
  threshold: number;
  summary: string;
  tests: IcpTest[];
  disqualifiers: string[];
  rules: string[];
};

export type TestResult = { id: string; pass: boolean; evidence: string };

export type WaterfallHop = { provider: string; result: "hit" | "miss"; confidence?: number; latencyMs: number };

export type Contact = { name: string; title: string; email: string; verified: boolean; persona: string } | null;

export type CompanyRecord = {
  domain?: string;
  name?: string;
  source: {
    provider: string;
    hq: string;
    employees: number | null;
    founded: number | null;
    industry: string;
    lastRound: string;
  };
  scrape: { pages: string[]; summary: string };
  description: string;
  icp: { score: number; verdict: "qualify" | "disqualify"; reason: string; tests: TestResult[]; disqualifiers: string[] };
  waterfall: WaterfallHop[];
  contact: Contact;
};

export type CreditModel = {
  note: string;
  sourceLookup: number;
  scrapeAndClassify: number;
  waterfallAverage: number;
  defaultBatch: number;
  defaultQualifyRate: number;
};
