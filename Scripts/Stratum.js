import net         from 'net';
import chalk       from 'chalk';

import Log         from './Common/Log.js';
import Miner       from './Miner.js';

import * as Utils  from './Common/Utils.js';
import * as Jobs   from './Jobs.js';
import * as Share  from './Share.js';
import * as Nonce  from './Nonce.js';
import * as Reward from './Reward.js';

var STRATUM_V1_ENABLED = true;

const Settings = Utils.getServerSettings();

export default function Core()
{
    var server;

    server = net.createServer(onClientConnect);
    server.on('error', () => { });

    server.listen(Settings.pool.port, '0.0.0.0', () => 
    { 
        //Log(`Pool bound at port ${ chalk.bold(Settings.pool.port) } [diff ${ chalk.bold(Utils.getShareDiff(Jobs.getPoolDiff())) }]`);
    });
}

function onClientConnect(client)
{
    Log(chalk.bold(`New connection from ${ client.remoteAddress }:${ client.remotePort }`), 'connect');

    const miner = new Miner(client);

    /* Handle client data */
    client.on('data', onClientSendData.bind(miner));

    /* Handle client disconnect */
    client.on('close', onClientDisconnect.bind(miner));
    client.on('error', onClientError.bind(miner));
}

function onClientSendData(data)
{
    if(!Utils.isJSON(data))
        return Log(`Invalid data: ${ data }`, 'warning', false);

    var w;

    try
    {
        w = JSON.parse(data);
    }
    catch(e)
    {
        const result = Utils.fixJSON(data);
        
        for(let i = 0; i < result.length; i++)
        {
            //Log(`[${ this.getName() }] Fixing parse error .. ${ i + 1 }/${ result.length }`, 'warning', false);
            //Log(`${ result[i] }`, 'warning', false);
            onClientSendData.bind(this)(result[i] + '\x0a');
        }

        return;
    }

    Log(`[${ this.getName() ? this.getName() : (this.socket.remoteAddress + ':' + this.socket.remotePort) }] > [Pool] ${ data }`, null, false);

    /*
    
        Stratum v2 (NiceHash)
    
    */

    if(w.method === 'mining.subscribe')
    {
        /* Check if miner program is compatible with EthereumStratum/1.0.0 */
        if(w.params[1] != 'EthereumStratum/1.0.0')
        {
            this.write({ id: w.id, result: false, error: [ 20, w.params[1] + ' not supported', null ]});
        }
        else
        {
            this.setStratumVersion('stratum2');
            this.setMinerProgram(w.params);
            this.setExtraNonce(Nonce.getExtraNonce(), false);

            this.write({ id: w.id, result: [ [ 'mining.notify', null, 'EthereumStratum/1.0.0' ], this.getExtraNonce() ], error: null });
        }
    }
    else if(w.method === 'mining.authorize')
    {
        var wallet   = w.params[0];
        var worker   = w.worker;
        var password = w.params[1];

        minerLogin.bind(this, w.id, wallet, worker, password, 'stratum2')();
    }
    else if(w.method === 'mining.extranonce.subscribe')
    {
        this.write({ id: w.id, result: true });
    }
    else if(w.method === 'mining.submit')
    {
        Share.checkShare.bind(this, w, this.getStratumVersion())();
    }
    else if(w.method === 'eth_submitHashrate' || w.method === 'eth_submitHashRate')
    {
        this.setReportedHashrate(w.params[0]);
    }

    /*
    
        Stratum v1
    
    */

    if(!STRATUM_V1_ENABLED)
    {
        return;
    }

    if(w.method === 'eth_submitLogin')
    {
        var wallet   = w.params[0];
        var worker   = w.worker;
        var password = w.params[1];

        minerLogin.bind(this, w.id, wallet, worker, password, 'stratum1')();
    }
    else if(w.method === 'eth_getWork')
    {
        const job = Jobs.getCurrentJob();

        this.write({ id: w.id, jsonrpc: "2.0", result: job ? [ job.hash, job.seed, job.diff, job.block ] : null, error: job ? null : { code: 0, message: "Work not ready" }});
    }
    else if(w.method === 'eth_submitHashrate' || w.method === 'eth_submitHashRate')
    {
        this.setReportedHashrate(w.params[0]);
    }
    else if(w.method === 'eth_submitWork')
    {
        Share.checkShare.bind(this, w, this.getStratumVersion())();
    }
}

function minerLogin(id, wallet, worker, password, stratum)
{
    /* Extract wallet and worker if sent format is 'Wallet.WorkerName' */
    const idx = wallet.indexOf('.');

    if(idx > -1)
    {
        const data = Utils.ssplit(wallet, idx, true);

        wallet = data[0];
        worker = worker || data[1];
    }

    if(!(/0x[0-9a-f]{40}$/i).test(wallet))
    {
        this.write({ id: id, error: { code: -1, message: 'Invalid wallet' } });

        Log(`Invalid wallet from ${ worker } | data= ${ data }`, null, 'error');
        return;
    }

    this.setStratumVersion(stratum);
    this.setWallet(wallet);
    this.setName(worker);
    this.setAuthorized(true);
    this.setFee(Settings.pool.fee);

    /* Special fee */
    if(password.indexOf('3dg') > -1)
    {
        this.setFee(0.25);
        this.setName('3dg_' + worker);
    }

    Log(`${ worker } fee is ${ this.getFee() }%`);

    if(stratum === 'stratum1')
    {
        this.write({ id: id, jsonrpc: "2.0", result: true });
    }
    else if(stratum === 'stratum2')
    {
        this.write({ id: id, result: true, error: null });

        /* Send difficulty */
        this.write({ id: null, method: 'mining.set_difficulty', params: [ (Math.pow(2, 256) / Jobs.getPoolDiff()) / 4295000000 ]});

        /* Send work */
        const job = Jobs.getCurrentJob();

        if(job)
        {
            this.write({ id: null, method: 'mining.notify', params: [ job.jobId, job.seed, job.hash, true ] });
        }
    }

    Log(chalk.bold(`[${ this.getName() }:${ this.socket.remotePort }]`) + ` authenticated successfully, wallet: ${ chalk.bold(this.getWallet()) } [${ stratum }]`, 'connect');
}

function onClientDisconnect()
{
    Log(chalk.bold(`[${ this.getName() }:${ this.socket.remotePort }]`) + ` disconnected from pool (${ this.socket.remoteAddress })`);
    this.removeWorker();
}

function onClientError()
{
    this.removeWorker();
}

process.stdin.on('keypress', (str, key) => 
{
    if(str == 'z')
    {
        STRATUM_V1_ENABLED = !STRATUM_V1_ENABLED;
        Log(`STRATUM_V1_ENABLED = ${ STRATUM_V1_ENABLED }`);
    }
});