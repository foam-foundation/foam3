/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.view',
  name: 'DocumentUploadView',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.fs.fileDropZone.FileDropZone',
    'foam.core.fs.fileDropZone.FilePreview'
  ],

  css: `
    <<{
      display: inline-grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 24px 24px;
      justify-items: start;
    }
    <<left-container{
      grid-column: 1 / 5;
      width: 100%;
    }
    <<right-container{
      grid-column: 5 / 12;
    }
  `,

  methods: [
    function render() {
      let selectSlot = foam.lang.SimpleSlot.create({ value: 0 });
      this.SUPER();
      this
        .addClass(this.myClass())
        .start()
          .addClass(this.myClass('left-container'))
          .add(this.FileDropZone.create({
            files$: this.data$,
            selected$: selectSlot
          }))
        .end()
        .start()
          .addClass(this.myClass('right-container'))
          .add(this.FilePreview.create({
            data$: this.data$,
            selected$: selectSlot
          }))
        .end();
    }
  ]
});
