/** Approximate current input line from keystrokes sent to the PTY. */
export class TerminalInputTracker {
    private line = "";

    reset(): void {
        this.line = "";
    }

    /** Returns submitted command when Enter is pressed, otherwise null. */
    feed(data: string): string | null {
        let submitted: string | null = null;

        for (let i = 0; i < data.length; i++) {
            const code = data.charCodeAt(i);

            if (code === 13 || code === 10) {
                submitted = this.line.trim() || null;
                this.line = "";
                continue;
            }

            if (code === 3) {
                this.line = "";
                continue;
            }

            if (code === 127 || code === 8) {
                this.line = this.line.slice(0, -1);
                continue;
            }

            if (code === 27 && data[i + 1] === "[") {
                const seqEnd = data.indexOf("m", i);
                const seqEndAlt = data.indexOf("~", i);
                const end = seqEnd >= 0 ? seqEnd : seqEndAlt;
                if (end > i) {
                    i = end;
                }
                continue;
            }

            if (code >= 32 && code !== 127) {
                this.line += data[i];
            }
        }

        return submitted;
    }

    getLine(): string {
        return this.line;
    }

    setLine(line: string): void {
        this.line = line;
    }
}

/** Ctrl+U clear line, then command + Enter — works in bash/zsh/ash. */
export function buildRunCommandPayload(command: string): string {
    return `\x15${command}\r`;
}

/** Append text to the current line without executing. */
export function buildInsertPayload(text: string): string {
    return text;
}
