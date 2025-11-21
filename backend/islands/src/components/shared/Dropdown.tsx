import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';

interface DropdownItem {
    label: string;
    icon?: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
}

interface DropdownProps {
    items: DropdownItem[];
    trigger?: ReactNode;
    align?: 'left' | 'right';
}

const Dropdown = ({ items, trigger, align = 'right' }: DropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleItemClick = (item: DropdownItem) => {
        item.onClick();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="메뉴 열기">
                {trigger || <i className="fas fa-ellipsis-v" />}
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div
                    className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50`}
                    onClick={(e) => e.stopPropagation()}>
                    {items.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => handleItemClick(item)}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                                item.variant === 'danger'
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-gray-700 hover:bg-gray-50'
                            }`}>
                            {item.icon && <i className={`${item.icon} w-4`} />}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dropdown;
