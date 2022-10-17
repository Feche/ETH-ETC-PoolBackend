import fs         from 'fs';
import { Keccak } from 'sha3';

const settingsPath = './Settings/Settings.json';

const Settings = getServerSettings();

/* Calculate block hash difficulty */
export function calcShareDiff(h, n, m) 
{
    const header = h.replace('0x', '');
    const nonce = n.replace('0x', '');
    const mixhash = m.replace('0x', '');
    const headerBuffer = Buffer.from(header, 'hex');
    const nonceBuffer = Buffer.from(nonce, 'hex');
    const mixhashBuffer = Buffer.from(mixhash, 'hex');
    nonceBuffer.swap64();
    const resultBuffer = Keccak(512).update(Buffer.concat([headerBuffer, nonceBuffer])).digest();
    const result = Keccak(256).update(Buffer.concat([resultBuffer, mixhashBuffer])).digest();
    return '0x' + result.toString('hex');
}

export function getShareDiff(d) 
{
    d = Math.pow(2, 256) / d;

    /* M */
    if(d < 1000000000 - 1)
        return roundDecimal(Number(d) / 1000000) + ' M';
    /* G */
    else if(d >= 1000000000 - 1 && d <= 1000000000000 - 1)
        return roundDecimal(Number(d) / 1000000000) + ' G';
    /* T */
    else if(d >= 1000000000000 && d < 1000000000000000 - 1)
        return roundDecimal(Number(d) / 1000000000000) + ' T';
    /* P */
    else if(d >= 1000000000000000 - 1)
        return roundDecimal(Number(d) / 1000000000000000) + ' P';
}

export function roundDecimal(d)
{
    return Number(Math.round(Number(d + 'e' + 2)) + 'e-' + 2).toFixed(2);
}

export function decimal(value, decimal)
{
    if(decimal == 0) return Math.floor(value);
    decimal = decimal ? decimal : 2;
    return Number(Math.round(Number(value + 'e' + decimal)) + 'e-' + decimal).toFixed(decimal);
}

export function getJobID(hash)
{
    return hash.substr(hash.length - 6);
}

export function indent(str, max)
{
    if(!str)
        return ' '.repeat(max < 0 ? 0 : max);

    var count = max - str.toString().length;
    count = count < 0 ? 0 : count;
    return ' '.repeat(count);
}

export function rand(min, max)
{
    return Math.floor(Math.random() * (max - min) + min);
}

export function hsToMHs(hs) 
{
    return Number(Math.round(Number((hs / 1000000) + 'e' + 2)) + 'e-' + 2).toFixed(2);
}

export function getTickCount() 
{
    return new Date().getTime();
}

/*export function isJson(str) 
{
    try 
    {
        JSON.parse(str);
    } 
    catch (e) 
    {
        return false;
    }
    
    return isNaN(str);
}*/

export function isJSON(str)
{
    return str.toString().match(/({.*})/g);
}

export function getServerSettings()
{
    try
    {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    catch(e)
    {
        console.log(`getServerSettings error: ${ e }`);
    }
}

export function msToTime(ms, showseconds)
{
    /* Convert to seconds */
    const sss = ms / 1000;

    var days = sss / 86400;
    var hours = (days % 1) * 24;
    var minutes = (hours % 1) * 60;
    var seconds = (minutes % 1) * 60;

    var str = '';

    days = Math.floor(days);
    hours = Math.floor(hours);
    minutes = Math.floor(minutes);
    seconds = Math.floor(seconds);

    /* Days */
    if(days > 0)
        str = `${ days } ${ days == 1 ? 'day' : 'days' }`;
    
    /* Hours */
    if(hours > 0 || days > 0)
        str = `${ str }${ days > 0 ? ', ' : ''}${ hours } ${ hours == 1 ? 'hour' : 'hours' }`;
    
    /* Minutes */
    str = `${ str }${ (hours > 0 || days > 0) ? ', ' : ''}${ minutes } ${ minutes == 1 ? 'minute' : 'minutes' }`;
    
    /* Seconds */
    if(days == 0 && (showseconds == null || showseconds))
        str = `${ str }, ${ seconds } ${ seconds == 1 ? 'second' : 'seconds' }`;
     
    /* If showseconds is set to 'false', only diplay seconds when 60 > seconds */ 
    if(!showseconds && days == 0 && hours == 0 && minutes == 0)
        str = `${ seconds } ${ seconds == 1 ? 'second' : 'seconds' }`;

    return str;
}

export function fixJSON(data)
{
    var result = [];
    data = data.toString().split(/({.*})/g);
    for(let i = 0; i < data.length; i++)
        if(data[i].indexOf('{') > -1)
            result.push(data[i]);

    return result;
}

export function ssplit(str, index, rmindex)
{
    return [ str.substring(0, index), str.substring(index + (rmindex ? 1 : 0)) ];
}

export function parseDiff(str)
{
    for(let i = 0; i < str.length; i++)
    {
        if(str[i] == 'm')
        {
            return Number(str.substr(0, i)) * 1000000;
        }
        else if(str[i] == 'g')
        {
            return Number(str.substr(0, i)) * 1000000000;
        }
        else if(str[i] == 't')
        {
            return Number(str.substr(0, i)) * 1000000000000;
        }
        else if(str[i] == 'p')
        {
            return Number(str.substr(0, i)) * 1000000000000000;
        }
    }
}

export function parseTimeToSeconds(str)
{
    for(let i = 0; i < str.length; i++)
    {
        if(str[i] == 'm' && str[i + 1] == 's')
        {
            return Number(str.substr(0, i)) / 1000;
        }
        else if(str[i] == 's')
        {
            return Number(str.substr(0, i));
        }
        else if(str[i] == 'm')
        {
            return Number(str.substr(0, i)) * 60;
        }
        else if(str[i] == 'h')
        {
            return Number(str.substr(0, i)) * 3600;
        }
        else if(str[i] == 'd')
        {
            return Number(str.substr(0, i)) * 86400;
        }
    }
}

export function parseTimeToMs(str)
{
    for(let i = 0; i < str.length; i++)
    {
        if(str[i] == 'm' && str[i + 1] == 's')
        {
            return Number(str.substr(0, i));
        }
        else if(str[i] == 's')
        {
            return Number(str.substr(0, i)) * 1000;
        }
        else if(str[i] == 'm')
        {
            return Number(str.substr(0, i)) * 60000;
        }
        else if(str[i] == 'h')
        {
            return Number(str.substr(0, i)) * 3600000;
        }
        else if(str[i] == 'd')
        {
            return Number(str.substr(0, i)) * 86400000;
        }
    }
}

export function removeIdxFromArray(arr, idx)
{
    var newArr = [];

    for(let i = 0; i < arr.length; i++)
    {
        if(i != idx)
        {
            newArr.push(arr[i]);
        }
    }

    return newArr;
}

export function removeFromArr(arr, idxArr)
{
    if(!Array.isArray(idxArr))
    {
        return Log(`removeFromArr error: idxArr is not an array`);
    }

    var newArr = [];

    for(let i = 0; i < arr.length; i++)
    {
        newArr.push(arr[i]);
        
        for(let j = 0; j < idxArr.length; j++)
        {
            if(idxArr[j] == i)
            {
                newArr.pop();
            }
        }
    }

    return newArr;
}

export function getServerType()
{
    return Settings.pool.type.toUpperCase();
}