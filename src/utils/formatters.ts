import { lenientJsonParse } from './lenientJsonParser';

export function formatJson(jsonString: string, indent: number = 2): string {
  try {
    const obj = lenientJsonParse(jsonString);
    return JSON.stringify(obj, null, indent);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function minifyJson(jsonString: string): string {
  try {
    const obj = lenientJsonParse(jsonString);
    return JSON.stringify(obj);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function formatXml(xmlString: string, indent: number = 2): string {
  // Simple XML formatter - in production, use a proper XML parser
  let formatted = '';
  let level = 0;
  const spaces = ' '.repeat(indent);

  xmlString = xmlString.replace(/>\s+</g, '><');

  for (let i = 0; i < xmlString.length; i++) {
    const char = xmlString[i];
    const nextChar = xmlString[i + 1];

    if (char === '<' && nextChar === '/') {
      level--;
      formatted += '\n' + spaces.repeat(level) + char;
    } else if (char === '<') {
      formatted += '\n' + spaces.repeat(level) + char;
      if (nextChar !== '/') {
        level++;
      }
    } else if (char === '>') {
      formatted += char;
    } else {
      formatted += char;
    }
  }

  return formatted.trim();
}

export function removeNewlines(text: string): string {
  return text.replace(/\n/g, '').replace(/\r/g, '');
}

export function replaceDoubleQuotesWithSingle(text: string): string {
  return text.replace(/"/g, "'");
}

export function addQuotesToKeys(jsonString: string): string {
  // Add quotes to unquoted keys
  return jsonString.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
}

export function escapeJsonForPostman(jsonString: string): string {
  try {
    const obj = lenientJsonParse(jsonString);
    const jsonStr = JSON.stringify(obj);
    // Escape for Postman - replace " with \"
    return jsonStr.replace(/"/g, '\\"');
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}


