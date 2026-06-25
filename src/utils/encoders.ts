export function encodeBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export function decodeBase64(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch (error) {
    throw new Error('Invalid Base64 string');
  }
}

export function encodeUrl(text: string): string {
  return encodeURIComponent(text);
}

export function decodeUrl(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    throw new Error('Invalid URL encoded string');
  }
}


