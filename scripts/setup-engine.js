import {run} from '../lib/process.js';
import {fileURLToPath} from 'node:url';
// Install the immutable upstream release; no fork source, patches or compiler.
try {
 await run('python3',[fileURLToPath(new URL('./install-stock.py',import.meta.url)),...process.argv.slice(2)],{timeout:7200000,onData:text=>process.stdout.write(text)});
} catch(error) { console.error(error.message);process.exitCode=1; }
