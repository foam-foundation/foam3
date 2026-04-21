/**
 * @license
 * Copyright 2014 Google Inc. All Rights Reserved.
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
  package: 'foam.u2.dialog',
  name: 'Popup',
  extends: 'foam.u2.borders.ControlBorder',

  documentation: `This is a container for a whole-screen, modal overlay. It
    fills the viewport with a transparent grey background, and then
    centers the "content" element. Clicking the background closes the
    dialog. Exports itself as "overlay", for use by OK and CANCEL buttons.`,

  imports: [
    'setTimeout'
  ],

  exports: [
    'close as closeDialog',
    'as popup',
    'as controlBorder'
  ],

  requires: ['foam.lang.Latch'],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      align-items: center;
      bottom: 0;
      height: 100%;
      justify-content: space-around;
      left: 0;
      position: fixed;
      right: 0;
      top: 0;
      width: 100%;
      z-index: 1000;
    }
    ^X {
      position: absolute;
      top: min(10%, 16px);
      right: min(10%, 16px);
      z-index: 1000;
      cursor: pointer;
      transition: all ease-in 0.1s;
      padding: 0;
    }
    ^X:hover{
      transform: scale(1.1)
    }
    ^background {
      background-color: $backgroundInverse;
      bottom: 0;
      left: 0;
      opacity: 0.4;
      position: absolute;
      right: 0;
      top: 0;
    }
    ^inner {
      height: auto;
      width: auto;
      display: flex;
      justify-content: center;
      z-index: 3;
      position: relative;
      border-radius: 3px;
      box-shadow: 0 24px 24px 0 rgba(0, 0, 0, 0.12), 0 0 24px 0 rgba(0, 0, 0, 0.15);
      overflow: auto;
      background: $backgroundDefault;
      /* The following line fixes a stacking problem in certain browsers. */
      will-change: opacity;
    }

    ^fullscreen ^inner {
      height: 100%;
      width: 100%;
      border-radius: 0;
    }
 `,

  properties: [
    {
      name: 'backgroundColor'
    },
    {
      class: 'Boolean',
      name: 'closeable',
      value: true
    },
    'onClose',
    {
      class: 'Boolean',
      name: 'isStyled',
      value: true,
      documentation: 'Can be used to turn off all styling for modal container'
    },
    {
      class: 'Boolean',
      name: 'fullscreen'
    },
    {
      class: 'Boolean',
      name: 'showActions',
      value: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Latch',
      name: 'closedLatch',
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      var content;
      this.onDetach({ detach: () => { this.closedLatch?.resolve(); } })

      this.addClass()
        .enableClass(this.myClass('fullscreen'), this.fullscreen$)
        .start()
          .addClass(this.myClass('background'))
          .on('click', this.closeable ? this.closeModal.bind(this) : null)
        .end()
        .start()
          .call(function() { content = this; })
          .enableClass(this.myClass('inner'), this.isStyled$)
          .callIf(this.backgroundColor && this.isStyled, function() {
            this.style({ 'background-color': this.backgroundColor })
          })
          .startContext({ data: this })
            .start(this.CLOSE_MODAL, { buttonStyle: 'TERTIARY' })
              .show(this.closeable$.and(this.showActions$))
              .addClass(this.myClass('X'))
            .end()
          .endContext()
        .end();

      this.content = content;
    },

    function open() {
      this.closedLatch = this.Latch.create();
      this.write();
      this.focus();
    }
  ],

  listeners: [
    function close() { this.closeModal(); }
  ],

  actions: [
    {
      name: 'closeModal',
      icon: 'images/ic-cancelblack.svg',
      label: '',
      keyboardShortcuts: [ 27 /* Escape */ ],
      code: function() {
        if ( this.onClose ) this.onClose();
        this.closedLatch?.resolve(this.data);
        // Delay removal by 32ms (two animation frames) so the action.closeModal
        // topic has a chance to be published
        this.hide();
        this.setTimeout(() => {this.remove()}, 32);
      }
    }
  ]
});
