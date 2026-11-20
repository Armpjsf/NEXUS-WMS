export const CHART_COLORS = {
  inbound: '#57ec7f',
  outbound: '#4cd7f6',
  gold: '#facc15',
  warning: '#f59e0b',
  danger: '#ff5449',
  dangerSoft: '#ffb4ab',
  steel: '#8a92a6',
  grid: 'rgba(255, 255, 255, 0.07)',
  axis: '#64748b',
  tick: '#d1c6ab',
  surface: '#171c23',
  border: '#30353d',
  series: ['#4cd7f6', '#57ec7f', '#facc15', '#f59e0b', '#ff5449'],
} as const;

export const TACTICAL_TOOLTIP_STYLE = {
  backgroundColor: '#090f15',
  border: '1px solid #30353d',
  borderRadius: '10px',
  boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.7)',
  color: '#dee2ec',
  fontFamily: 'var(--font-mono), monospace',
  fontSize: '12px',
} as const;

export const HYBRID_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 4px 10px -6px rgba(15, 23, 42, 0.05)',
  color: '#0f172a',
  fontFamily: 'var(--font-sans), sans-serif',
  fontSize: '12px',
} as const;
