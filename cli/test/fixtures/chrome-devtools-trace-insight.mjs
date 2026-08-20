const DOCUMENT_LATENCY_THRESHOLD_MS = 600;

function median(values) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function medianPhase(results, phase) {
  const timings = results.flatMap((result) =>
    (result.audits ?? [])
      .filter((audit) => audit.id === 'largest-contentful-paint-element')
      .flatMap((audit) => audit.lcpPhases ?? [])
      .filter((entry) => entry.phase === phase)
      .map((entry) => entry.timingMs)
  );
  return median(timings);
}

const adapter = {
  name: 'chrome-devtools-mcp-validation',
  async diagnose({ results, artifactPath }) {
    const ttfbMs = median(
      results.map((result) => result.metrics?.ttfb).filter((value) => typeof value === 'number')
    );
    const renderDelayMs = medianPhase(results, 'Render Delay');

    if (ttfbMs !== undefined && ttfbMs > DOCUMENT_LATENCY_THRESHOLD_MS) {
      return {
        bottleneckPhase: 'TTFB',
        summary: `DocumentLatency regression: ${Math.round(ttfbMs)}ms TTFB`,
        opportunities: ['Respond to the initial document request within 600ms'],
        adapter: adapter.name,
        artifactPath,
      };
    }

    if (renderDelayMs !== undefined && renderDelayMs > DOCUMENT_LATENCY_THRESHOLD_MS) {
      return {
        bottleneckPhase: 'Render Delay',
        summary: `LCPBreakdown regression: ${Math.round(renderDelayMs)}ms render delay`,
        opportunities: ['Render the LCP element without a post-load visibility delay'],
        adapter: adapter.name,
        artifactPath,
      };
    }

    return {
      summary: 'No known Chrome DevTools regression detected',
      opportunities: [],
      adapter: adapter.name,
      artifactPath,
    };
  },
};

export default adapter;
