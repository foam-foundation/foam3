#!/usr/bin/env node
/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
// Build and Deploy a FOAM Application
//
// See documentation at #flowdoc/Build
// and node build.js --help
//
// Toosls
//   tools/JSMaker.js
//     - collects and minifies .js files into a single foam-bin.js file
//     - uses the UglifyJS library to minimize the size of the packaged .js files
//   tools/JavaMaker.js
//     - generates .java files from .js models
//     - create /build/javacfiles file containing list of modified or static .java files
//     - call javac to compile files in javacfiles
//   tools/MavenMaker
//     - build pom.xml from accumulated javaDependencies
//     - call maven to update dependencies if pom.xml updated
//     - create a Maven pom.xml file with accumulated POM javaDependencies information
//   tools/JournalMaker.js
//     - copies .jrl files into /build/journals
//   tools/DocMaker.js
//     - copies .flow files into /build/documents
//
// Directory Structure (Standard/default):
//   /deployment    - deployment specific journals
//   /build
//     /src         - java source files created by genJava
//     /classes     - compiled java class files created with javac (called by genJava)
//     /classes
//       /documents
//       /images
//       /journals
//     /documents    - All .flow documents are copied here by genJava
//     /journals     - All journal.0 files created by genJava
//     /package      - Designation for .tar.gz files
//     /javacfiles   - A list of all java files to be compiled by javac, created by genJava
//     /lib          - 3rd party java .jar library files created by gradle (or maven)
//     /webroot      - jetty resource base directory for jar build
//   /opt/<pom.name>
//     /bin
//     /etc
//     /logs
//     /documents
//     /journals
//     /lib
//     /saf
//     /var
//
// TODO:
//   - should Makers be responsible for building target directories?

const { adaptOrCreateArgs, bool, buildEnv, addOptions, comma, copyDir, copyFile, emptyDir, ensureDir, exec, execSync, exportEnvs, findOption, findSimilarOptions, findTask, findSimilarTasks, flag, hyphenate, info, isExcluded, log, processBuildArgs, processToolingArgs, rmdir, rmfile, spawn, stat, warning, writeFileIfUpdated, verbose } = require('./buildlib');
const { appendFileSync, existsSync, openSync, readdirSync, readFileSync, writeFileSync } = require('fs');
const { homedir, hostname, platform}              = require('os');
const { join }                                    = require('path');
const pmake                                       = require('./pmake');

const TASK_SEPERATOR                              = ' ';

process.on('unhandledRejection', e => {
  error("ERROR: Unhandled promise rejection ", e);
});

var depth   = 1;
var running = {}; // tasks currently executing
var fired   = {}; // tasks executed. See resetTask to re-run a task
var summary = [];
let TOOLING_TASKS = {};
let POM_HELP = {}; // additional help topics provided in build

