/**
 * JavaScript Code Runner
 * Safely executes JavaScript code in a sandboxed environment
 * Supports require() for installed npm packages
 */

export interface JsExecutionResult {
  output: string;
  error: string | null;
  executionTime: number;
}

/**
 * Run JavaScript code in Electron main process with require() support
 */
export async function runJavaScriptCodeInMainProcess(
  code: string,
  timeoutMs: number = 5000
): Promise<JsExecutionResult> {
  if (!window.electronAPI) {
    return {
      output: '',
      error: 'Electron API not available',
      executionTime: 0,
    };
  }

  try {
    const result = await window.electronAPI.jsRunner.execute(code, timeoutMs);
    return result;
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : String(error),
      executionTime: 0,
    };
  }
}


