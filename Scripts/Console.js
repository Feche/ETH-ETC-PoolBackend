import chalk      from 'chalk';

import Log        from './Common/Log.js';

import * as Miner from './Miner.js';
import * as Utils from './Common/Utils.js';
import * as Jobs  from './Jobs.js';
import * as Share from './Share.js';

const Settings = Utils.getServerSettings();
const Uptime   = Utils.getTickCount();
const indent   = Utils.indent;
const decimal  = Utils.decimal;

export default function Stats()
{
    setInterval(showServerStats, Utils.parseTimeToMs(Settings.console.stats_time));
}

function showServerStats()
{
    const Miners = Miner.getMiners();
    var totalShares = 0;

    Log(``);
    Log(chalk.bold.bgBlueBright(` Connected miners: ${ Miners.length } worker` + (Miners.length > 1 ? 's' : '') + ` | Pool diff: ${ Utils.getShareDiff(Jobs.getPoolDiff()) } `));
    Log(``);

    const MAX_WORKERS = 25;
    const len = Miner.getMaxNameLength() + 1;
    var miners = [];

    for(let i = 0; i < (Miners.length > MAX_WORKERS ? MAX_WORKERS : Miners.length); i++)
    {
        const self = Miners[i];

        const name = `[${ self.getName() }]:`;
        const reportedHashrate = decimal(self.getHashrate(15));
        const shares = self.getShares();

        totalShares += shares;

        const nonce = self.getExtraNonce();

        miners.push([ `${ chalk.bold(name) }` + indent(name, len + 3) + ` ${ reportedHashrate }` + indent(reportedHashrate, 7) + ` MH/s | ${ shares }` + indent(shares.toString(), 4) + ` shares | nonce: ${ nonce == null ? '-     ' : nonce } | Uptime: ${ self.getUptime() }`, Number(reportedHashrate)]);
    }

    miners.sort((a, b) => b[1] - a[1]);

    for(let i = 0; i < miners.length; i++)
    {
        Log(miners[i][0]);
    }

    if(Miners.length > MAX_WORKERS)
    {
        Log(`.. and ${ Miners.length - MAX_WORKERS } more workers.`);
    }

    const total_hashrate = decimal(Miner.getTotalHashrate(15));

    Log(``);
    Log(chalk.bgWhiteBright.black(`    [Total]: ` + indent('    [Total]: ', len) + ` ${ total_hashrate }` + indent(total_hashrate, 7) + ` MH/s | ${ totalShares }` + indent(totalShares, 4) + ` shares | Uptime: ${ Utils.msToTime(Utils.getTickCount() - Uptime) } `));

    /* Max share diff */
    const max = Share.getMaxShareDiff();

    if(max.worker)
    {
        Log(chalk.bgWhiteBright.black(` Max share diff ${ max.diff } by [${ max.worker }] ${ max.time } ago `));
    }

    /* Blocks found */
    const blocks = Jobs.getBlocksFound();

    if(blocks > 0)
    {
        Log(chalk.bgGreen.black(` Blocks found ${ blocks } `));
    }

    Log(``);
}

process.stdin.on('keypress', (str, key) => 
{
    if(str === '?' || str === 'h')
    {
        Log(`Available commands:`);
        Log(`s - show pool stats`);
        Log(`t - show shares`);
        Log(`c - clear terminal`);
        Log(`r - reset max diff and block founds`);
        Log(`k - test Geth 'eth_submitWork'`);
        Log(`z - toggle Stratum v1 support`);
        Log(`h - this help!`);
    }
    else if(str === 's')
    {
        showServerStats();
    }
    else if(str === 'c')
    {
        console.clear();
    }
});