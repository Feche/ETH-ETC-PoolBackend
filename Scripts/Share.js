import chalk           from 'chalk';

import Log             from './Common/Log.js';

import * as Utils      from './Common/Utils.js';
import * as Jobs       from './Jobs.js';
import * as Dag        from './etchash/Dag.js';
import * as Http       from './Http.js';

const POW_256  = Math.pow(2, 256);
var   Settings = Utils.getServerSettings();

/* Used to check for duplicate shares */
var CURRENT_SHARES = [];

var TEST_1G = false;

var Stats = 
{
    shares:
    {
        total: 0,
        max: POW_256,
        worker: false,
        tick: 0
    }
}

export function checkShare(w, type)
{
    const t = Utils.getTickCount();
    var jobId = 0, nonce = '', header = '', block = Jobs.getCurrentBlock();

    var response = 
    {
        id: w.id,
        jsonrpc: "2.0",
        result: true,
        error: null
    }

    if(type === 'stratum1')
    {
        nonce = w.params[0], header = w.params[1];
    }
    else if(type === 'stratum2')
    {
        nonce = '0x' + this.getExtraNonce() + w.params[2], header = Jobs.getJobIDHeader(w.params[1]);
    }

    /* Stale share aka old work */
    if(Jobs.isStale(header))
    {
        response.result = false;
        response.error = { code: 23, message: "Job not found" };

        Log(` Stale job from [${ this.getName() }] `, 'error');
        //Log(` jobId=${ jobId } | header=${ header } | nonce=${ nonce } `, 'error');

        this.addStale();
        this.write(response);
        return;
    }

    /* Check if it's correctly sent */
    if(!(/0x[0-9a-f]{16}$/i).test(nonce) || !(/0x[0-9a-f]{64}$/i).test(header)) 
    {
        response.result = false;
        response.error = { code: -1, message: "Malformed PoW result" };

        Log( ` Bad PoW from [${ this.getName() }] `, 'error');
        Log(` jobId=${ jobId } | header=${ header } | nonce=${ nonce } `, 'error');

        this.write(response);
        return;
    }

    /* Duplicate share */
    if(isDuplicateShare(header, nonce))
    {
        response.result = false;
        response.error = { code: 22, message: "Duplicate share" };

        Log(` Duplicate share from [${ this.getName() }] `, 'error');
        Log(` jobId=${ jobId } | header=${ header } | nonce=${ nonce } `, 'error');

        this.write(response);
        return;
    }

    /* Accept share */
    this.write(response);

    const d = Dag.verifyShare(header, nonce, block);
    var diff = d.hash, mix = d.mix;

    if(diff <= Jobs.getPoolDiff())
    {
        this.addShare();
        addToStales(header, nonce);

        /* New max diff share found */
        if(diff <= Stats.shares.max)
        {
            Stats.shares.max = diff;
            Stats.shares.diff = Utils.getShareDiff(diff);
            Stats.shares.worker = this.getName();
            Stats.shares.tick = Utils.getTickCount();

            Log(chalk.bgWhite.black(` New max share diff ${ Stats.shares.diff } by [${ Stats.shares.worker }] `));
        }

        /* Block solution found */
        if(diff <= (TEST_1G ? Number('0x44b82fa09b5a540000000000000000000000000000000000000000000') : Jobs.getNetDiff()))
        {
            Http.submitWork(nonce, header, mix, this.getWallet());
        }

        const shareDiff = Utils.getShareDiff(diff).toString();
        const nonc = Utils.ssplit(nonce, 9);
        const name = '[' + this.getName() + ']';

        Log(`New share by ${ chalk.bold(name) }` + Utils.indent(name, 11) + ` | nonce: ${ (nonc[0].replace('0x', '')) + chalk.bold(nonc[1]) } | job: ${ chalk.bold(Utils.getJobID(header)) } | diff: ${ shareDiff }` + Utils.indent(shareDiff, 8) + ` .. ${ Utils.getTickCount() - t }ms .. [${ this.getHashrate(15) } MH/s]`, 'job', Settings.console.info.shares);
    }
    else
    {
        response.result = false;
        response.error = { code: -1, message: "Invalid share" };

        Log(` Invalid share from [${ this.getName() }] `, 'error');
        Log(` jobId=${ jobId } | header=${ header } | nonce=${ nonce } `, 'error');

        this.addInvalid();

        //this.write(response);
    }
}

/* Share check duplicate */

function addToStales(header, nonce)
{
    CURRENT_SHARES.push({ header: header.toLowerCase(), nonce: nonce.toLowerCase() });
}

export function clearShares()
{
    CURRENT_SHARES = [];
}

function isDuplicateShare(header, nonce)
{
    for(let i = 0; i < CURRENT_SHARES.length; i++)
        if(CURRENT_SHARES[i].header == header && CURRENT_SHARES[i].nonce == nonce)
            return true;

    return false;
}

export function getMaxShareDiff()
{
    return { worker: Stats.shares.worker, diff: Stats.shares.diff, time: Utils.msToTime(Utils.getTickCount() - Stats.shares.tick) };
}

process.stdin.on('keypress', (str, key) => 
{
    if(key && key.name === 't')
    {
        Settings.console.info.shares = !Settings.console.info.shares;
        Log(`Settings.console.info.shares = ${ Settings.console.info.shares }`);
    }
    else if(key && key.name === 'r')
    {
        Stats.shares.max = POW_256;
        Stats.shares.worker = false;
        Stats.shares.tick = 0;

        Jobs.resetBlocksFound();

        Log(`Max diff & blocks reset`);
    }
    else if(key && key.name === 'k')
    {
        TEST_1G = !TEST_1G;
        Log(`TEST_1G = ${ TEST_1G }`);
    }
});