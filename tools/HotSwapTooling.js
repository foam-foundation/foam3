/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Java hot swap for local source runs (see doc/guides/Build.md, "Java hot swap"). Not in the default
// tooling: include it with -T+HotSwap.
//
//   --hot-swap   start CORE on a JVM that can redefine classes (JetBrains Runtime), with a debug port
//                that listens on 127.0.0.1 only. Use --server-java-home to choose that JVM.
//   --swap       build the changed classes, then send them into the running CORE.
//
// It plugs into JavaTooling through tasks of the same name, which the build runs after JavaTooling's own:
// pomEnvs (refuse runs it does not apply to), javacParameters (ask JavacMaker for the swap manifest),
// genJava (send the changed classes in) and serverJvmArgs (the JVM arguments of start-core).
//
// The swap itself is HotSwap.java (JDI), started with the same JVM as the server. The helpers below use
// no build globals, so tests and foamctl can take them from module.exports.

const fs_    = require('fs');
const path_  = require('path');
const child_  = require('child_process');
const crypto_ = require('crypto');

// Exit codes of a swap, also the build's exit code.
const SWAPPED = 0, BUILD_FAILED = 1, REFUSED = 2, NO_ATTACH = 3, HELPER_FAILED = 4, TIMED_OUT = 5;

// The one table of them. help: the words of the --swap help text. words: the short sentence a tool
// that runs the build (foamctl) says for the code. The helper's own text, when it has one, is what the build prints:
// one result line with the count and the time, and for a refusal "restart needed (why)".
const OUTCOMES = [
  { code: SWAPPED,       help: 'swapped or nothing to do',   words: 'swapped, or nothing had changed' },
  { code: BUILD_FAILED,  help: 'build failed',               words: 'the build failed (nothing was swapped)' },
  { code: REFUSED,       help: 'restart needed',             words: 'restart needed (the swap was refused, see why above): down, then up' },
  { code: NO_ATTACH,     help: 'cannot attach',              words: 'cannot attach to the debug port' },
  { code: HELPER_FAILED, help: 'helper failed',              words: 'the swap helper failed' },
  { code: TIMED_OUT,     help: 'timed out',                  words: 'the swap timed out' }
];
const outcomeWords = code => ( OUTCOMES.find(o => o.code === code) || {} ).words;
const exitCodeHelp = () => OUTCOMES.map(o => `${o.code} ${o.help}`).join(', ');

const SWAP_FLAG       = '-XX:+AllowEnhancedClassRedefinition';
const SWAP_HELPER     = path_.join(__dirname, 'HotSwap.java');
const SWAP_TIMEOUT_MS = 120000;

// The debug agent. Always the loopback address: anything that can reach the port can run code
// in the server, and the agent has no login.
const jdwp = (port, suspend) => `-agentlib:jdwp=transport=dt_socket,server=y,suspend=${suspend ? 'y' : 'n'},address=127.0.0.1:${port}`;

// Class file version a javac --release produces: release 21 is 65.
const classVersion = release => Number(release) + 44;

const javaBin = javaHome => javaHome ? path_.join(javaHome, 'bin', 'java') : 'java';

// What the server JVM gets for these settings. args go on its command line, never into
// JAVA_TOOL_OPTIONS: that reaches every JVM the server starts (a test run, a build), and
// a JVM that is not a JetBrains Runtime stops on the swap flag.
// With a release, the JVM is checked too (see checkJvm); the swap step passes none.
// Answers { java, args, error }.
function serverJvm({ hotSwap, javaHome, debugPort, suspend, platform, release, run }) {
  const java = javaBin(javaHome);
  if ( ! hotSwap ) return { java, args: [], error: null };
  if ( platform === 'win32' ) return { java, args: [], error: '--hot-swap is not supported on Windows' };
  if ( release ) {
    const check = checkJvm({ java, release, run });
    if ( ! check.ok ) return { java, args: [], error: check.message };
  }
  return { java, args: [ SWAP_FLAG, jdwp(debugPort, suspend) ], error: null };
}

// Runs the JVM and answers { ok, message }: it must accept the swap flag and run the classes javac
// writes for --release (a JVM older than the release cannot load them).
// run(file, args) answers { status, output }; tests hand in their own.
function checkJvm({ java, release, run = runJava }) {
  const r = run(java, [ SWAP_FLAG, '-XshowSettings:properties', '-version' ]);
  if ( r.status !== 0 ) {
    return { ok: false, message: `${java} does not accept ${SWAP_FLAG} (it needs a JetBrains Runtime). Its answer: ${firstLine(r.output)}. ${GET_JBR}` };
  }
  const m = /java\.class\.version = (\d+)/.exec(r.output);
  if ( ! m ) return { ok: false, message: `cannot read the class file version of ${java}` };
  const have = Number(m[1]), need = classVersion(release);
  if ( have < need ) {
    return { ok: false, message: `${java} runs class files up to version ${have}, but the build writes version ${need} (--java-release:${release}). Use --java-release:${have - 44} or a newer JetBrains Runtime.` };
  }
  return { ok: true, message: '' };
}

