//require('app-module-path').addPath(__dirname); //Makes managing file paths MUCH easier, https://github.com/patrick-steele-idem/app-module-path-node
import Discord from "discord.js";  //imports Discord client class TYPESCRIPT SPECIFIC https://www.typescriptlang.org/docs/handbook/modules.html
import fs from 'fs';
import path from 'path';
import Util = require('./MyDiscordUtils') ; //importing frequently used functions 
import DBManager = require("./DBManager");

const client = new Discord.Client();    //initializes discord.js client object
var owner: Discord.User = undefined;   //to hold discord user object for bot owner, user ID hardcoded into config.json for now.
var DB: DBManager;  

const config = Util.getYAMLObj(path.join(__dirname,'..','config','config-admin.yaml'));    //Load the Bot configuration
const creds = Util.getYAMLObj(path.join(__dirname,'..','config','creds.yaml'));    //Load in credentials //Content of this variable should NEVER be exposed to users
connectionManager("login"); //initial discord bot login

client.on('ready', () => {  //activates when bot starts up, and logs its name to the terminal
    client.fetchUser(config.owner)  //finds specified bot owner by user ID
        .then(user => owner = user) //stores desired bot owner as a discord user object into the owner variable
        .then(user => console.log("Owner set to " + user.username))
        .then(user => console.log("Active in " + client.guilds.size + " servers."))
        .catch((error: string) => console.log("Could not locate specified bot owner due to error " + error));
    console.log(`Logged in as ${client.user.tag}!`);
    
    console.time('invitelinkclient');
    client.generateInvite()
        .then(link => {
            console.log("Invite link: " + link);
            console.timeEnd('invitelinkclient');    //Log the delay when getting invite link from Discord API 
        });

    //Post-login initialization tasks here
    DB = new DBManager();
    setActivity();

});


client.on('reconnecting', () => { //Emitted when client tries to auto reconnect.
    console.log(`Client lost WebSocket connection to Discord. Auto-reconnecting...`);
});

let resumeCount = 0;
client.on('resume', (replays) => {
    console.log(`WebSocket connection resumed, ${replays} replays. Total resumes this session: [${++resumeCount}]`);
});

// Emitted for general warnings. 
client.on("warn", (info) => {
    console.log(`Discord.js warning: ${info}`);
});

client.on('disconnect', () => { //Emitted when the client's WebSocket disconnects and will no longer attempt to reconnect.
    console.log("Bot could not connect to Discord API. Reconnecting at next opportunity.");
    let attempts: number = 0;
    setInterval(() => connectionManager("refresh"), (attempts < 60 ? ++attempts : attempts));  //each attempt increases the delay on the next one, up to a limit
});

