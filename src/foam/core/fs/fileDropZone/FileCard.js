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

  axioms: [
    foam.pattern.Faceted.create()
  ],

  requires: [
    'foam.blob.BlobBlob',
    'foam.core.fs.File',
    'foam.core.fs.FileSizeView',
    'foam.u2.tag.Image',
    'foam.u2.layout.Cols'
  ],

  imports: [
    'allowRemoval',
    'removeFile',
    'highlight',
    'theme',
    'controllerMode as importedControllerMode'
  ],

  exports: [
    'as fileCard',
    'controllerMode'
  ],

  css: `
    ^ {
      background: $backgroundDefault;
      border: 1px solid $borderXLight;
      border-radius: 4px;
      box-sizing: border-box;
      padding: 4px 12px;
      width: 100%;

      -webkit-transition: all .15s ease-in-out;
      -moz-transition: all .15s ease-in-out;
      -ms-transition: all .15s ease-in-out;
      -o-transition: all .15s ease-in-out;
      transition: all .15s ease-in-out;
    }
    
    ^:hover {
      background: $backgroundBrandTertiary;
      border-color: $borderBrand;
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
      text-overflow: ellipsis;
      white-space: nowrap;
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
      padding: 0;
      flex-grow: 1;
      justify-content: flex-start;
    }

    ^fileButton.disableButton {
      pointer-events: none;
    }

    ^fileCard-content.foam-u2-layout-Cols {
      gap: 8px;
      align-items: center;
    }

    ^nameHolder {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex-grow: 1;
      align-items: flex-start;
    }

    ^ .foam-u2-tag-Image svg {
      fill: currentColor;
      height: 1.2em;
    }
  `,

  properties: [
    {
      name: 'controllerMode',
      value: foam.u2.ControllerMode.VIEW
    },
    {
      class: 'Boolean',
      name: 'canBeRemoved',
      expression: function(importedControllerMode) { return importedControllerMode != foam.u2.ControllerMode.VIEW; }
    },
    {
      class: 'Class',
      name: 'of',
      expression: function(data) { return data?.cls_ ?? null; }
    },
    {
      name: 'index'
    },
    {
      name: 'selected'
    },
    {
      class: 'Boolean',
      name: 'allowViewAndDownload',
      value: true
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
      var label = this.returnLabel();

      this.addClass()
      .start(this.Cols)
          .addClass(this.myClass('fileCard-content'))
          .callIfElse(this.allowViewAndDownload, function() {
            this.start(self.File.VIEW, { label: label, buttonStyle: 'UNSTYLED' }).addClass(self.myClass('fileButton')).end()
            .start(self.File.DOWNLOAD, { buttonStyle: 'TERTIARY', label: '', themeIcon: 'download' }).addClass(self.myClass('file-action')).end();
          }, function() {
            this.start().add(label).addClass(self.myClass('fileButton')).enableClass('disableButton', self.allowViewAndDownload$).end();
          })
          .start(this.REMOVE_FILE_X, {
            label: '',
            buttonStyle: foam.u2.ButtonStyle.TERTIARY,
            themeIcon: 'trash'
          }).show(this.allowRemoval && this.canBeRemoved).addClass(this.myClass('file-action')).end()
        .end();

      this.on('click', this.pick);
    },
    function returnLabel() {
      let self = this;
      return this.E()
        .addClass(this.myClass('label'))
        .callIfElse(this.theme, function() {  
          this.start(self.Image, { glyph: 'file' }).attrs({ role: 'presentation' }).end();
        }, function() {
          this.start(self.Image, { data: 'images/attach-icon.svg' }).attrs({ role: 'presentation' }).end();
        })
        .start()
          .addClass(this.myClass('nameHolder'))
          .start().addClass('p-semiBold', this.myClass('name'))
            .add(this.data.filename)
          .end()
          .call(this.addSubLabel, [self])
        .end()
    },
    function addSubLabel(self) {
      this.start(self.FileSizeView, { data: self.data.filesize }).addClass(self.myClass('size'), 'p-legal-light').end();
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
