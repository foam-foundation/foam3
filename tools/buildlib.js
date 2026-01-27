/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Common library functions for use with build.js and pmake.js

const fs_   = require('fs');
const exec_ = require('child_process');
const path_ = require('path');
const readline_ = require('readline');

function adaptOrCreateArgs(X, args) {
  /**
    If listed arguments are found in X, then adapt their value
    to appropriate type if an adapter based on their class: is available.
    Otherwise, create a binding in X if argument has a factory: or value:.
  **/
  const adapt = {
    'Boolean': function (v) {
      if ( typeof v === 'boolean' ) return v;

      if ( ! v ) return false;

      var s = v.toString().trim().toLowerCase();
      return s === 'true' || s === 't' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
    }
  };

  args.forEach(a => {
    if ( X.hasOwnProperty(a.name) ) {
      if ( a.class && adapt[a.class] ) {
        X[a.name] = adapt[a.class](X[a.name]);
      }
    } else if ( a.factory ) {
      X[a.name] = a.factory();
    } else if ( a.value ) {
      X[a.name] = a.value;
    }
  });
}


function ensureDir(dir) {
  if ( ! fs_.existsSync(dir) ) {
    verbose('Creating directory', dir);
    fs_.mkdirSync(dir, {recursive: true});
    return true;
  }
  return false;
}


function writeFileIfUpdated(file, txt) {
  if ( fs_.existsSync(file) && ( fs_.readFileSync(file).toString() === txt ) )
    return false;

  fs_.writeFileSync(file, txt);
  return true;
}


function execSync(cmd, options) {
  verbose('\x1b[0;32mExecSync:',cmd,'\x1b[0;0m');
  exportEnvs();
  return exec_.execSync(cmd, options);
}


function isExcluded(pom, f, opt_disableWildcard) {
  var ex = pom.excludes;
  if ( ! ex ) return false;
  for ( var i = 0 ; i < ex.length ; i++ ) {
    var p = ex[i];
    if ( p.endsWith('*') && ! opt_disableWildcard ) p = p.substring(0, p.length-1);

    if ( f.endsWith(p) || ( f.endsWith('.js') && f.substring(0, f.length-3).endsWith(p) ) ) {
      return true;
    }
  }

  return false;
}


function copyDir(src, dst) {
  /** Recursively copy a directory. **/
  ensureDir(dst);
  fs_.readdirSync(src).forEach(f => {
    var srcPath = path_.join(src, f);
    var dstPath = path_.join(dst, f);

    if ( fs_.lstatSync(srcPath).isDirectory() )
      copyDir(srcPath, dstPath);
    else
      copyFile(srcPath, dstPath);
  });
}


function addBuildEnv(key, doc, val) {
  Object.defineProperty(globalThis, key, {
    get: function()  { return typeof val === 'function' ? val() : val; },
    set: function(v) { val = v; }
  });
  if ( val ) {
    globalThis[key] = val;
  }
  if ( ! globalThis.ENVS[key] ) {
    globalThis.ENVS[key] = [doc, val];
  }
}

function buildEnv(m) {
  Object.keys(m).forEach(k => {
    let [doc, val] = m[k];
    addBuildEnv.bind(this, k, doc, val)();
  });
}

function createOption() {
  var name, opt, gnuopt, env, desc, def, f;
  if ( arguments.length == 7 ) {
    name = arguments[0];
    opt = arguments[1];
    gnuopt = arguments[2];
    env = arguments[3];
    desc = arguments[4];
    def = arguments[5];
    f = arguments[6];
  } else {
    var msg = 'createOption() expecting 7 arguments';
    Object.keys(arguments).forEach(key => {
      msg += key +': ' + arguments[key] + '\n';
    });
    error(msg);
  }
  var option = {
    name: name,
    opt: opt,
    gnuopt: gnuopt,
    env: env,
    desc: desc,
    def: def,
    f: f
  };
  return option;
}

function addOptions(options, existing = {}) {
  Object.keys(options).forEach(key => {
    var opt;
    if ( existing[key] ) {
      warning(`[Tooling] ignoring duplicate option '${key}'`);
    } else {
      var args = options[key];
      args.unshift(key);
      opt = createOption(...args);
      existing[key] = opt;
    }
    opt = existing[key];
    let env = opt.env;
    if ( env && ! globalThis[env] )
      addBuildEnv(env, opt.desc, opt.def);
  });
  return existing;
}


