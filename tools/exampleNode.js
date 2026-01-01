#!/usr/bin/env node

// Example script which shows how to use FOAM with ClientBuilder from NodeJS

const SESSION_ID = '1983691b-bcf1-4619-9b5b-8303e71254c0localhost:8080';

const fs = require('node:fs');

require('../foam3/src/foam_node.js');
// foam.cwd = foam.cwd + '../../'; // for app POM
foam.cwd = foam.cwd + '/../';

foam.flags.node = true;

// Load FOAM POM
require('../pom.js');

// Use FOAM Objects
let u = foam.core.auth.User.create();
u.firstName = 'Kevin';
u.lastName  = 'Greer';
console.log(foam.json.stringify(u));

// Build the FOAM Client so we have access to all DAOs and services
const cb = foam.core.client.ClientBuilder.create({sessionID: SESSION_ID});
cb.promise.then(async client => {
  try {
    // Use a DAO
    await client.userDAO.select(function(u) {
      console.log('**** User', u.id, u.toSummary());
    });
  } catch (x) {
    console.log(x);
  }
}, err => {
  console.log('****** ERR', err);
});
