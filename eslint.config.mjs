import next from 'eslint-config-next';

const config = [
  ...next,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'reference/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
];

export default config;