function task() {
  var name, gnuopt, desc = '', dep = [], f, pom = 'build';
  if ( arguments.length == 1 ) {
    // tasks from build poms
    f = arguments[0];
    name = f.name;
    gnuopt = hyphenate(f.name);
  } else if ( arguments.length == 3 ) {
    // tasks from build.js itself
    f = arguments[2];
    name = f.name;
    gnuopt = hyphenate(f.name);
    desc = arguments[0];
    dep = arguments[1];
  } else if ( arguments.length == 4 ) {
    f = arguments[3];
    name = f.name;
    gnuopt = arguments[0];
    desc = arguments[1];
    dep = arguments[2];
  } else if ( arguments.length == 6 ) {
    // tasks from tooling
    name = arguments[0];
    gnuopt = arguments[1];
    desc = arguments[2];
    dep = arguments[3];
    f = arguments[4];
    pom = arguments[5];
  } else {
    var msg = 'task() expecting 1, 3, 4, or 6 arguments\n';
    Object.keys(arguments).forEach(key => {
      msg += key +': ' + arguments[key] + '\n';
    });
    error(msg);
  }

  let toolingTask = {
    name: name,
    gnuopt: gnuopt,
    desc: desc,
    dep: dep,
    f: f,
    pom: pom
  };

  let toolingTasks = TOOLING_TASKS[name] || [];
  toolingTasks.push(toolingTask);
  TOOLING_TASKS[name] = toolingTasks;

  var rec   = [];
  var SUPER = globalThis[name] || function() { };
  globalThis[name] = function(...args) {
    if ( fired[name] ) return;
    fired[name] = true;

    let tasks = TOOLING_TASKS[name];
    if ( ! tasks ) {
      outputHelp(name, 'Task not found:');
    }
    if ( NOP.split(',').includes(name) ) {
      warning(`Skipping Task :: ${name}`);
      return;
    }

    running[name] = (running[name] || 0) + 1;
    if ( running[name] === 1 ) {
      summary.push(rec);
      info(`Starting Task :: ${name}`);
      var start = Date.now();
      rec[0] = ''.padEnd(2*depth) + name;
      rec[2] = start;
      depth++;
    }

    // execute same named pom tasks
    let pomTasks = POM_TASKS && POM_TASKS[name];
    if ( pomTasks ) {
      info(`  Starting POM Tasks :: ${name}`);
      if ( ! DRY_RUN ) {
        pomTasks.forEach(pomTask => {
          verbose(`    Executing POM Tasks :: ${name} (${pomTask.pom})`);
          var f = pomTask.f || pomTask;
          try {
            f.apply(Object.assign({}, EXPORTS), args);
          } catch (e) {
            error(`POM Tasks :: ${name} (${pomTask.pom})`, '\n', e);
          }
        });
      }
      verbose(`  Finished POM Tasks :: ${name}`);
    }

    tasks.every(function(task) {
      verbose(`  Execute Task :: ${name} (${task.pom})`);
      // execute task dependencies
      var dep = task.dep;
      dep && dep.forEach(d => {
        if ( d instanceof Function ) {
          d.apply(Object.assign({}, EXPORTS), args);
        } else {
          var f = globalThis[d];
          if ( f )
            f.apply(Object.assign({}, EXPORTS), args);
          else {
            if ( ! NOP.includes(d) )
              error(`Task ${name} (${task.pom}) dependency not found ${d}`);
          }
        }
      });

      // execute tasks
      if ( ! DRY_RUN || name === 'pomEvns' || name === 'all' ) {
        task.f && task.f.apply(Object.assign({ SUPER }, EXPORTS), args);
      }
      // only run first 'all'
      return name !== 'all';
    });

    running[name] -= 1;
    if ( running[name] === 0 ) {
      depth--;
      var end = Date.now();
      var dur = ((end-start)/1000).toFixed(2);
      info(`Finished Task :: ${name} in ${dur} seconds`);
      rec[1] = dur;
    }
  };
}

// Execute task by name
function execute(t, ...args) {
  // log(`execute t: ${t}, args: ${args}`);
  var f = globalThis[t];
  if ( ! f ) {
    let task = findTask(TOOLING_TASKS, t);
    if ( task ) {
      f = globalThis[task.name];
      if ( ! f && task.f ) {
        f = task.f;
      }
    }
  }
  if ( ! f ) {
    let option = findOption(OPTIONS, t);
    if ( option ) {
      f = globalThis[option.name];
      if ( ! f && option.f ) {
        f = option.f;
      }
    }
  }
  if ( f ) {
    f.apply(Object.assign({}, EXPORTS), args);
  } else {
    outputHelp(t, "Task not found:");
  }
}

// Allow a task to be run again.
function resetTask(t) {
  delete fired[t];
}

function showSummary() {
  if ( SILENT ) return;
  if ( HELP ) return;

  if ( SHOW_ENVS || VERBOSE )
    moreUsage('showEnvs');

  var s = '';
  summary.forEach(e => {
    if ( e[1] === undefined ) {
      var end = Date.now();
      var dur = ((end-e[2])/1000).toFixed(1);
      e[1] = dur;
    }
    s += e[0].padEnd(25) + ' ' + e[1].padStart(15) + 's\n';
  });
  if ( s ) {
    info('Execution Summary:\n', s);
  }
}
task('show-summary', 'Display build statistics', [], showSummary);

function quit(code) {
  showSummary();
  if ( code ) {
    console.trace();
  }
  process.exit(code);
}

function error(...args) {
  showSummary();
  let msg = args.join(' ');
  console.log('\x1b[0;31mERROR ::', msg, '\x1b[0;0m');
  process.exit(1);
}

