// Trace Parser — parses "P0 R X [value]" format into structured operations
// Format: P<n> <R|W> <block_id> [value]
// One instruction per line, blank lines and # comments allowed

class TraceParser {
    static parse(text, numProcessors) {
        const lines = text.split('\n');
        const operations = [];
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            const raw = lines[i].trim();

            // Skip blank lines and comments
            if (raw === '' || raw.startsWith('#')) continue;

            const tokens = raw.split(/\s+/);
            if (tokens.length < 3 || tokens.length > 4) {
                errors.push({ line: lineNum, message: `Invalid format. Expected: P<n> R|W <block> [value]. Got: "${raw}"` });
                continue;
            }

            // Parse processor
            const procMatch = tokens[0].match(/^P(\d+)$/i);
            if (!procMatch) {
                const validProcs = Array.from({length: numProcessors}, (_, i) => `P${i}`).join(', ');
                errors.push({ line: lineNum, message: `Invalid processor "${tokens[0]}". Expected ${validProcs}.` });
                continue;
            }
            const proc = parseInt(procMatch[1]);
            if (proc >= numProcessors) {
                errors.push({ line: lineNum, message: `P${proc} referenced but only ${numProcessors} processors configured.` });
                continue;
            }

            // Parse operation
            const op = tokens[1].toUpperCase();
            if (op !== 'R' && op !== 'W') {
                errors.push({ line: lineNum, message: `Invalid operation "${tokens[1]}". Expected R (read) or W (write).` });
                continue;
            }

            // Parse block ID
            const block = tokens[2].toUpperCase();

            // Parse optional value for writes
            let value = null;
            if (tokens.length === 4) {
                value = parseInt(tokens[3]);
                if (isNaN(value)) {
                    errors.push({ line: lineNum, message: `Invalid value "${tokens[3]}". Expected a number.` });
                    continue;
                }
            }

            operations.push({ proc, op, block, value, line: lineNum, raw });
        }

        return { operations, errors };
    }
}
