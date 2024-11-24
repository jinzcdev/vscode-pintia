import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [{
    ignores: ["**/out", "**/dist", "**/*.d.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 6,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": "warn",
        "@typescript-eslint/semi": "warn",
        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "off",
        forin: false,
        "object-literal-sort-keys": false,
        indent: [true, "spaces"],
        "no-string-literal": false,
        "no-namespace": false,
        "max-line-length": [false, 120],

        typedef: [
            true,
            "call-signature",
            "arrow-call-signature",
            "parameter",
            "arrow-parameter",
            "property-declaration",
            "variable-declaration",
            "member-variable-declaration",
        ],

        "variable-name": [true, "allow-leading-underscore"],
    },
}];