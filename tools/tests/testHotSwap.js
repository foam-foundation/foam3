#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Tests for Java hot swap (the helpers and wiring in tools/HotSwapTooling.js, its hooks in tools/JavaTooling.js, and HotSwap.java).
// Runs in node. The smoke test at the end needs a JetBrains Runtime: set HOTSWAP_JBR to its folder
// (or have ~/jbr); without one it says so and skips. HOTSWAP_SMOKE=off skips it on purpose.
//
// Usage: node foam3/tools/tests/testHotSwap.js

var fs_    = require('fs');
var os_    = require('os');
var path_  = require('path');
var vm_    = require('vm');
var child_ = require('child_process');

// HotSwapTooling.js is a foam.POM file, so load() runs it with the build's globals stubbed; its helpers are its module.exports.
var hs = load().hs;

var passes = 0, failures = 0;

function test(ok, message) {
  if ( ok ) { passes++; console.log('  ok   ' + message); }
  else      { failures++; console.log('  FAIL ' + message); }
}

// ---- the pure parts

function serverJvm() {
  console.log('server JVM');
  var off = hs.serverJvm({ hotSwap: false, javaHome: '', debugPort: 8005, platform: 'darwin' });
  test(off.java === 'java' && off.args.length === 0 && ! off.error, 'without --hot-swap: java on the path, no extra arguments');

  var on = hs.serverJvm({ hotSwap: true, javaHome: '/x/jbr', debugPort: 8005, platform: 'darwin' });
  test(on.java === '/x/jbr/bin/java', 'the chosen java home runs the server');
  test(on.args.indexOf('-XX:+AllowEnhancedClassRedefinition') !== -1, 'the swap flag is set');
  test(on.args.some(a => /^-agentlib:jdwp=.*address=127\.0\.0\.1:8005$/.test(a)), 'the debug agent listens on 127.0.0.1 and the given port');
  test(! on.args.some(a => /address=(\*|0\.0\.0\.0|:)/.test(a) || /address=\d+$/.test(a)), 'no argument binds a wider address');
  test(on.args.every(a => /^-(XX|agentlib)/.test(a)), 'nothing else is added');

  var susp = hs.serverJvm({ hotSwap: true, javaHome: '', debugPort: 8005, suspend: true, platform: 'darwin' });
  test(susp.args.some(a => /suspend=y,.*address=127\.0\.0\.1:8005$/.test(a)), '-s (suspend) is kept with --hot-swap');
  test(on.args.some(a => /suspend=n,/.test(a)), 'without -s the server does not wait');

  var win = hs.serverJvm({ hotSwap: true, javaHome: '', debugPort: 8005, platform: 'win32' });
  test(/not supported on Windows/.test(win.error), 'Windows is refused in words');
}

function jvmCheck() {
  console.log('JVM check');
  var fake = (status, output) => () => ({ status: status, output: output });
  var ok = hs.checkJvm({ java: 'j', release: '21', run: fake(0, '    java.class.version = 65.0\n') });
  test(ok.ok, 'a JVM that runs release 21 classes passes for release 21');
  var old = hs.checkJvm({ java: 'j', release: '24', run: fake(0, 'java.class.version = 65.0') });
  test(! old.ok && /up to version 65, but the build writes version 68 \(--java-release:24\).*--java-release:21/.test(old.message), 'an older JVM than the release fails and says what to change: ' + old.message);
  var noflag = hs.checkJvm({ java: 'j', release: '21', run: fake(1, 'Unrecognized VM option \'AllowEnhancedClassRedefinition\'\nError') });
  test(! noflag.ok && /needs a JetBrains Runtime/.test(noflag.message) && /Unrecognized VM option/.test(noflag.message), 'a JVM that refuses the flag fails with its own words');
  var sj = hs.serverJvm({ hotSwap: true, javaHome: '', debugPort: 1, platform: 'linux', release: '24', run: fake(0, 'java.class.version = 65.0') });
  test(sj.error && sj.args.length === 0, 'serverJvm with a release returns the check error');
}

