interface StatusIndicatorProps {
  status: "online" | "offline" | "loading";
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
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
      <span className="text-sm text-gray-600">{config.text}</span>
    </div>
  );
}