function moreUsage(arg) {
  if ( SILENT ) return;
  let showEnvs = ( SHOW_ENVS || arg && arg === 'showEnvs' ) ? true : false;
  if ( ! showEnvs ) {
    info('Usage: build.js [OPTIONS] (see --usage for examples)');
    if( ! arg || arg === 'options' ) {
      log('\n');
      info('Options are:');
      Object.keys(OPTIONS).forEach(key => {
        let option = OPTIONS[key];
        var opts = '';
        if ( option.opt ) {
          opts = '-'+option.opt;
        }
        opts += (opts ? ', ' : '');
        opts += '--'+option.name;
        if( option.gnuopt !== key ) {
          opts += ', --'+option.gnuopt;
        }
        if ( option.env ) {
          opts += ', '+option.env;
        }
        var def = option.env && globalThis[option.env] && globalThis[option.env].toString();
        if ( ! def ) {
          def = option.def ? option.def : '';
          if ( def instanceof Function ) {
            def = def();
          }
        }
        log(''.padStart(0), opts+':', ''.padStart(41-opts.length), '\x1b[0;35m', def,'\x1b[0;0m');
        log(''.padStart(3), option.desc);
      });
    }

    if ( ! arg || arg === 'tasks' ) {
      log('\n');
      info('Tasks: (invoke with -XtaskName or --task-name)');
      var ts = Object.assign({}, TOOLING_TASKS);
      var depth = 1;
      function printTask(t) {
        if ( ! ts[t] ) return;
        delete ts[t];
        var task = findTask(TOOLING_TASKS, t);
        var dstr = '';
        var dep = [];
        if ( task ) {
          let desc = showEnvs ? '' : task.desc;
          let tasks = TOOLING_TASKS[task.name];
          tasks.forEach(task => {
            var dep2 = task.dep.filter(d => ! ts[d]); // list of dependencies which appear elsewhere in tree
            if ( dep2.length )
              dstr = comma(dstr, dep2.join(', '));
          });
          if ( dstr ) {
            dep = dstr.split(",");
            dstr = '[' + dstr + ']';
          }
          log(''.padEnd(depth*2) + t.padEnd(27-depth*2), desc, dstr);
          depth++;
          dep.forEach(printTask);
          depth--;
        }
      }
      Object.keys(ts).sort().forEach(t => {
        printTask(t);
      });
    }
  }
  if ( showEnvs ||
       ! arg ||
       arg === 'envs' ) {
    log('\n');
    if ( showEnvs ) {
      info('Environment variable report:');
    } else {
      info('Environment variables: (set with -E)');
    }
    depth = 1;

    Object.keys(ENVS).sort().forEach(k => {
      if ( NO_SHOW_ENVS[k] ) {
        // log(`moreUsage skipping ${k}`);
        return;
      }
      var [ desc, _ ] = ENVS[k];
      var v = globalThis[k];
      if ( v === null || v === undefined )
        v = '';
      else
        v = v.toString();
      log(''.padStart(0), k+':', ''.padStart(20-k.length), '\x1b[0;35m', v, '\x1b[0;0m',);
      if ( ! showEnvs && desc ) {
        log(''.padStart(3), desc);
      }
    });
  }
  log('');
  if ( ! showEnvs ) {
    info('Additional Tooling (include with -T)');
    log('  RAMDisk - create RAM disk to use as the build directory. use: -TRAMDisk');
    log('  RemoteInstall - configure remote host and install Java application. use: -TStandard,RemoteInstall,Java ...');
    log('  setup/Project - create a new FOAM project. use: -T+setup/Project ...');
    log('');
    info('See --usage for examples, and documentation #flowdoc/Build');
  }
}

