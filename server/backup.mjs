import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
const output=process.argv[2];if(!output||!process.env.DB_PATH)throw Error('DB_PATH and output required');
const db=new Database(process.env.DB_PATH,{readonly:true});try{await db.backup(output);await fs.chmod(output,0o600);}finally{db.close();}
