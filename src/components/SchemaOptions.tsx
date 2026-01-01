import { useStore } from '../state/store';

export function SchemaOptions() {
    const generateSchema = useStore((state) => state.generateSchema);
    const licenseStatus = useStore((state) => state.licenseStatus);

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={generateSchema}
                className="px-2.5 py-1 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Generate
            </button>
            {licenseStatus && (
                <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                    <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        {licenseStatus.status === 'free' ? (
                            <>
                                <span className="w-1 h-1 bg-yellow-500 rounded-full"></span>
                                <span className="font-semibold">Free</span>
                            </>
                        ) : (
                            <>
                                <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                                <span className="text-green-600 dark:text-green-400 font-semibold">Pro</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