// Internal environment variables of build.js and buildlib.js
var ENVS = {
  EXPORTS:           ['Build environment variables which will be exported to pom tasks.', {}],
  OPTIONS:           ['Build options determined during tooling which can be configured to by CLI and POM arguments to control the build', {}],
  POM_ENVS:          ['Supports translating top level POM parameters to build parameters, such as pom.version -> VERSION.  Also provides legacy support to POMs still using top level POM parametes for Java Manifest and Javac Parameters. Java Manifest property \'vendor\' should be set in POM task \'javaManifest\' and \'java\' should be set in POM task \'javacParameters\'.', 'VERSION=version,JAVA_RELEASE=java,JAVA_MANIFEST_VENDOR=vendor'],
  POM_TASKS:         ['Map of named tasks captured from build POMs. Will be executed when same named build task is executed.', {}],
  PROJECT:           ['Top-Level Loaded POM Object, not be be confused with variable \'POMS\', which is the name of the POM(s) to be processed by the build'],
  TOOLING_OPTIONS:   ['Options which control the tooling phase of the build', {}],
};
ENVS['TOOLING_TASKS'] = ['Tasks defined in Tooling poms and this build itself', TOOLING_TASKS];
let NO_SHOW_ENVS = Object.assign({}, ENVS);

globalThis['ENVS'] = ENVS;

// Configure build variables
buildEnv(ENVS);

// Export functions for Tooling and Build POM tasks
EXPORTS = Object.assign(EXPORTS, {
  adaptOrCreateArgs,
  addJournal,
  appendFileSync,
  bool,
  buildEnv,
  comma,
  copyDir,
  copyFile,
  emptyDir,
  ensureDir,
  error,
  exec,
  execute,
  execSync,
  existsSync,
  findOption,
  findTask,
  flag,
  homedir,
  hostname,
  info,
  isExcluded,
  join,
  log,
  openSync,
  platform,
  pmake,
  readdirSync,
  readFileSync,
  resetTask,
  rmdir,
  rmfile,
  showSummary,
  spawn,
  warning,
  writeFileIfUpdated,
  writeFileSync,
  verbose
});

TOOLING_OPTIONS = addOptions({
  homeDir: ['', 'home-dir', 'HOME_DIR', 'Home directory of user executing build', () => homedir(), arg => HOME_DIR = arg ],
  platform: ['', 'platform', 'PLATFORM', 'Operation System Type. One of: darwin (MacOS), freebsd, linux, win32', () => platform(), arg => PLATFORM = arg ],
  silent: ['', 'silent', 'SILENT', "Suppress all 'info' and 'warning' log messages.", false, function(arg) { SILENT = arg ? bool(arg) : true; }],
  toolingPoms: [ 'T', 'tooling-poms', 'TOOLING_POMS', 'Comma separated list of tooling poms. When not specified, build will look for tools/defaultTooling file, and it not found, default to \'Standard,Npm,Maven,Git,JS,Java\'.  To \'add\' tooling to default list, prefix name with +.',
                 function() {
                   var poms;
                   var fn = join(process.cwd(),`tools/defaultTooling`);
                   if ( existsSync(fn) ) {
                     poms = readFileSync(fn).toString().trim();
                     verbose(`[build] using project tooling: ${poms}`);
                   }
                   if ( ! poms ) {
                     poms = 'Standard,Npm,Maven,Git,JS,Java';
                     verbose(`[build] using default tooling: ${poms}`);
                   }
                   return poms;
                 },
                 function(arg) {
                   if ( arg.startsWith('+') ) {
                     // each addOptions call invokes the functions
                     if ( TOOLING_POMS.includes(arg.substring(1)) ) return;
                     TOOLING_POMS = comma(TOOLING_POMS, arg.substring(1));
                   } else {
                     TOOLING_POMS = arg;
                   }
                 }]
}, TOOLING_OPTIONS);

