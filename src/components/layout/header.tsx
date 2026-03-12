"use client";

import { Bell, Search, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-white flex items-center px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground leading-tight">{description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actions}

        {/* Quick add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href="/jobs/new">New Job</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/clients?new=1">New Client</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/invoices?new=1">New Invoice</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>
      </div>
    </header>
  );
}
