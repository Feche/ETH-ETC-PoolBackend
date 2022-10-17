import chalk      from 'chalk';

import Log        from './Common/Log.js';

import * as Utils from './Common/Utils.js';
import * as MySQL from './MySQL.js';
import * as Miner from './Miner.js';

const query = MySQL.query;
const Settings = Utils.getServerSettings();

Settings.pool.miner_stats_update   = Utils.parseTimeToMs(Settings.pool.miner_stats_update);
Settings.pool.miner_stats_timespan = Utils.parseTimeToMs(Settings.pool.miner_stats_timespan);

var WALLETS = [];

export async function start()
{
    const result = await query(`SELECT Wallet, Type, Miners FROM Wallets`);

    if(result)
    {
        for(let i = 0; i < result.length; i++)
        {
            const r = result[i];

            WALLETS.push(
            {
                Wallet: r.Wallet,
                Type: r.Type,
                Miners: JSON.parse(r.Miners)
            });
        }
    }

    Log(`Loaded ${ chalk.bold(WALLETS.length) } miners.`);

    setInterval(updateMinersStats, Settings.pool.miner_stats_update);
}

function updateMinersStats()
{
    const t      = Utils.getTickCount();
    const Miners = Miner.getMiners();

    var u = 0;

    /* Remove offline miners */

    for(let i = 0; i < WALLETS.length; i++)
    {
        var toRemove = [];

        for(let x = 0; x < WALLETS[i].Miners.length; x++)
        {
            if(WALLETS[i].Miners[x].Last_Seen + Settings.pool.miner_stats_timespan < Utils.getTickCount())
            {
                toRemove.push(x);
            }
        }
       
        WALLETS[i].Miners = Utils.removeFromArr(WALLETS[i].Miners, toRemove);
    }

    for(let i = 0; i < Miners.length; i++)
    {
        const self  = Miners[i];

        /* Get last N hs shares */
        const Shares = self.getLastNShares(Settings.pool.miner_stats_update);

        if(Shares.length > 0)
        {
            var valid = 0, invalid = 0, stale = 0;

            for(let x = 0; x < Shares.length; x++)
            {
                if(Shares[x].type == 1)
                {
                    valid++;
                }
                else if(Shares[x].type == 2)
                {
                    stale++;
                }
                else if(Shares[x].type == 3)
                {
                    invalid++;
                }
            }

            const reportedHashrate = self.getReportedHashrate();
            const poolHashrate     = self.getHashrate(Settings.pool.miner_stats_update);
            const lastSeen         = Shares[Shares.length - 1].tick;
            const tick             = Utils.getTickCount();

            const name             = self.getName();
            const wallet           = self.getWallet();

            const idx = getMinerIdx(name, wallet);

            /* Wallet and worker already exists */

            if(idx.wIdx > -1 && idx.mIdx > -1)
            {
                WALLETS[idx.wIdx].Miners[idx.mIdx].Last_Seen = lastSeen;

                WALLETS[idx.wIdx].Miners[idx.mIdx].Hashrate.push(
                {
                    Valid_Shares: valid,
                    Invalid_Shares: invalid,
                    Stale_Shares: stale,
                    Reported_Hashrate: reportedHashrate,
                    Pool_Hashrate: poolHashrate,
                    Tick: tick
                });

                /* Remove old hashrate */

                var toRemove = [];

                for(let x = 0; x < WALLETS[idx.wIdx].Miners[idx.mIdx].Hashrate.length; x++)
                {
                    if(WALLETS[idx.wIdx].Miners[idx.mIdx].Hashrate[x].Tick + Settings.pool.miner_stats_timespan < Utils.getTickCount())
                    {
                        toRemove.push(x);
                    }
                }

                WALLETS[idx.wIdx].Miners[idx.mIdx].Hashrate = Utils.removeFromArr(WALLETS[idx.wIdx].Miners[idx.mIdx].Hashrate, toRemove);

                query(`UPDATE Wallets SET Miners = '${ JSON.stringify(WALLETS[idx.wIdx].Miners) }' WHERE Wallet = '${ wallet }' AND Type = '${ Utils.getServerType() }'`);

                u++;
            }

            /* Wallet exists, worker does not exist */

            else if(idx.wIdx > -1 && idx.mIdx == -1)
            {
                WALLETS[idx.wIdx].Miners.push(
                {
                    Name: name,
                    Last_Seen: lastSeen,
                    Hashrate:
                    [{
                        Valid_Shares: valid,
                        Invalid_Shares: invalid,
                        Stale_Shares: stale,
                        Reported_Hashrate: reportedHashrate,
                        Pool_Hashrate: poolHashrate,
                        Tick: tick
                    }]
                });

                query(`UPDATE Wallets SET Miners = '${ JSON.stringify(WALLETS[idx.wIdx].Miners) }' WHERE Wallet = '${ wallet }' AND Type = '${ Utils.getServerType() }'`);

                u++;
            }

            /* Wallet and worker does not exist */

            else if(idx.wIdx == -1 && idx.mIdx == -1)
            {
                WALLETS.push(
                {
                    Wallet: wallet,
                    Type: Utils.getServerType(),
                    Miners: 
                    [{
                        Name: name,
                        Last_Seen: lastSeen,
                        Hashrate:
                        [{
                            Valid_Shares: valid,
                            Invalid_Shares: invalid,
                            Stale_Shares: stale,
                            Reported_Hashrate: reportedHashrate,
                            Pool_Hashrate: poolHashrate,
                            Tick: tick
                        }]
                    }]
                });

                query(`UPDATE Wallets SET Miners = '${ JSON.stringify(WALLETS[WALLETS.length - 1].Miners) }' WHERE Wallet = '${ wallet }' AND Type = '${ Utils.getServerType() }'`);

                u++;
            }
        }
    }

    Log(`Updated ${ u } workers stats ... ${ Utils.getTickCount() - t } ms`);
}

function getMinerIdx(name, wallet)
{
    var wIdx = -1, mIdx = -1;

    for(let i = 0; i < WALLETS.length; i++)
    {
        if(WALLETS[i].Wallet == wallet)
        {
            wIdx = i;

            for(let x = 0; x < WALLETS[i].Miners.length; x++)
            {
                if(WALLETS[i].Miners[x].Name == name)
                {
                    mIdx = x;
                    break;
                }
            }
        }
    }

    return { wIdx: wIdx, mIdx: mIdx };
}