OPTIONS = addOptions({
  buildDir: [ '', 'build-dir', 'BUILD_DIR', 'Build directory, relative to project root','build', arg => BUILD_DIR = arg ],
  dryRun: [ '', 'dry-run', 'DRY_RUN', 'Run build in dry-run mode which just lists tasks that would have run.', false, function(arg) { DRY_RUN = arg ? bool(arg) : true; } ],
  envs: [ 'E', 'envs', '', 'Set environment variables. Example: -EJAVA_OPTS:-Xmx8g,APP_NAME:demo or -EJAVA_OPTS:"-Xms12g -Xmx12g"', '',
          arg => {
            arg.split(',').forEach(b => {
              var c = b.split(':');
              if ( ! ( c[0] in globalThis ) ) {
                error('Unknown environment variable:', c[0]);
              } else if ( c.length > 1 ) {
                globalThis[c[0]] = c.slice(1).join(':');
              }
            });
          }
        ],
  flags: ['f', 'flags', 'FLAGS', 'Flags passed to pmake. Explicitly set with --flags:test, for example.', '', arg => FLAGS = arg ],
  help: [ 'h', 'help', 'HELP', 'Print usage information for environment variables (envs), options, and tasks.  Narrow output with --help:tasks, for example. Or show help for a particular topic with --help:foo where foo is the name of an option or task.', '', arg => {
    HELP = true;
    TOPIC_HELP = arg;
  }],
  hostname: ['', 'hostname', 'HOST_NAME', 'Hostname to set in JVM', () => hostname(), arg => HOST_NAME = org ],
  nop: ['', 'nop', 'NOP', 'List of task NOT to run. ex: --nop:genJS,genJava', '', arg => NOP = comma(NOP, arg) ],
  poms: [ 'P', 'poms', 'POMS', "comma seperated list of pom files. Defaults to 'pom' at the root of the project.", '', arg => POMS = arg ],
  projectHome: ['', 'project-home', 'PROJECT_HOME', 'Project directory', process.cwd(), arg => PROJECT_HOME = arg ],
  showEnvs: [ '', 'show-envs', 'SHOW_ENVS', 'Output environment variable values.', false, function(arg) { SHOW_ENVS = arg ? bool(arg) : true; }],
  tasks: [ 'X', 'tasks', 'TASKS', 'Register task for execution during the build phase. Comma seperated list of task names. Parameters to each demarcated with : symbol. Ex: -XcheckDeps:9. NOTE: only the first \'all\' task is processed.', 'all',
           arg => {
             var t = arg;
             // cli will pass tasks as --task1,task2 or -Xtask1,task2 or --task1:arg1,arg2
             if ( ! arg.includes(':') ) {
               t = arg.replaceAll(',', TASK_SEPERATOR);
             }
             if ( TASKS === 'all' )
               TASKS = '';
             TASKS = TASKS ? TASKS + TASK_SEPERATOR + t : t;
           } ],
  timestamp: ['', 'timestamp', 'TIMESTAMP', 'Date/time string to timestamp files', () => TIMESTAMP = new Date().toISOString().substring(0, 19).replaceAll('-','').replaceAll(':','').replaceAll('T',''), arg => TIMESTAMP = arg],
  verbose: ['', 'verbose', 'VERBOSE', 'Enable VerboseMaker to log additional info during build. ', false, function(arg) { VERBOSE = arg ? bool(arg) : true; }]

}, OPTIONS);

// explicitly add journal to POM list, intented to be called
// after pom() has setup the initial list
function addJournal(name) {
  let fn = name && `${PROJECT_HOME}/deployment/${name}/pom`;
  if ( ! existsSync(fn + '.js') ) {
    let fn2 = `${PROJECT_HOME}/foam3/deployment/${name}/pom`;
    if ( ! existsSync(fn2 + '.js') ) {
      error('POM not found ' + fn + '.js');
      fn = null;
    } else {
      fn = fn2;
    }
  }
  if ( fn )
    POMS = comma(POMS, fn);
}

// build pom map and ensure the POMS list is viable
function pom() {
  var poms   = [];
  function addPom(fn) {
    if ( ! existsSync(fn + '.js') )
      warning('POM not found ' + fn + '.js');
    else
      poms.push(fn);
  };

  var root = false;
  POMS && POMS.split(',').forEach(c => {
    addPom(c && `${PROJECT_HOME}/${c}`);
    root = root || c == 'pom';
  });
  // backward compatibility - hithertoo, only the root directory pom
  // was 'require(pom)' to start the build process.  Now, the initial
  // pom can be specified. When not explicitly specified, the first
  // pom will most likely be set to a deployment pom via -J. The build
  // will fail if the foam pom is not specified.
  if ( ! root ) {
    if ( poms.length > 0 ) {
      poms.splice(1, 0, 'pom');
    } else {
      poms.push('pom');
    }
    warning('Added /pom');
  }

  if ( globalThis['JOURNALS'] ) {
    JOURNALS.split(',').forEach(c => {
      if ( ! c ) return;
      let fn = `${PROJECT_HOME}/deployment/${c}/pom`;
      if ( ! existsSync(fn + '.js') ) {
        let fn2 = `${PROJECT_HOME}/foam3/deployment/${c}/pom`;
        if ( ! existsSync(fn2 + '.js') ) {
          error('POM not found ' + fn + '.js');
          fn = null;
        } else {
          fn = fn2;
        }
      }
      if ( fn ) addPom(fn);
    });
  }

  POMS = poms.join(',');
}