function answers() {
  console.log('swap answers');
  var r = (status, out, extra) => Object.assign({ status: status, stdout: out, stderr: '' }, extra || {});
  test(hs.swapAnswer(r(0, 'swapped 1 classes')).code === 0, 'exit 0 is a swap');
  test(hs.swapAnswer(r(2, 'the JVM refused')).code === 2, 'exit 2 is a refusal');
  test(hs.swapAnswer(r(3, 'cannot attach')).code === 3, 'exit 3 is no attach');
  var helper = hs.swapAnswer(r(1, '', { stderr: 'HotSwap.java:3: error: boom' }));
  test(helper.code === 4 && /helper failed/.test(helper.message) && /boom/.test(helper.message), 'any other exit is a helper failure and shows its error');
  var late = hs.swapAnswer(r(null, '', { error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }));
  test(late.code === 5 && /more than 120 s/.test(late.message), 'a timeout is its own answer');
  var nojdi = hs.swapAnswer(r(1, '', { stderr: 'HotSwap.java:8: error: package com.sun.jdi does not exist' }));
  test(nojdi.code === 4 && /needs the JDK modules jdk\.compiler and jdk\.jdi.*jbrsdk/.test(nojdi.message), 'a JVM without jdk.jdi or jdk.compiler is named plainly');
  var seen;
  hs.swapClasses({ java: 'j', port: 8005, classesDir: 'c', manifest: 'm', startedAt: 1234, spawn: (f, args, o) => { seen = { f: f, args: args, o: o }; return r(0, 'ok'); } });
  test(seen.args.slice(1).join(' ') === '8005 c m 1234' && seen.args[0].endsWith('HotSwap.java'), 'the helper gets port, classes folder, manifest and the start time');
  process.env.JAVA_TOOL_OPTIONS = '-agentlib:jdwp=x';
  hs.swapClasses({ java: 'j', port: 1, classesDir: 'c', manifest: 'm', spawn: (f, args, o) => { seen = o; return r(0, ''); } });
  test(seen.env.JAVA_TOOL_OPTIONS === undefined, 'the helper does not inherit the server debug agent');
  delete process.env.JAVA_TOOL_OPTIONS;
}

// ---- the wiring: run the tooling files' own task functions, stacked like the build, with recorded commands

var BUILD = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-build-'));
// A home with no ~/jbr, so a run never picks up the JetBrains Runtime of the machine running the tests.
var NO_HOME = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-home-'));

// Loads JavaTooling.js, then (unless javaOnly) HotSwapTooling.js, into one context, as the build loads its
// tooling: shared globals, each file a module. Answers { poms, ctx, exits, hs } (hs: HotSwapTooling's exports).
function load(javaOnly) {
  var poms = [], exits = [], hs;
  var ctx = { TIMESTAMP: 't', foam: { POM: p => poms.push(p) }, process: Object.assign(Object.create(process), { exit: c => { exits.push(c); throw new Error('exit'); } }), console: console };
  vm_.createContext(ctx);
  ( javaOnly ? [ 'JavaTooling.js' ] : [ 'JavaTooling.js', 'HotSwapTooling.js' ] ).forEach(name => {
    var file = path_.join(__dirname, '..', name);
    var module = { exports: {} };
    // Like node's require: the file's own top-level names stay in its own function scope.
    var wrapped = vm_.runInContext('(function(module, require, __dirname) {' + fs_.readFileSync(file, 'utf8') + '\n})', ctx);
    wrapped(module, require('module').createRequire(file), path_.join(__dirname, '..'));
    hs = module.exports;
  });
  return { poms: poms, ctx: ctx, exits: exits, hs: hs };
}

// The tasks the harness runs in full when a task depends on or executes them. Of the build's other tasks only
// the hooks of the tooling files after JavaTooling run (HotSwapTooling's); JavaTooling's own work is recorded.
var RUNS = [ 'pomEnvs', 'javacParameters', 'serverJvmArgs', 'testSetup', 'genJava', 'hotSwap' ];

