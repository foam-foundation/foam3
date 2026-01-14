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

    genJS: ['gen-js', 'Build foam-bin.js', ['cleanFOAM', 'genFoamBinVersion'], function() {
      let version = FOAM_BIN_VERSION;
      var flags = this.flag();
      let outdir = BUILD_DIR+'/js';
      if ( WITHOUT_STAGES ) {
        this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${POMS} -builddir=${BUILD_DIR} -outdir=${outdir}`)();
      } else {
        this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${POMS} -builddir=${BUILD_DIR} -outdir=${outdir} -stage=0`)();
        this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${POMS} -builddir=${BUILD_DIR} -outdir=${outdir} -stage=1`)();
        this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${POMS} -builddir=${BUILD_DIR} -outdir=${outdir} -stage=2`)();
      }
      // again for node version
      flags = this.flag('node');
      this.pmake.bind(this, `-flags=${flags} -makers=JS -version=${version} -pom=${POMS} -builddir=${BUILD_DIR} -outdir=${outdir}`)();
    }]
  }
});
