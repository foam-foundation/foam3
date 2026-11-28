/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// HotSwapTooling: Java hot swap for local source runs. No foam globals here, so it can be tested alone.
//
//   --hot-swap          start CORE on a JVM that can redefine classes (JetBrains Runtime), with
//                       a debug port that listens on 127.0.0.1 only. Use --server-java-home
//                       to choose that JVM.
//   --swap              build the changed classes, then send them into the running CORE.
//
// The swap itself is HotSwap.java (JDI), started with the same JVM as the server.
// See doc/guides/Build.md, "Java hot swap".

const fs_    = require('fs');
const path_  = require('path');
const child_ = require('child_process');

// Exit codes of a swap, also the build's exit code.
const SWAPPED = 0, REFUSED = 2, NO_ATTACH = 3, HELPER_FAILED = 4, TIMED_OUT = 5;

const SWAP_FLAG = '-XX:+AllowEnhancedClassRedefinition';
const HELPER    = path_.join(__dirname, 'HotSwap.java');
const TIMEOUT_MS = 120000;

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
    return { ok: false, message: `${java} does not accept ${SWAP_FLAG} (it needs a JetBrains Runtime). Its answer: ${firstLine(r.output)}` };
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
const LIVE = 'swap-live', STALE = 'swap-stale', MANIFEST = 'swap-manifest';

// serverJvm for the tasks that start CORE, and, when it is a hot swap start, the baseline: the classes
// on disk are the ones the server is about to load, so nothing is pending and nothing is stale.
function startServerJvm(options) {
  const jvm = serverJvm(options);
  if ( options.hotSwap && ! jvm.error ) {
    const dir = options.buildDir;
    fs_.mkdirSync(dir, { recursive: true });
    fs_.writeFileSync(path_.join(dir, LIVE), '');
    [ STALE, MANIFEST ].forEach(f => fs_.rmSync(path_.join(dir, f), { force: true }));
  }
  return jvm;
}

// Why this run cannot have --hot-swap, or null. kind: 'test runs', 'jar and tar builds'.
const refusal = kind => `--hot-swap is for local source runs (start-core): it does not apply to ${kind}. Leave it out.`;

// A path in one word for /bin/bash.
const shellQuote = text => "'" + String(text).replace(/'/g, "'\\''") + "'";

// Nothing swapped since a build without --swap changed classes: the swap cannot know which, so the server must restart.
const isStale = buildDir => fs_.existsSync(path_.join(buildDir, STALE));

// A swap went through: its classes are no longer pending.
const clearPending = buildDir => fs_.rmSync(path_.join(buildDir, MANIFEST), { force: true });

const firstLine = text => String(text).trim().split('\n')[0];

function runJava(file, args) {
  const r = child_.spawnSync(file, args, { encoding: 'utf8', timeout: 30000 });
  return { status: r.error ? -1 : r.status, output: ( r.stdout || '' ) + ( r.stderr || '' ) + ( r.error ? String(r.error) : '' ) };
}

// Sends the classes named in manifest (class file paths relative to classesDir, one per line) into the
// JVM on the debug port. Answers { code, message }. spawn is child_process.spawnSync; tests hand in their own.
function swap({ java, port, classesDir, manifest, spawn = child_.spawnSync }) {
  // The debug agent is not wanted in the helper: it would take the server's port.
  const env = Object.assign({}, process.env);
  delete env.JAVA_TOOL_OPTIONS;
  const r = spawn(java, [ HELPER, String(port), classesDir, manifest ], { timeout: TIMEOUT_MS, env, encoding: 'utf8' });
  return answer(r);
}

// The code and words for what the helper did (r is a spawnSync result).
function answer(r) {
  const text = ( String(r.stdout || '') + String(r.stderr || '') ).trim();
  if ( r.error && r.error.code === 'ETIMEDOUT' ) return { code: TIMED_OUT, message: `the swap took more than ${TIMEOUT_MS / 1000} s and was stopped` };
  if ( r.error ) return { code: HELPER_FAILED, message: `the swap helper could not start: ${r.error.message}` };
  if ( r.status !== SWAPPED && r.status !== REFUSED && r.status !== NO_ATTACH && /package com\.sun\.jdi|module jdk\.(jdi|compiler)|jdk\.compiler/.test(text) ) {
    return { code: HELPER_FAILED, message: `the swap helper needs the JDK modules jdk.compiler and jdk.jdi, and this JVM lacks them: use a JetBrains Runtime SDK (jbrsdk), not a JRE.\n${text}` };
  }
  if ( r.status === SWAPPED )   return { code: SWAPPED, message: text };
  if ( r.status === REFUSED )   return { code: REFUSED, message: text };
  if ( r.status === NO_ATTACH ) return { code: NO_ATTACH, message: text };
  return { code: HELPER_FAILED, message: `the swap helper failed (exit ${r.status}):\n${text}` };
}

// The file names (relative to classesDir) a build wrote; [] when it wrote none or the file is gone.
function readManifest(file) {
  try { return fs_.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; }
}

module.exports = { startServerJvm, refusal, shellQuote, isStale, clearPending, LIVE, STALE, MANIFEST, serverJvm, checkJvm, swap, answer, readManifest, classVersion, jdwp, SWAP_FLAG, SWAPPED, REFUSED, NO_ATTACH, HELPER_FAILED, TIMED_OUT };
