const path = require('node:path');
const pipe = require('node:readline').createInterface({input:process.stdin});
pipe.once('close', () => process.exit(0));
pipe.once('line', line => {
  try {
    const data = process.env.ROAMDOCK_DATA_ROOT;
    if (line !== 'START' || !data || !path.isAbsolute(data)) throw Error('Invalid launch');
    for (const key of Object.keys(process.env)) if (/^ALLOW_/i.test(key)) delete process.env[key];
    process.env.ROAMDOCK_RESOURCE_ROOT = __dirname;
    process.env.HOST = process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1';
    process.env.PORT = '0';
    const token = require('./web/pairing').loadOrCreateConsoleToken(data);
    process.env.CONSOLE_TOKEN = token;
    const {server,startBonjour} = require('./web/server');
    server.once('error', () => process.exit(2));
    server.listen(0,process.env.HOST,() => {
      // Private inherited pipe; never publish the pairing secret to logs or argv.
      process.stdout.write(JSON.stringify({port:server.address().port,token})+'\n');
      if(process.env.HOST !== '127.0.0.1') startBonjour();
    });
  } catch { process.exit(2); }
});
