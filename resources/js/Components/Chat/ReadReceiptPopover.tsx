import React, { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, Users, Clock, Info } from 'lucide-react';
import { formatReadReceiptTime, formatFullTooltipDateTime } from './formatters';

interface MemberReadStatus {
    id: number;
    name: string;
    email: string;
    last_read_message_id?: number | null;
    last_read_at?: string | null;
}

interface ReadReceiptPopoverProps {
    messageId: number;
    isDirect: boolean;
    participants: MemberReadStatus[];
    currentUserId: number;
}

export function ReadReceiptPopover({
    messageId,
    isDirect,
    participants,
    currentUserId,
}: ReadReceiptPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    // Filter out current user from participants list
    const otherMembers = participants.filter((p) => p.id !== currentUserId);

    // Calculate who has read this message
    const readMembers: Array<{ member: MemberReadStatus; readAt: string }> = [];
    const unreadMembers: MemberReadStatus[] = [];

    otherMembers.forEach((member) => {
        if (
            member.last_read_message_id !== undefined &&
            member.last_read_message_id !== null &&
            member.last_read_message_id >= messageId &&
            member.last_read_at
        ) {
            readMembers.push({ member, readAt: member.last_read_at });
        } else {
            unreadMembers.push(member);
        }
    });

    const totalOthers = otherMembers.length;
    const readCount = readMembers.length;
    const isFullyRead = totalOthers > 0 && readCount === totalOthers;
    const isAnyRead = readCount > 0;

    // Close popover when clicking outside
    useEffect(() => {
        if (!isOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen]);

    // ── Direct Chat Receipt ──
    if (isDirect) {
        if (readMembers.length > 0) {
            const readAt = readMembers[0].readAt;
            const formatted = formatReadReceiptTime(readAt);
            const fullTooltip = formatFullTooltipDateTime(readAt);

            return (
                <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] font-medium select-none">
                    <CheckCheck className="w-3.5 h-3.5 text-[#EC7505]" strokeWidth={2.2} />
                    <span title={fullTooltip} className="hover:underline cursor-help">
                        Read on {formatted}
                    </span>
                </div>
            );
        }

        // Before it is read: show "Delivered"
        return (
            <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] font-medium select-none">
                <Check className="w-3.5 h-3.5 text-[var(--muted)]" strokeWidth={2} />
                <span>Delivered</span>
            </div>
        );
    }

    // ── Group Chat Receipt ──
    return (
        <div className="relative inline-block" ref={popoverRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsOpen(true)}
                className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--ink)] font-medium cursor-pointer transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={`Read receipt: Read by ${readCount} of ${totalOthers}`}
            >
                {isFullyRead ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[#EC7505]" strokeWidth={2.2} />
                ) : (
                    <Check className="w-3.5 h-3.5 text-[var(--muted)]" strokeWidth={2} />
                )}
                <span>
                    Read by {readCount} of {totalOthers}
                </span>
            </button>

            {/* Popover Listing Each Member's Read Status */}
            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Member read status details"
                    className="absolute right-0 bottom-full mb-2 w-64 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl p-3 z-30 animate-modal-in select-none text-left"
                    onMouseLeave={() => setIsOpen(false)}
                >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
                        <span className="text-xs font-bold text-[var(--ink)]">
                            Read Receipts ({readCount}/{totalOthers})
                        </span>
                        <span className="text-[10px] text-[var(--muted)] font-medium">
                            {isFullyRead ? 'Everyone read' : 'Group members'}
                        </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                        {/* Read Members */}
                        {readMembers.map(({ member, readAt }) => (
                            <div key={member.id} className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-[var(--ink)] truncate">
                                        {member.name}
                                    </p>
                                    <p
                                        className="text-[10px] text-[var(--muted)] truncate"
                                        title={formatFullTooltipDateTime(readAt)}
                                    >
                                        Read on {formatReadReceiptTime(readAt)}
                                    </p>
                                </div>
                                <span className="w-2 h-2 rounded-full bg-[#EC7505] shrink-0 mt-1" title="Read" />
                            </div>
                        ))}

                        {/* Unread Members */}
                        {unreadMembers.map((member) => (
                            <div key={member.id} className="flex items-start justify-between gap-2 opacity-70">
                                <div className="min-w-0">
                                    <p className="font-medium text-[var(--ink)] truncate">
                                        {member.name}
                                    </p>
                                    <p className="text-[10px] text-[var(--muted)]">Not read yet</p>
                                </div>
                                <span className="w-2 h-2 rounded-full bg-[var(--border)] shrink-0 mt-1" title="Not read yet" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