// Runs one task, or a line of tasks, with these globals, like the build: for each tooling file that has the task,
// in load order, its dependencies, then its body (build.js runs same-named tasks of every tooling file, in order),
// and each task once per line. Answers what it ran; order lists tasks and pmake calls as they happened.
function run(tasks, globals, javaOnly, stubs) {
  var l = load(javaOnly);
  var swapGlobals = javaOnly ? {} : { HOT_SWAP: false, SWAP: false };
  Object.assign(l.ctx, { JAVA_OPTS: '', HOST_NAME: 'localhost', APP_NAME: 'a', WEBROOT: 'w', TIMEZONE: 'GMT', DEBUG: false, SUSPEND: false,
    DEBUG_PORT: 8005, BUILD_ONLY: false, BUILD_DIR: BUILD, JAVA_MAIN_CLASS: 'my.Main', JAVA_MAIN_ARGS: 'x', JAVA: '/usr/bin/java',
    SERVER_JAVA_HOME: '', JAVA_RELEASE: '21', CORE_PIDFILE: '/dev/null', FLAGS: 'js,java', TAR: false, JAR: false, RESTART: false,
    CLEAN: false, CLEAN_ALL: false, BACKUP_RUNTIME_JOURNALS: false, DELETE_RUNTIME_JOURNALS: false, APP_ROOT: '/opt',
    SERVER_JVM_ARGS: [], JAVA_MAKER_ARGS: '', HOME_DIR: NO_HOME, JAVAC_PARAMETERS: '', JAR_INCLUDES: '', VERBOSE: false, POMS: '', FAST_JAVA: 'off', TESTS: '', BENCHMARKS: '' }, swapGlobals, globals);
  var ran = { commands: [], errors: [], spawned: [], exits: l.exits, logs: [], executed: [], order: [] };
  l.ctx.console = Object.assign(Object.create(console), { log: (...m) => ran.logs.push(m.join(' ').split('\n')[0]) });
  var line = [].concat(tasks);
  var fired = {};
  var exec = name => {
    ran.executed.push(name);
    ran.order.push(name);
    if ( fired[name] ) return;
    fired[name] = true;
    var full = RUNS.includes(name) || line.includes(name);
    l.poms.forEach((p, i) => {
      if ( ! full && i === 0 ) return;
      var t = p.tasks[name];
      if ( ! t ) return;
      t[2].forEach(d => typeof d === 'function' ? d.call(self) : exec(d));
      t[3].call(self);
    });
  };
  var self = {
    execSync: c => { ran.commands.push(c); return ''; },
    spawn: (f, a, o) => { ran.spawned.push({ file: f, args: a, env: o.env }); return { pid: 1 }; },
    writeFileSync: () => {}, showSummary: () => {}, info: () => {}, addJournal: () => {}, pmake: { bind: (t, args) => () => ran.order.push('pmake ' + args) },
    comma: (a, b) => a ? a + ',' + b : b, execute: exec, flag: () => l.ctx.FLAGS,
    error: m => { ran.errors.push(m); throw new Error('stop'); }
  };
  Object.assign(self, stubs);
  // A crash means the run went on into work the harness does not stub: a test sees it as an error, not as a refusal.
  try { line.forEach(exec); } catch (e) { if ( e.message !== 'stop' && e.message !== 'exit' ) ran.errors.push('crashed: ' + e.message); }
  ran.opts = l.ctx.JAVA_OPTS;
  ran.makerArgs = l.ctx.JAVA_MAKER_ARGS;
  ran.serverJavaHome = l.ctx.SERVER_JAVA_HOME;
  return ran;
}

var JBR21 = { HOT_SWAP: true, SERVER_JAVA_HOME: jbrHome() || '/nowhere' };

