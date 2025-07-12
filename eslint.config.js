export default [
  {
    ignores: ['src/lib/togeojson.esm.js'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    rules: {},
  }
];
