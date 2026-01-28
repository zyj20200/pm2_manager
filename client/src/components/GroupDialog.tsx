import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Plus, Pencil } from "lucide-react";

interface GroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
];

export default function GroupDialog({ open, onOpenChange }: GroupDialogProps) {
    const [editMode, setEditMode] = useState<"list" | "create" | "edit">("list");
    const [editingGroup, setEditingGroup] = useState<{ id: number; name: string; description: string; color: string } | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState(PRESET_COLORS[0]);

    const utils = trpc.useUtils();
    const { data: groups = [], isLoading } = trpc.groups.list.useQuery();
    const createMutation = trpc.groups.create.useMutation({
        onSuccess: () => {
            toast.success("分组创建成功");
            utils.groups.list.invalidate();
            resetForm();
        },
        onError: () => toast.error("创建分组失败"),
    });
    const updateMutation = trpc.groups.update.useMutation({
        onSuccess: () => {
            toast.success("分组更新成功");
            utils.groups.list.invalidate();
            resetForm();
        },
        onError: () => toast.error("更新分组失败"),
    });
    const deleteMutation = trpc.groups.delete.useMutation({
        onSuccess: () => {
            toast.success("分组删除成功");
            utils.groups.list.invalidate();
        },
        onError: () => toast.error("删除分组失败"),
    });

    const resetForm = () => {
        setEditMode("list");
        setEditingGroup(null);
        setName("");
        setDescription("");
        setColor(PRESET_COLORS[0]);
    };

    useEffect(() => {
        if (!open) {
            resetForm();
        }
    }, [open]);

    const handleCreate = () => {
        if (!name.trim()) {
            toast.error("请输入分组名称");
            return;
        }
        createMutation.mutate({ name: name.trim(), description: description.trim() || undefined, color });
    };

    const handleUpdate = () => {
        if (!editingGroup || !name.trim()) {
            toast.error("请输入分组名称");
            return;
        }
        updateMutation.mutate({ id: editingGroup.id, name: name.trim(), description: description.trim() || undefined, color });
    };

    const handleDelete = (id: number) => {
        if (confirm("确定要删除此分组吗？分组内的进程将变为未分组状态。")) {
            deleteMutation.mutate({ id });
        }
    };

    const startEdit = (group: { id: number; name: string; description: string | null; color: string | null }) => {
        setEditingGroup({ id: group.id, name: group.name, description: group.description || "", color: group.color || PRESET_COLORS[0] });
        setName(group.name);
        setDescription(group.description || "");
        setColor(group.color || PRESET_COLORS[0]);
        setEditMode("edit");
    };

    const startCreate = () => {
        setName("");
        setDescription("");
        setColor(PRESET_COLORS[0]);
        setEditMode("create");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {editMode === "list" && "管理分组"}
                        {editMode === "create" && "新建分组"}
                        {editMode === "edit" && "编辑分组"}
                    </DialogTitle>
                    <DialogDescription>
                        {editMode === "list" && "创建和管理进程分组"}
                        {editMode === "create" && "创建一个新的进程分组"}
                        {editMode === "edit" && "修改分组信息"}
                    </DialogDescription>
                </DialogHeader>

                {editMode === "list" && (
                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="text-center text-muted-foreground py-8">加载中...</div>
                        ) : groups.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">暂无分组</div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {groups.map((group) => (
                                    <div
                                        key={group.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded-full shrink-0"
                                                style={{ backgroundColor: group.color || PRESET_COLORS[0] }}
                                            />
                                            <div>
                                                <p className="font-medium text-sm">{group.name}</p>
                                                {group.description && (
                                                    <p className="text-xs text-muted-foreground">{group.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                onClick={() => startEdit(group)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(group.id)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Button onClick={startCreate} className="w-full">
                            <Plus className="mr-2 h-4 w-4" />
                            新建分组
                        </Button>
                    </div>
                )}

                {(editMode === "create" || editMode === "edit") && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">分组名称</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="输入分组名称"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">描述（可选）</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="输入分组描述"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>颜色</Label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`w-8 h-8 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                                            }`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setColor(c)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {editMode === "list" ? (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            关闭
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={resetForm}>
                                返回
                            </Button>
                            <Button
                                onClick={editMode === "create" ? handleCreate : handleUpdate}
                                disabled={createMutation.isPending || updateMutation.isPending}
                            >
                                {editMode === "create" ? "创建" : "保存"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