function wiring() {
  console.log('wiring: JavaTooling.js alone, and with HotSwapTooling.js (-T+HotSwap)');
  // Without -T+HotSwap the globals HOT_SWAP and SWAP do not exist: JavaTooling must never name them.
  var alone = run('startCORE', {}, true);
  test(alone.errors.length === 0 && alone.commands.length === 1 && ! /jdwp|AllowEnhanced/.test(alone.commands[0]), 'JavaTooling alone starts CORE with no hot swap globals defined');
  var aloneAll = run('all', { BUILD_ONLY: true }, true);
  test(aloneAll.errors.length === 0 && aloneAll.executed.indexOf('genJava') !== -1, 'JavaTooling alone builds (all) with no hot swap globals defined');
  var aloneDbg = run('startCORE', { DEBUG: true }, true);
  test(/jdwp=.*address=127\.0\.0\.1:8005/.test(aloneDbg.opts), 'JavaTooling alone: start-core --debug works as before (agent in JAVA_OPTS)');
  var src = fs_.readFileSync(path_.join(__dirname, '..', 'JavaTooling.js'), 'utf8');
  test(! /HOT_SWAP|\bSWAP\b|AllowEnhancedClassRedefinition|swap-manifest/.test(src), 'JavaTooling.js names no hot swap setting');

  var plain = run('startCORE', {});
  test(plain.commands.length === 1 && /^"java"  -cp/.test(plain.commands[0]) && ! /jdwp|AllowEnhanced/.test(plain.commands[0] + plain.opts), 'start-core without --hot-swap: no swap flag, no debug agent');
  var dbg = run('startCORE', { DEBUG: true });
  test(/jdwp=.*address=127\.0\.0\.1:8005/.test(dbg.opts), 'start-core --debug works as before (agent in JAVA_OPTS)');
  test(run('javacParameters', { SWAP: true, HOT_SWAP: true }).makerArgs === ' -swapManifest=' + BUILD + '/swap-manifest', '--swap asks JavacMaker for the swap manifest');
  test(run('javacParameters', {}).makerArgs === '', 'without --swap, JavacMaker gets no swap manifest');

  if ( ! jbrHome() ) { console.log('  skip the --hot-swap command lines: no JetBrains Runtime'); }
  else {
    var hot = run('startCORE', JBR21);
    var cmd = hot.commands[0] || '';
    test(cmd.indexOf('"' + JBR21.SERVER_JAVA_HOME + '/bin/java"') === 0, 'start-core --hot-swap runs the chosen java: ' + cmd.slice(0, 60));
    test(/ -XX:\+AllowEnhancedClassRedefinition /.test(cmd) && /-agentlib:jdwp=.*address=127\.0\.0\.1:8005 /.test(cmd), 'the flag and the loopback agent are on the server command line');
    test(! /jdwp|AllowEnhanced/.test(hot.opts), 'neither goes into JAVA_TOOL_OPTIONS, so child JVMs do not get them');
    var hotDbg = run('startCORE', Object.assign({ DEBUG: true }, JBR21));
    test(( hotDbg.commands[0] || '' ).split('-agentlib:jdwp').length === 2 && ! /jdwp/.test(hotDbg.opts), 'with -D and --hot-swap there is one debug agent, on the command line');

    var asyncRun = run('startCOREAsync', JBR21);
    var sp = asyncRun.spawned[0];
    test(sp && sp.file === "'" + JBR21.SERVER_JAVA_HOME + "/bin/java'" && sp.args.indexOf('-XX:+AllowEnhancedClassRedefinition') !== -1 && sp.args.indexOf('my.Main') > sp.args.indexOf('-cp'), 'start-core-async --hot-swap: same java and arguments');
    test(sp && ! /jdwp|AllowEnhanced/.test(sp.env.JAVA_TOOL_OPTIONS), 'start-core-async: the env has neither');

    // One release past what this JetBrains Runtime runs.
    var have = jbrClassVersion(JBR21.SERVER_JAVA_HOME);
    var tooOld = run('startCORE', Object.assign({}, JBR21, { JAVA_RELEASE: String(have - 44 + 1) }));
    test(tooOld.errors.length === 1 && new RegExp('version ' + have).test(tooOld.errors[0]) && tooOld.commands.length === 0, 'a release the JVM cannot run stops the start with a message');

    test(fs_.existsSync(path_.join(BUILD, 'swap-live')), 'a hot swap start writes the swap-live baseline');
    fs_.writeFileSync(path_.join(BUILD, 'swap-stale'), '');
    fs_.writeFileSync(path_.join(BUILD, 'swap-manifest'), 'A.class\n');
    run('startCORE', JBR21);
    test(! fs_.existsSync(path_.join(BUILD, 'swap-stale')) && ! fs_.existsSync(path_.join(BUILD, 'swap-manifest')), 'a start clears the stale mark and the pending list');
    var susp = run('startCORE', Object.assign({ SUSPEND: true }, JBR21));
    test(/suspend=y/.test(susp.commands[0]), 'start-core --hot-swap -s: the server waits for the debugger');
    var quoted = run('startCOREAsync', Object.assign({}, JBR21, { SERVER_JAVA_HOME: JBR21.SERVER_JAVA_HOME + '/../x y' }));
    test(quoted.spawned.length === 0 || /^'.* .*'$/.test(quoted.spawned[0].file), 'a java home with a space is quoted for bash');
  }

  // --hot-swap with runs it does not apply to: refused in words, before any build work
  var work = [ 'genJava', 'buildJar', 'buildResourcesJar', 'startCORE', 'startCORETest', 'stopCORE' ];
  [ [ 'all', { JAR: true } ], [ 'all', { TAR: true } ], [ 'buildJar', {} ], [ 'buildResourcesJar', {} ], [ 'runTests', {} ], [ 'javaBenchmarks', {} ] ].forEach(([ t, g ]) => {
    var rr = run(t, Object.assign({ HOT_SWAP: true }, g));
    var did = rr.executed.slice(1).filter(n => work.includes(n));
    test(rr.errors.length === 1 && /does not apply to/.test(rr.errors[0]) && ! did.length, t + ( g.TAR ? ' --tar' : g.JAR ? ' --jar' : '' ) + ' with --hot-swap is refused before any work: ' + ( rr.errors[0] || '(not refused)' ).slice(0, 60) + ( did.length ? ' (ran ' + did + ')' : '' ));
  });

  // A line of tasks runs each once: a pomEnvs that ran before a later task set JAR, or before a test run, does not let it through.
  var late = run([ 'pomEnvs', 'buildJar' ], { HOT_SWAP: true, SWAP: true });
  test(late.errors.length === 1 && /jar and tar/.test(late.errors[0]) && ! late.order.some(o => /^pmake /.test(o)) && late.executed.indexOf('hotSwap') === -1, 'pomEnvs then buildJar: refused before javac, nothing swapped: ' + ( late.errors[0] || '(not refused)' ).slice(0, 50));
  var lateTests = run([ 'pomEnvs', 'runTests' ], { HOT_SWAP: true });
  test(lateTests.errors.length === 1 && /test and benchmark/.test(lateTests.errors[0]) && lateTests.executed.indexOf('buildJar') === -1, 'pomEnvs then runTests: refused before the build');
  // A source run of test-flagged code is a start-core run, not a test run. Only the refusal is checked: without a
  // JetBrains Runtime here the start still stops, at the JVM check.
  var flagged = run('startCORE', Object.assign({ FLAGS: 'js,java,test' }, JBR21));
  test(! flagged.errors.some(e => /does not apply to/.test(e)), 'start-core with --flags:test and --hot-swap is not refused as a test run: ' + ( flagged.errors[0] || 'ok' ).slice(0, 60));

  // --swap: the manifest is asked for before javac, and the swap runs after it.
  var dir = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-order-'));
  var swapAll = run('all', { SWAP: true, HOT_SWAP: true, BUILD_ONLY: true, BUILD_DIR: dir });
  var at = re => swapAll.order.findIndex(o => re.test(o));
  test(at(/^javacParameters$/) !== -1 && at(/^javacParameters$/) < at(/^pmake .*-swapManifest=/) && at(/^pmake .*-swapManifest=/) < at(/^hotSwap$/), '--swap: javacParameters, then javac with -swapManifest, then hotSwap: ' + swapAll.order.filter(o => /javacParameters|pmake|hotSwap/.test(o)).map(o => o.slice(0, 20)).join(' > '));
  test(swapAll.logs.some(o => /^nothing to swap/.test(o)), '--swap with nothing changed says so after the build');
  var noSwap = run('all', { HOT_SWAP: true, BUILD_ONLY: true, BUILD_DIR: dir });
  test(noSwap.executed.indexOf('hotSwap') === -1 && ! noSwap.order.some(o => /-swapManifest/.test(o)), 'a build without --swap neither stages nor swaps');
  fs_.rmSync(dir, { recursive: true, force: true });

  var l = load();
  ['startCORETest', 'startCOREJar', 'startCOREJarAsync'].forEach(t => {
    var body = l.poms[0].tasks[t][3].toString();
    test(! /SERVER_JVM_ARGS|SERVER_JAVA_HOME|serverJvmArgs/.test(body + l.poms[0].tasks[t][2]), t + ' never gets hot swap');
  });
}

