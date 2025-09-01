import React, { useRef, useEffect } from 'react';

interface TwoFactorCodeInputProps {
    codes: string[];
    onCodeChange: (index: number, value: string) => void;
    onKeyDown: (index: number, e: React.KeyboardEvent) => void;
    autoFocus?: boolean;
}

const TwoFactorCodeInput: React.FC<TwoFactorCodeInputProps> = ({
    codes,
    onCodeChange,
    onKeyDown,
    autoFocus = false
}) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus) {
            inputRefs.current[0]?.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

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
                    className="w-12 h-14 text-center text-2xl font-bold border border-sol border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 transition-all duration-200"
                    inputMode="numeric"
                    pattern="[0-9]"
                    autoComplete="off"
                />
            ))}
        </div>
    );
};

export default TwoFactorCodeInput;
