import { ReactNode } from 'react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    width?: number;
}

export function Sidebar({ isOpen, onClose, title, children, width = 300 }: SidebarProps) {
    if (!isOpen) return null;

    return (
        <div 
            className="bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full shadow-lg"
            style={{ width: `${width}px` }}
        >
            {/* Sidebar Header */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Close sidebar"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            {/* Sidebar Content */}
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    );
}

