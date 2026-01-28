import { Link, useLocation } from "wouter";
import { LayoutDashboard, Activity, FileText, Settings } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "进程列表" },
    { path: "/monitoring", icon: Activity, label: "性能监控" },
    { path: "/logs", icon: FileText, label: "日志查看" },
    { path: "/settings", icon: Settings, label: "设置" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-2xl font-black tracking-tight">
            <span className="text-primary neon-glow">PM2</span>
            <span className="text-secondary ml-1">CTRL</span>
          </h2>
          <p className="text-xs font-mono text-muted-foreground mt-1">v2.0.1</p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-md font-mono text-sm transition-all ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
                  }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/50">
          <div className="text-xs font-mono text-muted-foreground space-y-1">
            <div className="tech-bracket">SYSTEM STATUS</div>
            <div className="flex items-center justify-between">
              <span>UPTIME</span>
              <span className="text-primary">99.9%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>LOAD</span>
              <span className="text-accent">NORMAL</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
