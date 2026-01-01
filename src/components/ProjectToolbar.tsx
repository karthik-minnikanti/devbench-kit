import { useStore } from '../state/store';
import { openProject, saveProject, Project } from '../services/project';

export function ProjectToolbar() {
    const jsonInput = useStore((state) => state.jsonInput);
    const selectedSchemaType = useStore((state) => state.selectedSchemaType);
    const generatedOutput = useStore((state) => state.generatedOutput);
    const setJsonInput = useStore((state) => state.setJsonInput);
    const setSelectedSchemaType = useStore((state) => state.setSelectedSchemaType);
    const setCurrentProjectPath = useStore((state) => state.setCurrentProjectPath);
    const currentProjectPath = useStore((state) => state.currentProjectPath);

    const handleOpen = async () => {
        const result = await openProject();
        if (result) {
            setJsonInput(result.project.jsonInput);
            setSelectedSchemaType(result.project.schemaType);
            setCurrentProjectPath(result.filePath);
        }
    };

    const handleSave = async () => {
        const project: Project = {
            name: 'Untitled Project',
            jsonInput,
            schemaType: selectedSchemaType,
            output: generatedOutput,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await saveProject(project, currentProjectPath || undefined);
        if (result.success && result.filePath) {
            setCurrentProjectPath(result.filePath);
        }
    };

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={handleOpen}
                className="px-2 py-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium transition-colors"
            >
                Open
            </button>
            <button
                onClick={handleSave}
                className="px-2 py-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium transition-colors"
            >
                {currentProjectPath ? 'Save' : 'Save As'}
            </button>
            {currentProjectPath && (
                <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                    <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                        <span className="truncate max-w-[120px]">{currentProjectPath.split('/').pop()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}


