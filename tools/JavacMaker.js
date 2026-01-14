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

    var cmd = `javac -parameters ${X.javacParams} -d ${X.d} -classpath "${X.d}:${X.libdir}/*" @${X.builddir}/javacfiles`;

    this.log('[Javac] Compiling', X.javaFiles.length ,'java files:', cmd);
    try {
      this.execSync(cmd, {stdio: SILENT ? 'ignore' : 'inherit'});
    } catch(x) {
      process.exit(1);
    }
  } else {
    this.log('[Javac] No Updates');
  }
}
