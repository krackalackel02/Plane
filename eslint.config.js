import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },
  {
    settings: {
      react: {
        version: "detect", // Automatically detect the React version
      },
    },
    rules: {
      // Suppress errors for missing 'import React' in files
      "react/react-in-jsx-scope": "off",
      // Allow JSX syntax in files with these extensions
      "react/jsx-filename-extension": [
        1,
        { extensions: [".js", ".jsx", ".ts", ".tsx"] },
      ],
      // Custom rule: Ignore specific properties for no-unknown-property checks
      "react/no-unknown-property": [
        "error",
        {
          ignore: [
            "args",
            "intensity",
            "position",
            "angle",
            "penumbra",
            "decay",
            "attach", // Add these to ignored properties
            "array",
            "count",
            "itemSize",
            "vertexColors",
            "object",
            "map",
            "rotation",
          ],
        },
      ],
    },
  },
];
