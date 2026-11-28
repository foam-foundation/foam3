/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// JavacMaker

// NOTE: JavaMaker and JavacMaker shared data through X, they must
// be run in the same pmake call.

const fs_   = require('fs');
const path_ = require('path');

exports.description = 'create /build/javacfiles file containing list of modified or static .java files, call javac';

exports.args = [
  {
    name: 'javacParams',
    description: 'parameters to pass to javac',
    factory: () => X.javacParams || '-proc:none'
  },
  {
    name: 'libdir',
    description: 'location to write generated .java files, default: {builddir}/lib',
    factory: () => path_.resolve(path_.normalize(X.libdir || (X.builddir + '/lib')))
  },
  {
    // For a tool that applies the changed classes to a running JVM (--swap)
    name: 'swapManifest',
    description: 'file that lists the class files changed in {d} and not yet used by whoever reads the list, one per line, kept between runs: this run adds to it, the reader clears it. When set, javac writes to a staging folder ({d}-swap) first and the classes are moved into {d} only when javac succeeded',
    factory: () => X.swapManifest || ''
  }
];

exports.init = function() {
  this.verbose('[Javac] init');
  this.adaptOrCreateArgs(X, exports.args);
  this.ensureDir(X.libdir);

  X.javaFiles = [];
}

exports.visitPOM = function(pom) {
  var self = this;
  foam.checkFiles(pom.javaFiles, function(f) {
    if ( f.name.endsWith( '*' ) ) {
      // Support non foam/pom projects
      let i = f.name.lastIndexOf('/');
      let path = path_.resolve(foam.cwd, i > 0 ? f.name.substring(0, i) : '');
      includeAll.bind(self, path)();
    } else {
      let path = path_.resolve(foam.cwd, f.name + '.java');
      self.verbose('[Javac] include', path);
      X.javaFiles.push(path);
    }
  });
}

// Support non foam/pom projects
function includeAll(dir) {
  var self = this;
  this.verbose(`[Javac] includeAll ${dir}`);
  var files = fs_.readdirSync(dir, {withFileTypes: true});
  files.forEach(f => {
    let path = path_.resolve(dir, f.name);
    if ( f.isDirectory() ) {
      includeAll.bind(self, path)();
    } else if ( f.name.endsWith('.java') ) {
      self.verbose(`[Javac] includeAll include ${path}`);
      X.javaFiles.push(path);
    }
  });
}

exports.end = function() {
  this.log(`[Javac] END ${X.javaFiles.length} Java files`);

  // Filter out files that aren't newer than their corresponding .class file
  X.javaFiles = X.javaFiles.filter(f => {
    var i = f.indexOf('/src/java');
    var classFile;
    if ( i != -1 ) {
      classFile = X.d + f.substring(i+9).replaceAll('.java', '.class');
    } else {
      i = f.indexOf('/src/');
      classFile = X.d + f.substring(i+4).replaceAll('.java', '.class');
    }
    return ! fs_.existsSync(classFile) || ( fs_.statSync(classFile).mtime < fs_.statSync(f).mtime );
  });

  if ( X.javaFiles.length > 0 ) {
    fs_.writeFileSync(X.builddir + '/javacfiles', X.javaFiles.join('\n') + '\n');

    if ( ! fs_.existsSync(X.d) ) fs_.mkdirSync(X.d, {recursive: true});

    // --swap: javac writes beside {d} and the classes move in whole files after it succeeded, so a running
    // server never loads half a build, and the manifest names what really changed.
    var out = X.swapManifest ? X.d + '-swap' : X.d;
    if ( X.swapManifest ) {
      fs_.rmSync(out, {recursive: true, force: true});
      fs_.mkdirSync(out, {recursive: true});
    }

    var cmd = `javac -parameters ${X.javacParams} -d ${out} -classpath "${X.d}:${X.libdir}/*" @${X.builddir}/javacfiles`;

    this.log('[Javac] Compiling', X.javaFiles.length ,'java files:', cmd);
    try {
      this.execSync(cmd, {stdio: SILENT ? 'ignore' : 'inherit'});
    } catch(x) {
      process.exit(1);
    }

    if ( X.swapManifest ) publishClasses(out, X.d, X.swapManifest);
    else markPlainBuild(X.builddir);
  } else {
    this.log('[Javac] No Updates');
  }
}

// A run that writes {d} directly while a hot swap server lives (the reader of the list writes build/swap-live)
// changes classes the list does not know: build/swap-stale says so, and the reader asks for a restart.
function markPlainBuild(builddir) {
  if ( fs_.existsSync(path_.join(builddir, 'swap-live')) ) fs_.writeFileSync(path_.join(builddir, 'swap-stale'), '');
}

// Moves the classes under from into to. A class whose bytes did not change stays where it is. Adds the
// ones that changed (paths relative to to) to the manifest, which keeps what earlier runs added until its reader clears it.
function publishClasses(from, to, manifest) {
  var changed = [];
  (function walk(dir) {
    fs_.readdirSync(dir, {withFileTypes: true}).forEach(e => {
      var f = path_.join(dir, e.name);
      if ( e.isDirectory() ) return walk(f);
      var rel = path_.relative(from, f);
      var dest = path_.join(to, rel);
      var bytes = fs_.readFileSync(f);
      if ( fs_.existsSync(dest) && fs_.readFileSync(dest).equals(bytes) ) {
        // Newer than its source again, or the next run compiles it again.
        var now = new Date();
        fs_.utimesSync(dest, now, now);
        return;
      }
      fs_.mkdirSync(path_.dirname(dest), {recursive: true});
      // Same folder, then rename: a loader sees the old file or the new one, never a part.
      fs_.writeFileSync(dest + '.tmp', bytes);
      fs_.renameSync(dest + '.tmp', dest);
      changed.push(rel);
    });
  })(from);
  fs_.rmSync(from, {recursive: true, force: true});
  var all = new Set(fs_.existsSync(manifest) ? fs_.readFileSync(manifest, 'utf8').split('\n').filter(Boolean) : []);
  changed.forEach(c => all.add(c));
  fs_.writeFileSync(manifest, [...all].sort().join('\n') + ( all.size ? '\n' : '' ));
}

exports.publishClasses = publishClasses;
exports.markPlainBuild = markPlainBuild;
