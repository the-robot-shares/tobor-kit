import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('dist'), demo=resolve('demo/voice-agent.html');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=pathname==='/'||pathname==='/voice-agent'?demo:resolve(root,'.'+pathname);if(file!==demo&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}if(!(await stat(file)).isFile())throw new Error('missing');res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end('Not found. Build the toolkit with npm run build first.');}});
server.listen(Number(process.env.PORT??8090),'127.0.0.1',()=>console.log('Voice agent playground: http://127.0.0.1:8090'));
