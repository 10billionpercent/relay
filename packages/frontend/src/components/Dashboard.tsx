import React from "react";
import { BarChart3, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { MODELS } from "../constants";

interface DashboardProps {
  stats: any;
  onRefresh: () => void;
  isGuest?: boolean;
}

export default function Dashboard({
  stats,
  onRefresh,
  isGuest,
}: DashboardProps) {
  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 size={24} /> Analytics Dashboard
        </h2>
        {!isGuest && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-[#24272c] rounded-lg hover:bg-[#2a2d33] self-start sm:self-auto"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
          <h3 className="text-gray-400 text-sm">Active Conversations</h3>
          <p className="text-2xl font-bold">
            {stats.totalConversations?.count || 0}
          </p>
        </div>
        <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
          <h3 className="text-gray-400 text-sm">Total Messages</h3>
          <p className="text-2xl font-bold">
            {stats.totalMessages?.count || 0}
          </p>
        </div>

        {!isGuest && (
          <>
            <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
              <h3 className="text-gray-400 text-sm">Avg Latency</h3>
              <p className="text-2xl font-bold">
                {stats.avgLatency?.avg
                  ? `${stats.avgLatency.avg.toFixed(0)}ms`
                  : "N/A"}
              </p>
            </div>
            <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
              <h3 className="text-gray-400 text-sm">Error Rate</h3>
              <p className="text-2xl font-bold">
                {stats.errorRate?.rate ? `${stats.errorRate.rate}%` : "0%"}
              </p>
            </div>
            <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
              <h3 className="text-gray-400 text-sm">Total Tokens</h3>
              <p className="text-2xl font-bold">
                {stats.tokenUsage?.total_tokens?.toLocaleString() || 0}
              </p>
            </div>
          </>
        )}
      </div>

      {isGuest && (
        <p className="text-gray-500 text-sm">Sign in to see full analytics.</p>
      )}

      {/* Model Distribution – always visible */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Model Distribution</h3>
        <div className="space-y-2">
          {stats.modelDistribution?.length > 0 ? (
            stats.modelDistribution.map((item: any) => (
              <div key={item.model} className="flex items-center gap-3">
                <span
                  className="w-32 sm:w-40 text-sm text-gray-300 truncate"
                  title={item.model}
                >
                  {MODELS[item.model].name || item.model}
                </span>
                <div className="flex-1 bg-[#24272c] rounded-full h-2">
                  <div
                    className="bg-[#00cfff] h-2 rounded-full"
                    style={{
                      width: `${(item.count / Math.max(...stats.modelDistribution.map((d: any) => d.count))) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">
                  {item.count}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No data yet</p>
          )}
        </div>
      </div>

      {/* Recent Inference Logs – only for signed-in users */}
      {!isGuest && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Inference Logs</h3>
          {stats.recentLogs?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#24272c] text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2">Latency</th>
                    <th className="px-4 py-2">Tokens</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-[#2a2d33]">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2" title={log.model}>
                        {MODELS[log.model].name || log.model}
                      </td>
                      <td className="px-4 py-2">{log.latency_ms}ms</td>
                      <td className="px-4 py-2">{log.total_tokens}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            log.status === "success"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-red-900/30 text-red-400"
                          }`}
                        >
                          {log.status === "success" ? (
                            <CheckCircle size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No logs yet – start chatting to see data
            </p>
          )}
        </div>
      )}
    </div>
  );
}
