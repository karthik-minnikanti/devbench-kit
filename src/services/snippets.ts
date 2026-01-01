export interface Snippet {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnippetsData {
  snippets: Snippet[];
}

export async function getSnippets(): Promise<Snippet[]> {
  // Try backend first
  try {
    const { getSnippets: getSnippetsFromSync } = await import('./sync');
    const snippets = await getSnippetsFromSync();
    if (snippets.length > 0) {
      return snippets.map(snippet => ({
        id: snippet.id || (snippet as any)._id,
        name: snippet.name,
        code: snippet.code,
        createdAt: snippet.createdAt || (snippet as any).createdAt || new Date().toISOString(),
        updatedAt: snippet.updatedAt || (snippet as any).updatedAt || new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error('Failed to get snippets from backend:', error);
  }

  // Fallback to local storage
  if (!window.electronAPI) {
    return [];
  }

  try {
    const data = await window.electronAPI.snippets.get();
    return (data as SnippetsData).snippets || [];
  } catch (error) {
    console.error('Failed to get snippets:', error);
    return [];
  }
}

export async function saveSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<{ success: boolean; snippet?: Snippet }> {
  // Try backend first
  try {
    const { saveSnippet: saveSnippetToSync } = await import('./sync');
    const savedSnippet = await saveSnippetToSync({ ...snippet, id });
    if (savedSnippet) {
      return {
        success: true,
        snippet: {
          id: savedSnippet.id || (savedSnippet as any)._id,
          name: savedSnippet.name,
          code: savedSnippet.code,
          createdAt: savedSnippet.createdAt || (savedSnippet as any).createdAt || new Date().toISOString(),
          updatedAt: savedSnippet.updatedAt || (savedSnippet as any).updatedAt || new Date().toISOString(),
        }
      };
    }
  } catch (error) {
    console.error('Failed to save snippet to backend:', error);
  }

  // Fallback to local storage
  if (!window.electronAPI) {
    return { success: false };
  }

  try {
    const result = await window.electronAPI.snippets.save(snippet, id);
    return result;
  } catch (error) {
    console.error('Failed to save snippet:', error);
    return { success: false };
  }
}

export async function deleteSnippet(id: string): Promise<boolean> {
  // Try backend first
  try {
    const { deleteSnippet: deleteSnippetFromSync } = await import('./sync');
    const success = await deleteSnippetFromSync(id);
    if (success) {
      // Also delete locally as backup
      if (window.electronAPI) {
        try {
          await window.electronAPI.snippets.delete(id);
        } catch (err) {
          console.error('Failed to delete snippet locally:', err);
        }
      }
      return true;
    }
  } catch (error) {
    console.error('Failed to delete snippet from backend:', error);
  }

  // Fallback to local storage
  if (!window.electronAPI) {
    return false;
  }

  try {
    const result = await window.electronAPI.snippets.delete(id);
    return result.success === true;
  } catch (error) {
    console.error('Failed to delete snippet:', error);
    return false;
  }
}

export async function loadSnippet(id: string): Promise<Snippet | null> {
  if (!window.electronAPI) {
    return null;
  }

  try {
    const result = await window.electronAPI.snippets.load(id);
    return result.snippet || null;
  } catch (error) {
    console.error('Failed to load snippet:', error);
    return null;
  }
}


