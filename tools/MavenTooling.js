/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'maven',

  tasks: {
    cleanAll: ['clean-all', 'Remove pom.xml and Java lib directory.', [], function() {
      this.rmfile('pom.xml');
      if ( this.existsSync(BUILD_DIR) ) {
        this.emptyDir(BUILD_DIR + '/lib');
      }
    }],

    maven: ['maven', 'Run Maven', [], function() {
      this.pmake.bind(this, `-makers=Maven -flags=${this.flag()} -pom=${POMS} -libdir=${BUILD_DIR}/lib`)();
    }],

    checkDeps: ['check-deps', 'Check Java dependencies for known vulnerabilities (via Maven). -XcheckDeps:score where score in range [0..11].  CVSS score (LOW:0..5 ,MEDIUM:5..7 ,HIGH:7..9 ,CRITICAL:9..10,IGNORE:11)', ['maven'], function(score) {
      score = score || 9;
      try {
        this.execSync(`mvn dependency-check:check -DfailBuildOnCVSS=${score}`, { stdio: 'inherit' });
      } catch (_) {
        // maven build error will be output to the console, no need to throw
      }
    }],

    showJARs: ['show-jars', 'Show JAR structure.', ['maven'], function(value) {
      try {
        this.execSync(`mvn dependency:tree `, { stdio: 'inherit' });
      } catch (_) {
        // maven build error will be output to the console, no need to throw
      }
    }],

    mavenGetSources: ['maven-get-sources', 'Get Maven java sources.', ['maven'], function(value) {
      try {
        this.execSync(`mvn dependency:resolve-sources -DincludeArtifactIds=${value} `, { stdio: 'inherit' });
      } catch (_) {
        // maven build error will be output to the console, no need to throw
      }
    }]
  }
});
