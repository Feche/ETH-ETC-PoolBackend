import keypress      from 'keypress';
import chalk         from 'chalk';

import Stratum       from './Scripts/Stratum.js';
import Console       from './Scripts/Console.js'
import Log           from './Scripts/Common/Log.js';

import * as MySQL    from './Scripts/MySQL.js';
import * as Jobs     from './Scripts/Jobs.js';
import * as Nonce    from './Scripts/Nonce.js';
import * as Reward   from './Scripts/Reward.js';
import * as Stats    from './Scripts/Stats.js';
import * as Payouts  from './Scripts/Payouts.js';
import * as Utils    from './Scripts/Common/Utils.js';

const Settings = Utils.getServerSettings();

var interval;

for(let i = 0; i < 100; i++)
    console.log('');

Log(chalk.bold(`SERVER SETTINGS`));
Log(JSON.stringify(Settings, null, 4));

MySQL.start();
/* Start to receive getWork */
Jobs.start();

interval = setInterval(async () =>
{
    if(Jobs.getCurrentBlock() == 0)
    {
        Log(`Waiting for getWork..`);
        return;
    }

    clearInterval(interval);

    Stratum();
    Console();
    Reward.start();
    Stats.start();
    Payouts.start();
    
    //Log(`ExtraNonce size is ${ chalk.bold(Nonce.getExtraNonceSize().toString(16).length) } bytes.`)

}, 1000);

keypress(process.stdin);