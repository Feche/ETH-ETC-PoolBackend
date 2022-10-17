import mysql      from 'mysql';

import Log        from './Common/Log.js';

import * as Utils from './Common/Utils.js';

const Settings = Utils.getServerSettings();

const auth =
{
    host: Settings.mysql.host,
    user: Settings.mysql.user,
    password: Settings.mysql.password,
    database: Settings.mysql.database
}

var pool;

export async function start()
{
    pool = mysql.createPool(auth);

    await query(`CREATE TABLE IF NOT EXISTS Wallets (Id INT NOT NULL AUTO_INCREMENT, Wallet TEXT, Type TEXT, Min_Payout FLOAT, Balance FLOAT, Unpaid_Balance FLOAT, Blocks_Found MEDIUMTEXT, Daily_Earnings LONGTEXT, Miners LONGTEXT, Joined BIGINT, PRIMARY KEY (Id))`);
}

export function query(query)
{
    return new Promise((resolve, reject) => 
    {
        pool.getConnection((err, connection) => 
        {
            if(err)
                return Log(`MySQL query error (1): ${ err }`, 'error');

            connection.query(query, (err, rows) => 
            { 
                connection.release();

                if(err)
                {
                    Log(query, 'error');
                    Log(`MySQL query error (2): ${ err }`, 'error');
                    return;
                }

                resolve(rows);
            });
        });
    });
}