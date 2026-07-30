import { readFileSync, readdirSync } from 'fs';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const files = readdirSync(distDir).filter(f => f.endsWith('.eext'));
if (files.length === 0) { console.error('No .eext file found. Run npm run build first.'); process.exit(1); }
const eextFile = files.sort().pop();
const eextPath = join(distDir, eextFile);
console.log(`Found extension: ${eextFile}`);

let bridgePort = null;
for (let port = 49620; port <= 49629; port++) {
  try {
    const resp = await fetch(`http://localhost:${port}/health`);
    const data = await resp.json();
    if (data.service === 'easyeda-bridge') { bridgePort = port; console.log(`Bridge found on port: ${port}`); break; }
  } catch {}
}
if (!bridgePort) { console.error('Bridge not running.'); process.exit(1); }

const server = createServer((req, res) => {
  const data = readFileSync(eextPath);
  res.writeHead(200, { 'Content-Type': 'application/zip', 'Access-Control-Allow-Origin': '*' });
  res.end(data);
});
const httpPort = 19876;
server.listen(httpPort, async () => {
  console.log(`Serving ${eextFile} on http://127.0.0.1:${httpPort}`);
  try {
    const code = `var r=await fetch("http://127.0.0.1:${httpPort}/${eextFile}");var b=await r.arrayBuffer();var f=new File([b],"p.eext",{type:"application/zip"});return await window.top._MSG_BUS2_EXTAPI_.rpcCall("extensionApi.importExtensionPackages",{files:[f],action:"import"},15000);`;
    const resp = await fetch(`http://localhost:${bridgePort}/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, timeout: 30000 }) });
    const result = await resp.json();
    console.log('Import result:', JSON.stringify(result, null, 2));
  } catch (err) { console.error('Import failed:', err.message); }
  finally { server.close(); }
});
