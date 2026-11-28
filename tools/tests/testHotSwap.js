#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Tests for Java hot swap (the helpers and wiring in tools/JavaTooling.js, and HotSwap.java).
// Runs in node. The smoke test at the end needs a JetBrains Runtime: set HOTSWAP_JBR to its folder
// (or have ~/jbr); without one it says so and skips. HOTSWAP_SMOKE=off skips it on purpose.
//
// Usage: node foam3/tools/tests/testHotSwap.js

var fs_    = require('fs');
var os_    = require('os');
var path_  = require('path');
var vm_    = require('vm');
var child_ = require('child_process');

// JavaTooling.js is a foam.POM file, so load() runs it with the build's globals stubbed; its helpers are its module.exports.
var hs = load().ctx.module.exports;

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

// ---- the wiring: run JavaTooling.js's own task functions with recorded commands

var BUILD = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'hotswap-build-'));

function load() {
  var pom;
  var exits = [];
  var ctx = { TIMESTAMP: 't', module: { exports: {} }, __dirname: path_.join(__dirname, '..'), foam: { POM: p => { pom = p; } }, require: require('module').createRequire(path_.join(__dirname, '..', 'JavaTooling.js')), process: Object.assign(Object.create(process), { exit: c => { exits.push(c); throw new Error('exit'); } }), console: console };
  vm_.createContext(ctx);
  vm_.runInContext(fs_.readFileSync(path_.join(__dirname, '../JavaTooling.js'), 'utf8'), ctx);
  return { pom: pom, ctx: ctx, exits: exits };
}

// Runs a task with these globals; answers what it ran.
function run(task, globals) {
  var l = load();
  Object.assign(l.ctx, { JAVA_OPTS: '', HOST_NAME: 'localhost', APP_NAME: 'a', WEBROOT: 'w', TIMEZONE: 'GMT', DEBUG: false, SUSPEND: false,
    DEBUG_PORT: 8005, BUILD_ONLY: false, BUILD_DIR: BUILD, JAVA_MAIN_CLASS: 'my.Main', JAVA_MAIN_ARGS: 'x', JAVA: '/usr/bin/java',
    HOT_SWAP: false, SERVER_JAVA_HOME: '', JAVA_RELEASE: '21', CORE_PIDFILE: '/dev/null' }, globals);
  var ran = { commands: [], errors: [], spawned: [], exits: l.exits, logs: [] };
  l.ctx.console = Object.assign(Object.create(console), { log: (...m) => ran.logs.push(m.join(' ').split('\n')[0]) });
  var self = {
    execSync: c => { ran.commands.push(c); return ''; },
    spawn: (f, a, o) => { ran.spawned.push({ file: f, args: a, env: o.env }); return { pid: 1 }; },
    writeFileSync: () => {}, showSummary: () => {}, info: () => {},
    error: m => { ran.errors.push(m); throw new Error('stop'); }
  };
  // Like the build: the task's function dependencies (the --hot-swap refusals are one), then its body.
  var t = l.pom.tasks[task];
  try { t[2].filter(d => typeof d === 'function' || /^refuse/.test(d)).forEach(d => ( typeof d === 'function' ? d : l.pom.tasks[d][3] ).call(self)); t[3].call(self); } catch (e) { if ( e.message !== 'stop' && e.message !== 'exit' ) throw e; }
  ran.opts = l.ctx.JAVA_OPTS;
  return ran;
}

var JBR21 = { HOT_SWAP: true, SERVER_JAVA_HOME: jbrHome() || '/nowhere' };

