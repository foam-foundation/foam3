/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.blob',
  name: 'BlobStore',
  extends: 'foam.blob.AbstractBlobService',

  requires: [
    'foam.blob.IdentifiedBlob'
  ],

  javaImports: [
    'java.io.File',
    'java.io.FileOutputStream',
    'java.io.IOException',
    'org.apache.commons.codec.binary.Hex',
    'org.apache.commons.io.IOUtils',
    'foam.core.fs.FileSystemStorage'
  ],

  constants: [
    {
      name: 'BUFFER_SIZE',
      value: 4096,
      type: 'Integer'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'root',
      generateJava: false,
      documentation: 'Root directory of where files are stored'
    },
    {
      class: 'String',
      name: 'tmp',
      transient: true,
      documentation: 'Temp directory of where files are stored before hashing',
      expression: function(root) {
        return root + '/tmp';
      },
      javaFactory: 'return File.separator + "tmp";'
    },
    {
      class: 'String',
      name: 'directory',
      transient: true,
      documentation: 'Directory of where files are stored after hashing',
      expression: function(root) {
        return root + '/largefiles';
      },
      javaFactory: 'return File.separator + "largefiles";'
    },
    {
      class: 'Boolean',
      name: 'isSet',
      value: false,
      hidden: true,
      transient: true
    }
  ],

  methods: [
    {
      name: 'setup',
      type: 'Void',
      args: [ { name: 'x', type: 'Context' } ],
      code: function setup() {
        if ( globalThis.require ) {
          if ( this.isSet ) return;

          var parsed = require('path').parse(this.root);

          if ( ! require('fs').statSync(parsed.dir).isDirectory() ) {
            throw new Error(parsed.dir + ' is not a directory.');
          }

          this.ensureDir(this.root);
          this.ensureDir(this.tmp);
          this.ensureDir(this.directory);

          this.isSet = true;
        }
      },
      javaCode:`
        if ( this.getIsSet() )
          return;
          ensureDir(x, getTmp());
          ensureDir(x, getDirectory());
          setIsSet(true);
      `
    },
    {
      name: 'ensureDir',
      type: 'Void',
      synchronized: true,
      args: [ { name: 'x', type: 'Context' },
              { name: 'path', type: 'String' } ],
      code: function ensureDir(path) {
        var stat;

        try {
          stat = require('fs').statSync(path);
          if ( stat && stat.isDirectory() ) return;
        } catch(e) {
          if ( e.code === 'ENOENT' ) return require('fs').mkdirSync(path);

          throw e;
        }
      },
      javaCode: `
        File parsed = x.get(FileSystemStorage.class).get(path);
        if ( parsed.exists() && parsed.isDirectory() ) {
          return;
        }

        if ( ! parsed.mkdirs() ) {
          throw new RuntimeException("Failed to create: " + path);
        }
      `
    },
    {
      name: 'allocateTmp',
      javaType: 'File',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'name',
          type: 'Long'
        }
      ],
      code: function allocateTmp() {
        var fd;
        var path;
        //      var name = Math.floor(Math.random() * 0xFFFFFF)
        var name = 1;
        var self = this;

        return new Promise(function aaa(resolve, reject) {
          path = self.tmp + require('path').sep + (name++);
          fd = require('fs').open(path, 'wx', function onOpen(err, fd) {
            if ( err && err.code !== 'EEXIST' ) {
              reject(err);
              return;
            }

            if ( err ) aaa(resolve, reject);
            else resolve({ path: path, fd: fd});
          });
        });
      },
      javaCode: `String path = this.tmp_ + File.separator + (name++);
File file = x.get(FileSystemStorage.class).get(path);
// createNewFile is the exclusive create the JS version gets from open(path, 'wx'):
// the existence check and the creation are one atomic step, so two concurrent
// puts can never be handed the same tmp file. A plain exists() check lets both
// through, and the second FileOutputStream truncates the first's bytes.
try {
  if ( ! file.createNewFile() ) return allocateTmp(x, name);
} catch ( java.io.IOException e ) {
  throw new RuntimeException("Could not allocate blob tmp file " + path, e);
}
return file;`
    },

    {
      name: 'put_',
      code: function put_(x, obj) {
        if ( this.IdentifiedBlob.isInstance(obj) ) {
          return obj;
        }

        this.setup();
        // This process could probably be sped up a bit by
        // requesting chunks of the incoming blob in advance,
        // currently we wait until they're put into the write-stream's
        // buffer before requesitng the next chunk.

        var hash = require('crypto').createHash('sha256');

        var bufsize = 8192;
        var buffer = Buffer.alloc(bufsize);

        var size = obj.size
        var remaining = size;
        var offset = 0;
        var self = this;

        var chunks = Math.ceil(size / bufsize);

        function chunkOffset(i) {
          return i * bufsize;
        }

        var tmp;

        function writeChunk(chunk) {
          return obj.read(buffer, chunkOffset(chunk)).then(function(buf) {
            hash.update(buf);
            return new Promise(function(resolve, reject) {
              require('fs').write(tmp.fd, buf, 0, buf.length, function cb(err, written, buffer) {
                if ( err ) {
                  reject(err);
                  return;
                }

                if ( written !== buf.length ) {
                  console.warn("Didn't write entire chunk, does this ever happen?");
                  require('fs').write(tmp.fd, buf.slice(written), cb);
                  return;
                }

                resolve();
              });
            });
          });
        }

        var chunk = 0;
        return this.allocateTmp().then(function(tmpfile) {
          tmp = tmpfile;
        }).then(function a() {
          if ( chunk < chunks ) return writeChunk(chunk++).then(a);
        }).then(function() {
          return new Promise(function(resolve, reject) {
            require('fs').close(tmp.fd, function() {
              var digest = hash.digest('hex');
              require('fs').rename(tmp.path, self.directory + require('path').sep + digest, function(err) {
                if ( err ) {
                  reject(err);
                  return;
                }
                resolve(self.IdentifiedBlob.create({ id: digest }));
              });
            });
          });
        });
      },
      javaCode: `if ( blob instanceof IdentifiedBlob ) {
  return blob;
}

this.setup(x);
long size = blob.getSize();
File tmp = allocateTmp(x, 1);

try ( HashingOutputStream os = new HashingOutputStream(new FileOutputStream(tmp)) ) {
  blob.read(os, 0, size);
  os.close();

  String digest = new String(Hex.encodeHexString(os.digest()));
  File dest = x.get(FileSystemStorage.class).get(getDirectory() + File.separator + digest);
  if ( ! tmp.renameTo(dest) ) {
    // File already exists, so remove tmp version
    try {
      tmp.delete();
    } catch (Throwable t) {}
  }
  IdentifiedBlob result = new IdentifiedBlob();
  result.setId(digest);
  result.setX(getX());
  return result;
} catch (Throwable t) {
  return null;
}
`
    },
    function filename(blob) {
      if ( ! foam.blob.IdentifiedBlob.isInstance(blob) ) return null;

      var path = this.directory + require('path').sep + blob.id;
      try {
        require('fs').statSync(path);
      } catch(e) {
        return null;
      }

      return path;
    },

    {
      name: 'find_',
      code: function find_(x, id) {
        this.setup();
        if ( id.indexOf(require('path').sep) != -1 ) {
          return Promise.reject(new Error("Invalid file name"));
        }

        var self = this;

        return new Promise(function(resolve, reject) {
          require('fs').open(self.directory + require('path').sep + id, "r", function(err, fd) {
            if ( err ) {
              if ( err.code == 'ENOENT' ) {
                resolve(null);
                return;
              }

              reject(err);
              return;
            }
            resolve(foam.blob.FdBlob.create({ fd: fd }));
          });
        });
      },
      javaCode: `try {
  this.setup(x);
  if ( ((String) id).indexOf(File.separatorChar) != -1 ) {
    throw new RuntimeException("Invalid file name");
  }

  File file = x.get(FileSystemStorage.class).get(getDirectory() + File.separator + id);
  if ( ! file.exists() ) {
    throw new RuntimeException("File does not exist");
  }

  if ( ! file.canRead() ) {
    throw new RuntimeException("Cannot read file");
  }

  return new FileBlob(file);
} catch (Throwable t) {
  throw new RuntimeException(t);
}`
    },
    {
      name: 'urlFor_',
      code: function() { throw new Error("Unsupported operation."); },
      javaCode: 'throw new UnsupportedOperationException("Unsupported operation: urlFor_");'
    }
  ]
});
