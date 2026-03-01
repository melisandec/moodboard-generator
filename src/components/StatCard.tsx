"use client";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatCard({
  label,
  value,
  icon,
  trend,
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {typeof value === "number"
              ? value.toLocaleString()
              : value}
          </p>
          {trend && (
            <p
              className={`mt-1 text-sm font-medium ${
                trend.isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {trend.value}% from last month
            </p>
          )}
        </div>
        {icon && (
          <div className="text-4xl text-gray-400 dark:text-gray-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
