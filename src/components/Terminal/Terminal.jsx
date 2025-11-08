import { FiTerminal, FiX } from "react-icons/fi";
import { useEffect, useRef } from "react";

export default function Terminal({ output, isConnected, onClearOutput }) {
  const terminalEndRef = useRef(null);

  // Enhanced auto-scroll
  useEffect(() => {
    const timer = setTimeout(() => {
      terminalEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [output]);

  return (
    <div className="w-80 border-l border-gray-200 flex flex-col bg-gray-800 text-white">
      <div className="bg-gray-800 p-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <FiTerminal className="text-gray-300" />
          <h3 className="font-mono font-medium text-gray-100">Terminal</h3>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
            ></span>
          </div>
          <button
            onClick={onClearOutput}
            className="text-gray-300 hover:text-white transition-colors"
            title="Clear terminal"
          >
            <FiX size={16} />
          </button>
        </div>
      </div>

      <div className="flex-grow bg-gray-900 p-4 overflow-auto font-mono text-sm">
        <pre className="whitespace-pre-wrap break-words text-gray-100">
          {output || (
            <span className="text-gray-400 italic">
              // Output will appear here...
            </span>
          )}
          <div ref={terminalEndRef} />
        </pre>
      </div>
    </div>
  );
}
