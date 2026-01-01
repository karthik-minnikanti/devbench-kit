/**
 * Utility functions for sync change detection
 */

/**
 * Creates a hash/string representation of content for comparison
 */
export function getContentHash(content: any): string {
  if (!content) return '';
  
  try {
    // For BlockNote content (array of blocks)
    if (Array.isArray(content)) {
      return JSON.stringify(content);
    }
    
    // For Excalidraw elements (array)
    if (Array.isArray(content)) {
      return JSON.stringify(content);
    }
    
    // For other content types
    return JSON.stringify(content);
  } catch (error) {
    console.error('Error hashing content:', error);
    return '';
  }
}

/**
 * Compares two content objects to determine if they're different
 */
export function hasContentChanged(oldContent: any, newContent: any): boolean {
  const oldHash = getContentHash(oldContent);
  const newHash = getContentHash(newContent);
  return oldHash !== newHash;
}

/**
 * Compares a full note/drawing object to check if anything changed
 */
export function hasNoteChanged(
  oldNote: { title?: string; content?: any; folderId?: string | null },
  newNote: { title?: string; content?: any; folderId?: string | null }
): boolean {
  // Check title change
  if (oldNote.title !== newNote.title) {
    return true;
  }
  
  // Check folderId change
  if (oldNote.folderId !== newNote.folderId) {
    return true;
  }
  
  // Check content change
  return hasContentChanged(oldNote.content, newNote.content);
}

/**
 * Compares a full drawing object to check if anything changed
 */
export function hasDrawingChanged(
  oldDrawing: { title?: string; elements?: any[]; files?: any; folderId?: string | null },
  newDrawing: { title?: string; elements?: any[]; files?: any; folderId?: string | null }
): boolean {
  // Check title change
  if (oldDrawing.title !== newDrawing.title) {
    return true;
  }
  
  // Check folderId change
  if (oldDrawing.folderId !== newDrawing.folderId) {
    return true;
  }
  
  // Check elements change
  if (hasContentChanged(oldDrawing.elements, newDrawing.elements)) {
    return true;
  }
  
  // Check files change
  if (hasContentChanged(oldDrawing.files, newDrawing.files)) {
    return true;
  }
  
  return false;
}