function outputHelp(arg, msg) {
  var found = false;

  pom();
  execute('pomEnvs');

  if ( ! msg ) {
    if ( ! arg ||
         ( arg === 'envs' ||
           arg === 'options' ||
           arg === 'tasks' ) ) {
      found = true;
      moreUsage(arg);
    }

    if ( ! found ) {
      if ( arg.startsWith(':') ||
           arg.startsWith('=') ) {
        arg = arg.substring(1);
      }
      info(`Help for \'${arg}\'`);
      var option = findOption(OPTIONS, arg);
      if ( option ) {
        found = true;
        let opts = option.opt ? '-'+option.opt+', ' : '';
        opts += '--'+option.name;
        if ( option.name !== option.gnuopt ) {
          opts += ', --'+option.gnuopt;
        }
        var def = option.env && globalThis[option.env];
        if ( ! def ) {
          def = option.def ? option.def : '';
          if ( def instanceof Function ) {
            def = def();
          }
        }
        let desc = option.desc;
        log('(OPTION)', ''.padStart(0), opts+':', '\x1b[0;35m', def,'\x1b[0;0m', desc);
      }
      if ( ! found ) {
        let t = findTask(TOOLING_TASKS, arg); // first will do
        if ( t ) {
          found = true;
          var m = arg;
          if ( arg !== t.name ) m += ' '+t.name;
          log('(TASK)', m, t.desc);
        }
      }
      if ( ! found ) {
        let e = ENVS[arg];
        if ( e ) {
          found = true;
          log('(ENV)', arg,': ',e[0]);
        }
      }
    }
  }
  if ( ! found ) {
    var extra = '';
    if ( arg && arg.length > 1 ) {
      let similar = findSimilarTasks(TOOLING_TASKS, arg);
      if ( similar.length > 0 ) {
        extra += '\n  Possible Task matches: \n';
      }
      similar.forEach(task => {
        extra += '    ' + task.name + ' ' + task.gnuopt + ' - ' + task.desc + '\n';
      });
      similar = findSimilarOptions(OPTIONS, arg);
      if ( similar.length > 0 ) {
        extra += '\n  Possible Option matches: \n';
      }
      similar.forEach(option => {
        extra += '    ' + option.name + ' ' + option.opt + ' ' + option.gnuopt + ' - ' + option.desc + '\n';
      });
      var title = false;
      Object.keys(POM_HELP).forEach(name => {
        let pomHelp = POM_HELP[name];
        pomHelp.forEach(h => {
          if ( name.startsWith(arg) ||
               pomHelp.help && pomHelp.help.indexOf(arg) ) {
            if ( ! title ) {
              title = true;
              extra += '\n  Possible POM matches: \n';
            }
            extra += '    '+name+': '+h.help;
            extra += '\n     '+h.path+ '\n';
          }
        });
      });
    }
    if ( ! msg )
      msg = 'Topic not found:';
    error(msg, arg, extra);
  }

  process.exit(0);
}


// ############################
// # Build tasks
// ############################

task('tooling', 'Prepare build environment', [], function tooling() {
  var tps = '';
  (TOOLING_POMS).split(',').forEach(name => {
    var found = false;
    let fn1 = join(__dirname, `${name}Tooling`);
    var fn = fn1;
    if ( existsSync(fn + '.js') ) {
      tps = comma(tps, fn);
      found = true;
    }
    let fn2 = join(process.cwd(),`tools/${name}Tooling`);
    fn = fn2;

    if ( existsSync(fn + '.js') ) {
      tps = comma(tps, fn);
      found = true;
    } else {
      // TODO: look in other directories
      // **/tools/
    }
    if ( ! found ) {
      error(`[build] tooling ${name} not found in ${fn1} or ${fn2}`);
    }
  });
  let maker = pmake.bind(Object.assign({}, EXPORTS), `-makers=Tooling -pom=${tps}`)();
  buildEnv(maker.envs);

  addOptions(maker.options, OPTIONS);

  Object.keys(maker.tasks || {}).forEach(name => {
    let list = maker.tasks[name];
    list.forEach(t => {
      var [gnuopt, desc, dep, f] = t;
      if ( ! f ) {
        // warning(`[build] task missing function ${name} ${t}`);
      }
      task(name, gnuopt, desc, dep, f, t.pom);
    });
  });
  // copy tooling options to build options so command line doesn't complain
  // REVIEW - remove tooling option f - so no side effects?
  OPTIONS = Object.assign(OPTIONS, TOOLING_OPTIONS);
});