// ---- getting a JetBrains Runtime

// Lines from a real release's notes (jbr-release-25.0.5.1b508.47): the plain SDK must win over the JBR alone,
// fastdebug, FreeType, JCEF and debug-symbol builds.
var NOTES = [
  '| osx-aarch64 | **JBR (vanilla, bundled by default)** | [jbr-25.0.5.1-osx-aarch64-b508.47.tar.gz](https://cache-redirector.jetbrains.com/intellij-jbr/jbr-25.0.5.1-osx-aarch64-b508.47.tar.gz) | [checksum](https://cache-redirector.jetbrains.com/intellij-jbr/jbr-25.0.5.1-osx-aarch64-b508.47.tar.gz.checksum) |',
  '| osx-aarch64 | JBRSDK debug symbols | [x](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk-25.0.5.1-osx-aarch64-b508.47_diz.tar.gz) |',
  '| osx-aarch64 | JBRSDK (fastdebug) | [x](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk-25.0.5.1-osx-aarch64-fastdebug-b508.47.tar.gz) |',
  '| osx-aarch64 | JBRSDK with JCEF | [x](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk_jcef-25.0.5.1-osx-aarch64-b508.47.tar.gz) |',
  '| osx-aarch64 | JBRSDK | [jbrsdk-25.0.5.1-osx-aarch64-b508.47.tar.gz](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk-25.0.5.1-osx-aarch64-b508.47.tar.gz) | [checksum](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk-25.0.5.1-osx-aarch64-b508.47.tar.gz.checksum) |',
  '| linux-x64 | JBRSDK | [jbrsdk-25.0.5.1-linux-x64-b508.47.tar.gz](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk-25.0.5.1-linux-x64-b508.47.tar.gz) | [checksum](https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk-25.0.5.1-linux-x64-b508.47.tar.gz.checksum) |'
].join('\n');

