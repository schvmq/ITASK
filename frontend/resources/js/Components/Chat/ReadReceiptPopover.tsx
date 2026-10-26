import React, { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, Eye } from 'lucide-react';
import { formatReadReceiptTime, formatFullTooltipDateTime } from './formatters';

export interface MemberReadStatus {
    id: number;
    name: string;
    email: string;
    last_read_message_id?: number | null;
    last_read_at?: string | null;
}

export interface ReadReceiptPopoverProps {
    messageId: number;
    senderId?: number | null;
    isMine?: boolean;
    isDirect?: boolean;
    participants: MemberReadStatus[];
    currentUserId: number;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

export function ReadReceiptPopover({
    messageId,
    senderId,
    isMine = true,
    isDirect = false,
    participants,
    currentUserId,
}: ReadReceiptPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    // Target audience: other members excluding the sender of this message
    const excludedUserId = isMine ? currentUserId : (senderId ?? 0);
    const otherMembers = participants.filter((p) => p.id !== excludedUserId);

    // Calculate who has read this message
    const readMembers: Array<{ member: MemberReadStatus; readAt: string }> = [];
    const unreadMembers: MemberReadStatus[] = [];

    otherMembers.forEach((member) => {
        if (
            member.last_read_message_id !== undefined &&
            member.last_read_message_id !== null &&
            Number(member.last_read_message_id) >= Number(messageId)
        ) {
            readMembers.push({
                member,
                readAt: member.last_read_at || new Date().toISOString(),
            });
        } else {
            unreadMembers.push(member);
        }
    });

    const totalOthers = otherMembers.length;
    const readCount = readMembers.length;
    const isFullyRead = totalOthers > 0 && readCount === totalOthers;

    // Close popover when clicking outside or pressing Escape
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

    // ── No one has seen it yet ──
    if (readCount === 0) {
        if (!isMine) return null;
        return (
            <div
                className="flex items-center gap-1 text-[11px] text-[color:var(--muted)] font-medium select-none"
                title="Message delivered to server"
            >
                <Check className="w-3.5 h-3.5 text-[color:var(--muted)]" strokeWidth={2} />
                <span>Delivered</span>
            </div>
        );
    }

    // ── Format Seen By text ──
    const getSeenText = () => {
        if (totalOthers === 1 || isDirect) {
            const memberName = readMembers[0]?.member?.name || 'Someone';
            const timeStr = formatReadReceiptTime(readMembers[0]?.readAt);
            return `Seen by ${memberName} • ${timeStr}`;
        }
        if (readCount === 1) {
            return `Seen by ${readMembers[0]?.member?.name || 'Someone'}`;
        }
        if (readCount === 2) {
            const first = (readMembers[0]?.member?.name || 'Someone').split(' ')[0];
            const second = (readMembers[1]?.member?.name || 'Someone').split(' ')[0];
            return `Seen by ${first} and ${second}`;
        }
        const first = (readMembers[0]?.member?.name || 'Someone').split(' ')[0];
        const second = (readMembers[1]?.member?.name || 'Someone').split(' ')[0];
        const extra = readCount - 2;
        return `Seen by ${first}, ${second} +${extra} more`;
    };

    return (
        <div
            className="relative inline-block"
            ref={popoverRef}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsOpen(true)}
                className="flex items-center gap-1.5 text-[11px] text-[color:var(--muted)] hover:text-[color:var(--text)] font-medium cursor-pointer transition-colors group/receipt select-none"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={`Seen by ${readCount} of ${totalOthers}`}
            >
                {/* Checkmark or eye indicator */}
                {isMine ? (
                    <CheckCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                            isFullyRead
                                ? 'text-[color:var(--primary)]'
                                : 'text-[color:var(--primary)] opacity-90'
                        }`}
                        strokeWidth={2.4}
                    />
                ) : (
                    <Eye className="w-3.5 h-3.5 shrink-0 text-[color:var(--muted)] group-hover/receipt:text-[color:var(--text)]" />
                )}

                {/* Overlapping mini avatars */}
                <div className="flex -space-x-1.5 overflow-hidden items-center shrink-0">
                    {readMembers.slice(0, 3).map(({ member }) => (
                        <div
                            key={member.id}
                            title={member.name}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full ring-1 ring-[color:var(--card)] bg-[color:var(--soft-surface)] text-[color:var(--primary)] text-[8px] font-bold select-none shrink-0"
                        >
                            {getInitials(member.name)}
                        </div>
                    ))}
                </div>

                {/* Plain-language "Seen by [Name]" text */}
                <span className="hover:underline truncate max-w-[220px]">
                    {getSeenText()}
                </span>
            </button>

            {/* Popover Card Listing Each Member's Exact Status */}
            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Member read status details"
                    className={`absolute ${
                        isMine ? 'right-0' : 'left-0'
                    } bottom-full mb-2 w-72 max-w-[calc(100vw-36px)] bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl p-3 z-40 animate-modal-in select-none text-left`}
                >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[color:var(--border)]">
                        <span className="text-xs font-bold text-[color:var(--text)] flex items-center gap-1.5">
                            <CheckCheck className="w-3.5 h-3.5 text-[color:var(--primary)]" />
                            Seen Receipts ({readCount}/{totalOthers})
                        </span>
                        <span className="text-[10px] text-[color:var(--muted)] font-medium">
                            {isFullyRead ? 'Everyone seen' : 'Project members'}
                        </span>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1 text-xs">
                        {/* Seen Members */}
                        {readMembers.map(({ member, readAt }) => (
                            <div key={member.id} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-[color:var(--soft-surface)] text-[color:var(--primary)] text-[9px] font-black flex items-center justify-center shrink-0 ring-1 ring-[color:var(--border)]">
                                        {getInitials(member.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-[color:var(--text)] truncate">
                                            {member.name}
                                        </p>
                                        <p
                                            className="text-[10px] text-[color:var(--muted)] truncate"
                                            title={formatFullTooltipDateTime(readAt)}
                                        >
                                            Seen {formatReadReceiptTime(readAt)}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className="w-2 h-2 rounded-full bg-[color:var(--primary)] shrink-0"
                                    title="Seen"
                                />
                            </div>
                        ))}

                        {/* Unseen Members */}
                        {unreadMembers.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-2 opacity-60">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-[color:var(--soft-surface)] text-[color:var(--muted)] text-[9px] font-bold flex items-center justify-center shrink-0 ring-1 ring-[color:var(--border)]">
                                        {getInitials(member.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-[color:var(--text)] truncate">
                                            {member.name}
                                        </p>
                                        <p className="text-[10px] text-[color:var(--muted)]">Not seen yet</p>
                                    </div>
                                </div>
                                <span
                                    className="w-2 h-2 rounded-full bg-[color:var(--border)] shrink-0"
                                    title="Not seen yet"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
