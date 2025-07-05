// ESLint configuration migrated for v9+

/** @type {import('eslint').Linter.FlatConfig} */
export default [
  {
    ignores: [
      'public/javascripts/*.js',
      '.github/*',
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        module: 'writable',
        require: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {},
    rules: {},
  },
  {
    extends: ['eslint:recommended'],
  },
];
