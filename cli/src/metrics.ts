type MetricKey = 'lcp' | 'inp' | 'cls' | 'tbt' | 'fcp' | 'ttfb' | 'si' | 'performance_score';

export interface MetricSpec {
  key: MetricKey;
  label: string;
  unit: 'ms' | 'score' | 'index';
  good?: number;
  poor?: number;
  higherIsBetter?: boolean;
}

export const METRICS: MetricSpec[] = [
  {
    key: 'performance_score',
    label: 'Perf Score',
    unit: 'score',
    good: 90,
    poor: 50,
    higherIsBetter: true,
  },
  { key: 'lcp', label: 'LCP', unit: 'ms', good: 2500, poor: 4000 },
  { key: 'inp', label: 'INP', unit: 'ms', good: 200, poor: 500 },
  { key: 'cls', label: 'CLS', unit: 'index', good: 0.1, poor: 0.25 },
  { key: 'tbt', label: 'TBT', unit: 'ms', good: 200, poor: 600 },
  { key: 'fcp', label: 'FCP', unit: 'ms', good: 1800, poor: 3000 },
  { key: 'ttfb', label: 'TTFB', unit: 'ms', good: 800, poor: 1800 },
  { key: 'si', label: 'SI', unit: 'ms', good: 3400, poor: 5800 },
];
