const animate = require("tailwindcss-animate");

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './index.html',
  ],
  plugins: [animate],
};