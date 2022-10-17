import Log from './Common/Log.js';
import * as Utils from './Common/Utils.js';
import * as Miner from './Miner.js'

const NONCE_START = 0x100000; // 6 byte
const NONCE_END   = 0xFFFFFF; // 6 byte

var NONCES = [];

function getRandomExtraNonce()
{
    while(true)
    {
        const nonce = Utils.rand(NONCE_START, NONCE_END);

        if(NONCES.length == 0)
        {
            return nonce.toString(16);
        }

        for(let i = 0; i < NONCES.length; i++)
        {
            if(!NONCES[i] || NONCES[i] != nonce)
            {
                NONCES[i] = nonce;

                return nonce.toString(16);
            }
        }
    }
}

export function rotateExtraNonces()
{
    const t = Utils.getTickCount();

    const miners = Miner.getMiners();

    var c = 0;

    NONCES = [];

    for(let i = 0; i < miners.length; i++)
    {
        if(miners[i].getStratumVersion() == 'stratum2')
        {
            miners[i].setExtraNonce(getRandomExtraNonce(), true);
            
            c++;
        }
    }

    Log(`Rotated ${ c } extraNonces (${ Utils.getTickCount() - t } ms)`);
}

export function freeExtraNonce(nonce)
{
    if(nonce)
    {
        nonce = Number('0x' + nonce);

        if(NONCES[nonce] != null)
        {
            NONCES[nonce] = null;
        }
    }
}

export function getExtraNonce()
{
    return getRandomExtraNonce();
}

export function getExtraNonceSize()
{
    return NONCE_END;
}