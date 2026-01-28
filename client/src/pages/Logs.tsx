import { useState, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSocket, LogData } from "@/hooks/useSocket";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Play, Square, Search, Download } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function Logs() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const pm2IdFromUrl = urlParams.get('pm2Id');

  const [selectedProcess, setSelectedProcess] = useState<number | null>(
    pm2IdFromUrl !== null ? parseInt(pm2IdFromUrl) : null
  );
  const [logType, setLogType] = useState<'stdout' | 'stderr' | 'both'>('both');
  const [logs, setLogs] = useState<LogData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: processes, error: processesError, isLoading } = trpc.processes.list.useQuery();
  const { startLogStream, stopLogStream } = useSocket();

  // Debug logging
  console.log('[Logs] processes:', processes, 'error:', processesError, 'isLoading:', isLoading, 'selectedProcess:', selectedProcess);

  useEffect(() => {
    // Only auto-select first process if no URL parameter was provided
    if (processes && processes.length > 0 && selectedProcess === null && pm2IdFromUrl === null) {
      console.log('[Logs] Setting selectedProcess to:', processes[0].pm_id);
      setSelectedProcess(processes[0].pm_id);
    }
  }, [processes, selectedProcess, pm2IdFromUrl]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      // Use scrollIntoView for more reliable scrolling with Radix ScrollArea
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [logs, autoScroll]);

  const handleStartStreaming = () => {
    if (selectedProcess === null) return;

    console.log('[Logs] Starting stream for process:', selectedProcess);
    setLogs([]);
    setIsStreaming(true);

    startLogStream(selectedProcess, logType, (log: LogData) => {
      setLogs((prev) => [...prev, log]);
    });
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
    stopLogStream();
  };

  const handleDownloadLogs = () => {
    const content = logs
      .map((log) => `[${format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}] [${log.type}] ${log.content}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${selectedProcess}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = searchKeyword
    ? logs.filter((log) => log.content.toLowerCase().includes(searchKeyword.toLowerCase()))
    : logs;

  const selectedProcessInfo = processes?.find((p) => p.pm_id === selectedProcess);

  return (
    <div className="bg-background noise-bg">

      {/* Controls */}
      <div className="container py-6">
        <Card className="p-6 mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div>
              <label className="text-sm font-mono text-muted-foreground mb-2 block">选择进程</label>
              <Select
                value={selectedProcess !== null ? selectedProcess.toString() : ""}
                onValueChange={(value) => setSelectedProcess(parseInt(value))}
                disabled={isStreaming}
              >
                <SelectTrigger>
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
            </div>

            <div>
              <label className="text-sm font-mono text-muted-foreground mb-2 block">日志类型</label>
              <Select
                value={logType}
                onValueChange={(value: any) => setLogType(value)}
                disabled={isStreaming}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">全部</SelectItem>
                  <SelectItem value="stdout">标准输出</SelectItem>
                  <SelectItem value="stderr">错误输出</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-mono text-muted-foreground mb-2 block">搜索</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索日志内容..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-scroll"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                <Label htmlFor="auto-scroll" className="font-mono text-sm">
                  自动滚动
                </Label>
              </div>

              {selectedProcessInfo && (
                <div className="text-sm font-mono">
                  <span className="text-muted-foreground">进程:</span>{' '}
                  <span className="text-primary font-bold">{selectedProcessInfo.name}</span>
                  <span className="text-muted-foreground ml-2">状态:</span>{' '}
                  <span className={`status-${selectedProcessInfo.status} font-bold`}>
                    {selectedProcessInfo.status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadLogs}
                disabled={logs.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                下载日志
              </Button>

              {isStreaming ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopStreaming}
                >
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="neon-border"
                  onClick={handleStartStreaming}
                  disabled={selectedProcess === null}
                >
                  <Play className="mr-2 h-4 w-4" />
                  开始
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Log Display */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="bg-muted/20 px-4 py-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                {isStreaming && (
                  <span className="inline-flex items-center">
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse mr-2" />
                    STREAMING
                  </span>
                )}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {filteredLogs.length} 条日志
              </span>
            </div>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="p-4 font-mono text-sm space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  {isStreaming ? '等待日志输出...' : '点击"开始"按钮开始流式传输日志'}
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`py-1 px-2 rounded ${log.type === 'stderr' ? 'bg-destructive/10 text-destructive' : 'text-foreground'
                      }`}
                  >
                    <span className="text-muted-foreground">
                      [{format(new Date(log.timestamp), 'HH:mm:ss.SSS', { locale: zhCN })}]
                    </span>
                    <span className={`ml-2 ${log.type === 'stderr' ? 'text-destructive' : 'text-primary'}`}>
                      [{log.type}]
                    </span>
                    <span className="ml-2">{log.content}</span>
                  </div>
                ))
              )}
              {/* Scroll anchor for auto-scroll */}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
