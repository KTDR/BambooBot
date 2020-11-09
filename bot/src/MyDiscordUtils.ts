/**
 * Library of functions useful for developing my discord bot
 */
import {DiscordClient as client} from './index'; //imports client from main program file
import Discord = require('discord.js'); //For type definitions TODO: Ensure this is not being loaded in the compiled .js file as it is not used in runtime here
import fs from "fs";   //imports node.js module that allows read/write of files
import path from 'path';    //For resolving suitable path for various OS environments
import yaml from 'js-yaml'; //For parsing YAML formatted config files

let configPath = path.join(__dirname,'..','config','config-admin.yaml');
let configAdmin: any = getYAMLObj(configPath);

/**
 * Formats a string to a codeblock for discord messages
 * @param string String to be converted into a codeblock
 * @param code language to be used for the syntax highlighting in the code block, optional
 */
export function codeblockWrap(str: string, code = ""): string {
    return "```" + code + "\n" + str + "\n```";
}

/**
 * Formats a string to a single line code block
 * @param str string to be converted to a single line code block
 */
export function codelineWrap(str: string): string {
    return '`' + str + '`';
}

/**
 * Converts a discord code block back into a string. Automatically detects if it is a single code line or a code block.
 * Returns the original string if it is determined not to be a code block or code line, in this way it can be used to 
 * check if a string is a code block or not. A properly formatted multiline codeblock should ideally have '```' and the optional syntax
 * highlighting parameters alone, on their own lines, and function may not work properly if a code block does not match this format.
 * @param str Code string to be unwrapped
 */
export function codeblockUnwrap(str: string): string {
    let returnString: string;
    if (str.startsWith('```') && str.endsWith('```')) { //string determined to be multiline code block
        let lines: string[] = str.split('\n')   //splits code block string into array along line breaks
        //remove first and last lines of the code block
        lines.shift();
        lines.pop();
        returnString = lines.join('\n');    //stich string back together.
    }
    else if (str.startsWith('`') && str.endsWith('`')) {    //string determined to be single code line
        returnString = str.slice(1, -1);    //removes first and last character from string
    }
    else {  //string isn't code
        returnString = str;
    }
    return returnString;
}

/**
 * Logging for the bot, defaults to logging to both the admin server and the local console but has options to specify one or the other.
 * @param content Object to be logged
 * @param destination 'LOCAL' or 'REMOTE' or 'BOTH' to specify where to log, by defaults logs to LOCAL
 */
export async function myLogger(content: any, destination?: string ): Promise<void> {
    let logChannel: Discord.TextChannel = client.channels.get(configAdmin.logChannel) as Discord.TextChannel;
    if (content != undefined || content != null) {  //Need to remember  null value checks TODO: Check if this can be simplified to one condition
        switch (destination) {
            case 'LOCAL':
                console.log(content);
                break;
            case 'REMOTE':
                await logChannel.send(content.toString());
                break;
            case 'BOTH':
                console.log(content);
                await logChannel.send(content.toString());
                break;
            default:
                console.log(content);
                //logChannel.send(content.toString())
        }
    }
}

/**
 * Find and return a text channel object on the specified server with the given name matching.
 * 
 * Text channels can share names, this is not accounted for.
 * @param server 
 * @param name 
 */
export function findTextChannel(server: Discord.Guild, name: string): Discord.TextChannel  {
    let targetChannel: Discord.TextChannel = null;
    if (server.available) {
        targetChannel = server.channels.find(ch => ch.name === name) as Discord.TextChannel;   //find a channel with name matching then cast it as a TextChannel
    }
    return targetChannel;
}

/**
 * Converts an object to a boolean value based upon my own rules
 * @param value Object to be evaluated
 */
export function booleanParser(value: any): boolean {
    let result: boolean = undefined;

    if (typeof value === 'boolean') {
        result = value;
    }
    else if (typeof value === 'string') {
        if (value.toLowerCase().trim() === 'true') {
            result = true;
        }
        else if (value.toLowerCase().trim() === 'false') {
            result = false;
        }
    }
    else if (typeof value === 'number') {
        value === 0 ? result = false : result = true;
    }
    //this.myLogger("Parsed " + value + " and determined " + result);
    return result;
}

/**
 * NOT YET IMPLEMENTED
 */
export function addAsSet(passedArray: Array<any>, value: Array<any>): Array<any>  {
    console.log("addAsSet() not yet implemented.");
    return null;   
}

