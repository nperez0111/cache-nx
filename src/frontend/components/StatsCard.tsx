import React from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  color: "blue" | "green" | "red" | "yellow";
  loading?: boolean;
  theme: "light" | "dark";
}

export function StatsCard({
  title,
  value,
  color,
  loading = false,
  theme,
}: StatsCardProps) {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
  };

  return (
    <div
      className={`p-6 rounded-lg shadow transition-colors ${
        theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
      }`}
    >
      <h3
        className={`text-lg font-semibold mb-2 ${
          theme === "dark" ? "text-gray-200" : "text-gray-900"
        }`}
      >
        {title}
      </h3>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>
        {loading ? <span className="loading">-</span> : value}
      </p>
    </div>
  );
}