function wiring() {
  console.log('wiring in JavaTooling.js');
  var plain = run('startCORE', {});
  test(plain.commands.length === 1 && /^"java"  -cp/.test(plain.commands[0]) && ! /jdwp|AllowEnhanced/.test(plain.commands[0] + plain.opts), 'start-core without --hot-swap: no swap flag, no debug agent');
  var dbg = run('startCORE', { DEBUG: true });
  test(/jdwp=.*address=127\.0\.0\.1:8005/.test(dbg.opts), 'start-core --debug works as before (agent in JAVA_OPTS)');

  if ( ! jbrHome() ) { console.log('  skip the --hot-swap command lines: no JetBrains Runtime'); return; }
  var hot = run('startCORE', JBR21);
  var cmd = hot.commands[0] || '';
  test(cmd.indexOf('"' + JBR21.SERVER_JAVA_HOME + '/bin/java"') === 0, 'start-core --hot-swap runs the chosen java: ' + cmd.slice(0, 60));
  test(/ -XX:\+AllowEnhancedClassRedefinition /.test(cmd) && /-agentlib:jdwp=.*address=127\.0\.0\.1:8005 /.test(cmd), 'the flag and the loopback agent are on the server command line');
  test(! /jdwp|AllowEnhanced/.test(hot.opts), 'neither goes into JAVA_TOOL_OPTIONS, so child JVMs do not get them');

  var asyncRun = run('startCOREAsync', JBR21);
  var sp = asyncRun.spawned[0];
  test(sp && sp.file === "'" + JBR21.SERVER_JAVA_HOME + "/bin/java'" && sp.args.indexOf('-XX:+AllowEnhancedClassRedefinition') !== -1 && sp.args.indexOf('my.Main') > sp.args.indexOf('-cp'), 'start-core-async --hot-swap: same java and arguments');
  test(sp && ! /jdwp|AllowEnhanced/.test(sp.env.JAVA_TOOL_OPTIONS), 'start-core-async: the env has neither');

  var tooOld = run('startCORE', Object.assign({}, JBR21, { JAVA_RELEASE: '24' }));
  test(tooOld.errors.length === 1 && /version 65/.test(tooOld.errors[0]) && tooOld.commands.length === 0, 'a release the JVM cannot run stops the start with a message');

  test(fs_.existsSync(path_.join(BUILD, 'swap-live')), 'a hot swap start writes the swap-live baseline');
  fs_.writeFileSync(path_.join(BUILD, 'swap-stale'), '');
  fs_.writeFileSync(path_.join(BUILD, 'swap-manifest'), 'A.class\n');
  run('startCORE', JBR21);
  test(! fs_.existsSync(path_.join(BUILD, 'swap-stale')) && ! fs_.existsSync(path_.join(BUILD, 'swap-manifest')), 'a start clears the stale mark and the pending list');
  var susp = run('startCORE', Object.assign({ SUSPEND: true }, JBR21));
  test(/suspend=y/.test(susp.commands[0]), 'start-core --hot-swap -s: the server waits for the debugger');
  var quoted = run('startCOREAsync', Object.assign({}, JBR21, { SERVER_JAVA_HOME: JBR21.SERVER_JAVA_HOME + '/../x y' }));
  test(quoted.spawned.length === 0 || /^'.* .*'$/.test(quoted.spawned[0].file), 'a java home with a space is quoted for bash');

  // --hot-swap with runs it does not apply to: refused in words
  ['all', 'buildJar', 'buildResourcesJar', 'runTests', 'javaBenchmarks'].forEach(t => {
    var g = { HOT_SWAP: true, TAR: false, JAR: true, SERVER_JAVA_HOME: '' };
    var rr = run(t, g);
    test(rr.errors.length === 1 && /does not apply to/.test(rr.errors[0]), t + ' with --hot-swap is refused: ' + ( rr.errors[0] || '(not refused)' ).slice(0, 70));
  });

  var l = load();
  ['startCORETest', 'startCOREJar', 'startCOREJarAsync'].forEach(t => {
    var src = l.pom.tasks[t][3].toString();
    test(! /HOT_SWAP|startServerJvm|AllowEnhancedClassRedefinition|SERVER_JAVA_HOME/.test(src), t + ' never gets hot swap');
  });
  var withFlag = run('startCORETest', Object.assign({ LOG_LEVEL: '', TESTS: '', TEST_SIDE: '', TEST_SUITES: '', TEST_HEADED: false, JAR_OUT: 'j', JAR_RES_OUT: 'r' }, JBR21));
  test(withFlag.commands.length === 1 && ! /AllowEnhanced|jdwp/.test(withFlag.commands[0]), 'start-core-test with --hot-swap set still has no swap flag');
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
    if ( fs_.existsSync(newer) ) {
      fs_.writeFileSync(path_.join(dir, 'Main.java'), src(3));
      child_.execFileSync(newer, ['--release', '24', '-d', classes, path_.join(dir, 'Main.java')]);
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
      console.log('  skip refusal: no newer javac (set HOTSWAP_NEWER_JAVAC)');
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
  smoke();
  fs_.rmSync(BUILD, { recursive: true, force: true });
  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  process.exitCode = failures ? 1 : 0;
}

if ( require.main === module ) main();
