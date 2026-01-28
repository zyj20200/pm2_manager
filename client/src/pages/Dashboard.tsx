import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useSocket, PM2Process } from "@/hooks/useSocket";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import ProcessDialog from "@/components/ProcessDialog";
import GroupDialog from "@/components/GroupDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
  Settings,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

type SortField = 'status' | 'pm_id' | 'name' | 'cpu' | 'memory' | 'uptime' | 'restarts';
type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [processes, setProcesses] = useState<PM2Process[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('pm_id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const { connected, startMonitoring, stopMonitoring } = useSocket();

  // Fetch groups
  const { data: groups = [] } = trpc.groups.list.useQuery();

  const stopMutation = trpc.processes.stop.useMutation();
  const restartMutation = trpc.processes.restart.useMutation();
  const deleteMutation = trpc.processes.delete.useMutation();
  const batchMutation = trpc.processes.batchOperation.useMutation();
  const updateGroupMutation = trpc.processes.updateGroup.useMutation({
    onSuccess: () => toast.success('分组已更新'),
    onError: () => toast.error('更新分组失败'),
  });

  useEffect(() => {
    startMonitoring((updatedProcesses) => {
      setProcesses(updatedProcesses);
    });

    return () => {
      stopMonitoring();
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700';
      case 'stopped':
        return 'bg-gray-100 text-gray-600';
      case 'errored':
        return 'bg-red-100 text-red-700';
      case 'restarting':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  };

  const formatUptime = (timestamp: number) => {
    if (!timestamp) return '-';
    return formatDistanceToNow(new Date(timestamp), { locale: zhCN, addSuffix: false });
  };

  const handleStop = async (pm2Id: number) => {
    try {
      await stopMutation.mutateAsync({ pm2Id });
      toast.success('进程已停止');
    } catch (error) {
      toast.error('停止进程失败');
    }
  };

  const handleRestart = async (pm2Id: number) => {
    try {
      await restartMutation.mutateAsync({ pm2Id });
      toast.success('进程已重启');
    } catch (error) {
      toast.error('重启进程失败');
    }
  };

  const handleDelete = async (pm2Id: number) => {
    if (!confirm('确定要删除此进程吗？')) return;

    try {
      await deleteMutation.mutateAsync({ pm2Id });
      toast.success('进程已删除');
    } catch (error) {
      toast.error('删除进程失败');
    }
  };

  const handleBatchOperation = async (operation: 'stop' | 'restart' | 'delete') => {
    if (selectedProcesses.size === 0) {
      toast.error('请先选择进程');
      return;
    }

    if (operation === 'delete' && !confirm(`确定要删除 ${selectedProcesses.size} 个进程吗？`)) {
      return;
    }

    try {
      const result = await batchMutation.mutateAsync({
        pm2Ids: Array.from(selectedProcesses),
        operation,
      });

      toast.success(`成功: ${result.success}, 失败: ${result.failed}`);
      setSelectedProcesses(new Set());
    } catch (error) {
      toast.error('批量操作失败');
    }
  };

  const toggleSelectProcess = (pm2Id: number) => {
    const newSelected = new Set(selectedProcesses);
    if (newSelected.has(pm2Id)) {
      newSelected.delete(pm2Id);
    } else {
      newSelected.add(pm2Id);
    }
    setSelectedProcesses(newSelected);
  };

  const selectAll = () => {
    if (selectedProcesses.size === processes.length) {
      setSelectedProcesses(new Set());
    } else {
      setSelectedProcesses(new Set(processes.map(p => p.pm_id)));
    }
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorted and filtered processes
  const sortedProcesses = useMemo(() => {
    // First filter by group
    let filtered = processes;
    if (selectedGroup !== 'all') {
      if (selectedGroup === 'ungrouped') {
        filtered = processes.filter(p => !(p as any).groupId);
      } else {
        const groupId = parseInt(selectedGroup);
        filtered = processes.filter(p => (p as any).groupId === groupId);
      }
    }

    // Then sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'pm_id':
          comparison = a.pm_id - b.pm_id;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'cpu':
          comparison = a.cpu - b.cpu;
          break;
        case 'memory':
          comparison = a.memory - b.memory;
          break;
        case 'uptime':
          comparison = (a.uptime || 0) - (b.uptime || 0);
          break;
        case 'restarts':
          comparison = a.restarts - b.restarts;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [processes, sortField, sortDirection, selectedGroup]);

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Statistics
  const onlineCount = processes.filter(p => p.status === 'online').length;
  const stoppedCount = processes.filter(p => p.status === 'stopped').length;
  const erroredCount = processes.filter(p => p.status === 'errored').length;
  const totalMemory = processes.reduce((sum, p) => sum + (p.memory || 0), 0);
  const avgCpu = processes.length > 0
    ? (processes.reduce((sum, p) => sum + (p.cpu || 0), 0) / processes.length).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">进程管理</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {connected ? '已连接' : '未连接'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setGroupDialogOpen(true)}
            >
              <Layers className="mr-2 h-4 w-4" />
              管理分组
            </Button>
            <Button
              onClick={() => {
                setEditingProcessId(null);
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建进程
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{processes.length}</p>
                <p className="text-sm text-muted-foreground">总进程数</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{onlineCount}</p>
                <p className="text-sm text-muted-foreground">运行中</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Square className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">{stoppedCount}</p>
                <p className="text-sm text-muted-foreground">已停止</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{erroredCount}</p>
                <p className="text-sm text-muted-foreground">错误</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Cpu className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{avgCpu}%</p>
                <p className="text-sm text-muted-foreground">平均 CPU</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Batch Operations */}
        {selectedProcesses.size > 0 && (
          <Card className="p-3 mb-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                已选择 <span className="font-bold">{selectedProcesses.size}</span> 个进程
              </span>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchOperation('restart')}
                  disabled={batchMutation.isPending}
                >
                  <RotateCw className="mr-1 h-3 w-3" />
                  批量重启
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchOperation('stop')}
                  disabled={batchMutation.isPending}
                >
                  <Square className="mr-1 h-3 w-3" />
                  批量停止
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBatchOperation('delete')}
                  disabled={batchMutation.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  批量删除
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Process Table */}
        <Card className="bg-card border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-foreground">进程列表</h2>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="筛选分组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分组</SelectItem>
                  <SelectItem value="ungrouped">未分组</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color || '#3B82F6' }}
                        />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="ghost" onClick={selectAll}>
              {selectedProcesses.size === sortedProcesses.length ? '取消全选' : '全选'}
            </Button>
          </div>

          {processes.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">没有运行中的进程</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        checked={selectedProcesses.size === processes.length && processes.length > 0}
                        onChange={selectAll}
                        className="rounded border-border"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('status')}
                    >
                      <span className="flex items-center">状态<SortIcon field="status" /></span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('pm_id')}
                    >
                      <span className="flex items-center">ID<SortIcon field="pm_id" /></span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('name')}
                    >
                      <span className="flex items-center">名称<SortIcon field="name" /></span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">分组</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('cpu')}
                    >
                      <span className="flex items-center">CPU<SortIcon field="cpu" /></span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('memory')}
                    >
                      <span className="flex items-center">内存<SortIcon field="memory" /></span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('uptime')}
                    >
                      <span className="flex items-center">运行时间<SortIcon field="uptime" /></span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('restarts')}
                    >
                      <span className="flex items-center">重启<SortIcon field="restarts" /></span>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedProcesses.map((process) => (
                    <tr
                      key={process.pm_id}
                      className={`hover:bg-muted/30 transition-colors ${selectedProcesses.has(process.pm_id) ? 'bg-blue-50/50' : ''
                        }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProcesses.has(process.pm_id)}
                          onChange={() => toggleSelectProcess(process.pm_id)}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(process.status)}`}>
                          {process.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {process.pm_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{process.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={(process as any).groupId?.toString() || 'none'}
                          onValueChange={(value) => {
                            updateGroupMutation.mutate({
                              pm2Id: process.pm_id,
                              groupId: value === 'none' ? null : parseInt(value)
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无分组</SelectItem>
                            {groups.map((group) => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: group.color || '#3B82F6' }}
                                  />
                                  {group.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-mono">
                        {process.cpu.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-mono">
                        {formatMemory(process.memory)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatUptime(process.uptime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {process.restarts}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {process.status === 'stopped' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleRestart(process.pm_id)}
                              disabled={restartMutation.isPending}
                              title="启动"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                              onClick={() => handleStop(process.pm_id)}
                              disabled={stopMutation.isPending}
                              title="停止"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleRestart(process.pm_id)}
                            disabled={restartMutation.isPending}
                            title="重启"
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => setLocation(`/logs?pm2Id=${process.pm_id}`)}
                            title="查看日志"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                            onClick={() => {
                              setEditingProcessId(process.pm_id);
                              setDialogOpen(true);
                            }}
                            title="设置"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(process.pm_id)}
                            disabled={deleteMutation.isPending}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ProcessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pm2Id={editingProcessId}
      />

      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
      />
    </div>
  );
}
