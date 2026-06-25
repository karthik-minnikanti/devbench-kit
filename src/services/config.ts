export interface Config {
  theme: 'light' | 'dark';
  licenseStatus?: 'free' | 'pro';
  dailyGenerations?: number;
  lastGenerationDate?: string;
  licenseKey?: string;
  umlSplitPosition?: number;
}

export async function getConfig(): Promise<Config> {
  if (!window.electronAPI) {
    return { theme: 'light' };
  }

  try {
    const config = await window.electronAPI.config.get();
    return config as Config;
  } catch (error) {
    console.error('Failed to get config:', error);
    return { theme: 'light' };
  }
}

export async function setConfig(config: Config): Promise<boolean> {
  if (!window.electronAPI) {
    return false;
  }

  try {
    const result = await window.electronAPI.config.set(config);
    return result.success === true;
  } catch (error) {
    console.error('Failed to set config:', error);
    return false;
  }
}


