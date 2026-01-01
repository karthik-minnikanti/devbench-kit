/**
 * Get the current Monaco editor theme based on the document's dark mode class
 */
export function getMonacoTheme(): 'vs-dark' | 'light' {
    return document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light';
}

/**
 * Get the current theme name
 */
export function getCurrentTheme(): 'light' | 'dark' {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

