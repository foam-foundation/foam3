#!/usr/bin/env node

// Example script which shows how to use FOAM with ClientBuilder from NodeJS

const SESSION_ID = '1983691b-bcf1-4619-9b5b-8303e71254c0localhost:8080';
// const SESSION_ID = '4e0b6400-494e-454f-b780-0320bf1b99d2';

const fs = require('node:fs');

// Load FOAM
require('../foam3/build/js/foam-bin-node.js');

foam.flags.node = true;

// foam.cwd = foam.cwd + '../../'; // for app POM
foam.cwd = foam.cwd + '/../';

// Use FOAM Objects
let u = foam.core.auth.User.create();
u.firstName = 'Kevin';
u.lastName  = 'Greer';
console.log(foam.json.stringify(u));

// Build the FOAM Client so we have access to all DAOs and services
let cb = foam.core.client.ClientBuilder.create({sessionID: SESSION_ID});
cb.promise.then(async client => {
  let x = client.__subContext__;
  try {
    // Use a DAO
    await x.userDAO.select(function(u) {
      console.log('**** User', u.id, u.toSummary());
    });
  } catch (e) {
    console.log(e);
  }
}, err => {
  console.log('****** ERR', err);
});
