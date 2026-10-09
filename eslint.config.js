const js = require('@eslint/js');
const globals = require('globals');
const logic = require('./js/logic.js');

// app.js is a classic script that uses the functions logic.js defines as globals.
const logicGlobals = Object.fromEntries(Object.keys(logic).map(name => [name, 'readonly']));

module.exports = [
  { ignores: ['node_modules/', 'css/'] },
  js.configs.recommended,
  {
    files: ['js/logic.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, module: 'readonly' } },
  },
  {
    files: ['js/app.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...logicGlobals } },
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
];
