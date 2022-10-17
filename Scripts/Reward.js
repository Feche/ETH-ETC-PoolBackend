import chalk      from 'chalk';

import Log        from './Common/Log.js';

import * as Utils from './Common/Utils.js';
import * as MySQL from './MySQL.js';

const query            = MySQL.query;
const Settings         = Utils.getServerSettings();

var block_total_shares = 0;
var WALLETS            = [];

export async function start()
{
    const result = await query(`SELECT * FROM Wallets`);

    if(result)
    {
        WALLETS = result;

        for(let i = 0; i < WALLETS.length; i++)
        {
            WALLETS[i].Unpaid_Shares = 0;
            WALLETS[i].Fee = Settings.pool.fee;
        }
    }

    Log(`Loaded ${ chalk.bold(WALLETS.length) } wallets.`);
}

export function addShareToWallet(wallet)
{
    block_total_shares++;

    for(let i = 0; i < WALLETS.length; i++)
    {
        if(WALLETS[i].Wallet == wallet)
        {
            WALLETS[i].Unpaid_Shares++;
            WALLETS[i].Fee = this.getFee();
            return;
        }
    }

    /* If wallet does not exist, create it */
    query(`INSERT INTO Wallets VALUES ('0', '${ wallet }', '${ Utils.getServerType() }', '${ Settings.pool.min_payout }', '0.000000', '0.000000', '[]', '[]', '[]', '${ Utils.getTickCount() }')`);

    WALLETS.push(
    { 
        Wallet:         wallet,
        Type:           Utils.getServerType(),
        Min_Payout:     Settings.pool.min_payout,
        Balance:        0.00,
        Unpaid_Balance: 0.00,
        Unpaid_Shares:  1,
        Fee:            this.getFee(),
        Blocks_Found:   '[]',
        Daily_Earnings: '[]',
        Joined:          Utils.getTickCount()
    });

    Log(`Created wallet [${ wallet }] | total wallets: ${ WALLETS.length }`);
}

export function rewardToMiners(block, wallet)
{
    const t           = Utils.getTickCount();
    const blockReward = 2.56; // TODO

    var Mininig       = 0;

    for(let i = 0; i < WALLETS.length; i++)
    {
        if(WALLETS[i].Unpaid_Shares > 0)
        {
            const reward             = blockReward * (WALLETS[i].Unpaid_Shares / block_total_shares);
            const actualReward       = reward - (reward * (WALLETS[i].Fee / 100));

            WALLETS[i].Balance       = WALLETS[i].Balance + actualReward;
            WALLETS[i].Unpaid_Shares = 0;

            Log(`wallet: ${ WALLETS[i].Wallet } | shares: ${ WALLETS[i].Unpaid_Shares } | total block shares: ${ block_total_shares } | reward: ${ actualReward } | fee: ${ WALLETS[i].Fee }%`);

            query(`UPDATE Wallets SET Balance = ${ WALLETS[i].Balance } WHERE Wallet = '${ WALLETS[i].Wallet }'`);

            Mininig++;
        }

        /* Miner found a block, record it on his wallet */
        if(WALLETS[i].Wallet == wallet)
        {
            var Blocks = JSON.parse(WALLETS[i].Blocks_Found);

            Blocks.push(
            {
                Block: block,
                Date:  Utils.getTickCount(),
                Hash:  '', // TODO
                Reward: blockReward
            });

            WALLETS[i].Blocks_Found = JSON.stringify(Blocks);

            query(`UPDATE Wallets SET Blocks_Found = '${ WALLETS[i].Blocks_Found }' WHERE Wallet = '${ wallet }'`);
        }
    }
    
    block_total_shares = 0;

    Log(`Paid rewards to ${ chalk.bold(Mininig) } miners (${ Utils.getTickCount() - t } ms)`);
}

export function getPayouts()
{
    var Pay = [];

    for(let i = 0; i < WALLETS.length; i++)
    {
        if(WALLETS[i].Balance >= WALLETS[i].Min_Payout)
        {
            Pay.push({ wallet: WALLETS[i].Wallet, balance: WALLETS[i].Balance });
        }
    }

    return Pay;
}