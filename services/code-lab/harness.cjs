const vm = require('node:vm');
let data = '';
process.stdin.on('data', chunk => { data += chunk; if (data.length > 2000000) process.exit(2); });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const script = `const exports = {};\n${input.compiled}\nJSON.stringify((${input.expression})(exports.mapExchange));`;
    const value = vm.runInNewContext(script, Object.create(null), { timeout: 500, contextCodeGeneration: { strings: false, wasm: false } });
    process.stdout.write(value);
  } catch (error) { process.stderr.write(error instanceof Error ? error.message : 'Evaluation failed'); process.exitCode = 1; }
});
