/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'UserView',
  extends: 'foam.u2.Element',

  documentation: 'View user name and user nav settings',

  imports: [
    'subject'
  ],

  requires: [
    'foam.core.menu.Menu',
    'foam.core.menu.SubMenuView',
  ],

  css: `
    ^ {
      display: flex;
      margin: 10 40px;
    }
    ^ .icon-container {
      margin-top: 4;
      position: relative;
    }
    ^ h1 {
      font-weight: $font-extra-light;
    }
    ^carrot {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid $white;
    }
    ^ > .profile-container {
      cursor: pointer;
      display: flex;
      align-items: center;
      height: 40px;
      margin-left: 10px;
    }
    ^ > .profile-container:hover {
      cursor: pointer;
    }
    ^ > .profile-container > * {
      margin: 0 5px 5px;
    }
    ^ .foam-core-menu-SubMenuView-inner {
      position: absolute;
      float: right;
      z-index: 10001;
      width: 215px;
      background: $backgroundDefault;
      box-shadow: 2px 2px 2px 2px rgba(0, 0, 0, 0.19);
      top: 65px;
      right: 0px;
    }
    ^ .foam-core-menu-SubMenuView-inner > div {
      height: 40px;
      padding-left: 50px;
      color: $textDefault;
      line-height: 25px;
    }
    ^ .foam-core-menu-SubMenuView-inner > div:last-child {
      background-color: $backgroundDefault;
      box-shadow: 0 -1px 0 0 $grey200;
      color: $red400;
    }
    ^ .foam-core-menu-SubMenuView-inner > div:hover {
      background-color: $backgroundBrand;
      cursor: pointer;
    }
    ^ .foam-core-menu-SubMenuView-inner::before {
      content: ' ';
      position: absolute;
      height: 0;
      width: 0;
      border-bottom-color: $white;
      -ms-transform: translate(110px, -16px);
      transform: translate(110px, -16px);
    }
    ^ .currency-container {
      all:none !important;
    }
  `,

  methods: [
    function render() {
      this
        .addClass(this.myClass());
        this.otherViews();

        this.tag({ class: 'foam.core.u2.navigation.NotificationMenuItem' })

        // The username and settings dropdown
        .start().addClass('profile-container')
          .on('click', () => {
            this.tag(this.SubMenuView.create({
              menu: this.Menu.create({ id: 'settings' })
            }));
          })
          .start('h1')
            .add( this.subject.user$.dot('firstName') ).addClass('p-md', this.myClass('user-name'))
          .end()
          .start()
            .addClass(this.myClass('carrot'))
          .end()
        .end();
    },
    function otherViews() {}
  ]
});
