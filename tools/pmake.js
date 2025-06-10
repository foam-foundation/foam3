#!/usr/bin/env node
/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
//
// POM Make - POM Specific Build Tool
//
// Recursively traverses POMs applying specified makers.
//
// Uses the Visitor design pattern, with Makers actually being visitors.
//
// Makers which use the same flags can be run together in a single pmake call
//
// Standard Makers Include:
//
//   CopyMaker    : copy from source to target directory. source/* -> target/
//   DocMaker     : copies .flow files into /build/documents
//   EnvMaker     : capture pom environment variables
//   JavaMaker    : generates .java files from .js models
//   JavacMaker   : create /build/javacfiles file containing list of modified or static .java files, call javac
//   JournalMaker : copies .jrl files into /build/journals
//   JsMaker      : create a minified foam-bin.js file
//   MavenMaker   : build a Maven pom.xml from javaDependencies, call maven if pom.xml updated
//   TaskMaker    : capture pom tasks for later execution when same named build task is run.
//   VerboseMaker : print out information about POMs and files visited

const fs_   = require('fs');
const path_ = require('path');

var pmake = function(...args) {
  var self = this;

  // Recreate foam for each call to pmake as
  // each call to pmake uses a different set of flags which control
  // how the model files are processed.
  delete require.cache[require.resolve('../src/foam.js')];
  delete require.cache[require.resolve('../src/foam_node.js')];
  delete globalThis.foam;
  require('../src/foam_node.js');

  // TODO: new version of processArgs which takes a map
  var [argv, X, flags] = require('./processArgs')(
    args,
    {
      path:        './'
    },
    {
      verbose:     false   // print extra status information
    }
  );

  globalThis.X       = X;
  globalThis.flags   = flags;

  /** 'makers' format: task1,task2,task3(args),... where args are optional **/
  var makers = X.makers.split(',').map(m => {
    var maker;
    var [_, makerName, _, makerArgs] = m.match(/([a-zA-Z0-9]*)(\((.*)\))?/);

    var loc = path_.join(__dirname, X.path, makerName + "Maker.js");

    if (!fs_.existsSync(loc)) {
      loc = path_.join(process.cwd(), X.path, makerName + "Maker.js");
    }
    maker = require(loc);
    if ( maker ) maker.name = m;
    if ( maker && maker.init ) maker.init.bind(this, makerArgs)();

    return maker;
  });

  // update globalThis.foam.flags after Makers initialized
  globalThis.foam.flags = flags;
  globalThis.foam.setupFlags();

  var processDir = function (pom, location, skipIfHasPOM) {
    self.verbose('\tdirectory:', location);
    var files = fs_.readdirSync(location, {withFileTypes: true});

    if ( skipIfHasPOM && files.find(f => f.name.endsWith('pom.js')) ) {
      return;
    }

    files.forEach(f => {
      var fn = location + '/' + f.name;
      if ( f.isDirectory() ) {
        if ( ! f.name.startsWith('.') ) {
          if ( f.name.endsWith('build') || f.name.endsWith('build2') ) return;
          if ( f.name.indexOf('android') != -1 ) return;
          if ( f.name.indexOf('examples') != -1 ) return;
          if ( f.name.endsWith('test') && ! flags.test ) return;
          if ( f.name.endsWith('tests') && ! flags.test ) return;
          if ( ! this.isExcluded(pom, fn) ) processDir.bind(this, pom, fn, true)();
        }
        makers.forEach(v => v.visitDir && v.visitDir.bind(this, pom, f, fn)());
      } else {
        makers.forEach(v => v.visitFile && v.visitFile.bind(this, pom, f, fn)());
      }
    });
  }.bind(this);

  var SUPER = foam.POM;
  var seen  = {};

  foam.POM = function(pom) {
    if ( seen[foam.sourceFile] ) {
      return;
    }
    seen[foam.sourceFile] = true;

    pom.location = foam.cwd;
    pom.path     = foam.sourceFile;

    makers.forEach(v => {
      self.verbose('[pmake] visitPOM', v.name, pom);
      v.visitPOM && v.visitPOM.bind(self, pom)();
    });
    if ( ! seen[foam.cwd] ) {
      self.verbose('[pmake] procesDir', pom.path );
      processDir.bind(self, pom, foam.cwd, false, makers)();
      seen[foam.cwd] = true;
    }

    SUPER(pom);
    makers.forEach(v => v.endVisitPOM && v.endVisitPOM(pom));
  }.bind(self);

  // Speeds up Makers like Verbose and JS which don't need to load .js model files.
  if ( ! foam.flags.loadFiles ) foam.loadFiles = function() {};

  X.pom.split(',').forEach(function(pom) {
    this.verbose(`[pmake] pom ${pom}`);
    var path;
    try {
      path = path_.resolve(foam.cwd, pom) + '.js';
      foam.require(pom, false, true);
    } catch (e) {
      this.error('[pmake] Unable to load POM', path, '\n', e);
    }
  }.bind(this));

  makers.forEach(v => v.end && v.end.bind(this)());

  if ( makers.length == 1 ) {
    return makers[0];
  }
  let map = new Map();
  Object.keys(makers).forEach(m => {
    let maker = makers[m];
    map.set(maker.name, maker);
  });
  return map;
};

module.exports = pmake;
