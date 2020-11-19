'use strict';
import path from 'path';
import http from 'http';
import https from 'https';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './bambooAPI.json';
import express from "express";
import {DBClient} from "../index";
import fs from 'fs';

const privateKey  = fs.readFileSync(path.join(__dirname, '../../security/certificates/key.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, '../../security/certificates/cert.pem'), 'utf8');
const credentials = {key: privateKey, cert: certificate};

export class APIServer {
    serverPort: number;
    app = express();
    active = false;
    http_server: http.Server;
    https_server: https.Server;

    constructor() {
        this.serverPort = 3333;
        this.app.use(express.json());   //Need to add this middleware to parse JSON in request bodies //https://masteringjs.io/tutorials/express/body
        this.app.get('/', function (req, res) { //Redirect requests to the base address to docs
            res.redirect('/docs');
        });
        //Setting up the routes defined by the API in the express server [V1]//
        this.app.get('/docs', (req, res) => {   //Base path for the rapiddoc API documentation
            res.sendFile(path.join(__dirname, "../../html/rapidoc.html"));
        });
        this.app.get('/bambooapi.pdf', (req, res) => {   //Generate a pdf of the live API spec
            res.sendFile(path.join(__dirname, "../../html/docgen.html"));
        });
        this.app.get('/bambooapi.json', (req, res) => {   //So the rapiddoc HTML can find the source JSON
            res.sendFile(path.join(__dirname, "./bambooAPI.json"));
        });
        
        this.app.use('/v1', (req, res, next) => {   //Adding API key validation for POST/PUT/DELETE methods on database endpoints to middlware chain to ensure only admins have write access to DB
            let access_level = getApiLevel(req.header('api_key'));
            //console.log("Access level " + access_level);
            let sent: boolean = false;
            if (access_level >= 2)  {// Don't give ANY access to database
            res.status(403).send("Authorization failed. Your api_key is missing from header or invalid on the backend.");
            sent = true;
            }
                 
            else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
                if (access_level !== 0) { //only allow admin level keys to use POST/PUT/DELETE
                    res.status(403).send("Authorization failed. Your api_key only allows for read operations on the database.")
                    sent = true;
                }
            }
            if (!sent) {
                next(); //No validation issues, continue down the middleware chain
            }
        })
        this.app.get('/v1/overview', async (req, res) => {  
            res.send(await DBClient.getOverview());
        });
        this.app.get('/v1/users', async (req, res) => {   
            res.send(await DBClient.getUsers());
        });
        this.app.post('/v1/users', async (req, res) => {
            let newUserName: string = req.body.name;
            console.log("New name parsed: " + newUserName);
            res.send(await DBClient.addUser(newUserName));
        })
        this.app.get('/v1/users/:name', async (req, res) => {
            console.log("Getting assignments for name: " + req.params.name);
            res.send(await DBClient.getAssignments(req.params.name));
        });
        this.app.post('/v1/users/:name', async (req, res) => {
            console.log("Adding assignment for name: " + req.params.name);
            console.log("Assignment body: " + JSON.stringify(req.body));
            
            res.send(await DBClient.addAssignment(req.params.name, req.body.name, req.body.due_date));
        });
        this.app.delete('/v1/users/:name', async (req, res) => {
            console.log("Deleting name: " + req.params.name);
            let deleted: Number = await DBClient.deleteUser(req.params.name);
            let responseString = deleted===undefined || deleted===0 ? "That user isn't in the database." : "Deleted " + deleted + " user(s) from the database.";
            
            res.send(responseString);
        });

    }

    public launch() {
        if (!this.active) {
            this.http_server = http.createServer(this.app); //Create the HTTP server with express app provided as middleware to native Node.js server
            this.https_server = https.createServer(credentials, this.app);  //Same as above but an HTTPS server, creds supplied

            this.http_server.listen(this.serverPort);   //Launch the HTTP server
            this.https_server.listen(this.serverPort+1);   //Launch the HTTPS server one port above the HTTP server
            console.log("HTTP Webserver started on port " + (this.serverPort));
            console.log("HTTPS Webserver started on port " + (this.serverPort+1));
        }
        this.active = true;
    }
}

/**
 * Get the API level for specified key. 
 * Returns integer representing access level. 0 is admin access. 1 is read-only access. 2 is no access.
 * Well aware that this system isn't robust in the slightest, just need a stand-in for prototyping.
 */
function getApiLevel(api_key: string): number {
    let accesslevel = 2;
    if (api_key === 'teammarsbamboobot') {
        accesslevel = 0;
    }
    if (api_key === 'testing') {
        accesslevel = 1;
    }
    return accesslevel;
}