//TODO: Separate each block of command logic into it's own function, with message object passed as parameter
//event listener for messages
client.on('message', async (msg: Discord.Message) => {  

    //Only reads to messages in a testing server, or from the specified owner.
    if ( msg.author === owner || config.testingServers.some(testingServerID => msg.guild.id === testingServerID) ) { 
        if (!msg.guild || msg.author.bot || msg.content.charAt(0) !== config.prefix)  {
            return; // Ignore messages that aren't from a guild, are from a bot, or don't start with the specified prefix 
        }

        //Separate the command name from the arguments
        const args = msg.content.slice(config.prefix.length).trim().replace(/  +/g, ' ').split(" ");    //Replace all spaces with just 1 blank space, then split on that token
        const command = args.shift().toLowerCase().trim(); //shift() returns and removes first element of array, so we get the command while also removing it from the args
        let active = true;

        if (command === 'ping' && active) {   //fires if message is ping
            const m = await msg.reply("Ping?") as Discord.Message;
            m.edit("Pong! Latency is " + (m.createdTimestamp - msg.createdTimestamp) 
                + "ms. API Latency is " + Math.round(client.ping));
        }

        //Echo command, used to have the bot send a message in a specified channel.
        if (command === "echo" && active) {
            if (args.length >= 2) {
                const targetChannel = msg.guild.channels.find(ch => ch.name === args[0]) as Discord.TextChannel;   //find a channel with name matching the first arg. 
                if (targetChannel) {    //if desired channel was found/exists
                    targetChannel.send(args.slice(1, args.length).join(" ")); //Reconnects arguments to form original message. Test for handling of multiple spaces. Consider storing original string.
                }
                else {
                    msg.reply(`Specified channel '${args[0]}' not found. Check that the channel exists and I have access to it.`);
                }
            }
            else {
                msg.reply("You can use this command to have me send a message in a specified channel. Just specify the channel name in the first argument and follow with your message.");
            } 
        }

        //Prints info about the channel this command is called in.
        if (command === "channelinfo" && active) {   
            const channel = msg.channel as Discord.TextChannel; //Casts guild channel object as a text channel https://acdcjunior.github.io/typescript-cast-object-to-other-type-or-instanceof.html
            var info = [];

            //TODO: Try to add an  @mention to the user
            info.push('Channel name:\t\t' + channel.name);
            info.push('Created at:\t\t' + channel.createdAt);
            info.push('Creation timestamp:\t\t' + channel.createdTimestamp);
            info.push('Channel ID:\t\t' + channel.id);
            info.push("Channel type:\t\t" + channel.type);
            channel.send( Util.codeblockWrap(info.join('\n')) );
        }

        //!help command, prints content of readme.txt
        if (command === "help" || command === "readme") {
            commandHelp(msg);
        }
        
        //!invitelink command, helps invite bot to new servers
        if (command === "invitelink" && active) {
            commandInviteLink(msg);
        }

        //Reconnects the discord bot to the API server
        //TODO: Needs testing
        if (command === "refresh" && active) {
            client.destroy()
            //.then (() =>  client.login(config.token)) //Should not be needed with auto-reconnect functionality enabled.
            .then (() => msg.reply("Refreshing connection to Discord API!"))
            .catch(error => msg.reply("Could not refresh, error " + error));
        }

        //////DATABASE COMMANDS BELOW//////
        const channel = msg.channel as Discord.TextChannel; //Casts guild channel object as a text channel
        if (command === "getusers" && active) {
            let returnString = await DB.getUsers();
            if (returnString.length == 0) returnString[0] = "No users in the database.";
            channel.send( Util.codeblockWrap(returnString.join('\n')) );
        }
        if (command === "getoverview" && active) {
            let userData = await DB.getOverview();  //Loads an array containing user objects to the userData variable
            if (userData.length == 0) {
                channel.send("No users in the database.");
            }
            else {
                let formattedString = "";
                let formattingArray: string[][] = [];    //Need to format the recieved data into a more human readable format. Create a 2D string array of the data, will be sent to a util function for formatting
                for (let i=0; i < userData.length; i++) {
                    formattingArray[i] = [];
                    formattingArray[i][0] = userData[i].name;
                    formattingArray[i][1] = `[${userData[i].assignment_count}]`;
                }
                formattingArray.unshift(['NAME', 'ASSIGNMENTS'],['----','-----------',]);   //Adding column headers. unshift adds to the front of the array.
                formattedString = Util.generateTextGrid(formattingArray, 4).join('\n');
                channel.send( Util.codeblockWrap(formattedString, 'SQL') );
            }
        }
        if (command === "adduser" && active) {
            if (args.length < 1) channel.send("Not enough arguments.");
            else await DB.addUser(args[0]);
        }
        if (command === "deleteuser" && active) {
            if (args.length < 1) channel.send("Not enough arguments.");
            else await DB.deleteUser(args[0]);
        }
        if (command === "getassignments" && active) {
            if (args.length < 1) {
                channel.send("Not enough arguments.");
            }
            else {
                let responseArray: String[] = await DB.getAssignments(args[0]);
                if (responseArray.length == 0) channel.send(Util.codeblockWrap(`${args[0]} has no assignments.`));
                else channel.send(Util.codeblockWrap(responseArray.join('\n')));
            }
        }
        if (command === "addassignment" && active) {
            if (args.length < 3) channel.send("Not enough arguments.");
            else await DB.addAssignment(args[0], args[1], args[2]);
        }
        if (command === "deleteassignment" && active) {
            if (args.length < 1) channel.send("Not enough arguments.");
            else channel.send("Not yet implemented.");
        }
    }
});

