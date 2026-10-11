import React, { InputHTMLAttributes, forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, description, className = '', disabled, checked, defaultChecked, onChange, ...props }, ref) => {
        const isControlled = checked !== undefined;
        const [internalChecked, setInternalChecked] = useState(Boolean(defaultChecked));

        useEffect(() => {
            if (isControlled) {
                setInternalChecked(Boolean(checked));
            }
        }, [isControlled, checked]);

        const isChecked = isControlled ? Boolean(checked) : internalChecked;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!isControlled) {
                setInternalChecked(e.target.checked);
            }
            if (onChange) {
                onChange(e);
            }
        };

        return (
            <label
                className={`inline-flex items-start gap-2.5 cursor-pointer select-none group ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
                <div className="relative mt-0.5 shrink-0 flex items-center justify-center">
                    <input
                        ref={ref}
                        type="checkbox"
                        disabled={disabled}
                        checked={isControlled ? checked : internalChecked}
                        onChange={handleChange}
                        className="peer sr-only"
                        {...props}
                    />
                    <motion.div
                        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                            isChecked
                                ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white'
                                : 'border-[color:var(--border)] bg-[color:var(--background)] group-hover:border-[color:var(--primary)]'
                        } peer-focus-visible:outline-3 peer-focus-visible:outline-[color:var(--primary)] peer-focus-visible:outline-offset-2 ${className}`}
                        whileTap={!disabled ? { scale: 0.92 } : undefined}
                    >
                        <AnimatePresence>
                            {isChecked && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    transition={{ type: 'spring', damping: 15 }}
                                    className="flex items-center justify-center"
                                >
                                    <Check className="w-3 h-3 stroke-[3] text-white" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
                {(label || description) && (
                    <div className="text-[14px]">
                        {label && <span className="font-medium text-[color:var(--text)]">{label}</span>}
                        {description && <p className="text-[12px] text-[color:var(--muted)] mt-0.5">{description}</p>}
                    </div>
                )}
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
