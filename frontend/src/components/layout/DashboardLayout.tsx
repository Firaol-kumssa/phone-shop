import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Headphones,
  LogOut,
  ShoppingCart,
  Smartphone,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/inventory', label: 'Inventory', icon: Smartphone },
  { to: '/products', label: 'Products', icon: Headphones },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

const ADMIN_NAV_ITEMS = [{ to: '/staff', label: 'Manage Staff', icon: UserCog }];

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r bg-muted/40">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Smartphone className="h-5 w-5" />
          Phone Shop
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {[...NAV_ITEMS, ...(user?.role === 'Admin' ? ADMIN_NAV_ITEMS : [])].map(
            ({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
            ),
          )}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-1 text-sm">
            <div className="font-medium">{user?.fullName}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
