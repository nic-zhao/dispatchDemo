import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Rocket, Package, Server, Boxes } from 'lucide-react';

const navItems = [
  { to: '/', label: '概览', icon: LayoutDashboard },
  { to: '/deployments', label: '弹性部署', icon: Rocket },
  { to: '/pods', label: '任务列表', icon: Boxes },
  { to: '/images', label: '镜像仓库', icon: Package },
  { to: '/resources', label: '集群资源', icon: Server },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col h-screen">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">算力平台</h1>
        <p className="text-xs text-muted-foreground">AI Dashboard Demo</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