/**
 * Receives an array that may contain duplicates and returns an array that contains no duplicates.
 * For now compares strings without concern for casing, will add an optional comparator param later.
 * @param list List that may contain duplicates
 */
//TODO: Find more efficient way of comparing without rebuilding an entirely new array of strings converted to lowercase
export function removeDuplicates(list: any[]): any[] {
    let newList: any[] = new Array(list);

    for (let i = 0; i < newList.length; i++) {
        for (let j = i; j < newList.length; j++ ) {
            if (newList[i].toLowerCase() === newList[j].toLowerCase()) {
                newList.splice(i, 1);
            }
        }
    }
    return newList;
}

/**
 * This function splits a string into an array of strings by looking for specific headers. It locates the headers by looking for a
 * string pattern matching the parameter supplied to it, in my case for the readme file headers begin and end with "____"
 * This helps divide the readme.txt into smaller parts that are below the discord message character limit.
 * @param myString String to split into array
 * @param pattern String used to demarcate a header, defaults to "____"
 * @example If a header is formatted as "*-*INTRO*-*", the pattern param would be "*-*"
 */
//Help with regular expressions is credited to https://regex101.com/ and http://www.javascripter.net/faq/creatingregularexpressions.htm.
//TODO: Consider using string.split() starting last in the header list and moving backwards to simplify this logic.
export function splitByHeaders(myString: string, pattern = "____") {
    const regex = new RegExp("^(" + pattern + ").+(" + pattern + ")$", "gm" ); //Builds the regular expression object that will be used to find the headers
    let stringArray = [], headers = []; //String arrays to hold the split sections as well as the header names.

    headers = myString.match(regex);    //Populates string array of headers with headers found in the string parameter

    for (let i = 0; i < headers.length; i++) {//Steps through each header array element
        let startPos = myString.search(headers[i]); //marks the start location as the position of the current header in the file.

        if (i === headers.length-1) { //if on the last array element, don't try to search for the next 
            stringArray.push(myString.slice(startPos)); //so it reads until the end of the remaining string
        }
        else {
            let endPos = myString.search(headers[i+1]);    //finds location of next header so it knows where to stop
            stringArray.push( myString.slice(startPos, endPos) ); //Reads up to but not including the next header
        }
    }
    return stringArray;
}

/**
 * Supplied with a 2D string array, it returns a 1D string array with padding for fixed minimum spacing between columns.
 * @param data The 2D string array
 * @param gapSize The length of the gap between columns, defaults to 1
 * @param rowPrefix A string to start each row with, defaults to an empty string.
 */
export function generateTextGrid(data: String[][], gapSize: number = 1, rowPrefix: string = '') {
    let newStringArray: String[][] = [];
    let formattedArray: String[] = [];
    let rowCount = data.length;
    let columnCount = data[0].length;
    let longestInColumn: number[] = new Array(columnCount).fill(0); //Tracks the longest element found in each column
    
    //getting the longest element of each column
    for (let i=0; i < rowCount; i++) {
        for (let j=0; j < columnCount; j++) {
            if (data[i][j].length > longestInColumn[j]) {
                longestInColumn[j] = data[i][j].length;
            }
        }
    }

    //Begin padding all the strings
    //TODO: Check for built in array copy function
    for (let i=0; i < rowCount; i++) {
        newStringArray[i] = []
        for (let j=0; j < columnCount; j++) {
            newStringArray[i][j] = data[i][j];  //Copy the string in to begin with
            if (j != columnCount-1) {   //The last element in the row doesn't need padding at the end
                newStringArray[i][j] = newStringArray[i][j].padEnd(longestInColumn[j]+gapSize, ' ');
            }
        }
        //Finally build the formatted 1D array, row by row
        formattedArray[i] = rowPrefix + newStringArray[i].join('');
    }
    //console.log("Formatted:\n" + formattedArray.join('\n'));
    return formattedArray;
}

/**
 * Parses a YAML format file at specified path to a Javascript Object and returns it. 
 * 
 * Synchronous/blocking, so avoid calling this on a main thread except for initialization tasks
 * @param filePath string containing a path to the YAML file
 * @returns Parsed object, returns null if parse fails
 */
export function getYAMLObj(filePath: string): any {
    let parsedObj = null;
    try {
        parsedObj = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));
    }
    catch (e) {
        console.log(`Failed to parse YAML file at [${filePath}], error: ${e}`);
    }
    return parsedObj;
}
