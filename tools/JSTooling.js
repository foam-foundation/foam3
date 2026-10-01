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
    withoutStages: [ 'w', 'without-stages', 'WITHOUT_STAGES', 'Generate a single foam-bin file.', false, function(arg) { WITHOUT_STAGES = arg ? this.bool(arg) : true; } ],
    lspAutoUpdate: [ '', 'lsp-auto-update', 'LSP_AUTO_UPDATE', 'Use --lsp-auto-update:false to stop builds updating the FOAM-LSP clone; the setting is saved until --lsp-auto-update:true.', true, function(arg) { LSP_AUTO_UPDATE = arg ? this.bool(arg) : true; require('./lspClone').setAutoUpdate(process.env, LSP_AUTO_UPDATE); } ]
  },

  tasks: {
    cleanFOAM: ['clean-foam', 'Remove foam-bin files.', [], function() {
      this.execSync(`rm -f ${BUILD_DIR}/js/foam-bin-* >/dev/null 2>&1`);
      this.execSync(`rm -f ${BUILD_DIR}/webroot/foam-bin-* >/dev/null 2>&1`);
    }],

    genFoamBinVersion: ['gen-foam-bin-version', 'Generate version string for the foam-bin, with our without a timestamp', [], function() {
      FOAM_BIN_VERSION = `${VERSION}` + (TIMESTAMP_FOAM_BIN ? `-${TIMESTAMP}` : '');
    }],

    lspInstall: ['lsp-install', 'Clone FOAM-LSP into $FOAM_LSP_HOME (default ~/.foam/lsp) and install an editor or MCP-agent integration. Editors: lsp-install:vscode, lsp-install:emacs, lsp-install:zed. MCP agents: lsp-install:claude-code, lsp-install:codex, lsp-install:gemini, lsp-install:cursor, lsp-install:pi.', [], function(args) {
      var dir = require('./lspClone').install(process.env);
      require('child_process').execSync(`"${dir}/install.sh" ${args || ''}`, { stdio: 'inherit' });
    }],

    lspUpdate: ['lsp-update', 'Fast-forward the FOAM-LSP clone now.', [], function() {
      this.info('[lsp] ' + require('./lspClone').update(process.env, { force: true }));
    }],

    lspRefresh: ['lsp-refresh', 'Fast-forward the FOAM-LSP clone, at most once a day. Runs before every build; does nothing when FOAM-LSP is not installed.', [], function() {
      if ( ! LSP_AUTO_UPDATE ) return;
      try {
        var status = require('./lspClone').update(process.env, {});
        if ( status === 'updated' ) this.info('[lsp] FOAM-LSP updated');
      } catch (e) {
        this.warning('[lsp] FOAM-LSP update skipped: ' + String(e.message).split('\n')[0]);
      }
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
