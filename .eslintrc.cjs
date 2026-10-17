module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-console": "off",
    "prefer-const": "error",
    "eqeqeq": ["error", "always"]
  }
};
