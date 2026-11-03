/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'IFrameDocView',
  extends: 'foam.u2.IFrameHTMLView',
  documentation: `Used to display an Iframe with a breadcrumb border, especially useful for displaying full page documents like T&C`,
  requires: ['foam.u2.borders.BreadcrumbBorder'],
  css: `
    << <<frame {
      border: none;
      max-width: 100%;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 0;
    }
    <<resize {
      resize: both;
    }
  `,

  methods: [
    function render() {
      this
        .addClass()
        .start(this.BreadcrumbBorder)
          .start('iframe')
            .addClass(this.myClass('frame'))
            .attrs((this.data ? { srcdoc: this.data } : { src: this.src }))
            .enableClass(this.myClass('resize'), this.resizable$)
          .end()
        .end();
    },
  ]
});
