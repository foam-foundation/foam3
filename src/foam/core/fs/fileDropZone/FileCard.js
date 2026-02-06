/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.fileDropZone',
  name: 'FileCard',
  extends: 'foam.u2.View',

  documentation: 'Card based on SME Design',

  requires: [
    'foam.blob.BlobBlob',
    'foam.core.fs.File',
    'foam.core.fs.FileSizeView',
    'foam.u2.HTMLView',
    'foam.u2.layout.Cols'
  ],

  imports: [
    'allowRemoval',
    'removeFile',
    'highlight',
    'theme'
  ],

  exports: [
    'as fileCard'
  ],

  css: `
    ^ {
      background: $backgroundDefault;
      border: 1px solid $borderXLight;
      border-radius: 4px;
      box-sizing: border-box;
      padding: 12px;
      width: 100%;

      -webkit-transition: all .15s ease-in-out;
      -moz-transition: all .15s ease-in-out;
      -ms-transition: all .15s ease-in-out;
      -o-transition: all .15s ease-in-out;
      transition: all .15s ease-in-out;
    }

    ^label {
      align-items: center;
      display: flex;
      gap: 0.5em;
      justify-content: flex-start;
      width: 100%;
    }

    ^name {
      color: $textBrand;
      cursor: pointer;
      overflow: hidden;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    ^name:hover {
      color: $borderBrand;
    }

    ^ .foam-u2-ActionView {
      padding: 0;
    }

    ^file-action {
      padding: 0;
    }

    ^size {
      color: $textTertiary;
      white-space: nowrap;
    }

    ^fileButton {
      overflow: hidden;
      flex-grow: 1;
      justify-content: flex-start;
    }
    ^fileCard-content.foam-u2-layout-Cols {
      gap: 8px;
      align-items: center;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'canBeRemoved',
      expression: function(controllerMode) { return controllerMode != foam.u2.ControllerMode.VIEW; }
    },
    {
      name: 'index'
    },
    {
      name: 'selected'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      if ( this.selected == this.index ) {
        this.style({
          'border-color': foam.CSS.returnTokenValue('$borderBrandStrong', this.cls_, this.__subContext__)
        });
      }
      var indicator = this.theme && this.theme.glyphs.file.expandSVG({ fill: this.theme.grey1 });
      var label = this.E()
        .addClass(this.myClass('label'))
        .callIfElse(indicator, function() {  
          this.start(self.HTMLView, { data: indicator }).attrs({ role: 'presentation' }).end();
        }, function() {
          this.start({ class: 'foam.u2.tag.Image', data: 'images/attach-icon.svg' }).end();
        })
        .start().addClass('h600', this.myClass('name'))
          .add(this.data.filename)
        .end()
        .start(this.FileSizeView, { data: this.data.filesize }).addClass(this.myClass('size'), 'p-legal').end();

      this.addClass()
      .start(this.Cols)
          .addClass(this.myClass('fileCard-content'))
          .start(self.File.VIEW, { label: label, buttonStyle: 'UNSTYLED' }).addClass(this.myClass('fileButton')).end()
          .start(self.File.DOWNLOAD, { buttonStyle: 'TERTIARY', label: '', themeIcon: 'download' }).addClass(this.myClass('file-action')).end()
          .start(this.REMOVE_FILE_X, {
            label: '',
            buttonStyle: foam.u2.ButtonStyle.TERTIARY,
            themeIcon: 'trash'
          }).show(this.allowRemoval && this.canBeRemoved).addClass(this.myClass('file-action')).end()
        .end();

      this.on('click', this.pick);
    }
  ],

  actions: [
    {
      name: 'removeFileX',
      icon: 'images/cancel-x.png',
      confirmationRequired: function() {
        return true;
      },
      code: function(X) {
        X.removeFile(X.fileCard.index);
      }
    }
  ],

  listeners: [
    {
      name: 'pick',
      code: function(X) {
        this.highlight(this.index);
      }
    }
  ]
});
