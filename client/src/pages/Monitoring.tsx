import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function Monitoring() {
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  
  const { data: processes } = trpc.processes.list.useQuery();
  const { data: metrics, refetch } = trpc.metrics.history.useQuery(
    {
      pm2Id: selectedProcess!,
      startTime: getStartTime(timeRange),
      limit: 200,
    },
    {
      enabled: selectedProcess !== null,
      refetchInterval: 5000, // Refetch every 5 seconds
    }
  );

  useEffect(() => {
    if (processes && processes.length > 0 && !selectedProcess) {
      setSelectedProcess(processes[0].pm_id);
    }
  }, [processes, selectedProcess]);

  function getStartTime(range: typeof timeRange): Date {
    const now = new Date();
    switch (range) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  const chartData = metrics
    ? metrics
        .slice()
        .reverse()
        .map((m) => ({
          time: format(new Date(m.timestamp), 'HH:mm:ss', { locale: zhCN }),
          cpu: m.cpu,
          memory: (m.memory / 1024 / 1024).toFixed(2), // Convert to MB
        }))
    : [];

  const selectedProcessInfo = processes?.find((p) => p.pm_id === selectedProcess);

  return (
    <div className="bg-background noise-bg">

      {/* Controls */}
      <div className="container py-6">
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
            <label className="text-sm font-mono text-muted-foreground mb-2 block">选择进程</label>
            <Select
              value={selectedProcess?.toString()}
              onValueChange={(value) => setSelectedProcess(parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择一个进程" />
              </SelectTrigger>
              <SelectContent>
                {processes?.map((p) => (
                  <SelectItem key={p.pm_id} value={p.pm_id.toString()}>
                    <span className="font-mono">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">ID: {p.pm_id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
            <label className="text-sm font-mono text-muted-foreground mb-2 block">时间范围</label>
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">最近 1 小时</SelectItem>
                <SelectItem value="6h">最近 6 小时</SelectItem>
                <SelectItem value="24h">最近 24 小时</SelectItem>
                <SelectItem value="7d">最近 7 天</SelectItem>
              </SelectContent>
            </Select>
          </Card>
        </div>

        {selectedProcessInfo && (
          <Card className="p-6 mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-2xl font-bold font-mono text-primary">
                  {selectedProcessInfo.name}
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  状态: <span className={`status-${selectedProcessInfo.status}`}>
                    {selectedProcessInfo.status.toUpperCase()}
                  </span>
                </p>
              </div>
              <div className="ml-auto grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">当前 CPU</p>
                  <p className="text-2xl font-bold font-mono text-primary">
                    {selectedProcessInfo.cpu.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">当前内存</p>
                  <p className="text-2xl font-bold font-mono text-secondary">
                    {(selectedProcessInfo.memory / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* CPU Chart */}
        <Card className="p-6 mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold font-mono mb-4 tech-angle">CPU 使用率</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(30% 0.08 195)" opacity={0.3} />
              <XAxis
                dataKey="time"
                stroke="oklch(60% 0.02 240)"
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="oklch(60% 0.02 240)"
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
                label={{ value: '%', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(12% 0.02 240)',
                  border: '1px solid oklch(30% 0.08 195)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: 'oklch(98% 0.01 0)' }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="oklch(75% 0.20 195)"
                strokeWidth={2}
                dot={false}
                name="CPU %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Memory Chart */}
        <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold font-mono mb-4 tech-angle">内存使用量</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(30% 0.08 195)" opacity={0.3} />
              <XAxis
                dataKey="time"
                stroke="oklch(60% 0.02 240)"
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="oklch(60% 0.02 240)"
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
                label={{ value: 'MB', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(12% 0.02 240)',
                  border: '1px solid oklch(30% 0.08 195)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: 'oklch(98% 0.01 0)' }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="oklch(65% 0.25 330)"
                strokeWidth={2}
                dot={false}
                name="内存 MB"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