function gettingJbr() {
  console.log('getting a JetBrains Runtime');
  var base = 'https://cache-redirector.jetbrains.com/intellij-jbr/';
  test(hs.jbrSdkUrl(NOTES, 'darwin', 'arm64') === base + 'jbrsdk-25.0.5.1-osx-aarch64-b508.47.tar.gz', 'mac arm: the plain SDK link, not the JBR, fastdebug, JCEF or symbols');
  test(hs.jbrSdkUrl(NOTES, 'linux', 'x64') === base + 'jbrsdk-25.0.5.1-linux-x64-b508.47.tar.gz', 'linux x64: its own link');
  test(hs.jbrSdkUrl(NOTES, 'linux', 'arm64') === null && hs.jbrSdkUrl(NOTES, 'win32', 'x64') === null, 'no link for this machine: null (a message, not a wrong download)');

  var home = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-jbr-'));
  var jbr = hs.JBR_DIR(home);
  test(hs.findJbr(jbr) === null, 'no ~/jbr: none found');
  [ 'jbrsdk-21.0.11-osx-aarch64-b1163.125', 'jbrsdk-25.0.5.1-osx-aarch64-b508.47' ].forEach(n => {
    fs_.mkdirSync(path_.join(jbr, n, 'Contents', 'Home', 'bin'), { recursive: true });
    fs_.writeFileSync(path_.join(jbr, n, 'Contents', 'Home', 'bin', 'java'), '');
  });
  var newest = path_.join(jbr, 'jbrsdk-25.0.5.1-osx-aarch64-b508.47', 'Contents', 'Home');
  test(hs.findJbr(jbr) === newest, 'the mac layout (<name>/Contents/Home) is found, the newest first');

  var picked = run('pomEnvs', { HOT_SWAP: true, HOME_DIR: home });
  test(picked.errors.length === 0 && picked.serverJavaHome === newest, '--hot-swap without --server-java-home runs on the JetBrains Runtime in ~/jbr');
  test(run('pomEnvs', { HOT_SWAP: true, HOME_DIR: home, SERVER_JAVA_HOME: '/my/jdk' }).serverJavaHome === '/my/jdk', '--server-java-home wins over ~/jbr');
  test(run('pomEnvs', { HOT_SWAP: false, HOME_DIR: home }).serverJavaHome === '', 'without --hot-swap, ~/jbr is not used');

  test(run('installJbr', { HOME_DIR: home }).logs.some(l => /already in .*b508\.47/.test(l)), 'installJbr with one in ~/jbr: nothing to do');

  // installJbr with the network faked: the release notes, the download, the checksum.
  var empty = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-jbr-'));
  var install = (checksumOf) => {
    var cmds = [];
    var r = run('installJbr', { HOME_DIR: empty }, false, { execSync: c => {
      cmds.push(c);
      if ( /api\.github\.com/.test(c) ) return JSON.stringify({ body: NOTES });
      var out = /-o '([^']+)'/.exec(c);
      if ( out ) { fs_.writeFileSync(out[1], 'the download'); return ''; }
      if ( /\.checksum'$/.test(c) ) return checksumOf(path_.join(hs.JBR_DIR(empty), 'jbrsdk-' + ( process.platform === 'darwin' ? '25.0.5.1-osx-aarch64' : '25.0.5.1-linux-x64' ) + '-b508.47.tar.gz')) + '  name.tar.gz\n';
      return '';
    } });
    r.cmds = cmds;
    return r;
  };
  var machine = hs.jbrSdkUrl(NOTES, process.platform, process.arch);
  if ( ! machine ) { console.log('  skip the install flow: the sample notes have no link for this machine'); }
  else {
    var bad = install(() => 'f'.repeat(128));
    test(bad.errors.length === 1 && /does not match its SHA-512/.test(bad.errors[0]) && ! bad.cmds.some(c => /^tar /.test(c)) && fs_.readdirSync(hs.JBR_DIR(empty)).length === 0, 'a download with the wrong SHA-512 is deleted, never unpacked');
    var good = install(f => hs.sha512(f));
    test(good.errors.length === 0 && good.cmds.some(c => /^tar -xzf '.*jbrsdk-.*\.tar\.gz' -C '.*\/jbr'$/.test(c)) && fs_.readdirSync(hs.JBR_DIR(empty)).length === 0, 'a download with the right SHA-512 is unpacked into ~/jbr and the archive removed');
    test(good.cmds[1] === "curl -fL --progress-bar -o '" + path_.join(hs.JBR_DIR(empty), path_.basename(machine)) + "' '" + machine + "'", 'it downloads the SDK for this machine');
  }
  [ home, empty ].forEach(d => fs_.rmSync(d, { recursive: true, force: true }));
}

