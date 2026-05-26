import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212f",
        panel: "#f7f8fb",
        line: "#d8dee8",
        brand: "#0f7b6c",
        coral: "#d94f45",
        amber: "#d7942d"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 47, 0.11)"
      }
    }
  },
  plugins: []
};

export default config;
