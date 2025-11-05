/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'ScrollBorder',
  extends: 'foam.u2.Element',

  css: `
    ^ {
      display: flex;
      flex-direction: column;
    }
    ^shouldOverflow{
      height: 100%;
    }
    ^reverse {
      width: 100%;
      display: flex;
      flex-direction: column-reverse;
      justify-content: flex-end;
      flex: 1;
      width: 100%;
    }
    /* Extra div added by borders?? */
    ^reverse > div:not(.edge) {
      flex: 1;
    }
    ^shouldOverflow > ^reverse > div:not(.edge) {
      height: 100%;
    }
    ^::before {
      display: block;
      opacity: 0;
      height: 7px;
      min-height: 7px;
      width: 100%;
      content: '';
      z-index: 10;
      background: linear-gradient(to bottom, #DADDE2 0, #ffffff00 7px, #ffffff00 100%);
      top: 0;
      position: sticky;
    }
    ^::after {
      display: block;
      opacity: 0;
      height: 7px;
      min-height: 7px;
      width: 100%;
      content: '';
      z-index: 10;
      background: linear-gradient(to top, #DADDE2 0, #ffffff00 7px, #ffffff00 100%);
      bottom: 0;
      position: sticky;
    }
    ^topShadow::before {
      opacity: 1;
    }
    ^botShadow::after {
      opacity: 1;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'topShadow'
    },
    {
      class: 'Boolean',
      name: 'botShadow'
    },
    {
      class: 'Boolean',
      name: 'disableScroll'
    },
    'topEdge_',
    'botEdge_'
  ],

  methods: [
    function init () {
      this
        .addClass()
        .enableClass(this.myClass('shouldOverflow'), this.disableScroll$)
        .enableClass(this.myClass('topShadow'), this.topShadow$)
        .enableClass(this.myClass('botShadow'), this.botShadow$)
        .start('', {}, this.topEdge_$)
          .attrs({
            'data-pos': 'topShadow',
            'aria-hidden': true
          })
          .addClass('edge')
        .end()
        .start()
          .addClass(this.myClass('reverse'))
          .start('', {}, this.botEdge_$)
          .attrs({
            'data-pos': 'botShadow',
            'aria-hidden': true
          })
            .addClass('edge')
          .end()
          .tag('div', null, this.content$)
        .end()
        ;
      this.addObserver();
    },
    // Starts an IntersectionObserver which invokes the onScrollUpdate listener
    // whenever the number of edges (top and bottom) visible in the scrollable
    // area changes.
    async function addObserver () {
      const root = await this.el_();
      const options = {
        root,
        rootMargin: '0px 0px 0px',
        threshold: [0.25, 0.5, 0.25]
      };

      const observer = new IntersectionObserver(this.onScrollUpdate, options);

      (async () => {
        observer.observe(await this.topEdge_.el_());
      })();
      (async () => {
        observer.observe(await this.botEdge_.el_());
      })();
    }
  ],

  listeners: [
    {
      name: 'onScrollUpdate',
      isFramed: true,
      code: function(entries) {
        for ( const entry of entries ) {
            if ( (this.el_().scrollHeight - this.el_().clientHeight) > 7 || (this.el_().scrollHeight === this.el_().clientHeight) ) {
            const prop = entry.target.dataset.pos;
            this[prop] = ! entry.isIntersecting;
          }
        }
      }
    }
  ]
});