// Files in the build folder that tie the running server to its classes:
//   swap-live      written when a hot swap server starts
//   swap-stale     written by JavacMaker when a build without --swap changed classes after that
//   swap-manifest  the classes changed by --swap builds and not yet swapped in (kept until a swap succeeds)
const SWAP_LIVE = 'swap-live', SWAP_STALE = 'swap-stale', SWAP_MANIFEST = 'swap-manifest';

// serverJvm for the tasks that start CORE, and, when it is a hot swap start, the baseline: the classes
// on disk are the ones the server is about to load, so nothing is pending and nothing is stale.
function startServerJvm(options) {
  const jvm = serverJvm(options);
  if ( options.hotSwap && ! jvm.error ) {
    const dir = options.buildDir;
    fs_.mkdirSync(dir, { recursive: true });
    fs_.writeFileSync(path_.join(dir, SWAP_LIVE), '');
    [ SWAP_STALE, SWAP_MANIFEST ].forEach(f => fs_.rmSync(path_.join(dir, f), { force: true }));
  }
  return jvm;
}

// Why this run cannot have --hot-swap, or null. kind: 'test runs', 'jar and tar builds'.
const hotSwapRefusal = kind => `--hot-swap is for local source runs (start-core): it does not apply to ${kind}. Leave it out.`;

// Nothing swapped since a build without --swap changed classes: the swap cannot know which, so the server must restart.
const swapIsStale = buildDir => fs_.existsSync(path_.join(buildDir, SWAP_STALE));

// A swap went through: its classes are no longer pending.
const swapClearPending = buildDir => fs_.rmSync(path_.join(buildDir, SWAP_MANIFEST), { force: true });

const secondsSince = start => ( ( Date.now() - start ) / 1000 ).toFixed(1) + ' s';

// The time a --swap run starts at: the helper tells how long the whole run took, build included.
let swapStartedAt = Date.now();

const firstLine = text => String(text).trim().split('\n')[0];

function runJava(file, args) {
  const r = child_.spawnSync(file, args, { encoding: 'utf8', timeout: 30000 });
  return { status: r.error ? -1 : r.status, output: ( r.stdout || '' ) + ( r.stderr || '' ) + ( r.error ? String(r.error) : '' ) };
}

// Sends the classes named in manifest (class file paths relative to classesDir, one per line) into the
// JVM on the debug port. Answers { code, message }. spawn is child_process.spawnSync; tests hand in their own.
function swapClasses({ java, port, classesDir, manifest, startedAt = Date.now(), spawn = child_.spawnSync }) {
  // The debug agent is not wanted in the helper: it would take the server's port.
  const env = Object.assign({}, process.env);
  delete env.JAVA_TOOL_OPTIONS;
  const r = spawn(java, [ SWAP_HELPER, String(port), classesDir, manifest, String(startedAt) ], { timeout: SWAP_TIMEOUT_MS, env, encoding: 'utf8' });
  return swapAnswer(r);
}

// The code and words for what the helper did (r is a spawnSync result).
function swapAnswer(r) {
  const text = ( String(r.stdout || '') + String(r.stderr || '') ).trim();
  if ( r.error && r.error.code === 'ETIMEDOUT' ) return { code: TIMED_OUT, message: `the swap took more than ${SWAP_TIMEOUT_MS / 1000} s and was stopped` };
  if ( r.error ) return { code: HELPER_FAILED, message: `the swap helper could not start: ${r.error.message}` };
  const helperSpeaks = [ SWAPPED, REFUSED, NO_ATTACH ].includes(r.status);
  if ( ! helperSpeaks && /package com\.sun\.jdi|module jdk\.(jdi|compiler)|jdk\.compiler/.test(text) ) {
    return { code: HELPER_FAILED, message: `the swap helper needs the JDK modules jdk.compiler and jdk.jdi, and this JVM lacks them: use a JetBrains Runtime SDK (jbrsdk), not a JRE.\n${text}` };
  }
  if ( helperSpeaks ) return { code: r.status, message: text };
  return { code: HELPER_FAILED, message: `the swap helper failed (exit ${r.status}):\n${text}` };
}

// The file names (relative to classesDir) a build wrote; [] when it wrote none or the file is gone.
function readSwapManifest(file) {
  try { return fs_.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; }
}

// ---- getting a JetBrains Runtime

