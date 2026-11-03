/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'AlertMessageBorder',
  extends: 'foam.u2.Element',
  documentation: `
    A message border that renders at the bottom of the child view. Displays a warning message from any class in an inlineNotificationMessage;
    Eg.
    {
      class: 'foam.u2.borders.AlertMessageBorder',
      source: 'foam.somePackage.someClass.MESSAGE_NAME',
      children: [....]
    }
  `,
  requires: ['foam.u2.dialog.InlineNotificationMessage'],
  css: `
    << {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  `,
  properties: [
    {
      class: 'String',
      name: 'source',
      documentation: 'Expects a path to a message axiom on another foam class. See class documentation',
      adapt: function(_, n) {
        var lastIndex = n.lastIndexOf('.');
        var classObj = foam.lookup(n.substring(0, lastIndex));
        return classObj[n.substring(lastIndex + 1)];
      }
    },
    'futureContent_'
  ],
  methods: [
    function render() {
      this.addClass().tag('', {}, this.futureContent_$)
      .add(this.slot(function(source) {
        let e = this.E().style({ display: 'contents' });
        return source ?
        e.start(this.InlineNotificationMessage, { type: 'WARN' }).add(this.source).end() :
        e;
      }));
      this.content = this.futureContent_;
    }
  ],
});
