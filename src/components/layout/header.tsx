"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
    <header className="h-14 border-b border-gray-100 bg-white flex items-center px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{title}</h1>
        {description && (
          <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}

        {/* Quick add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-[13px] bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border-gray-100">
            <DropdownMenuItem asChild>
              <Link href="/jobs/new" className="text-[13px]">New Job</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/clients?new=1" className="text-[13px]">New Client</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/invoices?new=1" className="text-[13px]">New Invoice</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
