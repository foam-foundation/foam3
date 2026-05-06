/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'js',

  envs: {
    FOAM_BIN_VERSION:  ['foam-bin version string, with or without timestamp'],
  },

  options: {
    timestampFoamBin: [ 'g', 'timestamp-foam-bin', 'TIMESTAMP_FOAM_BIN', 'Use --timestamp-foam-bin:false to not timestamp foam-bin javascript file to retain breakpoints during development cycle.', true, function(arg) { TIMESTAMP_FOAM_BIN = arg ? this.bool(arg) : false; } ],
    withoutStages: [ 'w', 'without-stages', 'WITHOUT_STAGES', 'Generate a single foam-bin file.', false, function(arg) { WITHOUT_STAGES = arg ? this.bool(arg) : true; } ]
  },

  tasks: {
    cleanFOAM: ['clean-foam', 'Remove foam-bin files.', [], function() {
      this.execSync(`rm -f ${BUILD_DIR}/js/foam-bin-* >/dev/null 2>&1`);
      this.execSync(`rm -f ${BUILD_DIR}/webroot/foam-bin-* >/dev/null 2>&1`);
    }],

    genFoamBinVersion: ['gen-foam-bin-version', 'Generate version string for the foam-bin, with our without a timestamp', [], function() {
      FOAM_BIN_VERSION = `${VERSION}` + (TIMESTAMP_FOAM_BIN ? `-${TIMESTAMP}` : '');
    }],

    lspInstall: ['lsp-install', 'Install FOAM LSP editor integration. Use lsp-install:vscode, lsp-install:emacs, or lsp-install:zed for a specific editor.', [], function(args) {
      var editor = args || '';
      var script = this.join(__dirname, 'lsp/install.sh');
      require('child_process').execSync(`${script} ${editor}`, { stdio: 'inherit' });
    }],

    genJS: ['gen-js', 'Build foam-bin.js', ['cleanFOAM', 'genFoamBinVersion'], function() {
      let version = FOAM_BIN_VERSION;
      let flags = this.flag();
      let outdir = BUILD_DIR+'/js';
      let bundles = globalThis.CLIENT_BUNDLES;

      let runStages = (pom, bundle) => {
        let bundleArg = bundle ? ` -bundle=${bundle}` : '';
        if ( WITHOUT_STAGES ) {
          this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${pom} -builddir=${BUILD_DIR} -outdir=${outdir}${bundleArg}`)();
        } else {
          this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${pom} -builddir=${BUILD_DIR} -outdir=${outdir} -stage=0${bundleArg}`)();
          this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${pom} -builddir=${BUILD_DIR} -outdir=${outdir} -stage=1${bundleArg}`)();
          this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${pom} -builddir=${BUILD_DIR} -outdir=${outdir} -stage=2${bundleArg}`)();
        }
      };

      if ( bundles && bundles.length ) {
        bundles.forEach(bundle => {
          runStages(bundle.poms, bundle.name);
        });
      } else {
        runStages(POMS);
      }
    }]
  }
});
