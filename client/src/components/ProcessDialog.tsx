import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pm2Id?: number | null;
}

export default function ProcessDialog({ open, onOpenChange, pm2Id }: ProcessDialogProps) {
  const isEditing = pm2Id !== null && pm2Id !== undefined;

  const [formData, setFormData] = useState({
    name: "",
    script: "",
    cwd: "",
    args: "",
    env: "{}",
    instances: 1,
    exec_mode: "fork" as "fork" | "cluster",
    autorestart: true,
    max_restarts: 10,
    min_uptime: 1000,
    max_memory_restart: "",
  });

  const { data: groups } = trpc.groups.list.useQuery();
  const { data: process } = trpc.processes.describe.useQuery(
    { pm2Id: pm2Id! },
    { enabled: isEditing }
  );

  const startMutation = trpc.processes.start.useMutation();
  const updateConfigMutation = trpc.processes.updateConfig.useMutation();

  useEffect(() => {
    if (process) {
      setFormData({
        name: process.name || "",
        script: process.script || "",
        cwd: process.cwd || "",
        args: process.config?.args?.join(" ") || "",
        env: JSON.stringify(process.config?.env || {}, null, 2),
        instances: process.config?.instances || 1,
        exec_mode: (process.config?.execMode || "fork") as "fork" | "cluster",
        autorestart: process.config?.autorestart === 1,
        max_restarts: process.config?.maxRestarts || 10,
        min_uptime: process.config?.minUptime || 1000,
        max_memory_restart: process.config?.maxMemoryRestart || "",
      });
    } else {
      // Reset form for new process
      setFormData({
        name: "",
        script: "",
        cwd: "",
        args: "",
        env: "{}",
        instances: 1,
        exec_mode: "fork",
        autorestart: true,
        max_restarts: 10,
        min_uptime: 1000,
        max_memory_restart: "",
      });
    }
  }, [process, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let env: Record<string, string> = {};
      try {
        env = JSON.parse(formData.env);
      } catch {
        toast.error("环境变量 JSON 格式错误");
        return;
      }

      if (isEditing) {
        // Update existing process config
        await updateConfigMutation.mutateAsync({
          pm2Id: pm2Id!,
          name: formData.name,
          script: formData.script,
          cwd: formData.cwd || undefined,
          args: formData.args ? formData.args.split(" ") : undefined,
          env,
          instances: formData.instances,
          execMode: formData.exec_mode,
          autorestart: formData.autorestart,
          maxRestarts: formData.max_restarts,
          minUptime: formData.min_uptime,
          maxMemoryRestart: formData.max_memory_restart || undefined,
        });
        toast.success("配置已更新");
      } else {
        // Start new process
        await startMutation.mutateAsync({
          name: formData.name,
          script: formData.script,
          cwd: formData.cwd || undefined,
          args: formData.args || undefined,
          env,
          instances: formData.instances,
          exec_mode: formData.exec_mode,
          autorestart: formData.autorestart,
          max_restarts: formData.max_restarts,
          min_uptime: formData.min_uptime,
          max_memory_restart: formData.max_memory_restart || undefined,
        });
        toast.success("进程已启动");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(isEditing ? "更新配置失败" : "启动进程失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-primary">
            {isEditing ? "编辑进程配置" : "创建新进程"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-mono">进程名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="my-app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="script" className="font-mono">脚本路径 *</Label>
              <Input
                id="script"
                value={formData.script}
                onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                required
                placeholder="/path/to/app.js"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cwd" className="font-mono">工作目录</Label>
            <Input
              id="cwd"
              value={formData.cwd}
              onChange={(e) => setFormData({ ...formData, cwd: e.target.value })}
              placeholder="/path/to/working/directory"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="args" className="font-mono">启动参数</Label>
            <Input
              id="args"
              value={formData.args}
              onChange={(e) => setFormData({ ...formData, args: e.target.value })}
              placeholder="--port 3000 --env production"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="env" className="font-mono">环境变量 (JSON)</Label>
            <Textarea
              id="env"
              value={formData.env}
              onChange={(e) => setFormData({ ...formData, env: e.target.value })}
              placeholder='{"NODE_ENV": "production", "PORT": "3000"}'
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instances" className="font-mono">实例数量</Label>
              <Input
                id="instances"
                type="number"
                min="1"
                value={formData.instances}
                onChange={(e) => setFormData({ ...formData, instances: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exec_mode" className="font-mono">执行模式</Label>
              <Select
                value={formData.exec_mode}
                onValueChange={(value: "fork" | "cluster") =>
                  setFormData({ ...formData, exec_mode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fork">Fork</SelectItem>
                  <SelectItem value="cluster">Cluster</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_restarts" className="font-mono">最大重启次数</Label>
              <Input
                id="max_restarts"
                type="number"
                min="0"
                value={formData.max_restarts}
                onChange={(e) => setFormData({ ...formData, max_restarts: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_uptime" className="font-mono">最小运行时间 (ms)</Label>
              <Input
                id="min_uptime"
                type="number"
                min="0"
                value={formData.min_uptime}
                onChange={(e) => setFormData({ ...formData, min_uptime: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_memory_restart" className="font-mono">内存限制重启</Label>
            <Input
              id="max_memory_restart"
              value={formData.max_memory_restart}
              onChange={(e) => setFormData({ ...formData, max_memory_restart: e.target.value })}
              placeholder="300M"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="autorestart"
              checked={formData.autorestart}
              onCheckedChange={(checked) => setFormData({ ...formData, autorestart: checked })}
            />
            <Label htmlFor="autorestart" className="font-mono">自动重启</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              className="neon-border"
              disabled={startMutation.isPending || updateConfigMutation.isPending}
            >
              {isEditing ? "保存配置" : "启动进程"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
