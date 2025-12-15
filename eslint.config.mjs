import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "coverage/**",
    ],
  },
  {
    rules: {
      // Disable overly strict React Compiler rules that flag standard patterns
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default eslintConfig;
