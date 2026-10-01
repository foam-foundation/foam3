/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'eslint',
  description: 'Replaces command line eslint operations and replaces the need for node package.json eslint scripts.',

  options: {
    eslintOpt: ['', 'eslint-opts', 'ESLINT_OPTS', 'Additional options passed to ESLint', function() {
      var args = '';
      if ( MAX_WARNINGS ) {
        args += ` --max-warnings ${MAX_WARNINGS}`;
      }
      if ( FORMAT ) {
        args += ` --format=${FORMAT}`;
      }
      return args;
    }, arg => ESLINT_OPTS = arg],
    dirs: ['', 'directories', 'DIRECTORIES', 'Comma seperated list of directories to inspect', 'src', arg => DIRECTORIES = arg],
    files: ['', 'files', 'FILES', 'Commad seperated list of files to inspect.', '', arg => FILES = arg],
    maxWarnings: ['', 'max-warnings', 'MAX_WARNINGS', 'Number of warnings reported before truncating output', 0, arg => MAX_WARNINGS = arg],
    format: ['', 'format', 'FORMAT', 'Generate detailed report. ex: \'stylish\'', '', arg => FORMAT= arg],
    source: ['', 'source', 'SOURCE', 'File or directory list spaced formatted for passing to eslint.', function() {
      if ( FILES ) return FILES.replaceAll(',', ' ');
      return DIRECTORIES.replaceAll(',', ' ');
    }, arg => SOURCE = arg],
    config: ['', 'config', 'CONFIG', 'Specify eslint config file. Default to \'.eslintrc.js\'.', '.eslintrc.js', arg => CONFIG = arg]
  },

  tasks: {
    all: ['all', 'Default to ESLint check', ['check']],
    check : ['check', 'Run ESLint \'check\' operation.', [], function() {
      try {
        this.log(`Running eslint \'check\' against ${SOURCE} ${ESLINT_OPTS ? 'with'+ESLINT_OPTS : ''}`);
        this.execSync(`npx eslint -c ${CONFIG} ${SOURCE} --ext .js ${ESLINT_OPTS}`, { stdio: 'inherit' });
      } catch(e) {
        // nop - already reported
      }
    }],
    fix: ['fix', 'Run ESLint \'fix\' operation to correct warnings', [], function() {
      try {
        this.log(`Running eslint \'fix\' against ${SOURCE}`);
        this.execSync(`npx eslint -c ${CONFIG} ${SOURCE} --ext .js --fix`, { stdio: 'inherit' });
      } catch(e) {
        // nop - already reported
      }
    }],
    usage: ['usage', 'usage examples', [], function() {
      console.log('ESLint tooling examples');
      console.log('  NOTE: --files and --directories are mutually exclusive. If --files are provided, default directories are ignored.');
      console.log('  ./build.sh -TESLint');
      console.log('    Run eslint reporting/check on default directories: src/ tools/');
      console.log('  ./build.sh -TESLint --config:.eslintrc.js');
      console.log('    Run eslint reporting/check using a custom config file');
      console.log('  ./build.sh -TESLint --max-warnings:8');
      console.log('    Run eslint reporting/check on default directories: src/ tools/ and reduced \'warning\' output');
      console.log('  ./build.sh -TESLint --dirs:tools');
      console.log('    Run eslint reporting/check on directories: tools');
      console.log('  ./build.sh -TESLint --files:src/foam/lang/Model.js --format:stylish');
      console.log('    Run eslint reporting/check on specific file with detailed reporting');
      console.log('  ./build.sh -TESLint --files:src/foam/lang/Model.js');
      console.log('    Run eslint reporting/check on file Model.js');
      console.log('  ./build.sh -TESLint --fix');
      console.log('    Run eslint fix against default directories src/ tools/. Changes can easily be rolled back with the \'git checkout\' operation.');
    }]
  }
});
