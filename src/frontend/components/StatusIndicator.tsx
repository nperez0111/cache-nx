import React from "react";

interface StatusIndicatorProps {
  status: "online" | "offline" | "loading";
  theme: "light" | "dark";
}

export function StatusIndicator({ status, theme }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "online":
        return {
          className: "w-3 h-3 rounded-full bg-green-500 mr-2",
          text: "Connected",
        };
      case "offline":
        return {
          className: "w-3 h-3 rounded-full bg-red-500 mr-2",
          text: "Disconnected",
        };
      case "loading":
        return {
          className: "w-3 h-3 rounded-full bg-yellow-500 mr-2 animate-pulse",
          text: "Loading...",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center">
      <div className={config.className}></div>
      <span
        className={`text-sm ${
          theme === "dark" ? "text-gray-400" : "text-gray-600"
        }`}
      >
        {config.text}
      </span>
    </div>
  );
}
