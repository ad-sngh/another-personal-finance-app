export const formatNumber = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0.0';
  }
  return Number(value).toFixed(1);
};

export const formatCurrency = (
  value?: number | null,
  options: { symbol?: string } = {}
): string => {
  const symbol = options.symbol ?? '$';
  if (value === undefined || value === null || Number.isNaN(value)) {
    return `${symbol}0.0`;
  }
  const formatted = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${symbol}${formatted}`;
};

export const formatPercentage = (value?: number | null): string => {
  return `${formatNumber(value)}%`;
};
