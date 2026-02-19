/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'File',

  documentation: 'Represents a file',

  mixins: [
    'foam.core.auth.CreatedAwareMixin',
    'foam.core.auth.CreatedByAwareMixin'
  ],

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.LifecycleAware',
    'foam.core.auth.ServiceProviderAware'
  ],

  requires: [
    'foam.blob.BlobBlob'
  ],

  imports: [
    'fileTypeDAO',
    'sessionID'
  ],

  javaImports: [
    'foam.blob.BlobService',
    'foam.blob.Blob',
    'foam.blob.FileBlob',
    'foam.blob.InputStreamBlob',
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.ServiceProviderAwareSupport',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.logger.Loggers',
    'foam.util.SafetyUtil',
    'java.io.*',
    'java.util.Base64'
  ],

  tableColumns: [
    'filename',
    'filesize',
    'mimeType',
    'created'
  ],

  searchColumns: [
    'id',
    'filename',
    'mimeType'
  ],

  contextMenuActions: [this.DOWNLOAD],

  messages: [
    { name: 'INVALID_FILE_LABEL', message: 'An assigned file label cannot be empty' }
  ],

  properties: [
    {
      name: 'lifecycleState',
      class: 'Enum',
      of: 'foam.core.auth.LifecycleState',
      value: 'ACTIVE',
      visibility: 'RO',
      includeInDigest: true
    },
    {
      class: 'String',
      name: 'id',
      createVisibility: 'HIDDEN',
      updatevisibility: 'RO',
      readVisibility: 'RO',
      documentation: 'GUID'
    },
    {
      class: 'String',
      name: 'filename',
      documentation: 'Filename'
    },
    {
      class: 'Long',
      name: 'filesize',
      createVisibility: 'HIDDEN',
      updateVisibility: 'HIDDEN',
      readVisibility: 'RO',
      documentation: 'Filesize',
      tableCellFormatter: function(value, _) {
        this.tag({
          class: 'foam.core.fs.FileSizeView',
          data: value
        });
      },
      view: { class: 'foam.core.fs.FileSizeView' }
    },
    {
      class: 'String',
      name: 'mimeType',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      readVisibility: 'RO',
      documentation: 'File mime type'
    },
    {
      class: 'Reference',
      of: 'foam.core.fs.FileType',
      name: 'fileType',
      label: 'Mime Type',
      updateVisibility: 'HIDDEN',
      readVisibility: 'HIDDEN',
      documentation: 'File mime type',
      storageTransient: true,
    },
    {
      class: 'String',
      name: 'dataString',
      updateVisibility: 'RO',
      readVisibility: 'RO',
      documentation: 'File converted to base64 string',
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.tag.TextArea',
            rows: 4, cols: 80
          }
        ]
      },
    },
    {
      class: 'String',
      name: 'address',
      hidden: true,
      transient: true,
      expression: function (id) {
        return window.location.origin + '/service/httpFileService/' + id + '?sessionId=' + this.sessionID;
      }
    },

    {
      class: 'String',
      name: 'image',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      readVisibility: 'RO',
      transient: true,
      storageTransient: true,
      expression: function () {
        return [this];
      },
      view: function(_, X) {
        return {
          class: 'foam.core.fs.fileDropZone.FilePreview',
          id: X.data.id
        };
      },
      comparePropertyValues: function(o1, o2) { return 0; }
    },
    {
      class: 'Blob',
      name: 'data',
      updateVisibility: 'HIDDEN',
      readVisibility: 'HIDDEN',
      javaGetter:`
        if ( dataIsSet_ ) return data_;

        if ( ! SafetyUtil.isEmpty(this.getDataString()) ) {
          String[]        s             = this.getDataString().split(",");
          String          encodedString = s.length != 2 ? "" : s[1];
          byte[]          decodedBytes  = Base64.getDecoder().decode(encodedString);
          InputStream     is            = new ByteArrayInputStream(decodedBytes);
          InputStreamBlob blob          = new foam.blob.InputStreamBlob(is, decodedBytes.length);

          return blob;
        }

        return null;
      `,
      getter: function() {
        if ( this.instance_.data ) return this.instance_.data;

        if ( this.dataString ) {
          let b64Data = this.dataString.split(',')[1];
          const b64toBlob = (b64Data, contentType = this.mimeType, sliceSize = 512) => {
            const byteCharacters = atob(b64Data);
            const byteArrays = [];

            for ( let offset = 0 ; offset < byteCharacters.length ; offset += sliceSize ) {
              const slice = byteCharacters.slice(offset, offset + sliceSize);

              const byteNumbers = new Array(slice.length);
              for ( let i = 0 ; i < slice.length ; i++ ) {
                byteNumbers[i] = slice.charCodeAt(i);
              }

              byteArrays.push(new Uint8Array(byteNumbers));
            }

            return new Blob(byteArrays, { type: contentType });
          }

          return this.BlobBlob.create({ blob: b64toBlob(b64Data) });
        }

        return null;
      },
      /**
       * When we export this as the CSV, we are trying to create a new object if this property is undefined.
       * But because this 'Blob' is an interface, we can not instantiate it.
       *
       * Provide an adapt function will fix that issue.
       */
      adapt: function(oldObj, newObj) {
        return newObj;
      }
    },
    {
      class: 'Reference',
      of: 'foam.core.fs.FileLabel',
      name: 'label'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      visibility: 'RO',
      storageTransient: true,
      section: 'systemInformation',
      javaFactory: `
        var map = new java.util.HashMap();
        map.put(
          File.class.getName(),
          new foam.lang.PropertyInfo[] { File.OWNER }
        );
        return new ServiceProviderAwareSupport()
          .findSpid(foam.lang.XLocator.get(), map, this);
      `
    },
    {
      class: 'Reference',
      of: 'foam.core.crunch.Capability',
      name: 'capabilityId'
    }
  ],
  methods: [
    {
      name: 'authorizeOnCreate',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "file.create") ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnRead',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        AuthService auth = (AuthService) x.get("auth");
        if (
          ! ( ( user != null && SafetyUtil.equals(this.getOwner(), user.getId()) ) ||
              auth.check(x, "file.read." + this.getId()) )
         ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `
        // FileUpdateDecorator will return the same object if it is update operation
        // No changes will be made
      `
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "file.remove." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      type: 'String',
      name: 'getText',
      code: function() {
        return new Promise((resolve, reject) => {
          let reader = new FileReader();

          reader.onload = () => {
            resolve(reader.result);
          };

          reader.onerror = reject;

          reader.readAsText(this.data.blob);
        });
      },
      javaCode: `
        if ( ! SafetyUtil.isEmpty(this.getDataString()) ) {
          String encodedString = this.getDataString().split(",")[1];
          byte[] decodedBytes  = Base64.getDecoder().decode(encodedString);
          String decodedString = new String(decodedBytes);
          return decodedString;
        }
        return "";
      `
    },
    {
      name: 'inputStream',
      args: 'Context x',
      javaType: 'java.io.InputStream',
      javaCode: `
      Blob blob = getData();
      if ( blob != null ) {
        return ((InputStreamBlob)blob).getInputStream();
      } else {
        BlobService blobStore = (BlobService) x.get("blobStore");
        blob = blobStore.find(getId());
        if ( blob != null ) {
          try {
            return new java.io.FileInputStream(((FileBlob) blob).getFile());
          } catch (java.io.FileNotFoundException e) {
            // nop
          }
        }
      }
      Loggers.logger(x, this).warning("data not found", getFilename(), getId());
      return null;
      `
    }
  ],

  actions: [
    {
      name: 'view',
      code: function(a, X) {
        var isImage = this.mimeType && this.mimeType.startsWith('image/');
        var isPdf   = this.mimeType === 'application/pdf';

        // Unsupported preview types — fall back to new tab
        if ( ! isImage && ! isPdf ) {
          var blob = this.data;
          if ( foam.blob.BlobBlob.isInstance(blob) ) {
            window.open(URL.createObjectURL(blob.blob));
          } else {
            window.open(this.address);
          }
          return;
        }

        var popup = foam.u2.dialog.Popup.create({
          closeable: true,
          backgroundColor: '#ffffff'
        }, X);

        popup
          .start()
            .style({ 'width': '85vw', 'height': '85vh' })
            .tag({
              class: 'foam.core.fs.fileDropZone.FilePreview',
              data: this,
              fullScreen: true
            })
          .end();

        popup.open();
      }
    },
    {
      name: 'download',
      code: function(a, X) {
        // TODO: Add logging for who has downloaded files etc.
        var url = this.address;
        if ( foam.blob.BlobBlob.isInstance(this.data) ) {
          url = URL.createObjectURL(this.data.blob);
        }
        var link = document.createElement('a');
        link.setAttribute("href", url);
        link.setAttribute("download", this.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    {
      name: 'multiDownload',
      label: 'Download',
      isAvailable: function() { return false; },
      code: function(ctx, X) {
        // For multi-select download support in DAOBrowserView
        if ( this.config && this.config.selectedObjs && ! foam.Object.equals(this.config.selectedObjs, {}) ) {
          foam.Object.forEach(this.config.selectedObjs, function(obj) {
            X.sourceCls_.DOWNLOAD.maybeCall(ctx, obj);
          });
        } else if ( this.predicatedDAO$proxy ) {
          this.predicatedDAO$proxy.select(function(obj) {
            X.sourceCls_.DOWNLOAD.maybeCall(ctx, obj);
          });
        } else {
          console.warn('Something went wrong downloading using multi-select');
        }
      }
    }
  ]
});
