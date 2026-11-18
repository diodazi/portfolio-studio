import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPortfolioServer} from './local/http-server.mjs';
import {setup} from './scripts/setup.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
await setup(root);
const publicOnly=process.argv.includes('--public');
const port=Number(process.env.PORT||(publicOnly?4176:4175));
const server=createPortfolioServer({root,publicOnly});
// Never expose the workstation editor on a LAN or public network interface.
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}\n${publicOnly?'Read-only public preview':`Local manager: http://127.0.0.1:${port}/manage/`}`));
