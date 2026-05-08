interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="h-14 border-b border-gray-100 bg-white flex items-center px-4 md:px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{title}</h1>
        {description && (
          <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