function pendingFlow() {
  console.log('pending list and stale mark');
  var dir = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-pend-'));
  fs_.writeFileSync(path_.join(dir, 'swap-stale'), '');
  fs_.writeFileSync(path_.join(dir, 'swap-manifest'), 'A.class\n');
  var r = run('hotSwap', { BUILD_DIR: dir, HOT_SWAP: true, SERVER_JAVA_HOME: '' });
  test(r.exits[0] === 2 && fs_.existsSync(path_.join(dir, 'swap-manifest')), 'after a build without --swap the swap asks for a restart (exit 2) and keeps the list');
  test(r.logs.some(l => /^restart needed \(a build without --swap changed classes\)/.test(l)), 'the stale refusal says restart needed and why: ' + r.logs.join(' | '));
  fs_.rmSync(path_.join(dir, 'swap-stale'));
  fs_.writeFileSync(path_.join(dir, 'swap-manifest'), '');
  var none = run('hotSwap', { BUILD_DIR: dir, HOT_SWAP: true });
  test(none.exits.length === 0 && none.errors.length === 0, 'an empty list is nothing to do');
  test(none.logs.some(l => /^nothing to swap: no class changed \(\d+\.\d s\)$/.test(l)), 'an empty list says so, with the time: ' + none.logs.join(' | '));
  fs_.rmSync(dir, { recursive: true, force: true });
}

// ---- smoke: swap one method body in a live JBR

function jbrHome() {
  var start = process.env.HOTSWAP_JBR || path_.join(os_.homedir(), 'jbr');
  var look = (d, n) => {
    if ( fs_.existsSync(path_.join(d, 'bin', 'java')) ) return d;
    if ( n === 0 ) return null;
    var names; try { names = fs_.readdirSync(d); } catch (e) { return null; }
    for ( var i = 0 ; i < names.length ; i++ ) { var f = look(path_.join(d, names[i]), n - 1); if ( f ) return f; }
    return null;
  };
  return look(start, 3);
}

// The class file version this JetBrains Runtime runs (65 for Java 21).
function jbrClassVersion(home) {
  var out = child_.spawnSync(path_.join(home, 'bin', 'java'), [ '-XshowSettings:properties', '-version' ], { encoding: 'utf8' });
  return Number(/java\.class\.version = (\d+)/.exec(out.stderr + out.stdout)[1]);
}

function sleep(ms) { child_.spawnSync('sleep', [String(ms / 1000)]); }

