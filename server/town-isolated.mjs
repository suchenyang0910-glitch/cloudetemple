import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import Database from 'better-sqlite3';
import {migrateTown} from './town-migrate.mjs';
import {openTownStore} from './town-store.mjs';
import {createTownApi,createTownAccountReader,townPrefix} from './town-api.mjs';
import {loadTownNamePolicy,draftTownNames} from './town-name-policy.mjs';

export function townDatabasePath(environment,file){
  if(!['production','staging'].includes(environment)||typeof file!=='string'||!path.isAbsolute(file))throw Error('town_separate_database_required');
  file=path.resolve(file);
  if(path.basename(file)!=='town.sqlite'||!file.replaceAll('\\','/').includes('/'+environment+'/'))throw Error('town_separate_database_required');
  return file;
}
export function openIsolatedTown(environment,file,names,{timeout=2000}={}){
  file=townDatabasePath(environment,file);
  if(fs.realpathSync(file)!==file||!fs.lstatSync(file).isFile()||fs.statSync(file).nlink!==1)throw Error('town_database_link');
  const db=new Database(file,{fileMustExist:true,timeout});
  try{
    db.pragma('foreign_keys = ON');
    if(db.pragma('journal_mode',{simple:true})!=='wal')throw Error('town_wal_required');
    if(!db.prepare('SELECT 1 FROM town_schema WHERE version=3').get())throw Error('town_separate_database_required');
    migrateTown(db,environment,{isolated:true});
    const store=openTownStore(db,environment,{isolated:true,names});
    return {db,store};
  }catch(error){db.close();throw error;}
}
export function townFlags(env){return {entryEnabled:env.TOWN_ENTRY_ENABLED==='1',realtimeEnabled:env.TOWN_REALTIME_ENABLED==='1'};}
export function reviewedNames(env){return env.CHUAMAY_ENV==='production'?loadTownNamePolicy(env.TOWN_NAME_POOL_PATH,env.TOWN_NAME_POOL_SHA256):env.TOWN_NAME_POOL_PATH?loadTownNamePolicy(env.TOWN_NAME_POOL_PATH,env.TOWN_NAME_POOL_SHA256):draftTownNames;}

// Main-account reads finish BEFORE any town write transaction; realtime never calls this.
export function refreshTownAccounts(main,town,now=Date.now()){
  const updates=town.prepare('SELECT ref,user_id FROM town_names WHERE user_id IS NOT NULL').all().map(row=>({
    ref:row.ref,active:!!main.prepare('SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL').get(row.user_id),
  }));
  town.transaction(()=>{for(const row of updates){
    if(row.active)town.prepare('UPDATE town_names SET account_valid_until=? WHERE ref=?').run(now+30000,row.ref);
    else town.prepare('DELETE FROM town_names WHERE ref=?').run(row.ref);
  }}).immediate();
}
export function createTownFeature(env,settings,main,access,log=()=>{}){
  const flags=townFlags(env);let resource,maintenance,handler=async()=>false;
  if(flags.realtimeEnabled){
    try{
      const names=reviewedNames(env);
      resource=openIsolatedTown(settings.environment,env.TOWN_DB_PATH,names,{timeout:50});
      refreshTownAccounts(main,resource.db);
      handler=createTownApi(settings,resource.store,{family:createTownAccountReader(main),access,names});
      maintenance=setInterval(()=>{try{refreshTownAccounts(main,resource.db);}catch{log({code:'town_account_refresh'});}},10000);maintenance.unref();
    }catch{resource?.db.close();resource=undefined;flags.realtimeEnabled=false;log({code:'town_unavailable'});}
  }
  return {
    async handle(req,res,route){
      if(route===townPrefix+'/config'&&req.method==='GET'){
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(flags));return true;
      }
      return handler(req,res,route);
    },
    close(){clearInterval(maintenance);resource?.db.close();},
  };
}

// Explicit offline initialization only. Existing source tables/files are never modified.
export function initializeTownFile(environment,file){
  file=townDatabasePath(environment,file);
  if(fs.realpathSync(path.dirname(file))!==path.dirname(file))throw Error('town_database_link');
  const fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);
  const db=new Database(file);
  try{db.pragma('foreign_keys = ON');db.pragma('journal_mode = WAL');migrateTown(db,environment,{isolated:true});}
  finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv[2]!=='--initialize-empty'||process.argv.length!==4)throw Error('explicit_initialization_required');
    initializeTownFile(process.env.CHUAMAY_ENV,process.argv[3]);console.log('{"code":"town_isolated_initialized"}');
  }catch{console.error('{"code":"town_initialization_failed"}');process.exitCode=1;}
}
