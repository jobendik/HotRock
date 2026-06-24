// Flat ESLint config. Enforces the layer boundaries from docs/ARCHITECTURE.md:
// a forbidden cross-layer import fails `npm run lint`.
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

/** no-restricted-imports rule forbidding the given layer aliases (and, optionally, phaser). */
const forbid = (aliases, phaser = true) => [
  'error',
  {
    patterns: aliases.map((a) => ({
      group: [a, `${a}/*`],
      message: 'Layer boundary violation — see docs/ARCHITECTURE.md.',
    })),
    ...(phaser
      ? { paths: [{ name: 'phaser', message: 'phaser may only be imported inside src/game/**.' }] }
      : {}),
  },
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // ---- layer boundaries (the heart of the architecture) ----
  { files: ['src/core/**/*.ts'], rules: { 'no-restricted-imports': forbid(['@/sim', '@/game', '@/ui', '@/platform']) } },
  { files: ['src/sim/**/*.ts'],  rules: { 'no-restricted-imports': forbid(['@/game', '@/ui', '@/platform']) } },
  { files: ['src/ui/**/*.ts'],   rules: { 'no-restricted-imports': forbid(['@/game', '@/sim', '@/platform']) } },
  { files: ['src/game/**/*.ts'], rules: { 'no-restricted-imports': forbid(['@/ui', '@/platform'], false) } },
  eslintConfigPrettier,
);