// Where installJbr puts it, and where --hot-swap looks when --server-java-home is not given.
const JBR_DIR = home => path_.join(home, 'jbr');
const GET_JBR = 'Get one into ~/jbr with: ./build.sh -T+HotSwap installJbr (or see doc/guides/Build.md, "Options and Tasks of interest", --hot-swap).';
const JBR_RELEASES = 'https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases/latest';

// The folder with bin/java under dir, up to depth levels down (the mac download is <name>/Contents/Home);
// the newest name first. null when there is none.
function findJbr(dir, depth = 3) {
  if ( fs_.existsSync(path_.join(dir, 'bin', 'java')) ) return dir;
  if ( depth === 0 ) return null;
  var names;
  try { names = fs_.readdirSync(dir).sort().reverse(); } catch (e) { return null; }
  for ( var n of names ) {
    var found = findJbr(path_.join(dir, n), depth - 1);
    if ( found ) return found;
  }
  return null;
}

// The download link of the plain JBR SDK for this machine, read from a release's notes (a table of links). The SDK,
// not the JBR alone: the swap helper needs its jdk.jdi and jdk.compiler modules. null when the notes have none.
function jbrSdkUrl(notes, platform, arch) {
  var os = { darwin: 'osx', linux: 'linux' }[platform], cpu = { arm64: 'aarch64', x64: 'x64' }[arch];
  if ( ! os || ! cpu ) return null;
  var m = new RegExp(`https://cache-redirector\\.jetbrains\\.com/intellij-jbr/jbrsdk-[0-9.]+-${os}-${cpu}-b[0-9.]+\\.tar\\.gz(?=\\))`).exec(notes);
  return m ? m[0] : null;
}

// The SHA-512 of a file, as the .checksum file next to each download states it.
const sha512 = file => crypto_.createHash('sha512').update(fs_.readFileSync(file)).digest('hex');

module.exports = { findJbr, jbrSdkUrl, sha512, JBR_DIR, startServerJvm, hotSwapRefusal, swapIsStale, swapClearPending, SWAP_LIVE, SWAP_STALE, SWAP_MANIFEST, serverJvm, checkJvm, swapClasses, swapAnswer, readSwapManifest, classVersion, jdwp, SWAP_FLAG, OUTCOMES, outcomeWords, exitCodeHelp, SWAPPED, BUILD_FAILED, REFUSED, NO_ATTACH, HELPER_FAILED, TIMED_OUT };

// The runs --hot-swap does not apply to stop at the first hook each one passes before its work. Every hook
// checks, because a task runs once per build: on a line of several tasks, an earlier task may have run pomEnvs
// before a later one set JAR. this is the task's.
function refusePackaging() {
  if ( HOT_SWAP && ( TAR || JAR ) ) this.error(hotSwapRefusal('jar and tar builds'));
}
function refuseTests() {
  if ( HOT_SWAP ) this.error(hotSwapRefusal('test and benchmark runs'));
}

