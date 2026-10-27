export default [
  { ignores: ["client.js", "node_modules/**"] },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: Object.fromEntries(
        [
          "process",
          "Buffer",
          "console",
          "AbortSignal",
          "AbortController",
          "fetch",
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "window",
          "URL",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^React$",
        },
      ],
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-constant-binary-expression": "error",
    },
  },
];
