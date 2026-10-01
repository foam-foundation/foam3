/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.util',
  name: 'ClipboardAccess',
  documentation: `Mixin that provides functionality to access web clipboard`,

  imports: ['ctrl?'],

  methods: [
    function copy(data, provideNotifications = true) {
      let tryCopy = function() {
        let res = navigator.clipboard ?
                  navigator.clipboard.writeText(data):
                  Promise.reject(new Error('No Clipboard Found')) ;
        if ( provideNotifications ) {
          res.then(() => {
            this.ctrl?.notify?.('Copied', '', 'INFO', true);
          }, (e) => {
            console.log(e);
            this.ctrl?.notify?.('Copy Failed', '', 'ERROR', true);
          })
        }
        return res;
      }.bind(this);
      if ( navigator.permissions ) {
        return navigator.permissions.query({ name: 'clipboard-write' }).then(result => {
          if (result.state === "granted" || result.state === "prompt") {
            return tryCopy();
          }
          if ( provideNotifications )
            this.ctrl?.notify?.('Copy Failed', 'Permission Denied', 'ERROR', true);
          return Promise.reject(new Error('Permission Denied')) ;
        })
      } else {
        return tryCopy();
      }
    },
    function cut() {},
    function paste() {}
  ]
});