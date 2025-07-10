interface StatsCardProps {
  title: string;
  value: string | number;
  color: "blue" | "green" | "red" | "yellow";
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  color,
  loading = false,
}: StatsCardProps) {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>
        {loading ? <span className="loading">-</span> : value}
      </p>
    </div>
  );
}
