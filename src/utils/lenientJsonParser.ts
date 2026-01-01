/**
 * Lenient JSON Parser
 * Handles JSON-like strings with unquoted keys, comments, and trailing commas
 */
export function lenientJsonParse(jsonString: string): any {
  // Remove comments (single-line and multi-line)
  let cleanedString = jsonString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  // Add quotes to unquoted keys
  cleanedString = cleanedString.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

  // Remove trailing commas
  cleanedString = cleanedString.replace(/,\s*([\]}])/g, '$1');

  return JSON.parse(cleanedString);
}


