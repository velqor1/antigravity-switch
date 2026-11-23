import daisyui from "daisyui";
import containerQueries from "@tailwindcss/container-queries";

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ["'Manrope Variable'", "'Manrope'", 'system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'],
                mono: ["'JetBrains Mono Variable'", "'JetBrains Mono'", 'ui-monospace', 'SFMono-Regular', 'monospace'],
            },
        },
    },
    plugins: [daisyui, containerQueries],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#18181b",
                    "secondary": "#71717a",
                    "accent": "#10b981",
                    "neutral": "#09090b",
                    "base-100": "#ffffff",
                    "base-200": "#f4f4f5",
                    "base-300": "#f5f5f7",
                    "info": "#71717a",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
            },
            {
                dark: {
                    "primary": "#fafafa",
                    "secondary": "#a1a1aa",
                    "accent": "#10b981",
                    "neutral": "#18181b",
                    "base-100": "#111113",
                    "base-200": "#18181b",
                    "base-300": "#09090b",
                    "info": "#a1a1aa",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
            },
        ],
        darkTheme: "dark",
    },
}
