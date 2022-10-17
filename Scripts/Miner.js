import chalk       from 'chalk';

import Log         from './Common/Log.js';

import * as Utils  from './Common/Utils.js';
import * as Nonce  from './Nonce.js';
import * as Jobs   from './Jobs.js';
import * as Reward from './Reward.js';

const POW_256 = Math.pow(2, 256);
const Settings = Utils.getServerSettings();

var Miners = [];

export default class Miner
{
    constructor(socket) 
    {
        this.shares = [];
        this.reportedHashrate = 0;
        this.blockFound = 0;
        this.socket = socket;
        this.uptime = Utils.getTickCount();
        this.wallet = null;
        this.minerProgram = '';
        this.stratumVersion = null;
        this.extraNonce = null;
        this.authorized = false;

        Miners.push(this);
    }

    /* Name */

    getName()
    {
        return this.name;
    }

    setName(name)
    {
        const idx = isNameAlreadyOnWallet(name, this.getWallet());

        if(idx)
        {
            name = name + '_' + idx;
        }

        this.name = name;
    }

    /* Hashrate */

    getHashrate(time)
    {
        if(this.getShares() == 0) 
            return 0;

        var count = 0;
        var timePassed = 0;

        for(let i = 0; i < this.shares.length; i++)
        {
            const t = Utils.getTickCount() - this.shares[i].tick;
            
            if(t <= time * 60000)
            {
                count++;

                timePassed = t > timePassed ? t : timePassed;
            }
        }

        const mhs = Utils.hsToMHs((POW_256 / Jobs.getPoolDiff() * count) / (timePassed / 1000));

        return isNaN(mhs) ? 0.00 : mhs;
    }

    getReportedHashrate()
    {
        return this.reportedHashrate;
    }

    setReportedHashrate(hash)
    {
        this.reportedHashrate = Utils.hsToMHs(parseInt(hash));
    }

    /* Fee */

    setFee(fee)
    {
        this.fee = fee;
    }

    getFee()
    {
        return this.fee;
    }

    /* Share */

    addShare()
    {
        this.shares.push({ type: 1, tick: Utils.getTickCount() });

        Reward.addShareToWallet.bind(this, this.getWallet())();
    }

    getShares()
    {
        return this.shares.length;
    }

    getLastNShares(ms)
    {
        var nShares = [];
        
        for(let i = 0; i < this.shares.length; i++)
        {
            const t = Utils.getTickCount() - this.shares[i].tick;
            
            if(t <= ms)
            {
                nShares.push(this.shares[i]);
            }
        }

        return nShares;
    }

    /* Stale shares */

    addStale()
    {
        this.shares.push({ type: 2, tick: Utils.getTickCount() });
    }

    /* Invalid shares */

    addInvalid()
    {
        this.shares.push({ type: 3, tick: Utils.getTickCount() });
    }

    /* Set which program miner is using */

    setMinerProgram(program)
    {
        this.minerProgram = program;
    }

    /* Stratum version */

    setStratumVersion(ver)
    {
        this.stratumVersion = ver;
    }

    getStratumVersion()
    {
        return this.stratumVersion;
    }

    /* Extra nonce */

    setExtraNonce(nonce, notify)
    {
        this.extraNonce = nonce;

        if(notify)
        {
            this.write({ id: null, method: 'mining.set_extranonce', params: [ nonce ] });

            //Log(`Changing [${ this.getName() }] extraNonce to: ${ chalk.bold(nonce) }`);
        }
    }

    getExtraNonce()
    {
        return this.extraNonce;
    }

    /* Authorization */

    setAuthorized(val)
    {
        this.authorized = val;
    }

    isAuthorized()
    {
        return this.authorized;
    }

    /* Wallet */

    getWallet()
    {
        return this.wallet; 
    }

    setWallet(wallet)
    {
        this.wallet = wallet.toLowerCase();
    }

    /* Uptime */

    getUptime()
    {
        return Utils.msToTime(Utils.getTickCount() - this.uptime);
    }

    /* Others */

    removeWorker()
    {
        this.socket.end();

        Nonce.freeExtraNonce(this.getExtraNonce());
        
        var newArr = [];

        for(let i = 0; i < Miners.length; i++)
        {
            if(Miners[i] != this)
            {
                newArr.push(Miners[i]);
            }
        }

        Miners = newArr;
    }

    write(data)
    {
        const jsondata = JSON.stringify(data);

        Log(`[Pool] > [${ this.getName() ? this.getName() : (this.socket.remoteAddress + ':' + this.socket.remotePort) }] ${ jsondata }`, null, false);
        
        this.socket.write(jsondata + '\x0a');
    }
}

function isNameAlreadyOnWallet(name, wallet)
{
    for(let i = 0; i < Miners.length; i++)
    {
        if(Miners[i].getName() == name && Miners[i].getWallet() == wallet)
        {
            return i + 1;
        }
    }

    return false;
}

/* Exports */

export function getMiners()
{
    return Miners;
}

export function getTotalHashrate(time)
{
    var total = 0;

    for(let i = 0; i < Miners.length; i++)
    {
        total = total + Number(Miners[i].getHashrate(time));
    }

    return total;
}

export function getMaxNameLength()
{
    var max = 1;

    for(let i = 0; i < Miners.length; i++)
        if(Miners[i].name && Miners[i].name.length > max)
            max = Miners[i].name.length;

    return max;
}