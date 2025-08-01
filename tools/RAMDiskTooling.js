/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'ram-disk',

  options: {
    ramDiskBlockSizeDarwin: ['', 'ram-disk-block-size-darwin', 'RAM_DISK_BLOCK_SIZE_DARWIN', 'RAM Disk block size in bytes', '512', arg => RAM_DISK_BLOCK_SIZE_DARWIN = arg],
    ramDiskName: ['', 'ram-disk-name', 'RAM_DISK_NAME', 'Name of ram disk to use as build directory', 'buildRAMDisk', arg => RAM_DISK_NAME = arg],
    ramDiskSize: ['', 'ram-disk-size', 'RAM_DISK_SIZE', 'Size of ram disk in MegaBytes to use as build directory', '1000', arg => RAM_DISK_SIZE = arg]
  },
  tasks: {
    ramDisk: ['ram-disk', 'Create RAM Disk and symbolic link to build directory. Optionaly provide size in bytes. --ramDisk:400', [], function(arg) {
      if ( PLATFORM == 'darwin' ) {
        this.execute('ramDiskDarwin', arg);
      } else {
        this.error(`RAM Disk creation on platform ${PLATFORM} not supported.`);
      }
    }],

    ramDiskDarwin: ['ram-disk-darwin', 'Create RAM Disk and symbolic link to build directory. Optionaly provide size in bytes. --ramDisk:400', [], function(arg) {
      if ( arg ) RAM_DISK_SIZE = arg;
      try {
        var info = this.execSync(`diskutil info ${RAM_DISK_NAME}`);
        this.info(`Ejecting previous RAM Disk: ${RAM_DISK_NAME}`);
        info = this.execSync(`diskutil eject ${RAM_DISK_NAME}`);
      } catch (e) {
        // nop - does not exist
      }
      let bytes = RAM_DISK_SIZE * 1024 * 1024 / RAM_DISK_BLOCK_SIZE_DARWIN;
      try {
        let device = this.execSync(`hdiutil attach -nomount ram://${bytes}`);
        info = this.execSync(`diskutil erasevolume HFS+ \"${RAM_DISK_NAME}\" ${device}`);
        this.info(`Created RAM Disk: ${RAM_DISK_NAME}`);
      } catch (e) {
        this.error(`Failed to create RAM Disk`, RAM_DISK_NAME, e);
      }
      // setup as build directory
      this.rmdir(BUILD_DIR);
      try {
        let link = `/Volumes/${RAM_DISK_NAME}`;
        info = this.execSync(`ln -s ${link} ${BUILD_DIR}`);
        this.info(`Created symbolic link to RAM Disk: ${BUILD_DIR} -> ${link}`);
      } catch (e) {
        this.error(`Failed to create symbolic link to RAM Disk ${BUILD_DIR} -> ${link}`);
      }
    }],

    usage: ['usage', 'Build usage examples', [], function() {
      this.log('\nCreating a RAM Disk to use as the build directory:');
      this.log('  ./build.sh --ram-disk');
      this.log('  ./build.sh --ram-disk:500');
      this.log('  ./build.sh --ram-disk --ram-disk-size:500');
      this.log('  ./build.sh --ram-disk --ram-disk-name:buildRAMDisk');
    }]
  }
});
