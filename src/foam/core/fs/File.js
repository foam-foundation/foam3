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
        var self = this;

        var url = foam.blob.BlobBlob.isInstance(this.data)
          ? URL.createObjectURL(this.data.blob)
          : this.address;

        var isImage = this.mimeType && this.mimeType.startsWith('image/');
        var isPdf   = this.mimeType === 'application/pdf';
        var title   = this.filename || 'Document';

        var popup = foam.u2.dialog.Popup.create({ closeable: true }, X);

        popup
          .start('div')
            .style({
              'display':        'flex',
              'flex-direction':  'column',
              'width':           '80vw',
              'max-width':       '1000px',
              'height':          '80vh',
              'max-height':      '800px'
            })

            // ── Header ──
            .start('div')
              .style({
                'display':         'flex',
                'align-items':     'center',
                'justify-content': 'space-between',
                'padding':         '12px 16px',
                'border-bottom':   '1px solid #e5e7eb',
                'background':      '#f9fafb',
                'flex-shrink':     '0'
              })
              .start('span')
                .style({
                  'font-size':     '14px',
                  'font-weight':   '600',
                  'color':         '#111827',
                  'overflow':      'hidden',
                  'text-overflow': 'ellipsis',
                  'white-space':   'nowrap',
                  'max-width':     '80%'
                })
                .add(title)
              .end()
              .start('span')
                .style({
                  'font-size':     '11px',
                  'padding':       '2px 8px',
                  'border-radius': '4px',
                  'background':    '#f3f4f6',
                  'color':         '#6b7280'
                })
                .add(self.mimeType || 'Unknown')
              .end()
            .end()

            // ── Content ──
            .start('div')
              .style({
                'flex':            '1',
                'overflow':        'auto',
                'display':         'flex',
                'align-items':     'center',
                'justify-content': 'center',
                'padding':         '16px',
                'background':      '#ffffff'
              })
              .callIf(isImage, function() {
                this.start('img')
                  .attrs({ src: url, alt: title })
                  .style({
                    'max-width':     '100%',
                    'max-height':    '100%',
                    'object-fit':    'contain',
                    'border-radius': '4px'
                  })
                .end();
              })
              .callIf(isPdf, function() {
                this.start('iframe')
                  .attrs({ src: url + '#toolbar=1&navpanes=0', title: title })
                  .style({
                    'width':         '100%',
                    'height':        '100%',
                    'border':        'none',
                    'border-radius': '4px'
                  })
                .end();
              })
              .callIf( ! isImage && ! isPdf, function() {
                this.start('span')
                  .style({ 'color': '#9ca3af', 'font-size': '14px' })
                  .add('Preview not available for this file type.')
                .end();
              })
            .end()

            // ── Footer ──
            .start('div')
              .style({
                'display':         'flex',
                'align-items':     'center',
                'justify-content': 'flex-end',
                'gap':             '8px',
                'padding':         '10px 16px',
                'border-top':      '1px solid #e5e7eb',
                'background':      '#f9fafb',
                'flex-shrink':     '0'
              })
              .startContext({ data: self })
                .tag(self.cls_.DOWNLOAD, { buttonStyle: 'PRIMARY' })
              .endContext()
            .end()

          .end();

        // Use open() which calls write() — works without ctrl
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
