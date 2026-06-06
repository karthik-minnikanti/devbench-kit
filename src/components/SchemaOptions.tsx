import { useStore } from "../state/store";

export function SchemaOptions() {
  const generateSchema = useStore((state) => state.generateSchema);
  const licenseStatus = useStore((state) => state.licenseStatus);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generateSchema}
        className="px-2.5 py-1 rounded btn-download !h-auto !py-1.5 !px-2.5 !text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Generate
      </button>
      {licenseStatus && (
        <div className="px-2 py-1 bg-[var(--color-muted)] rounded">
          <div className="text-[10px] font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5">
            {licenseStatus === "valid" ? (
              <>
                <span className="w-1 h-1 bg-[var(--color-semantic-success)] rounded-full"></span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  Licensed
                </span>
              </>
            ) : (
              <>
                <span className="w-1 h-1 bg-yellow-500 rounded-full"></span>
                <span className="font-semibold">{licenseStatus}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
