import { COLORS } from "./constants";

export const getRandomColor = (seed) => {
  let hash = 0;
  for (let i = 0; i < (seed || "").length; i++) {
    hash = (hash << 5) - hash + (seed || "").charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

export const formatOutput = (type, message) => {
  return `${new Date().toLocaleTimeString()} [${type}] ${message}\n`;
};