foam.POM({
  name: 'hot-swap',
  description: 'Java hot swap for local source runs: --hot-swap starts CORE so that --swap can send changed classes into it. Include with -T+HotSwap.',

  options: {
    hotSwap: ['', 'hot-swap', 'HOT_SWAP', "Start CORE so that --swap can send changed Java classes into it without a restart: the JVM gets -XX:+AllowEnhancedClassRedefinition (a JetBrains Runtime; choose it with --server-java-home) and a JDWP debug port on 127.0.0.1 (--debug-port, default 8000). Local source runs only (start-core, start-core-async). Any process on this machine can attach to that port: there is no login. Not on Windows. See doc/guides/Build.md.", false, function(arg) { HOT_SWAP = arg ? this.bool(arg) : true; } ],
    swap: ['', 'swap', 'SWAP', "Build the changed Java classes, then send them into the CORE that is running with --hot-swap on the same --debug-port, without a restart. Implies --hot-swap and --build-only. Exit code: " + exitCodeHelp() + ". See doc/guides/Build.md.", false, function(arg) { SWAP = arg ? this.bool(arg) : true; if ( SWAP ) { HOT_SWAP = true; BUILD_ONLY = true; } } ],
  },

  tasks: {
    pomEnvs:   ['pom-envs',   'Stop --hot-swap on a jar or tar build (-a, -k). Without --server-java-home, run on the JetBrains Runtime in ~/jbr.', [], function() {
      refusePackaging.call(this);
      if ( HOT_SWAP && ! SERVER_JAVA_HOME ) SERVER_JAVA_HOME = findJbr(JBR_DIR(HOME_DIR)) || '';
    }],
    // Test and benchmark runs both clean their deployment before they build.
    cleanTest: ['clean-test', 'Stop --hot-swap on a test or benchmark run.',     [], refuseTests],

    javacParameters: ['javac-parameters', 'Stop --hot-swap on a build that makes a jar. With --swap, JavacMaker compiles aside and lists the classes that changed.', [], function() {
      refusePackaging.call(this);
      if ( SWAP ) JAVA_MAKER_ARGS += ` -swapManifest=${BUILD_DIR}/${SWAP_MANIFEST}`;
    }],

    genJava: ['gen-java', 'With --swap, send the classes just built into the running CORE.', [], function() {
      if ( SWAP ) this.execute('hotSwap');
    }],

    serverJvmArgs: ['server-jvm-args', 'With --hot-swap, check the JVM, add the swap flag and the debug agent, and mark the classes on disk as the live ones.', [], function() {
      if ( ! HOT_SWAP || BUILD_ONLY ) return;
      var jvm = startServerJvm({ hotSwap: true, javaHome: SERVER_JAVA_HOME, debugPort: DEBUG_PORT, suspend: SUSPEND, platform: process.platform, release: JAVA_RELEASE, buildDir: BUILD_DIR });
      if ( jvm.error ) this.error(jvm.error);
      SERVER_JVM_ARGS.push(...jvm.args);
    }],

    hotSwap: ['hot-swap', 'Send the classes the --swap builds changed, and the server has not got yet, into the CORE running with --hot-swap.', [], function() {
      if ( swapIsStale(BUILD_DIR) ) {
        console.log('restart needed (a build without --swap changed classes): the swap cannot know which, so the server must restart');
        process.exit(REFUSED);
      }
      var names = readSwapManifest(`${BUILD_DIR}/${SWAP_MANIFEST}`);
      if ( ! names.length ) {
        console.log(`nothing to swap: no class changed (${secondsSince(swapStartedAt)})`);
        return;
      }
      var jvm = serverJvm({ hotSwap: true, javaHome: SERVER_JAVA_HOME, debugPort: DEBUG_PORT, platform: process.platform });
      if ( jvm.error ) this.error(jvm.error);
      var r = swapClasses({ java: jvm.java, port: DEBUG_PORT, classesDir: `${BUILD_DIR}/classes`, manifest: `${BUILD_DIR}/${SWAP_MANIFEST}`, startedAt: swapStartedAt });
      if ( r.message ) console.log(r.message);
      // The classes stay listed until a swap went through: a refused or failed one is tried again by the next --swap.
      if ( r.code ) process.exit(r.code);
      swapClearPending(BUILD_DIR);
    }],

    installJbr: ['install-jbr', 'Download the JetBrains Runtime SDK that hot swap needs (the newest release, from JetBrains\' GitHub releases) into ~/jbr, checked against its SHA-512. Nothing to do when ~/jbr has one.', [], function() {
      var dir  = JBR_DIR(HOME_DIR);
      var have = findJbr(dir);
      if ( have ) { console.log(`a JetBrains Runtime is already in ${have}: nothing to do`); return; }
      var url = jbrSdkUrl(JSON.parse(this.execSync(`curl -fsSL ${JBR_RELEASES}`).toString()).body || '', process.platform, process.arch);
      if ( ! url ) this.error(`the newest JetBrains Runtime release has no SDK for ${process.platform} ${process.arch}: download a jbrsdk build from https://github.com/JetBrains/JetBrainsRuntime/releases and unpack it into ${dir}`);
      fs_.mkdirSync(dir, { recursive: true });
      var file = path_.join(dir, path_.basename(url));
      console.log(`downloading ${url}`);
      this.execSync(`curl -fL --progress-bar -o '${file}' '${url}'`, { stdio: 'inherit' });
      var want = this.execSync(`curl -fsSL '${url}.checksum'`).toString().trim().split(/\s+/)[0];
      if ( sha512(file) !== want ) { fs_.rmSync(file, { force: true }); this.error(`the download of ${url} does not match its SHA-512: deleted, try again`); }
      this.execSync(`tar -xzf '${file}' -C '${dir}'`);
      fs_.rmSync(file, { force: true });
      console.log(`installed the JetBrains Runtime in ${findJbr(dir)}. --hot-swap uses it when --server-java-home is not given.`);
    }],

    usage: ['usage', 'Hot swap usage examples', [], function() {
      this.log('\nJava hot swap (-T+HotSwap):');
      this.log('  ./build.sh -T+HotSwap installJbr');
      this.log('    Download the JetBrains Runtime hot swap needs into ~/jbr (once).');
      this.log('  ./build.sh -T+HotSwap -Ndemo -W8300 --hot-swap -D8305  ;  ./build.sh -T+HotSwap -Ndemo -W8300 --hot-swap -D8305 --swap');
      this.log('    Run on the JetBrains Runtime in ~/jbr (or --server-java-home) with a loopback debug port, then (second line, other terminal) build the changed Java and send it into the running server without a restart.');
    }]
  }
});
