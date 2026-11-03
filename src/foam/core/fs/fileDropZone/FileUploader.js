/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.fileDropZone',
  name: 'FileUploader',
  extends: 'foam.u2.View',

  requires: [
    'foam.log.LogLevel',
    'foam.core.fs.fileDropZone.FileDropZone',
    'foam.u2.view.ReferenceArrayView'
  ],

  imports: [
    'fileDAO',
    'fileLabelDAO',
    'notify'
  ],

  messages: [
    { name: 'LABEL_TITLE',       message: 'File Uploader' },
    { name: 'LABEL_FILE_GROUP',  message: 'File Group' },
    { name: 'ERROR_FILE_UPLOAD', message: 'Please provide File and Label' }
  ],

  documentation: 'View to upload file and assign category',

  css: `
    << {
      background: $backgroundDefault;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    <<button {
      text-align: right;
    }
  `,

  properties: [
    {
      class: 'foam.core.fs.FileArray',
      name: 'files',
    },
    {
      class: 'Reference',
      of: 'foam.core.fs.FileLabel',
      name: 'label'
    },
    {
      class: 'Boolean',
      name: 'showTitle'
    },
    {
      class: 'Int',
      name: 'owner'
    },
    [ 'showLabel', true ],
    [ 'showAction', true],
    'supportedFormats'
  ],

  methods: [
    function render() {
      this.SUPER();

      // load initial data into files if present
      if ( this.data ) this.files = [ this.data ];

      // this is a single file uploader, link data and files[0]
      this.data$.linkFrom(this.files$.at(0));

      var self = this;
      this
        .addClass()
        .callIf(this.showTitle, function() {
          this.start().addClass('h100')
            .add(this.LABEL_TITLE)
          .end();
        })
        .tag(this.FileDropZone, { files$: this.files$, isMultipleFiles: false, supportedFormats: self.supportedFormats })
        .start()
          .show(this.showLabel$)
          .addClass('h600')
          .add(this.LABEL_FILE_GROUP)
        .end()
        .start()
          .show(this.showLabel$)
          .tag({
            class: 'foam.u2.view.ReferenceView',
            dao: this.fileLabelDAO,
            data$: this.label$
            })
        .end()
        .startContext({ data: self })
          .start(this.UPLOAD, { buttonStyle: foam.u2.ButtonStyle.PRIMARY })
            .addClass(this.myClass('button'))
          .end()
        .endContext();
    }
  ],

  actions: [
    {
      name: 'upload',
      isAvailable: function(showAction) { return showAction; },
      code: async function(X) {
        if ( this.files[0] && !! this.label ) {
          this.files[0].label = this.label;
          if ( this.owner !== 0 ) {
            this.files[0].owner = this.owner;
          }
          await this.fileDAO.put(this.files[0]);
          X.closeDialog();
        } else {
          this.notify(this.ERROR_FILE_UPLOAD, this.log, this.LogLevel.ERROR, true);
        }
      }
    }
  ]
});
