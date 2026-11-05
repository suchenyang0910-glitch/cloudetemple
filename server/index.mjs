import {config} from './security.mjs';
import {openStore} from './store.mjs';
import {createServer} from './app.mjs';
let settings;try{settings=config(process.env);}catch(error){console.error(error.message);process.exit(1);}
const store=openStore(settings.db),server=createServer(settings,store);
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(settings.port,'127.0.0.1',()=>console.log('Chua May API ready'));
process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0);}));
