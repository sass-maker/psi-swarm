export const PUBLIC_ROUTE_META = {
  home: {
    path: '/',
    title: 'PSI Swarm · distributional Lighthouse performance tracker',
    description:
      'Run Lighthouse repeatedly across realistic device and network presets, then inspect p50, p75, p90, and p99 Web Vitals.',
  },
  projects: {
    path: '/projects/',
    title: 'Projects · PSI Swarm',
    description:
      'Review project-level Lighthouse distributions, recent trends, and locally stored run history in PSI Swarm.',
  },
  compare: {
    path: '/compare/',
    title: 'Compare performance swarms · PSI Swarm',
    description:
      'Compare two tagged Lighthouse swarms across p50, p75, p90, and p99 results to evaluate a change.',
  },
  watchlist: {
    path: '/watchlist/',
    title: 'Performance regression watchlist · PSI Swarm',
    description:
      'Review locally tracked performance regressions against tagged baselines and prior PSI Swarm measurements.',
  },
  gallery: {
    path: '/gallery/',
    title: 'Performance evidence gallery · PSI Swarm',
    description:
      'Explore static before-and-after examples of distributional Lighthouse evidence without connecting a local agent.',
  },
  changelog: {
    path: '/changelog/',
    title: 'Changelog · PSI Swarm',
    description:
      'Verified product and release history for PSI Swarm, the local-first distributional Lighthouse tracker.',
  },
} as const;

export type PublicRouteKey = keyof typeof PUBLIC_ROUTE_META;
