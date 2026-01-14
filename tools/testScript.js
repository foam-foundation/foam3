#!/usr/bin/env node

const SESSION_ID = '4e0b6400-494e-454f-b780-0320bf1b99d2';

require('../foam3/build/js/foam-bin-node.js');
foam.flags.node = true;

// require('../foam3/src/foam_node.js');
// foam.flags.node = true;
// require('../pom.js');

const cb = foam.core.client.ClientBuilder.create({sessionID: SESSION_ID});
cb.promise.then(async client => {
  let x = client.__subContext__;
  try {
    var tr = foam.core.test.JSTestRunner.create({testRunId: Date.now().toString()}, x);
    await tr.execute(x);
  } catch (e) {
    console.error(e);
  }
}, err => {
  console.error('cb', err);
});
