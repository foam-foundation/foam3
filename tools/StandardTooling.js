/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'standard',

  options: {
    appName: [ 'N', 'app-name', 'APP_NAME', "Name used to construct a unique deployment directory, '/opt/NAME'.  Can be used to name and retain journal data rather than delete with \'j\'.  Also used to support multiple running applications. NOTE Each applications also requires a unique WEB_PORT (-W).", '', args => APP_NAME = args ],
    appHome: [ '','app-home', 'APP_HOME', 'Application root directory. To symultaniously deploy multiple applications, give each a unique APP_NAME and WEB_PORT',() => APP_NAME ? APP_ROOT + '/' + APP_NAME : 'APP_ROOT/APP_NAME', arg => APP_HOME = arg ],
    appRoot: [ '', 'app-root', 'APP_ROOT', 'Application root directory','/opt', arg => APP_ROOT = arg ],
    clean: [ 'c', 'clean', 'CLEAN', 'Clean generated code before building.  Required if generated classes have been removed. Use -XcleanAll to remove build/ directory. NOTE: if compilation fails after option c is issued, clean is again required until a succesful build.', false, function(arg) { CLEAN = arg ? this.bool(arg) : true; } ],
    cleanAll: [ '', 'clean-all', 'CLEAN_ALL', 'Clean application lib/, and remove build/ directory.',false, function(arg) { CLEAN_ALL = arg ? this.bool(arg) : true; } ],
    autoConfirm: [ 'y', 'auto-confirm', 'AUTO_CONFIRM', 'Suppress prompt for tasks which require confirmation, such as \'-j\'.', false, function(arg) { AUTO_CONFIRM = arg ? this.bool(arg) : true; } ]
  },

  tasks: {
    clean: ['clean', 'Remove generated files', [], function(args) {
      if ( args === 'all') { // -Xclean:all
        this.execute('cleanAll');
      }

      if ( this.existsSync(BUILD_DIR) ) {
        var files = this.readdirSync(BUILD_DIR, {withFileTypes: true});
        files.forEach(f => {
          if ( f.name === 'lib' ) return; // handled via cleanLib

          var fn = BUILD_DIR + '/' + f.name;
          if ( f.isDirectory() ) this.rmdir(fn);
          if ( f.isFile()      ) this.rmfile(fn);
        });
      }
    }],

    exit: [ 'exit', 'Terminate the build. Example --buildJar,exit', [], function(args) {
      process.exit(args ? 1 : 0);
    }],

    usage: ['usage', 'Build usage examples', [], function() {
      this.log('CLI examples:');
      this.log('  ./build.sh -c');
      this.log('    Remove previously generated code, before rebuilding.');
      this.log('  ./build.sh -Ntestset1');
      this.log('    Build and deploy into a unique deployment directory. Use this to name and retain journal test sets for later selection.');
      this.log('  ./build.sh --cleanAll,all');
      this.log('    Remove entire build/ diretory, including third-party java libraries, before building normally.');
      this.log('  ./build.sh --help:foo');
      this.log('    Print usage for \'foo\'. Ex: ./build.sh --help:cleanAll or ./build.sh --help:N');
    }]
  }
});
