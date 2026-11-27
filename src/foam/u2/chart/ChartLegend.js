/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'ChartLegend',
  extends: 'foam.u2.View',

  documentation: `
    The key beside a chart: one coloured swatch and label per series or
    slice. Clicking an entry hides that series, and clicking again brings it
    back; the entry is struck through while hidden. The legend is plain HTML,
    so a long label wraps or ends in an ellipsis through CSS and the browser
    sizes the legend before the chart draws into the space that is left.
  `,

  css: `
    << {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-content: center;
      gap: 0.4rem 1.2rem;
      font-size: 1.2rem;
      color: $textSecondary;
      min-width: 0;
    }
    <<vertical { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; }
    <<item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      max-width: 100%;
      min-width: 0;
      cursor: pointer;
      user-select: none;
    }
    <<static <<item { cursor: default; }
    <<swatch {
      flex: none;
      width: 2.8rem;
      height: 1.2rem;
      border-radius: 0.2rem;
    }
    <<label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    <<hidden <<label { text-decoration: line-through; }
    <<hidden <<swatch { opacity: 0.35; }
  `,

  properties: [
    {
      class: 'Array',
      name: 'items',
      documentation: 'One { label, color, hidden } per entry, in display order.'
    },
    {
      class: 'Boolean',
      name: 'vertical',
      documentation: 'Stack entries in a column, for a legend left or right of the chart.'
    },
    {
      class: 'Boolean',
      name: 'clickable',
      value: true
    },
    {
      class: 'Function',
      name: 'onToggle',
      documentation: 'Called with the entry index when a clickable entry is clicked.'
    },
    {
      class: 'Function',
      name: 'onHover',
      documentation: 'Called with (index, event) on mouse move over an entry, and with (-1) on leave.'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .addClass()
        .enableClass(this.myClass('vertical'), this.vertical$)
        .enableClass(this.myClass('static'), this.clickable$, true)
        .forEach(this.items, function(item, i) {
          this.start()
            .addClass(self.myClass('item'))
            .enableClass(self.myClass('hidden'), !! item.hidden)
            .on('click', function() { if ( self.clickable && self.onToggle ) self.onToggle(i); })
            .on('mousemove', function(e) { if ( self.onHover ) self.onHover(i, e); })
            .on('mouseleave', function() { if ( self.onHover ) self.onHover(-1); })
            .start().addClass(self.myClass('swatch')).style({ background: item.color }).end()
            .start('span').addClass(self.myClass('label')).add(item.label).end()
          .end();
        });
    }
  ]
});
