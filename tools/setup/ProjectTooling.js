/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
   Support for creating new FOAM based projects.
   usage: node tools/build.js -T+setup/Project --appName:myApp --package:com.foamdev --adminPassword:badpassword  --genJava,createProject
*/
foam.POM({
  name: 'project',
  description: 'Options and Tasks to create a new project using FOAM',

  envs: {
    ADMIN_PASSWORD_HASH: ['Hashed admin password'],
    APP_NAME_CAP: ['Application name capitalized'],
    JOURNAL_DIR: ['Location of deployment specific journal files common to all deployments of this application.', () => JOURNAL_DIR = 'journals'],
    MODEL_NAME_CAP: ['Model name capitalized']
  },

  options: {
    adminPassword: ['P', 'admin-password', 'ADMIN_PASSWORD', 'Initial password admin user', '', arg => ADMIN_PASSWORD = arg],
    adminUser: ['', 'admin-user', 'ADMIN_USER', 'Identifier of super-user. This will be the \'username\' for login.', 'admin', arg => ADMIN_USER = arg],
    adminUserId: ['', 'admin-user-id', 'ADMIN_USER_ID', 'Admin user \'id\'. Numerical value between 3 and 999.', '42', function(arg) {
      if ( arg && arg > 2 && arg < 1000) ADMIN_USER_ID = arg;
      else this.error(`Invalid adminUserId. Expecting value between in range [3..999]`);
    }],
    appName: [ '', 'app-name', 'APP_NAME', "Name used to construct a unique project directory and deployment structure. Also used as default model name if an explicit model name is not provided.", '', args => APP_NAME = args ],
    appNameLow: ['', 'app-name-low', 'APP_NAME_LOW', 'Application name with first letter lowercase. Used for directory name, spid, packages, ...', function() { return APP_NAME && APP_NAME[0].toLowerCase() + APP_NAME.substring(1); }, arg => APP_NAME_LOW = arg],
    domain: ['', 'domain', 'DOMAIN', 'Inverse package name for email', function() { return PACKAGE.split('.').reverse().join('.'); /* for email*/ }, arg => DOMAIN = arg ],
    group: ['', 'group', 'GROUP', 'Registration group of application theme.', function() { return APP_NAME_LOW; }, arg => GROUP = arg],
    package: ['', 'package', 'PACKAGE', 'Source code path - typically following Java package naming conventions which takes a FQDN inverts it and drops the sub-domain. Ex: www.foamdev.com -> com.foamdev.  This will become the source directory structure under src/. For the purposes of this Project creation the result would be src/com/foamdev/APP_NAME/', function() { return APP_NAME_LOW; }, arg => PACKAGE = arg ],
    projectDir: ['', 'project-dir', 'PROJECT_DIR', 'Path to root of project to prepare. Normally this is the parent of foam3/', function() {
      var dir = process.cwd();
      // if called from foam3/ directory, move up one level.
      if ( dir.substring(dir.lastIndexOf('/')+1) === 'foam3' ) {
        dir = dir.substring(0, dir.lastIndexOf('/'));
      } else {
        EXPORTS.error(`[Project] must be run from foam3/ directory`);
      }
      return dir;
    }, arg => PROJECT_DIR = arg],
    packagePath: ['', 'package-path', 'PACKAGE_PATH', 'Package in path notation: . -> /', function() { return PACKAGE.replaceAll('.', '/');}, arg => PACKAGE_PATH = arg],
    modelName: ['M', 'model-name', 'MODEL_NAME', 'If a model name is provided, the project creation processs will also setup a complete working application, with user, group, menu, permissions, and service journals based on the model name', function() { return APP_NAME; }, arg => MODEL_NAME = arg ],
    spid: ['', 'spid', 'SPID', 'Default spid', function() { return APP_NAME_LOW || 'foam';}, arg => SPID = arg],
    type: ['', 'type', 'TYPE', 'Select a predefined project example. One of: simple, demo', 'simple', function(arg) {
      if (arg && (arg === 'simple' || arg === 'demo')) TYPE = arg;
      else this.error(`Invalid type '${arg}', expecting one of [simple, demo]`);
    }],
    templateDir: ['', 'template-dir', 'TEMPLATE_DIR', 'Location of template files', function() { return __dirname;}, arg => TEMPLATE_DIR = arg]
  },

  tasks: {
    all: ['all', 'Run all tasks to create a new project', ['validate', 'createProject']],
    createAdmin: ['create-admin', 'Create an admin user in an existing application. This tooling took over creating the admin in new projects and the default FOAM admin user was removed.', ['validate'], function(arg) {
      if ( arg ) ADMIN_PASSWORD=arg;
      this.execute('hashAdminPassword');
      this.execute('templateMerge', TEMPLATE_DIR, 'adminUser.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, 'users.jrl', true);
    }],
    createProject: ['create-project', 'Create directories and creates root and src/ POMs for a new FOAM based project', ['validate'], function () {
      var modelName = MODEL_NAME || APP_NAME;
      MODEL_NAME_CAP = modelName[0].toUpperCase() + modelName.substring(1);
      MODEL_NAME = modelName[0].toLowerCase() + modelName.substring(1);

      this.log(`[Project] creating project ${APP_NAME_CAP} at ${PROJECT_DIR}`);

      this.execute('hashAdminPassword');

      // explicit reference to task function, as normally the build will
      // only allow execution a single time.
      let task = TOOLING_TASKS['templateMerge'];
      let templateMerge = task[0].f.bind(this);

      // base setup
      templateMerge(TEMPLATE_DIR, 'rootPOM.js', `${PROJECT_DIR}`, 'pom.js');
      templateMerge(TEMPLATE_DIR, 'journalPOM.js', `${PROJECT_DIR}/${JOURNAL_DIR}`, 'pom.js');
      templateMerge(TEMPLATE_DIR, 'journalGroups.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `groups.jrl`);
      templateMerge(TEMPLATE_DIR, 'journalGroupPermissionJunctions.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `groupPermissionJunctions.jrl`);

      // demo user setup
      templateMerge(TEMPLATE_DIR, 'deploymentDemoPOM.js', `${PROJECT_DIR}/deployment/demo`, `pom.js`);
      templateMerge(TEMPLATE_DIR, 'deploymentDemoUsers.jrl', `${PROJECT_DIR}/deployment/demo`, `users.jrl`);
      templateMerge(TEMPLATE_DIR, 'run.sh', `${PROJECT_DIR}/deployment/demo`, `run.sh`);
      this.execSync(`chmod u+x ${PROJECT_DIR}/deployment/demo/run.sh`);

      // test
      templateMerge(TEMPLATE_DIR, 'modelTestPOM.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}/test`, 'pom.js');
      templateMerge(TEMPLATE_DIR, 'modelTest.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}/test`, `${MODEL_NAME_CAP}Test.js`);
      templateMerge(TEMPLATE_DIR, 'deploymentModelTestPOM.js', `${PROJECT_DIR}/deployment/test`, 'pom.js');
      templateMerge(TEMPLATE_DIR, 'tests.jrl', `${PROJECT_DIR}/src/${PACKAGE_PATH}/test`, 'tests.jrl');

      templateMerge(TEMPLATE_DIR, 'journalMenus.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `menus.jrl`);

      // model
      if ( TYPE === 'demo' ) {
        templateMerge(TEMPLATE_DIR, 'demoModel.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}`, `${MODEL_NAME_CAP}.js`);
        templateMerge(TEMPLATE_DIR, 'demoModelCategory.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}`, `${MODEL_NAME_CAP}Category.js`);
        templateMerge(TEMPLATE_DIR, 'demoModelPOM.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}`, 'pom.js');
        templateMerge(TEMPLATE_DIR, 'journalServices.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `services.jrl`);
      } else {
        templateMerge(TEMPLATE_DIR, 'simpleModel.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}`, `${MODEL_NAME_CAP}.js`);
        templateMerge(TEMPLATE_DIR, 'simpleModelPOM.js', `${PROJECT_DIR}/src/${PACKAGE_PATH}`, 'pom.js');
        templateMerge(TEMPLATE_DIR, 'simpleJournalServices.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `services.jrl`);
      }

      // theme
      templateMerge(TEMPLATE_DIR, 'themes.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `themes.jrl`);

      // adminPassword = this.hash(adminPassword);
      templateMerge(TEMPLATE_DIR, 'adminUser.jrl', `${PROJECT_DIR}/${JOURNAL_DIR}`, `users.jrl`);

      // Additional PROJECT_DIRectories and poms
      templateMerge(TEMPLATE_DIR, 'build.sh', `${PROJECT_DIR}`, `build.sh`);
      this.execSync(`chmod u+x ${PROJECT_DIR}/build.sh`);
      templateMerge(TEMPLATE_DIR, 'gitignore', `${PROJECT_DIR}`, '.gitignore');

      // gitignore.execSync('sudo chown -R $USER /opt')
    }],

    hashAdminPassword: ['hash-admin-password', 'Execute FOAM to hash a password', [], function() {
      if ( ! this.existsSync('pom.xml') ) {
        // build foam  - don't rebuild for subsequent runs
        this.execute('genJava');
        // TODO: just compile foam.util.Password.java and foam.util.SecurityUtil.java
      }
      ADMIN_PASSWORD_HASH = this.execSync(`java -cp "${BUILD_DIR}/lib/\*:${BUILD_DIR}/classes" foam.util.Password ${ADMIN_PASSWORD.trim()}`).toString().trim();
    }],

    templateMerge: ['template-merge', 'Populate template fields and copy template into final file location', [],
                    function (inDir, templateFn, outDir, outFn, append = false) {
                      // this.log(`templateMerge inDir: ${inDir}\ntemplateFn: ${templateFn}\noutDir: ${outDir}\noutFn: ${outFn}\nappend: ${append}`);
                      let fn = this.join(inDir, templateFn);
                      if ( ! this.existsSync(fn) ) {
                        this.error(`[Project] template not found ${fn}`);
                      }
                      var text = this.readFileSync(fn).toString();
                      if ( ! text ) {
                        this.error(`[Project] template file empty ${fn}`);
                      }
                      text = text.replaceAll("{adminPassword}", ADMIN_PASSWORD_HASH);
                      text = text.replaceAll("{adminUser}", ADMIN_USER);
                      text = text.replaceAll("{adminUserId}", ADMIN_USER_ID);
                      text = text.replaceAll("{app}", APP_NAME_LOW);
                      text = text.replaceAll("{appName}", APP_NAME_LOW);
                      text = text.replaceAll("{App}", APP_NAME_CAP);
                      text = text.replaceAll("{AppName}", APP_NAME_CAP);
                      text = text.replaceAll("{domain}", DOMAIN);
                      text = text.replaceAll("{group}", GROUP);
                      text = text.replaceAll("{journalDir}", JOURNAL_DIR);
                      text = text.replaceAll("{model}", MODEL_NAME);
                      text = text.replaceAll("{modelName}", MODEL_NAME);
                      text = text.replaceAll("{Model}", MODEL_NAME_CAP);
                      text = text.replaceAll("{ModelName}", MODEL_NAME_CAP);
                      text = text.replaceAll("{package}", PACKAGE);
                      text = text.replaceAll("{packagePath}", PACKAGE_PATH);
                      text = text.replaceAll("{spid}", SPID);

                      fn = this.join(outDir, outFn);
                      this.log(`[Project] creating file ${fn}`);
                      if ( ! this.existsSync(fn) ) {
                        this.ensureDir(outDir);
                        this.writeFileSync(fn, text);
                      } else {
                        this.warning(`[Project] file already exists: ${fn}`);
                        if ( append ) {
                          this.warning(`[Project] appending to: ${fn}.`);
                          this.appendFileSync(fn, text);
                        }
                      }
                    }
                   ],
    info: ['info', 'Documentation for this Tooling', [], function() {
      this.log('Project Tooling');
      // TODO: elaborate - detailed documentation
    }],

    usage: ['usage', 'Example usage', [], function() {
      this.log('Project creation examples:');
      this.warning('must be run from foam3/ directory)');
      this.log('  node tools/build.js -T+setup/Project --appName:simple --package:com.foamdev --adminPassword:badpassword --genJava,createProject');
      this.log('      Generate a project with a very simple model.');
      this.log('  node tools/build.js -T+setup/Project --type:demo --appName:example --package:com.foamdev --adminPassword:badpassword --genJava,createProject');
      this.log('      Generate a project with a more elaborate model demonstrating more FOAM features..');
      this.log('  node tools/build.js -T+setup/Project --appName:example --package:com.foamdev --adminPassword:badpassword --genJava,createProject');
      this.log('      Generate a project named "example" based on the "simple" model.');
      this.log('  node tools/build.js -T+setup/Project --appName:example --package:com.foamdev --createAdmin:badpassword --genJava,createProject');
      this.log('      Generate an admin user for existing projects which were previously relying on the, now removed, foam-admin user provided by the baseline FOAM repo.');
      this.log();
    }],

    validate: ['validate', 'Validate tooling parameters before execution', [], function() {
      if ( ! APP_NAME ) {
        this.error(`[Project] option --appName required`);
      }
      if ( ! ADMIN_PASSWORD ) {
        this.error(`[Project] option --adminPassword required.`);
      }
    }]
  }
});
