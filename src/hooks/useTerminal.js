import { useRef, useEffect } from "react";

export const useTerminal = (output) => {
  const outputEndRef = useRef(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  return { outputEndRef };
};