task('pom-envs', 'Capture POM arguments to environment values or options, and register POM tasks for later execution when the corresponding build tasks is executed.', [], function pomEnvs() {
  let makers = pmake.bind(Object.assign({}, EXPORTS), `-makers=Help,Env,Task -flags=${flag()} -pom=${POMS} -builddir=${BUILD_DIR} -envs=${POM_ENVS} -tasks=${TOOLING_TASKS} -options=${Object.assign({}, OPTIONS)}`)();
  let helpMaker = makers.get('Help');
  Object.assign(POM_HELP, helpMaker.topics);

  let envMaker = makers.get('Env');
  Object.keys(envMaker.envs).forEach(e => {
    let option = findOption(OPTIONS, e);
    if ( option ) {
      // log(`[build] envMaker def ${option.def}, global: ${globalThis[option.env]}`);
      if ( ! globalThis[option.env] ||
           option.def &&
           globalThis[option.env] === option.def ) {
        log(`[build] setting ${e} = ${envMaker.envs[e]}`);
        option.f.bind(this, envMaker.envs[e])();
      } else {
        // log(`[build] NOT replacing ${e} ${globalThis[option.env]} with ${envMaker.envs[e]}`);
      }
      return;
    }
    if ( ENVS[e] ) {
      if ( globalThis[e] ) {
        log(`[build] replacing ${e} ${globalThis[e]} with ${envMaker.envs[e]}`);
      } else {
        log(`[build] setting ${e} = ${envMaker.envs[e]}`);
      }
      globalThis[e] = envMaker.envs[e];
      return;
    }
    warning(`[build] environment variable or option not found: ${e}`);
  });

  let taskMaker = makers.get('Task');
  Object.keys(taskMaker.tasks || {}).forEach(name => {
    let list = taskMaker.tasks[name];
    list.forEach(t => {
      let pomList = POM_TASKS[name] || [];
      // execute pom tasks in pom reverse order, giving poms higher in
      // the hierarchy ability to modify values set earlier.
      pomList.unshift(t);
      POM_TASKS[name] = pomList;
    });
  });
});

task('copy', 'Run POM copy tasks.', [], function copy() {
  pmake.bind(Object.assign({}, EXPORTS), `-makers=Copy -flags=${flag()} -pom=${POMS} -builddir=${BUILD_DIR}`)();
});

task('show-poms', 'Show POM structure.', [], function showPOMs() {
  pmake.bind(Object.assign({}, EXPORTS), `-makers=Verbose -flags=${flag('web,java')} -pom=${POMS} -builddir=${BUILD_DIR}`)();
});

task('get-env', 'Return value of arg. Called from installation scripts', ['pomEnvs'], function getEnv(arg) { console.log(`${arg}=${globalThis[arg]}`); });

// Phase I - process tooling poms
processToolingArgs.bind(Object.assign({}, EXPORTS), TOOLING_OPTIONS)();
execute('tooling');

// Phase II - process command line args,
processBuildArgs.bind(Object.assign({}, EXPORTS), OPTIONS, outputHelp)();

if ( HELP )
  outputHelp(TOPIC_HELP);

// build pom map for POM_TASKS, and ensure POMS list is viable
pom();

// Process build pom for envs and task registration
// NOTE: pomEnvs needs to be run early. Commented out so tasks such as
// JavaTooling javaTests can set flags and journals before calling pomEnvs.
// execute('pomEnvs');

// Phase III - execute build tasks
if ( SHOW_ENVS )
  moreUsage();

TASKS.split(TASK_SEPERATOR).forEach(t => {
  var s = t.split(':');
  execute(s[0], s[1]);
});

quit(0);
