//This module controls access to the various databases. Defined as a class so it can be instantiated more than once, for access to more than one database
import mongoose from 'mongoose';   //Mongoose libary is used to access MongoDB databases.
import creds = require("./config/creds.json") //The contents of this variable should NEVER be visible to users.
import MongoDB_Schemas = require("./schemas_mongoDB");


class DBManager {
    DBType: string;   //Determines the database being connected to. mongoDB for now
    connection: mongoose.Connection;    //Points to the mongoDB connection instance

    constructor(databaseType = "mongoDB") {
        this.DBType = databaseType;
        let cluster = "cluster0";
        let DBName = 'bamboo_bot';
        //let connectionURL = `mongodb+srv://${creds.Database_username}:${creds.Database_password}@${cluster}.88lzo.azure.mongodb.net/${DBName}?retryWrites=true&w=majority`;
        let connectionURL = `mongodb+srv://bamboo_bot:teammars@cluster0.88lzo.azure.mongodb.net/bamboo_bot?retryWrites=true&w=majority`;
        mongoose.connect(connectionURL, { useNewUrlParser: true , useUnifiedTopology: true}) //Connect to DB
        .then(() => console.log("Database connected."))
        .catch(error => console.error("Failed to connect to database " + error));   
        this.connection = mongoose.connection;
        this.connection.on('error', console.error.bind(console, 'MongoDB connection error:')); //Bind any connection error events to the console error output
    }

    //return an array of all the names of users in the database
    public async getUsers(): Promise<string[]> {
        let users: string[] = [];
        let userList: any = await MongoDB_Schemas.User.find({}, 'name');
        for (var i=0; i < userList.length; i++) {
            users.push(userList[i].name);
        }
        return users;
    }

    //return an object array that contains the name of each user and the number of assignments they have
    //The name is a string in the 'name' field and the # of assignments is an integer in the 'assignment_count' field
    public async getOverview(): Promise<{name: string; assignment_count: number}[]> {
        let users: {name: string; assignment_count: number}[] = [];
        let userList: any = await MongoDB_Schemas.User.find({}, 'name').populate('assignments').lean();
        for (var i=0; i < userList.length; i++) {
            var newObj = {name: userList[i].name, assignment_count: userList[i].assignments.length};    //Creating an object to hold the user info
            users[i] = newObj;   //Adding the new object to the return array
        }
        return users;
    }

    //Adds a user to the database.
    public async addUser(name: string) {
        if (await this.userExists(name) == true) {
            console.log("User already in database.");
            return;
        }
        let newUser = new MongoDB_Schemas.User({name: name}); //Creating a new user model instance with the supplied name
        // Save the new model instance, passing a callback
        await newUser.save(function (err) {
            if (err) console.log(err);
            // saved!
        });
    }

    //Delete users with matching name in the database, returns number of users deleted.
    public async deleteUser(name: string): Promise<Number> {      
        if (await this.userExists(name) == false) {
            console.log(name +" is not in database.");
            return;
        }  
        let query = MongoDB_Schemas.User.find({name: name});
        query.select('assignments');    
        query.populate('assignments');
        query.lean();   //This tells the query to return a javascript object
        await query.exec((err, res: any) => {
            res = res[0]; //Only need the first element of the returned array
            if (err) {
                return console.log(err);
            }
            for (let a of res.assignments) {
                console.log("Deleting assignment with ID" + a._id);
                MongoDB_Schemas.Assignment.findByIdAndRemove(a._id).exec(); //Without a callback supplied it returns a query, so need to chain in an exec()
            }
        });
        const res = await MongoDB_Schemas.User.deleteOne({name: name}).exec();
        return res.deletedCount;
    }

    //Returns a list of all the assignments for the specified user
    //TODO: Clean this up, way too many return statements
    public async getAssignments(name: string): Promise<string[]> {
        let returnArray: string[] = [];
        if (await this.userExists(name) == false) {
            returnArray[0] = name + " isn't in the database.";
            console.log(returnArray[0]);
            return returnArray;
        }
        
        //building a query
        let query = MongoDB_Schemas.User.find({name: name});
        query.select('assignments');   
        query.populate('assignments');
        query.sort({"assignments.due_date" : 1}); //Want it sorted by due date
        query.lean();   //This tells the query to return a javascript object
        let res: any = await query.exec();
        res = res[0]; //Only need the first element of the returned array
            console.log(res);
            if (res.assignments == undefined) { //No assignments 
                console.log(`No assignments for ${name}`); 
                return returnArray;
            }
            for (let a of res.assignments) {
                let myString = `Assignment: ${a.name} is due by ${a.due_date}`;
                returnArray.push(myString);
            }
        return returnArray;
    }

    //Adds an assignment for the specified user
    public async addAssignment(name: string, assignment: string, due_date: string) {

        if (await this.userExists(name) == false) {
            console.log("User doesn't exist, assignment not added.");
            return;
        }
        var newAssignment = new MongoDB_Schemas.Assignment({name: assignment, due_date: due_date});
        newAssignment.save();
        MongoDB_Schemas.User.updateOne({name: name},{$push: {assignments: [newAssignment]}}, (err, res) => {
            if (err) return console.error("Failed to add assignment " + err);
        });
    }

    //Just to check if a user exists on the database already or not
    private async userExists(name: string): Promise<Boolean> {
        var targetUser = await MongoDB_Schemas.User.find({name: name});
        if (targetUser.length == 0) {
            console.log("Couldn't find user named " + name);
            return false;
        }
        else {
            return true;
        }
    }
}
export = DBManager;