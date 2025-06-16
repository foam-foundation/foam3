/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

const topics = {};

exports.description = 'Register POM help.';

exports.visitPOM = function(pom) {
  if ( ! pom.help ) return;

  let help = {
    name: pom.name,
    help: pom.help,
    path: pom.path
  };
  var t = topics[pom.name] || [];
  t.push(help);
  topics[pom.name] = t;
};

exports.end = function() {
  let count = Object.keys(topics).length;
  this.verbose(`[Help] Registered ${count} help topics`);
};

exports.topics = topics;
