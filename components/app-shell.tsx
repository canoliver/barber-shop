'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getNavItemsForRole } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Scissors, Menu, LogOut, Bell, Search, ChevronRight } from 'lucide-react';
import { getInitials, getRoleLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems = user ? getNavItemsForRole(user.role) : [];

  const { data: unreadCount } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/app/search?q=${encodeURIComponent(searchQuery)}`);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border/50">
        <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center gold-glow">
          <Scissors className="h-5 w-5 text-charcoal" />
        </div>
        <div>
          <h1 className="font-playfair text-xl font-bold gold-text leading-none">BarberPro</h1>
          <p className="text-xs text-muted-foreground mt-1">{user ? getRoleLabel(user.role) : ''}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative',
                  isActive
                    ? 'bg-primary/12 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="h-4 w-4 text-primary" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 border border-border">
            {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
              {getInitials(user?.full_name || '?')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.phone || ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 left-0 bg-card/70 backdrop-blur-2xl border-r border-border/60 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 glass-strong border-r border-border/50">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/75 backdrop-blur-2xl border-b border-border/50 h-[4.5rem] flex items-center px-4 lg:px-8 gap-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes, produtos, serviços..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 h-9"
              />
            </div>
          </form>

          <div className="flex-1 sm:hidden" />

          {/* Notifications */}
          <Link href="/app/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center h-[18px] flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Profile */}
          <Link href="/app/profile">
            <Avatar className="h-9 w-9 border border-border cursor-pointer">
              {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {getInitials(user?.full_name || '?')}
              </AvatarFallback>
            </Avatar>
          </Link>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 pb-24 lg:pb-10 app-content">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar />
    </div>
  );
}

function MobileTabBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;
  const items = getNavItemsForRole(user.role);
  const mainItems = items.slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-border/50 h-16 flex items-center justify-around px-2">
      {mainItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="flex-1">
            <div className={cn(
              'flex flex-col items-center gap-1 py-2 rounded-lg transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}>
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