function emptyDir(dir) {
  emptyDir_(dir);
  ensureDir(dir);
}
// If symbolic link, remove directory contents,
// else remove and recreate directory.
function emptyDir_(dir) {
  if ( ! fs_.existsSync(dir) ) return;
  if ( fs_.lstatSync(dir).isSymbolicLink() ) {
    fs_.readdirSync(dir).forEach(f => {
      emptyDir_(path_.join(dir, f));
    });
  } else if ( fs_.lstatSync(dir).isDirectory() ) {
    fs_.rmSync(dir, {recursive: true, force: true});
  } else {
    fs_.rmSync(dir);
  }
}


function rmdir(dir) {
  if ( fs_.existsSync(dir) && fs_.lstatSync(dir).isDirectory() ) {
    fs_.rmSync(dir, {recursive: true, force: true});
  }
}


function rmfile(file) {
  if ( fs_.existsSync(file) && fs_.lstatSync(file).isFile() ) {
    fs_.rmSync(file, {force: true});
  }
}


function copyFile(src, dst) {
  fs_.copyFileSync(src, dst);
}


function spawn(cmd, args, options) {
  exportEnvs();
  return exec_.spawn(cmd, args, options);
}

function exportEnv(name, value) {
  verbose(`export ${name}="${value}"`);
  process.env[name] = value;
}


function exportEnvs() {
  /** Export environment variables. **/
  Object.keys(globalThis.ENVS).forEach(k => {
    var v = globalThis[k];
    exportEnv(k, v);
  });
}


function exec(cmd) {
  verbose('\x1b[0;32mExec:', cmd, '\x1b[0;0m');
  // return execSync(cmd, { stdio: 'inherit' });

  exportEnvs();
  return exec_.exec(cmd, (error, stdout, stderr) => {
    if (error) this.error(error);
  });
}

function comma(list, value) {
  return list ? list + ',' + value : value;
}

// TOOD: test for true, y, yes, ... and false, no,...
function bool(val) {
  let v = String(val).toLowerCase();
  if ( v === 'true' ||
       v === 'y' ||
       v === 'yes' ) {
    return true;
  }
  if ( v === 'false' ||
       v === 'n' ||
       v === 'no' ) {
    return false;
  }
  this.error(`[buildlib] bool(${val} unsuported)`);
  return false;
}


// Normal console.log messages, but can be silenced
function log(...args) {
  if ( SILENT ) return;
  let msg = args.join(' ');
  console.log(msg);
}

function info(...args) {
  if ( SILENT ) return;
  let msg = args.join(' ');
  console.log('\x1b[0;32mINFO ::', msg, '\x1b[0;0m');
  // green: 32m
  // blue: 34m - too dark on black background
  // magenta: 35m
  // cyan: 36m - may be too light on white background
}

function verbose(...args) {
  if ( globalThis['VERBOSE'] ) {
    console.log(args);
  }
}

function warning(...args) {
  if ( SILENT ) return;
  let msg = args.join(' ');
  console.log('\x1b[0;35mWARNING ::', msg, '\x1b[0;0m');
  // yellow: 33m - too light for white background
  // magenta: 35m - works well for both light and dark backgrounds
}

function error(...args) {
  let msg = args.join(' ');
  console.log('\x1b[0;31mERROR ::', msg, '\x1b[0;0m');
  process.exit(1);
}

function hyphenate(str) {
  return str.replace(/([a-z])([^0-9a-z_])/g, '$1-$2').replace(/\s/g,'').toLowerCase();
}
// Build flag string with global and argument flags
function flag(flgs) {
  var verbose = globalThis['VERBOSE'];
  var f = verbose ? 'verbose' : '';

  if ( globalThis['FLAGS'] )
    f = ( f ? f + ',' : '' ) + FLAGS;

  if ( flgs )
    f = ( f ? f + ',' : '' ) + flgs;

  return f;
}

function findTask(tasks, t) {
  var result = null;
  Object.keys(tasks).forEach(key => {
    let ts = tasks[key];
    if ( ts ) {
      let task = ts[0];
      if ( t === task.name ||
           t === task.opt ||
           t === task.gnuopt ) {
        result = task;
        return;
      }
    }
  });
  return result;
}

function findSimilarTasks(tasks, t) {
  var similar = [];
  if ( ! t ) return similar;

  Object.keys(tasks).forEach(key => {
    let ts = tasks[key];
    if ( ts ) {
      let task = ts[0]; // first will do
      var gnu = task.gnuopt;
      gnu = gnu.replaceAll("-","").toLowerCase();
      let target = t.replaceAll("-","").toLowerCase();
      if ( gnu.includes(target) ||
           key.toLowerCase().includes(target) ) {
        similar.push(task);
        // TODO: add column of common mismatches.
      }
    }
  });
  return similar;
}

