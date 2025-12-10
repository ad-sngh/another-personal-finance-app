export type Insight = {
  ticker: string;
  move: string;
  direction: 'up' | 'down' | 'flat';
  summary: string;
  timestamp: string; // ISO string
  source?: string;
};

export const mockInsights: Insight[] = [
  {
    ticker: 'NVDA',
    move: '+4.3% today',
    direction: 'up',
    summary:
      'Morgan Stanley bumped its target after supply chain checks pointed to Blackwell GPUs landing in hyperscale racks a quarter early.',
    timestamp: '2025-11-27T15:12:00Z',
    source: 'Morgan Stanley desk note'
  },
  {
    ticker: 'TSLA',
    move: '-2.1% today',
    direction: 'down',
    summary:
      'EU regulators opened a fresh FSD marketing probe while UBS trimmed FY26 delivery estimates on a slower Cybertruck ramp.',
    timestamp: '2025-11-27T14:48:00Z',
    source: 'Reuters'
  },
  {
    ticker: 'AAPL',
    move: '+1.6% today',
    direction: 'up',
    summary:
      'Vision Pro 2 build orders reportedly doubled for the holidays; Wedbush reiterated its $250 target citing resilient Services growth.',
    timestamp: '2025-11-27T14:15:00Z',
    source: 'Bloomberg'
  },
  {
    ticker: 'MSFT',
    move: '+0.9% today',
    direction: 'up',
    summary:
      'Announced an AI data partnership with Snowflake, which JPMorgan says can add 40 bps to Azure growth exiting FY25.',
    timestamp: '2025-11-27T13:55:00Z',
    source: 'JPMorgan channel checks'
  },
  {
    ticker: 'AMZN',
    move: '+1.2% today',
    direction: 'up',
    summary:
      'Prime logistics margins reached a record in October per MoffettNathanson, giving AWS room to keep price cuts off the table.',
    timestamp: '2025-11-27T13:05:00Z',
    source: 'MoffettNathanson report'
  },
  {
    ticker: 'JNJ',
    move: 'unch',
    direction: 'flat',
    summary:
      'FDA advisory panel backed the company’s next-gen RSV shot; launch timeline unchanged but Street expects faster uptake in 2H.',
    timestamp: '2025-11-27T12:40:00Z',
    source: 'FDA panel recap'
  }
];
