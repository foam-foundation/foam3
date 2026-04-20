/*
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.dialog',
  name: 'ModalStyles',

  values: [
    {
      name: 'DEFAULT',
      color: '$backgroundDefault'
    },
    {
      name: 'DESTRUCTIVE',
      color: '$destructive400'
    },
    {
      name: 'WARN',
      color: '$warn400'
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'StyledModal',
  extends: 'foam.u2.dialog.Popup',
  documentation: `
    This view is a simple styled modal with a title and ability to add content/strings and actions
  `,

  imports: ['returnExpandedCSS', 'theme?'],

  requires: ['foam.u2.dialog.ModalStyles', 'foam.u2.layout.Rows'],

  css: `
    ^top{
      position: absolute;
      top: 2vh;
    }
    ^colorBar{
      border: 1px solid;
      border-bottom: 0px;
      border-radius: 3px 3px 0 0;
      box-sizing: border-box;
      height: 8px;
      width: 100%;
      z-index: 4;
    }
    ^inner {
      background-color: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 0 0 3px 3px;
      border-top: none;
      box-shadow: 0 24px 24px 0 rgba(0, 0, 0, 0.12), 0 0 24px 0 rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
      height: 100%;
      padding-bottom: 0px;
    }
    ^modal-body{
      height: 100%;
      overflow: auto;
      position: relative;
    }
    ^actionBar {
      display: flex;
      justify-content: flex-end;
      padding: 16px 0px;
      gap: 8px;
    }
    ^actionBar:empty {
      display:none;
    }
    ^fullscreen ^wrapper {
      height: 100%;
      width: 100%;
      border-radius: 0;
    }
    ^header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
    }
    ^title {
      font-weight: $font-bold;
    }
    ^X {
      position: relative;
      right: 0;
      top: 0;
    }
    ^description {
      padding-block: 16px;
      border-bottom: 1px solid $borderLight;
      font-size: $body-md;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'maxHeight',
      value: '65vh'
    },
    {
      class: 'String',
      name: 'maxWidth',
      value: 'min(90vw, 400px)'
    },
    {
      class: 'Enum',
      of: 'foam.u2.dialog.ModalStyles',
      name: 'modalStyle',
      value: 'DEFAULT',
      documentation: 'Setting modal styles adds a coloured bar at the top of the modal'
    },
    {
      name: 'title',
      class: 'String'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Action',
      name: 'actionArray',
      documentation: 'Can be used to specify additional actions. Designed to be used when there are no primary/secondaryActions'
    },
    {
      class: 'Boolean',
      name: 'isTop',
      value: false,
      documentation: 'Positions the modal to the top of the screen'
    },
    {
      class: 'String',
      name: 'description'
    },
    'wrapper_'
  ],

  methods: [
    function init() {
      let getColor = a => {
        return a.startsWith('$') ?
        foam.CSS.returnTokenValue(a, this.cls_, this.__subContext__) :
        this.returnExpandedCSS(a);
      };
      var bgColor = getColor(this.modalStyle.color);
      this
        .addClass(this.myClass())
        .enableClass(this.myClass('fullscreen'), this.fullscreen$)
        .on('keydown', this.onKeyDown)
        .start()
          .addClass(this.myClass('background'))
          .on('click', this.closeable ? this.close : null)
        .end()
        .start(this.Rows, {}, this.wrapper_$)
          .addClass(this.myClass('wrapper'))
          .style({
            'max-height': this.slot(function(fullscreen, maxHeight) { return ! fullscreen ? maxHeight : ''}),
            'max-width': this.slot(function(fullscreen, maxWidth) { return ! fullscreen ? maxWidth : ''})
          })
          .enableClass(this.myClass('top'), this.isTop$)
          .start()
              .enableClass(this.myClass('colorBar'), this.isStyled$)
              .style({ 'background-color': bgColor, 'border-color': this.modalStyle != 'DEFAULT' ? bgColor : getColor('$borderDefault')})
          .end()
          .start()
            .enableClass(this.myClass('inner'), this.isStyled$)
            .enableClass(this.myClass('closeable'), this.closeable$)
            .start().addClass(this.myClass('header'))
              .start().addClass('h400', this.myClass('title')).add(this.title).end()
              .startContext({ data: this })
                .start(this.CLOSE_MODAL, { buttonStyle: 'TERTIARY' }).show(this.closeable$)
                  .addClass(this.myClass('X'))
                .end()
              .endContext()
            .end()
            .start().show(this.description$).addClass(this.myClass('description')).add(this.description$).end()
            .start()
              .addClass(this.myClass('modal-body'))
              .add(this.addBody())
            .end()
            .start()
                .addClass(this.myClass('actionBar'))
                .call(this.addActions, [this])
              .end()
          .end()
        .end();
    },
    function styleWrapper() {
      this.wrapper_.style(...arguments);
      return this;
    },
    function addBody() {
      return this.E().tag('', null, this.content$);
    },
    function addActions(self) {
      var actions = this.startContext({ data$: self.data$ });
      for ( action of self.actionArray ) {
        actions.tag(action);
      }
      actions.endContext();
    }
  ]
});
