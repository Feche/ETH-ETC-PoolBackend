import request from 'request';

import Log     from './Common/Log.js';

import * as Jobs   from './Jobs.js';
import * as Reward from './Reward.js';
import * as Utils  from './Common/Utils.js';

const Settings = Utils.getServerSettings();

export function submitWork(nonce, header, mix, wallet)
{
    const response =
    {
        json:
        {
            id: Utils.rand(20000000, 30000000),
            jsonrpc: "2.0",
            method: "eth_submitWork",
            params: [ nonce, header, mix ]
        }
    }

    const block = Jobs.getCurrentBlock();

    Log(` Submitting block solution to 'http://${ Settings.geth.ip }:${ Settings.geth.port }'.. `, 'warning', true, 'Block');
    Log(` block=${ block } | nonce=${ nonce } | header=${ header } | mix=${ mix } `, 'warning', true, 'Block');

    request.post(`http://${ Settings.geth.ip }:${ Settings.geth.port }`, response,
        async function (error, response, body) 
        {
            /* Test block submition */
            //body.result = true;

            if(!error && response.statusCode == 200)
            {
                if(body.result)
                {
                    Jobs.addBlockFound();
                    Reward.rewardToMiners(block, wallet);

                    Log(`response=${ JSON.stringify(body) }`, 'success', true, 'Block');
                }
                else
                {
                    Log(`response=${ JSON.stringify(body) }`, 'error', true, 'Block');
                }
            }
            else
            {
                Log(`request.post error (230): ${ error } ${ JSON.stringify(body) }`, 'error', true, 'Block');
            }
        }
    );
}

function getBlockReward(blockno)
{
    return new Promise((resolve, reject) =>
    {
        request.get(`https://blockscout.com/etc/mainnet/api?module=block&action=getblockreward&blockno=${ blockno }`, (error, response, body) =>
        {
            if(error)
            {
                return Utils.log(`getBlockReward error (0): ${ error }`, 'error');
            }

            resolve(Number(JSON.parse(body).result.blockReward / 1000000000000000000));
        });
    });
}