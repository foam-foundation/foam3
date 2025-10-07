# Deployment (DevOps)

FOAM has support for building, uploading, and install a complete application.

## Building for deployment

Deployment builds generate a tar ball:

    node foam3/tools/build.js -ckJyour_deployment_directories,../foam3/deployment/https

Once a tar ball is prepared, it can be uploaded and the application installed

    ./build.sh -TStandard,RemoteInstall,Java -Jyour_deployment_directories --remote-hostname:hostname

## Additional (most common) installation flags:

- `--user:name` -  User name to create and run application under. Defaults to **foam**
- `--user-id:id` -  User ID to create User with. Defaults to **3626**
- `--backup:true|false` - Controls backup of previous version during install. Defaults to **true**.
    - For a quick development, deploy cycle, and for non-production instances, set backup to false.


## SSH Considerations

**NOTE** The upload and install process assume the uploader's ssh key is installed on the remote host, and that ssh has been configured for no-password logins.

### SSH Key Pair Generation

- see [How to Create an SSH Key](https://www.digitalocean.com/community/tutorials/how-to-configure-ssh-key-based-authentication-on-a-linux-server) or 
- see [How to Set Up SSH Keys](https://www.digitalocean.com/community/tutorials/how-to-set-up-ssh-keys-on-ubuntu-20-04)

### SSH No-Password Login

- see [How to Setup Passwordless SSH Login](https://linuxize.com/post/how-to-setup-passwordless-ssh-login/)

## JVM Memory

JVM Memory configuration defaults to `-Xms2048m` and `-Xmx4096`. 

These properties can be overridden after first deployment by adding them to:

    /opt/name/conf/shrc.custom

`#!/bin/bash`
`  JAVA_OPTS="${JAVA_OPTS} -Xmx8000m"`

Or per deployment with

    ./build.sh -EJAVA_OPTS:"-Xms4g -Xmx8g"
    or
    ./build.sh --system-property:Xms4g,Xmx8g

## JVM Other Defaults and Tuning

Other JVM options, such as Garbage Collection, are defined in:

    /opt/name/etc/shrc.local

To override add to 

    /opt/name/conf/shrc.local

## Relevant Documentation

- Health - #flowdoc/Health - production monitoring and LB integration
