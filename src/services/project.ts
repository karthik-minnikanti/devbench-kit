export interface Project {
  name: string;
  jsonInput: string;
  schemaType: 'typescript' | 'zod' | 'prisma' | 'mongoose';
  output: string;
  createdAt: string;
  updatedAt: string;
}

export async function openProject(): Promise<{ project: Project; filePath: string } | null> {
  if (!window.electronAPI) {
    return null;
  }

  try {
    const result = await window.electronAPI.project.open();
    if (result.success && result.project) {
      return {
        project: result.project as Project,
        filePath: result.filePath as string,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to open project:', error);
    return null;
  }
}

export async function saveProject(
  project: Project,
  filePath?: string
): Promise<{ success: boolean; filePath?: string }> {
  if (!window.electronAPI) {
    return { success: false };
  }

  try {
    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    const result = await window.electronAPI.project.save(updatedProject, filePath);
    
    if (result.success) {
      return {
        success: true,
        filePath: result.filePath as string,
      };
    }
    return { success: false };
  } catch (error) {
    console.error('Failed to save project:', error);
    return { success: false };
  }
}


