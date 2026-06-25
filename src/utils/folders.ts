export interface Folder {
  id?: string;
  name: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const FOLDERS_STORAGE_KEY = 'devbench-folders';

export function getFolders(parentId?: string | null): Folder[] {
  try {
    const stored = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!stored) return [];
    
    const allFolders: Folder[] = JSON.parse(stored);
    
    // Filter by parentId (null means root level)
    if (parentId === undefined) {
      return allFolders;
    }
    
    return allFolders.filter(folder => {
      const folderParentId = folder.parentId === undefined ? null : folder.parentId;
      return folderParentId === parentId;
    });
  } catch (err) {
    console.error('Failed to load folders:', err);
    return [];
  }
}

export function saveFolder(folder: Folder): Folder | null {
  try {
    const stored = localStorage.getItem(FOLDERS_STORAGE_KEY);
    const allFolders: Folder[] = stored ? JSON.parse(stored) : [];
    
    if (folder.id) {
      // Update existing folder
      const index = allFolders.findIndex(f => f.id === folder.id);
      if (index >= 0) {
        allFolders[index] = {
          ...allFolders[index],
          ...folder,
          updatedAt: new Date().toISOString(),
        };
      } else {
        return null;
      }
    } else {
      // Create new folder
      const newFolder: Folder = {
        ...folder,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      allFolders.push(newFolder);
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(allFolders));
      return newFolder;
    }
    
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(allFolders));
    return allFolders.find(f => f.id === folder.id) || null;
  } catch (err) {
    console.error('Failed to save folder:', err);
    return null;
  }
}

export function deleteFolder(id: string): boolean {
  try {
    const stored = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!stored) return false;
    
    const allFolders: Folder[] = JSON.parse(stored);
    const filtered = allFolders.filter(f => f.id !== id);
    
    if (filtered.length === allFolders.length) {
      return false; // Folder not found
    }
    
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete folder:', err);
    return false;
  }
}







