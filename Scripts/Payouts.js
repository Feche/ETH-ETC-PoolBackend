import Web3        from 'web3';
import request     from 'request';

import Log         from './Common/Log.js';

import * as Utils  from './Common/Utils.js';
import * as Reward from './Reward.js';

const Settings = Utils.getServerSettings();

var   web3;

export function start()
{
    setInterval(processPayouts, Utils.parseTimeToMs(Settings.payouts.interval));

    web3 = new Web3(`http://${ Settings.geth.ip }:${ Settings.geth.port }`);
}

async function processPayouts()
{
    const Payouts = Reward.getPayouts();

    var total = 0;

    for(let i = 0; i < Payouts.length; i++)
    {
        const wallet  = Payouts[i].wallet;
        const balance = Payouts[i].balance;

        total += balance;

        payWallet(wallet, balance);
    }

    Log(`Paid ${ Payouts.length } accounts, total ${ total } ${ Settings.pool.type }`);
}

async function payWallet(wallet, balance)
{
    const signTx = 
    {
        to:    wallet,
        value: balance * 1000000000000000000,
        gas:   21000,
        type:  0x0
    };

    const signedTx = await web3.eth.accounts.signTransaction(signTx, Settings.payouts.private_key);

    console.log(signedTx);

    const eth_sendRawTransaction =
    {
        json:
        {
            id:      Utils.rand(1000, 2000),
            jsonrpc: "2.0",
            method:  "eth_sendRawTransaction",
            params:  [ signedTx.rawTransaction ]
        }
    }

    request.post(`http://10.0.0.250:3000`, eth_sendRawTransaction,
        async function (error, response, body) 
        {
            Log(`Paid ${ balance } to [${ wallet }]`);
            Log(`${ JSON.stringify(body) }`, 'success');
        }
    );     
}