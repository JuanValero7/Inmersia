import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks, security },
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        alert: "readonly",
        confirm: "readonly",
        FormData: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        Audio: "readonly",
        MediaRecorder: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        crypto: "readonly",
        performance: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        process: "readonly",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React rules
      ...react.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off", // sin PropTypes en el proyecto; si se quiere tipado, mejor migrar a TypeScript
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-danger": "error",
      "react/no-danger-with-children": "error",

      // Security rules
      ...security.configs.recommended.rules,
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
    },
  },
  {
    // Colores a mano en JSX.
    //
    // El naranja de la marca estaba escrito 88 veces entre .jsx y .css, y la
    // tinta 105, sin un sitio donde cambiarlos. La paleta vive ahora en el
    // bloque :root de src/index.css. Esta regla evita que vuelvan a entrar
    // hex nuevos sin que nadie lo note.
    //
    // En "warn" y no "error" a propósito: quedan ~500 hex heredados que se
    // van sustituyendo por pantalla, cuando se toca cada una por otro motivo.
    // Un "error" dejaría el lint rojo desde el primer día y se acabaría
    // desactivando la regla entera, que es peor.
    //
    // OJO: `npm run security-check` usa `eslint --quiet`, que NO muestra
    // warnings. Esta regla trabaja en el editor, subrayando mientras escribes.
    // Para ver la lista completa: npx eslint src/ --ext .jsx
    //
    // Cuando el contador llegue a cero, súbela a "error" y ahí sí entra en
    // security-check.
    files: ["src/**/*.jsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Usa una variable CSS var(--…) de index.css en vez de un hex literal.",
        },
      ],
    },
  },
];
