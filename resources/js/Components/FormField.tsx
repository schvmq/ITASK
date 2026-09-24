import React, { useId } from 'react';
import { Label } from './Label';
import { Input, InputProps } from './Input';
import { InputError } from './InputError';

export interface FormFieldProps extends Omit<InputProps, 'id'> {
    label: string;
    error?: string;
    required?: boolean;
    helperText?: string;
    id?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    error,
    required = false,
    helperText,
    id: externalId,
    className = '',
    ...inputProps
}) => {
    const generatedId = useId();
    const inputId = externalId || generatedId;

    return (
        <div className={`space-y-1 ${className}`}>
            <Label htmlFor={inputId} required={required}>
                {label}
            </Label>
            <Input id={inputId} hasError={Boolean(error)} required={required} {...inputProps} />
            {helperText && !error && (
                <p className="text-xs text-slate-500 mt-1">{helperText}</p>
            )}
            <InputError message={error} />
        </div>
    );
};
