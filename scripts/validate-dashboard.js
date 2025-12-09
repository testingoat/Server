#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const args = new Set(process.argv.slice(2));
const options = {
    fix: args.has('--fix'),
    verbose: args.has('--verbose'),
    json: args.has('--json')
};

const dashboardPath = path.resolve(process.cwd(), 'src/features/monitoring/dashboard.html');
const requiredFunctions = [
    'connectWebSocket',
    'fetchBackups',
    'fetchEnvVars',
    'fetchErrors',
    'renderEnvVars',
    'renderErrors',
    'initCharts',
    'fetchData',
    'updateDashboard',
    'switchTab',
    'renderLogs'
];

const builtinCalls = new Set([
    'map', 'forEach', 'filter', 'reduce', 'some', 'every', 'find', 'findIndex',
    'push', 'pop', 'shift', 'unshift', 'splice', 'replace', 'split', 'join',
    'toLocaleString', 'toLowerCase', 'toUpperCase', 'includes', 'startsWith', 'endsWith', 'trim',
    'alert', 'confirm', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'console', 'log', 'warn', 'error', 'info', 'table',
    'Math', 'JSON', 'Chart', 'Date', 'Number', 'String', 'Boolean', 'Promise',
    'document', 'window', 'performance',
    'appendChild', 'removeChild', 'getElementById', 'querySelector', 'querySelectorAll',
    'addEventListener', 'removeEventListener', 'createElement',
    'parse', 'stringify', 'floor', 'ceil', 'round', 'min', 'max', 'pow', 'sqrt', 'abs',
    'keys', 'values', 'entries', 'URLSearchParams', 'encodeURIComponent', 'decodeURIComponent',
    'setAttribute', 'getAttribute', 'hasAttribute',
    'Error', 'WebSocket', 'getContext', 'json', 'parseFloat', 'toFixed', 'toLocaleTimeString',
    'toString', 'slice', 'set', 'update', 'remove', 'click', 'close', 'now', 'isArray',
    'add', 'catch', 'rgba', 'var', 'if',
    'uPlot', 'setData', 'setSize', 'format', 'DateTimeFormat',
    'beginPath', 'lineTo', 'moveTo', 'clearRect', 'closePath', 'arc', 'stroke', 'fill',
    'fillText', 'getBoundingClientRect', 'setTransform', 'scale',
    // Monitoring dashboard helpers / Promise callbacks we allow without explicit function declarations
    'ChartCtor', '__chartCandidateGlobal', 'resolve', 'reject'
]);

const report = {
    errors: [],
    warnings: [],
    checks: []
};

function addCheck(label, passed, detail, severity = 'info') {
    report.checks.push({ label, passed, severity, detail });
    if (!passed) {
        if (severity === 'warning') {
            report.warnings.push(detail);
        } else {
            report.errors.push(detail);
        }
    }
}

function readDashboard() {
    try {
        return fs.readFileSync(dashboardPath, 'utf8');
    } catch (error) {
        console.error('❌ Unable to read dashboard.html:', error.message);
        process.exit(1);
    }
}

function extractScriptSource(raw) {
    const matches = [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    if (!matches.length) return raw;
    return matches[matches.length - 1][1];
}

function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
}

function stripStrings(source) {
    let result = '';
    let i = 0;
    while (i < source.length) {
        const char = source[i];
        if (char === '"' || char === "'") {
            const quote = char;
            result += quote + quote;
            i += 1;
            while (i < source.length) {
                const current = source[i];
                if (current === '\\') {
                    i += 2;
                    continue;
                }
                if (current === quote) {
                    i += 1;
                    break;
                }
                i += 1;
            }
            continue;
        }

        if (char === '`') {
            i += 1;
            let expressions = '';
            while (i < source.length) {
                const current = source[i];
                if (current === '\\') {
                    i += 2;
                    continue;
                }
                if (current === '`') {
                    i += 1;
                    break;
                }
                if (current === '$' && source[i + 1] === '{') {
                    let depth = 1;
                    i += 2;
                    const start = i;
                    while (i < source.length && depth > 0) {
                        const token = source[i];
                        if (token === '\\') {
                            i += 2;
                            continue;
                        }
                        if (token === '{') depth += 1;
                        else if (token === '}') depth -= 1;
                        i += 1;
                    }
                    expressions += source.slice(start, i - 1) + ' ';
                } else {
                    i += 1;
                }
            }
            result += expressions;
            continue;
        }

        result += char;
        i += 1;
    }
    return result;
}