function findOption(options, o) {
  var result = null;
  Object.keys(options).forEach(key => {
    let option = options[key];
    if ( o === option.name ||
         o === option.opt ||
         o === option.gnuopt ||
         o === option.env ) {
      result = option;
      return;
    }
  });
  return result;
}

function findSimilarOptions(options, o) {
  var similar = [];
  if ( ! o ) return similar;

  Object.keys(options).forEach(key => {
    let option = options[key];
    var gnu = option.gnuopt;
    gnu = gnu.replaceAll("-","").toLowerCase();
    let target = o.replaceAll("-","").toLowerCase();
    if ( gnu.includes(target) ||
         key.toLowerCase().includes(target) ) {
      similar.push(option);
      // TODO: add 6 column of common mismatches.
    }
  });
  return similar;
}

function processToolingArgs(options) {
  const args = process.argv.slice(2);
  for ( var i = 0 ; i < args.length ; i++ ) {
    var arg = args[0];
    if ( arg.startsWith('--') ) {
      var a = arg.substring(2);
      var option = findOption(options, a);
      if ( option && option.f ) {
        option.f.bind(this, arg.substring(j+1))();
        if ( option.key === 'toolingPoms' ) {
          break;
        }
      } else {
        continue;
      }
    } else if ( arg.startsWith('-') ) {
      for ( var j = 1 ; j < arg.length ; j++ ) {
        a = arg.charAt(j);
        option = findOption(options, a);
        if ( option && option.f ) {
          option.f.bind(this, arg.substring(j+1))();
          if ( option.key === 'toolingPoms' ) {
            break;
          }
        } else {
          break;
        }
      }
    }
  }
}

function processBuildArgs(options, help) {
  const args = process.argv.slice(2);
  for ( var i = 0 ; i < args.length ; i++ ) {
    var arg = args[i];
    if ( arg.startsWith('--') ||
         ! arg.startsWith('--') &&
         ! arg.startsWith('-') ) {
      if ( arg.startsWith('--') ) {
        arg = arg.substring(2);
      }
      // support --task1,task, --task:arg1,arg2
      let as = arg.includes(':') ? arg.split() : arg.split(',');
      for ( var k = 0; k < as.length; k++ ) {
        arg = as[k];
        var [opt, val] = arg.split(':');
        let option = findOption(options, opt);
        if ( option ) {
          option.f.bind(this, val)();
        } else {
          options['tasks'].f.bind(this, arg)();
        }
      }
    } else if ( arg.startsWith('-') ) {
      for ( var j = 1 ; j < arg.length ; j++ ) {
        var a = arg.charAt(j);
        if ( a === '?' )
          a = 'h';
        var option = findOption(options, a);
        if ( option ) {
          if ( a >= 'A' && a <= 'Z' ) {
            option.f.bind(this, arg.substring(j+1))();
            break;
          } else {
            option.f.bind(this, null)();
          }
        } else {
          help && help(a, 'Unknown argument:') ||
            error('Unknown argument:', a);
        }
      }
    } else {
      help && help(arg, 'Unknown argument:') ||
        error('Unknown argument:', a);
    }
  }
}


exports.adaptOrCreateArgs     = adaptOrCreateArgs;
exports.addOptions            = addOptions;
exports.bool                  = bool;
exports.buildEnv              = buildEnv;
exports.comma                 = comma;
exports.copyDir               = copyDir;
exports.copyFile              = copyFile;
exports.emptyDir              = emptyDir;
exports.ensureDir             = ensureDir;
exports.error                 = error;
exports.exec                  = exec;
exports.execSync              = execSync;
exports.exportEnvs            = exportEnvs;
exports.findTask              = findTask;
exports.findOption            = findOption;
exports.findSimilarOptions    = findSimilarOptions;
exports.findSimilarTasks      = findSimilarTasks;
exports.flag                  = flag;
exports.hyphenate             = hyphenate;
exports.info                  = info;
exports.isExcluded            = isExcluded;
exports.log                   = log;
exports.processBuildArgs      = processBuildArgs;
exports.processToolingArgs    = processToolingArgs;
exports.rmdir                 = rmdir;
exports.rmfile                = rmfile;
exports.warning               = warning;
exports.spawn                 = spawn;
exports.writeFileIfUpdated    = writeFileIfUpdated;
exports.verbose               = verbose;
