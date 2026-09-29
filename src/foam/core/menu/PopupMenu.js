/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'PopupMenu',
  extends: 'foam.u2.Element',

  imports: [ 'lastMenuLaunchedListener?' ],

  css: `
    ^container {
      align-items: center;
      display: flex;
      height: 100%;
      justify-content: space-around;
      position: relative;
      width: 100%;
    }
    ^background {
      bottom: 0;
      left: 0;
      opacity: 0.4;
      position: absolute;
      right: 0;
      top: 0;
    }
    ^inner {
      z-index: 3;
    }`
  ,

  properties: [
    'parent'
  ],

  methods: [
    function init() {
      this.SUPER();
      var content;

      this.addClass()
        .start()
          .addClass(this.myClass('background'))
          .on('click', this.close)
        .end()
        .start()
          .call(function() { content = this; })
          .addClass('p-light', this.myClass('inner'))
        .end();

      this.content = content;
    },

    function open() {
     if ( this.parent && this.parent.add ) {
        this.parent.add(this);
      } else {
        this.document.body.insertAdjacentHTML('beforeend', this.outerHTML);
        this.load();
      }
    }
  ],

  listeners: [
    function close() {
      this.lastMenuLaunchedListener && this.lastMenuLaunchedListener('');
      this.remove();
    }
  ]
});
