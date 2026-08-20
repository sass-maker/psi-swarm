export const PUBLIC_ROUTE_META = {
  home: {
    path: '/',
    title: 'psi-swarm · distributional Lighthouse performance tracker',
    description:
      'Run Lighthouse repeatedly across realistic device and network presets, then inspect p50, p75, p90, and p99 Web Vitals.',
  },
  projects: {
    path: '/projects/',
    title: 'Projects · psi-swarm',
    description:
      'Review project-level Lighthouse distributions, recent trends, and locally stored run history in psi-swarm.',
  },
  compare: {
    path: '/compare/',
    title: 'Compare performance swarms · psi-swarm',
    description:
      'Compare two tagged Lighthouse swarms across p50, p75, p90, and p99 results to evaluate a change.',
  },
  watchlist: {
    path: '/watchlist/',
    title: 'Performance regression watchlist · psi-swarm',
    description:
      'Review locally tracked performance regressions against tagged baselines and prior psi-swarm measurements.',
  },
  gallery: {
    path: '/gallery/',
    title: 'Performance evidence gallery · psi-swarm',
    description:
      'Explore static before-and-after examples of distributional Lighthouse evidence without connecting a local agent.',
  },
  changelog: {
    path: '/changelog/',
    title: 'Changelog · psi-swarm',
    description:
      'Verified product and release history for psi-swarm, the local-first distributional Lighthouse tracker.',
  },
} as const;

export type PublicRouteKey = keyof typeof PUBLIC_ROUTE_META;
