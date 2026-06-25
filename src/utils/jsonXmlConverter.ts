import { lenientJsonParse } from './lenientJsonParser';

export function jsonToXml(jsonString: string, rootName: string = 'root'): string {
  try {
    const obj = lenientJsonParse(jsonString);
    return objectToXml(obj, rootName);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function objectToXml(obj: any, rootName: string, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let xml = '';

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      xml += `${spaces}<${rootName}>\n`;
      xml += objectToXml(item, 'item', indent + 1);
      xml += `${spaces}</${rootName}>\n`;
    });
  } else if (typeof obj === 'object' && obj !== null) {
    xml += `${spaces}<${rootName}>\n`;
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          xml += objectToXml(item, key, indent + 1);
        });
      } else if (typeof value === 'object' && value !== null) {
        xml += objectToXml(value, key, indent + 1);
      } else {
        xml += `${spaces}  <${key}>${escapeXml(String(value))}</${key}>\n`;
      }
    }
    xml += `${spaces}</${rootName}>\n`;
  } else {
    xml += `${spaces}<${rootName}>${escapeXml(String(obj))}</${rootName}>\n`;
  }

  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function xmlToJson(xmlString: string): string {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    if (xmlDoc.documentElement.nodeName === 'parsererror') {
      throw new Error('Invalid XML');
    }

    const obj = xmlNodeToObject(xmlDoc.documentElement);
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    throw new Error(`Invalid XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function xmlNodeToObject(node: Node): any {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    // Try to parse as number or boolean
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (/^-?\d+$/.test(text)) return parseInt(text, 10);
    if (/^-?\d*\.\d+$/.test(text)) return parseFloat(text);
    return text;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    const obj: any = {};
    const children = Array.from(element.childNodes);

    if (children.length === 0) {
      return null;
    }

    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as Element;
        const tagName = childElement.tagName;
        const value = xmlNodeToObject(childElement);

        if (obj[tagName] === undefined) {
          obj[tagName] = value;
        } else if (Array.isArray(obj[tagName])) {
          obj[tagName].push(value);
        } else {
          obj[tagName] = [obj[tagName], value];
        }
      }
    });

    return Object.keys(obj).length > 0 ? obj : null;
  }

  return null;
}


