'use client';

import { useQuery } from '@tanstack/react-query';
import { Bot, LogOut, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { ThemeToggle } from '../theme-toggle';

interface User {
  id: string;
  email: string;
  name: string;
}

export function Navbar() {
  const router = useRouter();

  const { data: user } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.get<User>('/auth/me'),
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 text-foreground font-bold text-lg hover:opacity-90"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <span>Voice AI</span>
          </Link>
          <nav className="hidden md:flex space-x-4">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Agents
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/agents/new"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Agent</span>
          </Link>

          <ThemeToggle />

          {user && (
            <div className="flex items-center space-x-2 pl-2 border-l border-border">
              <span
                className="text-sm font-medium text-muted-foreground hidden lg:inline max-w-[150px] truncate"
                title={user.email}
              >
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
