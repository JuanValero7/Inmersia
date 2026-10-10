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
      // En "error": una dependencia que falta deja a un efecto leyendo un valor
      // viejo, y ese fallo solo se ve a veces. Si de verdad hay que omitir una,
      // eslint-disable-next-line con el motivo escrito encima.
      "react-hooks/exhaustive-deps": "error",
      "react/no-danger": "error",
      "react/no-danger-with-children": "error",

      // Security rules
      ...security.configs.recommended.rules,
      // Apagada: está pensada para servidores Node, donde la clave de un
      // `objeto[clave]` puede venir de una petición ajena. Aquí marcaba 242
      // accesos como `capitulos[i]` con índices que calcula la propia app:
      // ruido que tapaba los avisos que sí importan.
      "security/detect-object-injection": "off",
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
    // Es la ÚNICA regla que queda en "warn", así que el número de avisos es el
    // número de hex. `npm run lint` lo topa con --max-warnings (package.json):
    // un hex nuevo lo pasa del tope y el lint falla. Al quitar hex, baja el
    // tope al número nuevo para que no se pueda volver a subir.
    //
    // Cuando el contador llegue a cero, súbela a "error" y quita el tope.
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
  {
    // Los tests leen archivos del repo y montan expresiones regulares con
    // nombres de variables CSS: justo lo que estas dos reglas de servidor
    // marcan, sin riesgo aquí.
    files: ["src/**/*.test.js"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",
    },
  },
];
