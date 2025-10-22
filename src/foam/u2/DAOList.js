/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * TODO:
 * - Add Projection support
 */
foam.CLASS({
  package: 'foam.u2',
  name: 'DAOList',
  extends: 'foam.u2.View',

  exports: [
    'selection',
    'hoverSelection',
    'data as dao'
  ],

  imports: [
    'editRecord?',
    'selection? as importSelection'
  ],

  requires: [
    'foam.u2.view.LazyScrollManager',
    'foam.u2.layout.Cols'
  ],

  css: `
  ^ {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
    height: 100%;
  }
  ^wrapper{
    /*Scroll*/
    flex: 1;
    max-height: 100%;
    height: -webkit-fill-available;
    position: relative;
    overflow: auto;
    overscroll-behavior-y: contain;
    scroll-behavior: smooth;
  }
  ^wrapper [data-page] > [data-idx] {
    padding: 4px 8px;
  }
  ^wrapper [data-page] {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  ^wrapper groupHeader {
    width: 100%;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-start;
  }
  ^nav{
    align-items: center;
    background: $backgroundDefault;
    border-radius: 0 0 4px 4px;
    border-top: 1px solid $borderDefault;
    box-sizing: border-box;
    gap: 8px;
    justify-content: flex-end;
    max-height: 56px;
    padding: 16px 24px;
    width: 100%;
  }
  ^buttons svg{
    width: 1em;
    height: 1em;
  }
  ^counters > *:focus {
    border: 0px;
    border-radius: 0px;
    padding: 0px;
    height: auto;
    border-bottom: 2px solid $borderBrand;
  }
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'rowView',
      value: { class: 'foam.u2.CitationView' }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'rowView_',
      expression: function(rowView) {
        return { class: 'foam.u2.RowWrapper', rowView: rowView }
      }
    },
    'selection',
    'hoverSelection',
    'listEl_',
    'scrollEl_',
    {
      class: 'Boolean',
      name: 'loadLatch',
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'groupBy'
    },
    'order',
    ['invertGroupingOrder', false]
  ],

  classes: [
    {
      name: 'GroupHeader',
      extends: 'foam.u2.View',

      css: `
        ^ {
          min-height: 20px;
          padding: 8px;
          border-radius: $inputBorderRadius;
          background: $backgroundSecondary;
        }
      `,

      properties: [
        ['nodeName', 'groupHeader'],
        {
          class: 'String',
          name: 'groupLabel'
        }
      ],

      methods: [
        function render() {
          this
            .addClass(this.myClass(), 'h600')
            .add(this.groupLabel)
          .end();
        }
      ]
    }
  ],

  messages: [
    { name: 'MESSAGE_OF', message: 'of'}
  ],

  methods: [
    function render() {
      let view = this;
      var buttonStyle = { label: '', buttonStyle: 'TERTIARY', size: 'SMALL' };
      this
        .addClass(this.myClass())
        .start('', {}, this.listEl_$).addClass(this.myClass('wrapper'))
          .tag(this.LazyScrollManager, {
            data$: this.data$,
            rowView: this.rowView_,
            rootElement: this.listEl_,
            groupHeaderView: { class: 'foam.u2.DAOList.GroupHeader' },
            groupBy$: this.groupBy$,
            order$: this.order$,
            invertGroupingOrder$: this.invertGroupingOrder$,
            ctx: this
          }, this.scrollEl_$)
        .end()
        .start(view.Cols).addClass(view.myClass('nav')).style({ 'justify-content': 'flex-end'})
          .startContext({ data: view.scrollEl_ })
            .start(view.Cols)
              .style({ gap: '4px', 'box-sizing': 'border-box' })
              .start('').add(view.scrollEl_$.dot('topRow')).addClass(this.myClass('counters')).end()
              .add('-')
              .start('').add(view.scrollEl_$.dot('bottomRow')).addClass(this.myClass('counters')).end()
              .start().addClass(view.myClass('separator')).translate(this.cls_.id + '.MESSAGE_OF', this.MESSAGE_OF).end().add(view.scrollEl_.daoCount$)
            .end()
            .start(view.scrollEl_.FIRST_PAGE, { ...buttonStyle, themeIcon: 'first' })
            .addClass(view.myClass('buttons')).end()
            .start(view.scrollEl_.PREV_PAGE, { ...buttonStyle, themeIcon: 'back' })
            .addClass(view.myClass('buttons')).end()
            .start(view.scrollEl_.NEXT_PAGE, { ...buttonStyle, themeIcon: 'next' })
            .addClass(view.myClass('buttons')).end()
            .start(view.scrollEl_.LAST_PAGE, {  ...buttonStyle, themeIcon: 'last' })
            .addClass(view.myClass('buttons')).end()
          .endContext()
        .end();
    }
  ]
});


foam.CLASS({
    package:'foam.u2',
    name: 'RowWrapper',
    extends: 'foam.u2.View',
    documentation: 'A wrapper view that adds click functionality to the list rows',

    mixins: ['foam.comics.v2.Clickable'],
    imports: ['theme?', 'config'],
    css: `
      ^ {
        display: flex;
        padding: 8px;
        gap: 8px;
        min-height: 20px;
        border-radius: $inputBorderRadius;
        border: 1.5px solid $borderXLight;
        transition: all 0.2s ease;
      }
      ^ > div {
        padding: 0;
      }
      ^ > :first-child {
        flex: 1;
      }
      ^clickable:hover {
        background: $backgroundBrandTertiary;
        border-color: $borderBrandXLight;
        cursor: pointer;
      }
      ^svg-wrapper{
        display: flex;
        align-items: center;
      }
      ^svg-wrapper svg {
        width: 1.1em;
        height: 1.1em;
        fill: black;
      }
      ^clickable:hover ^svg-wrapper svg {
        fill: $textBrandSecondary;
      }
    `,

    properties: [
      {
        class: 'foam.u2.ViewSpec',
        name: 'rowView'
      }
    ],

    methods: [
      function render() {
        var self = this;
        this.addClass()
        .enableClass(this.myClass('clickable'), ! this.config?.disableSelection)
        .start(this.rowView, { data: this.data })
          .call(this.insertClick.bind(self), [this.data])
        .end()
        .start().addClass(self.myClass('svg-wrapper'))
          .hide(this.config?.disableSelection$)
          .start({ class: 'foam.u2.tag.Image', glyph: self.theme?.glyphs.next, role: 'presentation' })
          .end()
        .end();
      }
    ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'RelationshipDAOToERefinement',
  refines: 'foam.dao.RelationshipDAO',
  flags: ['web'],

  requires: [
    'foam.u2.CitationView',
    'foam.u2.DAOList'
  ],

  methods: [
    function toE(args, ctx) {
      args = args || {};
      args.data = this;
      args.rowView = this.CitationView;
      return this.DAOList.create(args, ctx);
    }
  ]
});