function extractFunctionStats(source) {
    const stats = new Map();
    const record = (name) => {
        if (!name) return;
        stats.set(name, (stats.get(name) || 0) + 1);
    };

    const functionRegex = /function\s+([A-Za-z_]\w*)/g;
    let match;
    while ((match = functionRegex.exec(source)) !== null) {
        record(match[1]);
    }

    const assignedFunctionRegex = /(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?function\b/g;
    while ((match = assignedFunctionRegex.exec(source)) !== null) {
        record(match[1]);
    }

    const arrowFunctionRegex = /(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g;
    while ((match = arrowFunctionRegex.exec(source)) !== null) {
        record(match[1]);
    }

    return stats;
}

function findFunctionCalls(source) {
    const sanitized = stripStrings(source);
    const calls = new Set();
    const callRegex = /\b([A-Za-z_]\w*)\s*\(/g;
    let match;
    while ((match = callRegex.exec(sanitized)) !== null) {
        const name = match[1];
        if (builtinCalls.has(name)) continue;
        const prefix = sanitized.slice(Math.max(0, match.index - 20), match.index);
        if (/function\s*$/.test(prefix.trimEnd()) || /class\s*$/.test(prefix.trimEnd())) {
            continue;
        }
        calls.add(name);
    }
    return calls;
}

function checkMissingFunctions(source, functionStats) {
    const calls = findFunctionCalls(source);
    const missing = [];
    calls.forEach((name) => {
        if (!functionStats.has(name)) {
            missing.push(name);
        }
    });
    return missing.sort();
}

function checkDuplicateFunctions(functionStats) {
    const duplicates = [];
    functionStats.forEach((count, name) => {
        if (count > 1) {
            duplicates.push(`${name} (${count})`);
        }
    });
    return duplicates;
}

function checkBraces(source) {
    const counters = {
        braces: 0,
        brackets: 0,
        parens: 0
    };
    for (const char of source) {
        if (char === '{') counters.braces += 1;
        if (char === '}') counters.braces -= 1;
        if (char === '[') counters.brackets += 1;
        if (char === ']') counters.brackets -= 1;
        if (char === '(') counters.parens += 1;
        if (char === ')') counters.parens -= 1;
    }
    const issues = [];
    if (counters.braces !== 0) issues.push(`Unbalanced braces (${counters.braces > 0 ? '+' : ''}${counters.braces})`);
    if (counters.brackets !== 0) issues.push(`Unbalanced brackets (${counters.brackets > 0 ? '+' : ''}${counters.brackets})`);
    if (counters.parens !== 0) issues.push(`Unbalanced parentheses (${counters.parens > 0 ? '+' : ''}${counters.parens})`);
    return issues;
}

function checkSyntaxArtifacts(source) {
    const issues = [];
    if (source.includes('```')) {
        issues.push('Markdown code fences (```) detected');
    }
    if (source.includes('<<<<<') || source.includes('>>>>>>')) {
        issues.push('Merge conflict markers detected');
    }
    return issues;
}

function checkRequired(functionStats) {
    return requiredFunctions.filter((fn) => !functionStats.has(fn));
}

function outputReport() {
    const success = report.errors.length === 0;
    if (options.json) {
        console.log(JSON.stringify({
            success,
            errors: report.errors,
            warnings: report.warnings,
            checks: report.checks
        }, null, 2));
        process.exit(success ? 0 : 1);
    }

    console.log('🔍 Validating dashboard.html...');
    for (const check of report.checks) {
        const icon = check.passed ? '✅' : (check.severity === 'warning' ? '⚠️' : '❌');
        console.log(`${icon} ${check.detail}`);
    }

    if (success) {
        console.log('\n✅ Validation passed!');
        process.exit(0);
    } else {
        const warningText = report.warnings.length ? `, ${report.warnings.length} warning${report.warnings.length > 1 ? 's' : ''}` : '';
        console.error(`\n❌ Validation failed with ${report.errors.length} error${report.errors.length > 1 ? 's' : ''}${warningText}`);
        process.exit(1);
    }
}

function main() {
    if (options.fix) {
        console.log('ℹ️  --fix flag detected. Automatic fixes are not implemented yet.');
    }

    const raw = readDashboard();
    const scriptSource = stripComments(extractScriptSource(raw));
    const functionStats = extractFunctionStats(scriptSource);
    if (options.verbose && !options.json) {
        console.log(`ℹ️  Detected functions: ${Array.from(functionStats.keys()).sort().join(', ')}`);
    }

    const missing = checkMissingFunctions(scriptSource, functionStats);
    if (missing.length) {
        addCheck('Missing functions', false, `Missing functions: ${missing.join(', ')}`, 'error');
    } else {
        addCheck('Missing functions', true, 'No missing functions');
    }

    const duplicates = checkDuplicateFunctions(functionStats);
    if (duplicates.length) {
        addCheck('Duplicate functions', false, `Duplicate functions: ${duplicates.join(', ')}`, 'warning');
    } else {
        addCheck('Duplicate functions', true, 'No duplicate functions');
    }

    const bracesIssues = checkBraces(scriptSource);
    if (bracesIssues.length) {
        addCheck('Unclosed braces', false, bracesIssues.join('; '), 'error');
    } else {
        addCheck('Unclosed braces', true, 'Braces, brackets, and parentheses are balanced');
    }

    const syntaxIssues = checkSyntaxArtifacts(scriptSource);
    if (syntaxIssues.length) {
        addCheck('Syntax artifacts', false, syntaxIssues.join('; '), 'error');
    } else {
        addCheck('Syntax artifacts', true, 'No syntax artifacts detected');
    }

    const missingRequired = checkRequired(functionStats);
    if (missingRequired.length) {
        addCheck('Required functions', false, `Missing required functions: ${missingRequired.join(', ')}`, 'error');
    } else {
        addCheck('Required functions', true, 'All required functions present');
    }

    if (options.verbose) {
        addCheck('Function count', true, `Detected ${functionStats.size} unique function definitions`);
    }

    outputReport();
}

main();
