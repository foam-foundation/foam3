/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

const { warning } = require('./buildlib');
const envs = {};
var rootPOM;

exports.description = `Capture POM values for environment variables or options,
and translate top level POM keys to build variables ( ex: pom.name -> appName )
and provide backwards compatibility for legacy poms still using
pom keys such as 'java' to set the javaRelease`;

exports.init = function() {
  this.verbose('[Env] init');

  X.envs && X.envs.split(',').forEach(e => {
    // example: APP_NAME=name
    var kv = e.split('=');
    // example: ['name'] = 'APP_NAME'
    envs[kv[1]] = kv[0];
    this.verbose(`[Env] init ${kv[1]} = ${kv[0]}`);
  });
};

exports.visitPOM = function(pom) {
  if ( ! rootPOM ) rootPOM = pom;
  pom.envs && Object.keys(pom.envs).forEach(e => {
    this.verbose(`[Env] pom ${pom.name} testing ${e}, currently envs[${e}]: ${envs[e]}`);
    if ( envs[e] ) { // envs['APP_NAME']
      this.verbose(`[Env] pom ${pom.name} ignoring change of ${e} from ${envs[e]} to ${pom.envs[e]}`);
      return;
    }
    this.verbose(`[Env] pom ${pom.name} recording ${e} = ${pom.envs[e]}`);
    envs[e] = pom.envs[e];
  });

  Object.keys(envs).forEach(k => {
    // example: k = 'name', envs[k] = APP_NAME,
    if ( envs[envs[k]] ) {
      delete envs[k];
      return;
    }

    this.verbose(`[Env] pom ${pom.name} testing ${k}, currently pom[${k}]: ${pom[k]}`);
    var v = pom[k];
    if ( v ) {
      this.verbose(`[Env] pom ${pom.name} recording ${envs[k]} = ${v}`);
      // example: envs['APP_NAME'] = 'foam'
      envs[envs[k]] = v;
      delete envs[k];
    }
  });
};

exports.end = function() {
  // clean up and report any variables not set
  X.envs && X.envs.split(',').forEach(e => {
    var kv = e.split('=');
    if ( ! envs[kv[0]] ) {
      // warning(`[Env] ${kv[0]} not set`);
      delete envs[kv[1]];
    }
  });
  // Determining app name is a special case.  Historically, this was
  // taken from the root pom.name, but this makes it difficult to
  // override in other configuration poms.
  if ( rootPOM ) {
    if ( ! envs['APP_NAME'] ||
         ! envs['appName'] ||
         ! envs['app-name'] ) {
      this.verbose(`[Env] setting APP_NAME to root pom name: ${rootPOM.name}`);
      envs['APP_NAME'] = rootPOM.name;
    }
    if ( rootPOM.clientBundles ) {
      globalThis.CLIENT_BUNDLES = rootPOM.clientBundles;
    }
  }
};

exports.envs = envs;
