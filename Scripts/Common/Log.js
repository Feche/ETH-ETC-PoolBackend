import fs    from 'fs';
import chalk from 'chalk';

/* ESC character regex */
const ESC_REGEX = /(\x1b.)((([0-9][0-9][0-9])|([0-9][0-9])|([0-9]))m)/g;

const d = new Date();
const logName = `${d.getFullYear()}${addZero(d.getMonth() + 1)}${addZero(d.getDate())}-${addZero(d.getHours())}${addZero(d.getMinutes())}${addZero(d.getSeconds())}`
var lastLine = null;

export default function Log(data, type, showconsole, filename) 
{
    const d = new Date();
    const date = `[${ chalk.green(addZero(d.getDate())) }/${ chalk.green(addZero(d.getMonth() + 1)) }/${ chalk.green(d.getFullYear()) } - ${ chalk.green(addZero(d.getHours())) }:${ chalk.green(addZero(d.getMinutes())) }:${ chalk.green(addZero(d.getSeconds())) }]`
    var str = '';

    if(type == 'error')
        str = `${ date } ${ chalk.bgRed(data) } `;
    else if(type == 'success')
        str = `${ date } ${ chalk.black.bgGreen(data) } `;
    else if(type == 'warning')
        str = `${ date } ${ chalk.black.bgYellow(data) } `;
    else
        str = `${ date } ${ data }`;

    if(showconsole || showconsole == null)
    {
        /* If last line is not the same as new one, add a space on console */
        if(lastLine != type)
        {
            console.log('');
            lastLine = type;
        }

        console.log(str);
    }

    filename = filename ? filename : 'Solo';

    fs.writeFile(`./Logs/${ filename }-${ logName }.log`, str.trim().replace(ESC_REGEX, '') + '\n', { flag: 'a+' }, err => { });
}

function addZero(s) 
{
    return s.toString().length == 1 ? `0${ s }` : s;
}