/**
 * Generates a string with a basic invite link for the bot. Although redundant it will remain for now as it completes in < 1 ms whereas
 * the Discord.js method runs asynchronously and takes 80ms to resolve.
 * TODO: Work out starting permissions
 */ 
function generateInviteLink() {
    return ('Invite link: https://discordapp.com/oauth2/authorize?client_id=' + config.Discord_clientID + '&scope=bot');
}

//Function that is called when the !help command is seen. Prepares a response that includes
//the readme.txt contents, read from file as a stream.
//In testing, found this function no longer worked properly when the readme.txt became longer than 2000 characters. For
//now, fixing this by splitting the readme file into sections and sending each one in a separate message.
//Help from https://stackabuse.com/read-files-with-node-js/.
function commandHelp(messageObject: Discord.Message, filePath = "./doc/readme.txt") {
    const readStream = fs.createReadStream(filePath); //initializes a file read stream on the readme file
    var data = "";
    var responseArray = []; //Stores messages to be sent in order on the server

    readStream.on('data', chunk => data += chunk)   
        .on('end', () => {
            responseArray = Util.splitByHeaders(data, "____");
            for (let i = 0; i < responseArray.length; i++) { //reformats each message such that it appears in a neat code block on Discord.
                responseArray[i] = responseArray[i].replace(/(____)/gm, '');  //removes the header formatting from the message TODO: Consider doing this within the splitByHeaders function?
                //responseArray[i] = "```diff\n+" + responseArray[i] + "```";     //Old way of wrapping in code block, restore if problems arise
                responseArray[i] = Util.codeblockWrap(responseArray[i], "diff");
            }  
            messageObject.channel.send("Hey " + messageObject.author + ", my helpfile is below!")
                .catch(error => messageObject.reply("Could not post help file due to error : " + error));
            while (responseArray.length !== 0) {
                let helpSection: string = responseArray.shift();
                messageObject.channel.send(helpSection)
                .catch(error => console.error(error));
            }
        });
}

//Sends caller an invite link to the bot. For now only responds to bot owner.
function commandInviteLink(messageObject) { //Cannot type this as a Discord.Message because following conditional marked as error, not treating a User as a possible snowflake.
    if (messageObject.author === config.owner) {
        messageObject.reply(generateInviteLink())
            .catch(error => console.log("Couldn't send invite link, error " + error));
    }
    else {
        messageObject.reply("You aren't authorized to do that.");
    }
}

//Sets activity message for bot. Abstracted here so calling without parameter will set to a default.
function setActivity(activityString:string = undefined) {
    if (activityString === undefined) {
        client.user.setActivity(config.BOT_NAME_VERSION + " | " + config.prefix + "help for more info", { type: 'PLAYING' })
            .then(presence => console.log(`Activity set to ${presence.game ? presence.game.name : 'none'}`))
            .catch(console.error);
    }
}

//Manages the bot's connection to the Discord API. Meant to run in the background. TODO: Testing, move to new class
function connectionManager(param: string) { 
    if (param === "login") {
        client.login(creds.Discord_token)  //login into the bot
            .then(() => console.log("Established connection to Discord API."))
            .catch(error => console.log("Failed to connect to Discord API, error: " + error));
    }
    if (param === "refresh") {
        if (client.status === 0) {    //If the client has no connection to discord API
            client.login(creds.Discord_token)  //login into the bot
            .then(() => console.log("Established connection to Discord API."))
            .catch(error => console.log("Failed to connect to Discord API, error: " + error));
        }
    }
    return false;   //Since it's passed to setInterval() as a callback it needs to return a bool, false so it never stops, risky TODO: consider wrapping in bool function
}
export { client as DiscordClient}; 