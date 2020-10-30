//Defines the structure of the data being transferred between this program and the database
/**
 * Module dependencies.
 */
'use strict';
import mongoose from 'mongoose';

//Define a schema
const Schema = mongoose.Schema;

const AssignmentSchema = new Schema({
  name: {
    type: String,
    index: true, //Indexing the name as it's what will be used to search for assignments in the user object
    trim: true
  },
  due_date: {
    //type: Date
    type: String,
    default: 'unspecified'
  }
})

const UserSchema = new Schema({
  name: {
    type: String,
    index: true, //Indexing the name as it's what will be used to search for users
    trim: true
  },
  assignments: [AssignmentSchema]
})


/**
 * Plugins
 */


/**
 * Define and compile models.
 */
var Assignment = mongoose.model('Assignment', AssignmentSchema);
var User = mongoose.model('User', UserSchema);

export {User, Assignment}