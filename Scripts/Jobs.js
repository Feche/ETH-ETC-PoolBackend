import express    from 'express';
import chalk      from 'chalk';

import Log        from './Common/Log.js';

import * as Share from './Share.js';
import * as Utils from './Common/Utils.js';
import * as Miner from './Miner.js';
import * as Dag   from './etchash/Dag.js';
import * as Nonce from './Nonce.js';

const Settings = Utils.getServerSettings();

var Stats = 
{
    jobIdx: 1,
    blocksFound: 0,
    currentBlock: 0,
    currentEpoch: 0,
    jobs: [],
    poolDiff: '0x' + (Math.pow(2, 256) / Utils.parseDiff(Settings.pool.difficulty)).toString(16),
    netDiff: 1,
    rotateNonceTick: Utils.getTickCount()
}

export function start()
{
    const app = express();
    app.use(express.json());

    app.post('/', (req, res) => 
    {
        onReceiveNewJob(req.body);
        res.sendStatus(200);
    });

    app.listen(Settings.geth.getWork, () => 
    { 
        //Log(`Listening for getWork at port ${ chalk.bold(Settings.geth.getWork) }`);
    });
}

async function onReceiveNewJob(job)
{
    const hash = job[0], seed = job[1], diff = job[2], block = job[3];
    var epoch = 0;

    Stats.netDiff = diff;

    /* New block, delete previous jobs */
    if(block > Stats.currentBlock)
    {
        Stats.currentBlock = Number(block);
        epoch = getCurrentEpoch();

        Stats.jobs = [];
        Share.clearShares();

        Log(chalk.bold(`New block ${ Stats.currentBlock.toLocaleString().replace(/,/g, '.') } | epoch: ${ epoch } | diff: ${ Utils.getShareDiff(Stats.netDiff) }`), 'block', Settings.console.info.new_block);
    }
    
    if(block == Stats.currentBlock)
    {
        Stats.jobs.push({ jobId: (Stats.jobIdx++).toString(), hash: hash, seed: seed, diff: Stats.poolDiff, block: block });
    }

    /* Generates cache on epoch change & on server start */
    if(epoch > Stats.currentEpoch)
    {
        Stats.currentEpoch = epoch;
        await Dag.generateCache();
    }

    /* Time to rotate luck! */
    if(Settings.pool.rotate_extranonces)
    {
        if(Utils.getTickCount() - Stats.rotateNonceTick >= Utils.parseTimeToMs(Settings.pool.rotate_interval))
        {
            Stats.rotateNonceTick = Utils.getTickCount();

            Log(chalk.bgBlueBright.bold(` Rotating extraNonces.. `));

            Nonce.rotateExtraNonces();
        }
    }

    Log(`New job ${ Utils.getJobID(hash) }`, 'job', false);

    sendNewJob(getCurrentJob());
}

function sendNewJob(job)
{
    const Miners = Miner.getMiners();

    const stratum1 =
    {
        id: 0,
        jsonrpc: "2.0",
        result: [ job.hash, job.seed, job.diff, job.block ],
        algo: 'etchash'
    }

    const stratum2 =
    {
        id: 0,
        method: 'mining.notify',
        params: [ job.jobId, job.seed.replace('0x', ''), job.hash.replace('0x', ''), true ]
    }

    for(let i = 0; i < Miners.length; i++)
    {
        const miner = Miners[i];

        if(miner.isAuthorized())
        {
            if(miner.getName() === 'Relay')
            {
                const response =
                {
                    id: 0,
                    jsonrpc: "2.0",
                    result: [ job.hash, job.seed, '0x' + getNetDiff().toString(16), job.block ],
                    algo: 'etchash'
                }
                
                miner.write(response);
            }
            else
            {
                miner.write(miner.getStratumVersion() == 'stratum1' ? stratum1 : stratum2);
            }
        }
    }
}

/* Exports */

export function getCurrentJob()
{
    return Stats.jobs.length == 0 ? false : Stats.jobs[Stats.jobs.length - 1];
}

export function isStale(header)
{
    if(!header) 
        return true;
    
    for(let i = 0; i < Stats.jobs.length; i++)
        if(Stats.jobs[i].hash.toLowerCase() == header.toLowerCase())
            return false;

    return true;
}

export function getJobIDHeader(jobid)
{
    for(let i = 0; i < Stats.jobs.length; i++)
        if(Stats.jobs[i].jobId == jobid)
            return Stats.jobs[i].hash;

    return false;
}

export function getPoolDiff()
{
    return Number(Stats.poolDiff);
}

export function getNetDiff()
{
    return Number(Stats.netDiff);
}

export function getBlocksFound()
{
    return Stats.blocksFound;
}

export function resetBlocksFound()
{
    Stats.blocksFound = 0;
}

export function getCurrentBlock()
{
    return Stats.currentBlock;
}

export function getCurrentEpoch()
{
    return Math.floor(Stats.currentBlock / 60000);
}

export function addBlockFound()
{
    Stats.blocksFound++;
}