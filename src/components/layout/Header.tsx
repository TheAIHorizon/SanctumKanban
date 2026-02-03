'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kanban, Settings, Users, LogOut, User, Megaphone, Tag } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

export function Header() {
  const { data: session } = useSession()
  const user = session?.user

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center space-x-2 mr-6">
          <div className="bg-primary p-1.5 rounded-md">
            <Kanban className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:inline-block">
            Sanctum Kanban
          </span>
        </Link>

        <nav className="flex items-center space-x-4 flex-1">
          <Link href="/">
            <Button variant="ghost" size="sm">
              Dashboard
            </Button>
          </Link>
          {user?.role === 'ADMIN' && (
            <>
              <Link href="/admin/teams">
                <Button variant="ghost" size="sm">
                  <Users className="h-4 w-4 mr-1" />
                  Teams
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="ghost" size="sm">
                  <User className="h-4 w-4 mr-1" />
                  Users
                </Button>
              </Link>
              <Link href="/admin/announcements">
                <Button variant="ghost" size="sm">
                  <Megaphone className="h-4 w-4 mr-1" />
                  Announcements
                </Button>
              </Link>
              <Link href="/admin/tags">
                <Button variant="ghost" size="sm">
                  <Tag className="h-4 w-4 mr-1" />
                  Tags
                </Button>
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      style={{ backgroundColor: user.color }}
                      className="text-white text-xs font-medium"
                    >
                      {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {user.role.toLowerCase().replace('_', ' ')}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
