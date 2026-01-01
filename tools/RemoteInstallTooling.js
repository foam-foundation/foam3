/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
   Support deploying a FOAM build tarball to a remote host.
   NOTE: RemoteInstall precedes Java so that RemoteInstall 'all' applies.
   usage: node foam3/tools/build.js -TStandard,RemoteInstall,Java --remote-hostname:moosehead --deploy --backup:false
 */
foam.POM({
  name: 'remoteInstall',
  description: 'Options and Tasks to install a tarball to a host',

  options: {
    backup: ['B', 'backup', 'BACKUP', 'Backup existing depoyment before installing new', true, function(arg) { BACKUP = arg ? this.bool(arg) : false; }],
    user: ['U', 'user', 'USER', 'User on remote host which will \'own\' the installation files, and under which it will execute. User is created if it does not already exist.' , 'foam', arg => USER = arg],
    userId: ['Y', 'user-id', 'USER_ID', 'User Id remote host which will \'own\' the installation files, and under which it will execute. User is created if it does not already exist.', '3626', arg => USER_ID = arg],
    // group: ['G', 'group', 'GROUP', 'Group of User when creating new User', 'foam', arg => GROUP = arg],
    // groupId: ['', 'group-id', 'GROUP_ID', 'Group Id of User when creating new User', '3626', arg => GROUP_ID = arg],
    installOpts: ['', 'install-opts', 'INSTALL_OPTS', 'Options passed to the install script.', '', arg => INSTALL_OPTS = arg],
    remoteHostname: ['', 'remote-hostname', 'REMOTE_HOSTNAME', 'Hostname of remote instance to deploy to.', '', arg => REMOTE_HOSTNAME =arg ],
    remoteInstallScriptLinux: ['', 'remote-install-script-linux', 'REMOTE_INSTALL_SCRIPT_LINUX', 'Path of intall script which is piped to the remote host and then executed to perform the actual remote installation', () => `${FOAM_TOOLS_DIR}/deploy/bin/install.sh`, arg => REMOTE_INSTALL_SCRIPT_LINUX = arg],
    remoteInstallScript: ['', 'remote-install-script', 'REMOTE_INSTALL_SCRIPT', 'Platform specific intall script which is piped to the remote host and then executed to perform the actual remote installation.', function() {
      if ( REMOTE_PLATFORM === 'linux' )
        REMOTE_INSTALL_SCRIPT = REMOTE_INSTALL_SCRIPT_LINUX;
      //else // - already reported.
    }, arg => REMOTE_INSTALL_SCRIPT = arg],
    remotePlatform: ['', 'remote-platform', 'REMOTE_PLATFORM', 'Operating system of remote host. One of:  darwin (MacOS), freebsd, linux, win32.', 'linux', arg => REMOTE_PLATFORM = arg],
    remoteUrl: ['', 'remote-url', 'REMOTE_URL', '', () => REMOTE_USER ? `${REMOTE_USER}@${REMOTE_HOSTNAME}` : REMOTE_HOSTNAME, arg => REMOTE_USER = arg],
    remoteOutput: ['', 'remote-output', 'REMOTE_OUTPUT', 'Working directory on remote host to upload to and install from.', '/tmp', arg => REMOTE_OUTPUT = arg],
    remoteUser: ['', 'remote-user', 'REMOTE_USER', 'User with which to connect via ssh/scp to perform the upload and installation.', '', arg => REMOTE_USER = arg],
    sshId: ['', 'ssh-id', 'SSH_ID', 'ssh id from .ssh/ to use for connection. Will default to that specified in .ssh/config when a matching host is found, otherwise to .ssh/id_rsa', '', arg => SSH_ID = arg],
    sshOpt: ['', 'ssh-opt', 'SSH_OPT', '', () => SSH_ID ? '-i ' + HOME_DIR + '/.ssh/' + SSH_ID : '', arg => SSH_OPT = arg]
  },

  tasks: {
    all: ['all', 'Execute all tasks for a remote deployment.', ['pomEnvs', 'validate', 'upload', 'install'], null],
    buildInstallOpts: ['build-install-opts', 'Build up options passed to the install script', ['pomEnvs'], function() {
      INSTALL_OPTS += ` -A${APP_HOME} -B${BACKUP} -N${APP_NAME} -V${VERSION} -U${USER} -Y${USER_ID}`;
      if ( WEB_PORT )
        INSTALL_OPTS += ` -W${WEB_PORT}`;
    }],
    deploy: ['deploy', 'Run all tasks to deploy', ['all'], null],
    upload: ['upload', 'Upload tarball', ['pomEnvs', 'validate'], function() {
      if ( ! this.existsSync(TARBALL_PATH) )
        this.error('tarball not found', TARBALL_PATH);

      try {
        this.execSync(`ssh ${SSH_OPT} ${REMOTE_URL} 'rm -rf ${REMOTE_OUTPUT}/*tar* >/dev/null 2>&1'`, { stdio: 'ignore'});
      } catch (e) {
        // nop - expect some failures when trying to delete /tmp files user does not own
      }

      try {
        this.log(`[RemoteInstall] uploading ${TARBALL_PATH} to ${REMOTE_URL}:${REMOTE_OUTPUT}/${TARBALL}`);
        if ( ! DRY_RUN ) {
          this.execSync(`scp ${SSH_OPT} ${TARBALL_PATH} ${REMOTE_URL}:${REMOTE_OUTPUT}/${TARBALL}`);
        }
        this.log(`[RemoteInstall] upload to ${REMOTE_HOSTNAME} complete.`);
      } catch (e) {
        this.error(`[RemoteInstall] upload to ${REMOTE_HOSTNAME} failed.\n`, e);
      }
    }],
    install: ['install', 'Install', ['pomEnvs', 'validate', 'buildInstallOpts'], function() {
      // FIXME - first use of REMOTE_INSTALL_SCRIPT it is undefined
      // suspect this is happening elsewhere
      let tmp = REMOTE_INSTALL_SCRIPT;

      if ( REMOTE_INSTALL_SCRIPT ) {
        try {
          this.log(`[RemoteInstall] installing to ${REMOTE_HOSTNAME} with ${INSTALL_OPTS}.`);
          if ( ! DRY_RUN ) {
            this.execSync(`ssh ${SSH_OPT} ${REMOTE_URL} 'sudo bash -s -- -T${REMOTE_OUTPUT}/${TARBALL} ${INSTALL_OPTS}' < ${REMOTE_INSTALL_SCRIPT}`);
          }
          this.log(`[RemoteInstall] installation to ${REMOTE_HOSTNAME} complete.`);
        } catch (e) {
          this.warning(`[RemoteInstall] installation to ${REMOTE_HOSTNAME} failed.\n`, e);
        }
      } else {
        this.error(`[RemoteInstall] install REMOTE_INSTALL_SCRIPT:${REMOTE_INSTALL_SCRIPT}`);
      }
    }],
    usage: ['usage', 'Examples', [], function() {
      this.log('Remote installation examples:');
      this.log('  ./build.sh -TStandard,Java,RemoteInstall -Jdemo,https --user:foam user-id:3636 --backup:false --remote-hostname:moosehead');
      this.log('  ./build.sh -TStandard,Java,RemoteInstall -Jdemo,https --user:foam user-id:3636 --backup:false --remote-hostname:moosehead');
      this.log('    Deploy with SSL/HTTPS support');
    }],
    validate: ['validate', 'Verify required information is available before proceeding with main build tasks', ['pomEnvs'], function() {
      if ( REMOTE_PLATFORM !== 'linux' ) {
        this.error(`[RemoteInstall] platform not supported: '${REMOTE_PLATFORM}'.\nSupported platforms: 'linux'`);
      } else {
        this.verbose(`[RemoteInstall] validate OK`);
      }
    }]
  }
});
