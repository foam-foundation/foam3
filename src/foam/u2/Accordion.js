/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.u2',
  name: 'Accordion',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.u2.ActionView'
  ],

  css: `
    ^ {
      position: relative;
      padding: 0.8rem;
      display: flex;
      flex-direction: column;
    }
    ^control {
      display: inline;
      position: relative;
      width: 30px;
    }
    ^toolbar {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      color: $textSecondary;
      cursor: pointer;
      width: 100%;
    }
    ^title-section {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    ^.expanded > ^toolbar {
      padding: 0 0 0.8rem 0;
    }
    ^control {
      transition: transform 0.3s;
    }
    ^.expanded > ^toolbar ^control {
      transform: rotate(90deg);
    }
    ^control svg {
      max-height: 1em;
      max-width: 1em;
      fill: $textDefault;
    }
  `,

  properties: [
    {
      name: 'title',
      hidden: true,
      documentation: `
        Title of the accordion. The title property is pre-initialized as a foam.u2.Element
        that is already bound to the DOM. You should add content to this existing element
        rather than replacing it.

        IMPORTANT: I spend too much time on this mistake.
        So, DO NOT replace the title element (this.title = ...) as this will break the DOM binding. Instead, use .add() to add content to the existing element.

        USAGE:
          EXAMPLE 1 - Simple string title:
          this
            .start(foam.u2.Accordion)
            .call(function() {
              this.title.add('My Accordion Title');
            });

          EXAMPLE 2 - Complex title with icon and reactive content:
          var self = this;
          this
            .start(self.Accordion, {
              expanded: false,
              togglerPosition: 'left'
            })
            .call(function() {
              this.title
                .start({
                  class: 'foam.u2.tag.Image',
                  data: 'images/folder.svg'
                })
                .end()
                .add(' ')
                .add(self.data$.map(function(item) {
                  return item ? item.name + ' (' + item.count + ')' : 'Loading...';
                }));
            });

        For a real-world implementation example, see:
        - foam3/src/foam/core/reflow/Console.js (Block class, lines 523-533)
      `
    },
    {
      name: 'rightSection',
      hidden: true,
      documentation: `
        Right section content. Can be a list of actions, a counter, ...etc

        USAGE:
          OPTION 1:
          let accordion = this.start(this.Accordion);
          accordion.rightSection.add(self.UPDATE_ACTION);

          OPTION 2:
          this
            .start(foam.u2.Accordion)
            .call(function() {
              this.rightSection = self.UPDATE_ACTION;
            });

          OPTION 3:
          this.tag(foam.u2.Accordion, {}, this.accordion$);
          this.accordion.rightSection.add(self.UPDATE_ACTION);
      `
    },
    {
      class: 'String',
      name: 'controlGlyph',
      hidden: true,
      value: 'next'
    },
    {
      class: 'String',
      name: 'togglerPosition',
      hidden: true,
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [ 'left', 'right' ]
      },
      value: 'right'
    },
    {
      class: 'Boolean',
      name: 'expanded',
      value: true
    }
  ],

  methods: [
    function init() {
      let self = this;
      this
        .addClass()
        .enableClass('expanded', this.expanded$)
        .start('div')
          .addClass(self.myClass('toolbar'))
          .on('click', self.toggle.bind(self))
          .start('div')
            .addClass(self.myClass('title-section'))
            .callIf(self.togglerPosition === 'left', this.addToggle, [self])
            .start('div', {}, this.title$)
              .addClass(self.myClass('title'))
              .addClass('p-bold')
            .end()
          .end()
          .start('div', {}, this.rightSection$)
            .addClass(self.myClass('right-section'))
            .callIf(self.togglerPosition === 'right', this.addToggle, [self])
          .end()
        .end()
        .start('div', null, this.content$)
          .show(this.expanded$)
          .addClass(this.myClass('content'))
        .end();
    },
    function addToggle(self) {
      this.start(self.TOGGLE, { themeIcon: self.controlGlyph })
        .addClass(self.myClass('control'));
    }
  ],

  actions: [
    {
      name: 'toggle',
      label: '',
      buttonStyle: 'UNSTYLED',
      code: function() { this.expanded = ! this.expanded; }
    }
  ]
});
