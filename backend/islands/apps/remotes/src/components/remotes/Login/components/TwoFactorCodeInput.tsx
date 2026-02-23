import React, { useRef, useEffect } from 'react';

interface TwoFactorCodeInputProps {
    codes: string[];
    onCodeChange: (index: number, value: string) => void;
    onKeyDown: (index: number, e: React.KeyboardEvent) => void;
    onPaste?: (pastedCode: string) => void;
    autoFocus?: boolean;
}

const TwoFactorCodeInput = ({
    codes,
    onCodeChange,
    onKeyDown,
    onPaste,
    autoFocus = false
}: TwoFactorCodeInputProps) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus) {
            inputRefs.current[0]?.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\s/g, '').slice(0, 6);

        if (/^\d+$/.test(pastedData) && onPaste) {
            onPaste(pastedData);
            // Focus on the last filled input or the last input
            const nextIndex = Math.min(pastedData.length, codes.length - 1);
            inputRefs.current[nextIndex]?.focus();
        }
    };

    return (
        <div className="flex justify-center gap-3 mb-4">
            {codes.map((code, index) => (
                <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    maxLength={1}
                    value={code}
                    onChange={(e) => onCodeChange(index, e.target.value)}
                    onKeyDown={(e) => onKeyDown(index, e)}
                    onPaste={(e) => handlePaste(e)}
                    className="w-12 h-14 text-center text-2xl font-bold border border-sol border-line rounded-xl focus:ring-2 focus:ring-line-strong focus:border-transparent bg-surface/50 transition-all duration-200"
                    inputMode="numeric"
                    pattern="[0-9]"
                    autoComplete="off"
                />
            ))}
        </div>
    );
};

export default TwoFactorCodeInput;