function smoke() {
  console.log('smoke: swap a method body in a live JBR');
  var jbr = jbrHome();
  if ( process.env.HOTSWAP_SMOKE === 'off' ) { console.log('  skip: HOTSWAP_SMOKE=off'); return; }
  if ( ! jbr ) { console.log('  skip: no JetBrains Runtime (set HOTSWAP_JBR)'); return; }
  var dir = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-'));
  var classes = path_.join(dir, 'classes');
  var javac = path_.join(jbr, 'bin', 'javac');
  var src = v => 'public class Main { static int value() { return ' + v + '; }\n' +
    'public static void main(String[] a) throws Exception { while ( true ) { System.out.println("value=" + value()); Thread.sleep(200); } } }\n';
  fs_.mkdirSync(classes);
  fs_.writeFileSync(path_.join(dir, 'Main.java'), src(1));
  child_.execFileSync(javac, ['-d', classes, path_.join(dir, 'Main.java')]);
  var port = 18000 + Math.floor(Math.random() * 1000);
  var jvm = hs.serverJvm({ hotSwap: true, javaHome: jbr, debugPort: port, platform: process.platform });
  var out = path_.join(dir, 'out.txt');
  var fd = fs_.openSync(out, 'w');
  var server = child_.spawn(jvm.java, jvm.args.concat(['-cp', classes, 'Main']), { stdio: ['ignore', fd, fd] });
  try {
    var up = false;
    for ( var i = 0 ; i < 50 && ! up ; i++ ) { sleep(200); up = /value=1/.test(fs_.readFileSync(out, 'utf8')); }
    test(up, 'the server JVM started with the swap flag and the agent');

    var manifest = path_.join(dir, 'manifest');
    fs_.writeFileSync(path_.join(dir, 'Main.java'), src(2));
    child_.execFileSync(javac, ['-d', classes, path_.join(dir, 'Main.java')]);
    fs_.writeFileSync(manifest, 'Main.class\n');
    var r = hs.swapClasses({ java: jvm.java, port: port, classesDir: classes, manifest: manifest });
    test(r.code === 0 && /^swapped 1 classes in \d+\.\d s$/.test(r.message), 'swap answers with count and time: ' + r.message);
    sleep(600);
    var lines = fs_.readFileSync(out, 'utf8').trim().split('\n');
    test(lines[lines.length - 1] === 'value=2' && lines.indexOf('value=1') !== -1, 'the same running process now prints the new value');

    // a field added: the swap works, and says static initializers did not run
    fs_.writeFileSync(path_.join(dir, 'Main.java'), src(2).replace('static int value', 'static int extra = 5; static int value'));
    child_.execFileSync(javac, ['-d', classes, path_.join(dir, 'Main.java')]);
    var f = hs.swapClasses({ java: jvm.java, port: port, classesDir: classes, manifest: manifest });
    var fl = f.message.split('\n');
    test(f.code === 0 && /^swapped 1 classes in /.test(fl[0]) && /^restart needed \(.* in Main\): the code is built but not live; restart the server$/.test(fl[fl.length - 1]), 'a field added is swapped, and the last line says restart needed: ' + fl[fl.length - 1]);

    // classes built for a newer Java than the server runs: the JVM refuses them. (A JetBrains Runtime
    // swaps even a changed superclass in some cases, so a class file version is the sure refusal.)
    var newer = process.env.HOTSWAP_NEWER_JAVAC || '/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home/bin/javac';
    var newerRelease = fs_.existsSync(newer) ? Number(/javac (\d+)/.exec(child_.execFileSync(newer, [ '-version' ], { encoding: 'utf8' }))[1]) : 0;
    if ( newerRelease + 44 > jbrClassVersion(jbr) ) {
      fs_.writeFileSync(path_.join(dir, 'Main.java'), src(3));
      child_.execFileSync(newer, ['--release', String(newerRelease), '-d', classes, path_.join(dir, 'Main.java')]);
      fs_.writeFileSync(path_.join(dir, 'swap-manifest'), 'Main.class\n');
      var task = { BUILD_DIR: dir, HOT_SWAP: true, SERVER_JAVA_HOME: jbr, DEBUG_PORT: port };
      // the task reads BUILD_DIR/classes
      var refused = run('hotSwap', task);
      test(/^restart needed \(the JVM refused the swap: /.test(refused.logs[refused.logs.length - 1] || ''), 'a refusal says restart needed and the JVM reason: ' + ( refused.logs[refused.logs.length - 1] || '' ).slice(0, 90));
      test(refused.exits[0] === 2 && fs_.readFileSync(path_.join(dir, 'swap-manifest'), 'utf8') === 'Main.class\n', 'a refused swap exits 2 and the class stays on the pending list');
      // fixed: the next swap sends it, and clears the list
      fs_.writeFileSync(path_.join(dir, 'Main.java'), src(4));
      child_.execFileSync(javac, ['-d', classes, path_.join(dir, 'Main.java')]);
      var again = run('hotSwap', task);
      sleep(600);
      var out2 = fs_.readFileSync(out, 'utf8').trim().split('\n');
      test(again.exits.length === 0 && ! fs_.existsSync(path_.join(dir, 'swap-manifest')) && out2[out2.length - 1] === 'value=4', 'the next swap sends it and clears the list: server prints ' + out2[out2.length - 1]);
    } else {
      console.log('  skip refusal: no javac newer than this JetBrains Runtime (set HOTSWAP_NEWER_JAVAC)');
    }
  } finally {
    server.kill('SIGKILL');
    var gone = hs.swapClasses({ java: jvm.java, port: port, classesDir: classes, manifest: path_.join(dir, 'manifest') });
    test(gone.code === 3 && /cannot attach/.test(gone.message) && /another debugger may be attached/.test(gone.message), 'after the server stops: cannot attach, in words');
    fs_.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  serverJvm();
  jvmCheck();
  answers();
  wiring();
  pendingFlow();
  gettingJbr();
  smoke();
  [ BUILD, NO_HOME ].forEach(d => fs_.rmSync(d, { recursive: true, force: true }));
  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  process.exitCode = failures ? 1 : 0;
}

if ( require.main === module ) main();
