/**
 * @license
 * Copyright 2015 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'SessionLinkMenu',
  extends: 'foam.core.menu.LinkMenu',

  imports: [
    'window'
  ],

  documentation: 'A menu item which links to an URL with current session id.',

  methods: [
    function select(X, menu) {
      var url = "";
      if ( ! this.link.includes("http") ) {
        url = this.window.location.origin;
      }
      url += this.link;
      if ( ! this.link.includes("?") ) {
        url += "?";
      } else {
        url += "&";
      }
      url += "sessionId=" + localStorage.defaultSession;
      this.link = url;

      this.SUPER();
    }
  ]
});
