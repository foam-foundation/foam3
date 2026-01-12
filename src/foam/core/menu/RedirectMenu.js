/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'RedirectMenu',
  extends: 'foam.core.menu.AbstractMenu',

  documentation: `Fetches menus from the URL params and redirects to the first one`,

  imports: [
    'menuDAO',
    'pushDefaultMenu',
    'routeTo',
    'window'
  ],

  requires: [
  ],

  properties: [
    {
      class: 'StringArray',
      name: 'menus'
    },
    {
      class: 'String',
      name: 'serviceName'
    }
  ],

  methods: [
    async function launch(x) {
      let url = new URL(this.window.location.href);
      this.serviceName = url.searchParams.get('service');
      url.searchParams.delete('service');

      // service redirect from client via redirect menu
      if ( this.serviceName ) {
        url.pathname = '/service/' + this.serviceName;
        this.window.location.href = url;
        return;
      }

      // menu redirect
      this.menus = url.searchParams.get('menus')?.split(',');
      url.searchParams.delete('menus');
      this.window.history.replaceState('', '', url);
      if ( ! this.menus.length ) {
        this.pushDefaultMenu();
        return;
      }
      for ( menu of this.menus ) {
        let found = await this.menuDAO.find(menu);
        if ( found ) {
          this.routeTo(menu);
          break;
        }
      }
    }
  ]
});
