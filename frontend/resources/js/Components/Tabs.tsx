import React, { useRef, useEffect } from 'react';

export interface TabItem<T extends string = string> {
    id: T;
    label: string;
    count?: number;
    icon?: React.ComponentType<{ className?: string }>;
}

export interface TabsProps<T extends string = string> {
    tabs: TabItem<T>[];
    activeTab: T;
    onChange: (tabId: T) => void;
    className?: string;
}

export function Tabs<T extends string = string>({
    tabs,
    activeTab,
    onChange,
    className = '',
}: TabsProps<T>) {
    const listRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextIdx = (index + 1) % tabs.length;
            onChange(tabs[nextIdx].id);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevIdx = (index - 1 + tabs.length) % tabs.length;
            onChange(tabs[prevIdx].id);
        } else if (e.key === 'Home') {
            e.preventDefault();
            onChange(tabs[0].id);
        } else if (e.key === 'End') {
            e.preventDefault();
            onChange(tabs[tabs.length - 1].id);
        }
    };

    return (
        <div
            ref={listRef}
            role="tablist"
            className={`flex items-center gap-1 p-1 bg-[color:var(--soft-surface)] rounded-[10px] border border-[color:var(--border)] overflow-x-auto ${className}`}
        >
            {tabs.map((tab, idx) => {
                const isActive = tab.id === activeTab;
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.id}
                        role="tab"
                        id={`tab-${tab.id}`}
                        aria-selected={isActive}
                        aria-controls={`panel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        type="button"
                        className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-all duration-150 whitespace-nowrap cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                            isActive
                                ? 'bg-[color:var(--card)] text-[color:var(--text)] font-semibold shadow-xs border border-[color:var(--border)]'
                                : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:color-mix(in_srgb,var(--text)_4%,transparent)] border border-transparent'
                        }`}
                    >
                        {Icon && <Icon className="w-4 h-4 shrink-0" />}
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span
                                className={`px-1.5 py-0.2 rounded-full text-[11px] tabular-nums font-semibold ${
                                    isActive
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'bg-[color:var(--border)] text-[color:var(--muted)]'
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
