export interface Variable {
  id: string;
  key: string;
  value: string;
  folderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'devbench-variables';

// Helper function to get variables from localStorage
function getStoredVariables(): Variable[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to get variables from localStorage:', error);
  }
  return [];
}

// Helper function to save variables to localStorage
function saveStoredVariables(variables: Variable[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(variables));
  } catch (error) {
    console.error('Failed to save variables to localStorage:', error);
  }
}

export async function getVariables(folderId?: string | null): Promise<Variable[]> {
  try {
    const allVariables = getStoredVariables();
    
    // Filter by folderId if specified
    if (folderId !== undefined) {
      if (folderId === null) {
        // Return only global variables (no folderId)
        return allVariables.filter(v => !v.folderId || v.folderId === null);
      } else {
        // Return variables for specific folder
        return allVariables.filter(v => v.folderId === folderId);
      }
    }
    
    // Return all variables if no folderId specified
    return allVariables;
  } catch (error) {
    console.error('Failed to get variables:', error);
    return [];
  }
}

export async function saveVariable(variableData: Omit<Variable, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Variable | null> {
  try {
    const variables = getStoredVariables();
    const existingIndex = variables.findIndex(v => v.id === variableData.id);
    
    const variable: Variable = {
      ...variableData,
      id: variableData.id || Date.now().toString(),
      createdAt: variableData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    if (existingIndex >= 0) {
      variables[existingIndex] = variable;
    } else {
      variables.push(variable);
    }
    
    saveStoredVariables(variables);
    return variable;
  } catch (error) {
    console.error('Failed to save variable:', error);
    return null;
  }
}

export async function deleteVariable(id: string): Promise<boolean> {
  try {
    const variables = getStoredVariables();
    const filtered = variables.filter(v => v.id !== id);
    saveStoredVariables(filtered);
    return true;
  } catch (error) {
    console.error('Failed to delete variable:', error);
    return false;
  }
}

/**
 * Replace variables in a string using {{variableName}} syntax
 * Variables are resolved in order: folder variables override global variables
 */
export function replaceVariables(
  text: string,
  variables: Variable[],
  folderId?: string | null
): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Separate global and folder variables
  const globalVars = variables.filter(v => !v.folderId || v.folderId === null);
  const folderVars = folderId 
    ? variables.filter(v => v.folderId === folderId)
    : [];
  
  // Create a map: folder vars override global vars
  const varMap = new Map<string, string>();
  globalVars.forEach(v => varMap.set(v.key, v.value));
  folderVars.forEach(v => varMap.set(v.key, v.value));
  
  // Replace {{variable}} syntax
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = varMap.get(trimmedKey);
    return value !== undefined ? value : match; // Keep original if not found
  });
}

/**
 * Replace variables in an object recursively
 */
export function replaceVariablesInObject(
  obj: any,
  variables: Variable[],
  folderId?: string | null
): any {
  if (typeof obj === 'string') {
    return replaceVariables(obj, variables, folderId);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => replaceVariablesInObject(item, variables, folderId));
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariablesInObject(value, variables, folderId);
    }
    return result;
  }
  
  return obj;
}

/**
 * Check if all variables in a text are valid (exist in the variables list)
 * Returns true if all variables are valid, false if any are invalid
 */
export function areVariablesValid(
  text: string,
  variables: Variable[],
  folderId?: string | null
): boolean {
  if (!text || typeof text !== 'string') {
    return true; // Empty or non-string is considered valid
  }
  
  // Extract all variable names from the text
  const variableMatches = text.match(/\{\{([^}]+)\}\}/g);
  if (!variableMatches || variableMatches.length === 0) {
    return true; // No variables found, so it's valid
  }
  
  // Separate global and folder variables
  const globalVars = variables.filter(v => !v.folderId || v.folderId === null);
  const folderVars = folderId 
    ? variables.filter(v => v.folderId === folderId)
    : [];
  
  // Create a map: folder vars override global vars
  const varMap = new Map<string, string>();
  globalVars.forEach(v => varMap.set(v.key, v.value));
  folderVars.forEach(v => varMap.set(v.key, v.value));
  
  // Check if all variables exist
  for (const match of variableMatches) {
    const key = match.replace(/\{\{|\}\}/g, '').trim();
    if (!varMap.has(key)) {
      return false; // Variable not found
    }
  }
  
  return true; // All variables are valid
}
