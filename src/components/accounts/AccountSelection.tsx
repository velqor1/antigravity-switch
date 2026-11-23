import { useEffect, useRef } from 'react';

interface AccountSelectionProps {
    checked: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    label: string;
    onChange: () => void;
}

export default function AccountSelection({ checked, indeterminate = false, disabled = false, label, onChange }: AccountSelectionProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
        <label className="relative flex items-center justify-center w-6 h-6 shrink-0" title={label}>
            <input
                ref={inputRef}
                type="checkbox"
                aria-label={label}
                checked={checked}
                disabled={disabled}
                onChange={onChange}
                onClick={event => event.stopPropagation()}
                className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111113]"
            />
        </label>
    );
}
