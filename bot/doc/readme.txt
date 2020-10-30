____-ABOUT:____

Bamboo Bot 
Only responds to the owner unless it's in a testing server.

Commands arguments follow the command name and are generally space-separated when specifying more than one parameter. Parameters are inferred in order and parameters starting with ? are optional.

____-GENERAL_COMMANDS:____

!help
Posts the contents of this file to the channel where it is called as a reply to the calling user.

!ping
Checks the Discord API latency and is helpful for testing.

!echo [channel] [message]
Have the bot send a message in another channel. After the command, enter a #channel mention and then write your message.

!channelinfo
Prints info about the channel this is called in.

!invitelink
Posts an invite link to the bot.

!refresh
Restarts the connection to the Discord API. This does not restart the bot itself and may not fix all issues.

____-BAMBOO_COMMANDS:____

!getUsers
Prints a list of all users in the Bamboo database

!getOverview
Prints the names of all users and the number of assignments each one has

!addUser [user]
Adds a user to the bamboo database

!deleteUser [user]
Removes a user from the bamboo database. This will delete all their information as well

!getAssignments [user]
Get all the assignments linked to a specified user in database

!addAssignment [user] [assignment_name] [due_date]
Add an assignment for a specific user into the database. Due date should be in dd/mm/yyyy format

!deleteAssignment [user] [assignment_name]
Deletes assignment with corresponding name from user in database

____-CREDITS:____
The Discord.js team for their excellent API interface and online documentation. https://discord.js.org/#/