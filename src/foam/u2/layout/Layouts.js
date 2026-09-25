/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.layout',
  name: 'Rows',
  extends: 'foam.u2.Element',
  css: `
    ^ {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: stretch;
    }
  `,
  methods: [
    function render() {
      this.SUPER();
      this.addClass();
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.layout',
  name: 'Cols',
  extends: 'foam.u2.Element',
  css: `
    ^ {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
    }
  `,
  methods: [
    function render() {
      this.SUPER();
      this.addClass();
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.layout',
  name: 'Layout',
  extends: 'foam.u2.Element',
  documentation: 'Element that acts as a wrapper div, can change between flex and grid based on properties',
  exports: ['layoutType', 'as layout'],
  css: `
    ^ {
      overflow: auto;
      align-items: stretch;
    }
    ^debug > div {
      border: 1px solid $destructive;
    }
  `,
  properties: [
    {
      name: 'tooltip',
      hidden: true
    },
    {
      class: 'String',
      name: 'layoutType',
      value: 'row',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [['row', 'Horizontal'], ['column', 'Vertical'], 'grid']
      },
      postSet: function(_,n) {
        if ( n === 'grid' ) {
          this.autoGap = false;
          this.align = ['stretch', 'stretch'];
        }
      }
    },
    {
      class: 'Int',
      name: 'rows',
      value: 2,
      supportingLabel: 'Set to 0 for dynamic row sizing, rows will be sized by their biggest element',
      visibility: function(layoutType) {
        return layoutType !== 'grid' ? 'HIDDEN' : 'RW';
      }
    },
     {
      class: 'Int',
      name: 'columns',
      value: 2,
       visibility: function(layoutType) {
        return layoutType !== 'grid' ? 'HIDDEN' : 'RW';
      }
    },
    {
      class: 'Boolean',
      name: 'autoGap',
      visibility: function(layoutType) {
        return layoutType === 'grid' ? 'HIDDEN' : 'RW' ;
      },
      postSet: function(_,n) {
        this.align = n ? 'flex-start': ['flex-start', 'flex-start'];
      }
    },
    {
      class: 'Boolean',
      name: 'stretch',
      label: 'Stretch to Fill',
      visibility: function(layoutType) {
        return layoutType === 'grid' ? 'HIDDEN' : 'RW' ;
      },
      postSet: function(_,n) {
        this.align = n ? 'flex-start': ['flex-start', 'flex-start'];
      }
    },
    {
      class: 'Int',
      name: 'gap',
      value: 10,
      visibility: function(autoGap) {
        return autoGap ? 'HIDDEN' : 'RW';
      }
    },
    {
      class: 'Array',
      name: 'align',
      visibility: function(layoutType, autoGap, stretch) {
        if ( autoGap && stretch ) return 'HIDDEN';
        return layoutType === 'grid' ? 'HIDDEN' : 'RW' ;
      },
      view: function(_, X) {
        return {
          class: 'foam.u2.view.ChoiceView',
          choices$: X.data.slot(function(autoGap, layoutType, stretch) {
            if ( layoutType === 'grid' ) {
              return [
                [['stretch', 'stretch'], 'Fill'],
                [['start', 'start'],     'Top Left'],
                [['start', 'center'],    'Top Center'],
                [['start', 'end'],       'Top Right'],
                [['center', 'start'],    'Center Left'],
                [['center', 'center'],   'Center'],
                [['center', 'end'],      'Center Right'],
                [['end', 'start'],       'Bottom Left'],
                [['end', 'center'],      'Bottom Center'],
                [['end', 'end'],         'Bottom Right']
              ]
            }
            let verticalArr = [ ['flex-start', 'Top'], ['center', 'Center'], ['flex-end', 'Bottom']];
            let horizontalArr = [ ['flex-start', 'Left'], ['center', 'Center'], ['flex-end', 'Right']];
            if ( autoGap && ! stretch ) {
              return layoutType == 'row' ? verticalArr : horizontalArr;
            }
            if ( ! autoGap && stretch ) {
              return layoutType == 'column' ? verticalArr : horizontalArr;
            }
            return [
              [['flex-start', 'flex-start'], 'Top Left'],
              [['flex-start', 'center'],     'Top Center'],
              [['flex-start', 'flex-end'],   'Top Right'],
              [['center', 'flex-start'],     'Center Left'],
              [['center', 'center'],         'Center'],
              [['center', 'flex-end'],       'Center Right'],
              [['flex-end', 'flex-start'],   'Bottom Left'],
              [['flex-end', 'center'],       'Bottom Center'],
              [['flex-end', 'flex-end'],     'Bottom Right']
            ];
          })
        };
      }
    },
    {
      class: 'Boolean',
      name: 'enableDebugBorders'
    },
    {
      // redefined here to control the property order, to show it last
      name: 'shown'
    }
  ],
  methods: [
    function render() {
      this.SUPER();
      this.addClass();
      this.enableClass(this.myClass('debug'), this.enableDebugBorders$);
      this.style({
        display: this.layoutType$.map(v => v != 'grid' ? 'flex' : v),
        'flex-direction': this.layoutType$.map(v => v != 'grid' ? v : 'unset'),
        'grid-template-rows': this.slot(function(rows, layoutType) {
          return layoutType === 'grid' ? rows <= 0 ? 'max-content' : `repeat(${rows}, minmax(0, 1fr))` : 'unset';
        }),
        'grid-template-columns': this.slot(function(columns, layoutType) {
          return layoutType === 'grid' ? columns <= 0 ? 'max-content' : `repeat(${columns}, minmax(0, 1fr))` : 'unset';
        }),
        gap: this.slot(function(gap, autoGap) {
          return autoGap ? 'initial' : gap + 'px';
        }),
        'justify-content': this.slot(function(align, autoGap, layoutType, stretch) {
          if ( layoutType === 'grid' ) return  'unset';
          if ( stretch ) return align;
          return autoGap ? 'space-between' : align[(layoutType === 'row' ? 1 : 0)];
        }),
        'justify-items': this.slot(function(align, layoutType) {
          if ( layoutType === 'grid' ) return align[1];
          return 'unset';
        }),
        'align-items': this.slot(function(align, layoutType, autoGap, stretch){
          if ( layoutType === 'grid' ) return  align[0];
          if ( stretch ) return 'stretch';
          return autoGap ? align : align[(layoutType === 'row' ? 0 : 1)];
        })
      });
    }
  ]
});

foam.ENUM({
  package: 'foam.u2.layout',
  name: 'SizeMode',
  properties: [
    {
      class: 'Function',
      name: 'flexPropertyValue'
    }
  ],
  values: [
    // TODO: maybe add initial??, but if that fine of a control is needed we have manual so maybe not
    {
      name: 'FILL',
      documentation: 'Fills available space',
      flexPropertyValue: function(value) {
        return 'auto';
      }
    },
    {
      name: 'FIT_CONTENT',
      documentation: 'Fits to content size, does not expand',
      flexPropertyValue: function(value) {
        return 'none';
      }
    },
    {
      name: 'FIXED',
      documentation: 'Fixed pixel width',
      flexPropertyValue: function(value) {
        return `0 0 ${value}`;
      }
    },
    {
      name: 'MANUAL',
      documentation: 'Allows entering a completely custom "flex" property value',
      flexPropertyValue: function(value) {
        return value;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.layouts',
  name: 'LayoutChild',
  imports: ['layout'],

  properties:[
    {
      class: 'String',
      name: 'label',
      hidden: true
    },
    {
      name: 'gridColumns',
      class: 'Int',
      value: 1,
      visibility: function(layout$layoutType) {
        return layout$layoutType === 'grid' ? 'RW' : 'HIDDEN';
      }
    },
    {
      name: 'flexContainerType',
      label: 'Content Sizing',
      class: 'Enum',
      of: 'foam.u2.layout.SizeMode',
      visibility: function(layout$layoutType) {
        return layout$layoutType !== 'grid' ? 'RW' : 'HIDDEN';
      }
    },
    {
      name: 'flexValue',
      label: 'Value',
      class: 'String',
      view: function(_,X) {
        return {
          class: 'foam.u2.view.StringView',
          writeView: {
            class: 'foam.u2.TextField',
            placeholder$: X.data$.dot('flexContainerType').map(v => {
              if ( v == 'FIXED' ) return 'Enter size values (eg. 60px, 2rem, 40%)';
              return 'Enter values for "flex" css property'
            })
          }
        }
      },
      visibility: function(layout$layoutType, flexContainerType) {
        return layout$layoutType !== 'grid' &&
        (flexContainerType == 'FIXED' || flexContainerType == 'MANUAL') ?
        'RW' : 'HIDDEN';
      }
    }
  ],
  listeners: [
    {
      name: 'addLayoutProps',
      isFramed: true,
      code: function() {
        this.style({
          'grid-column': this.slot(function(layout$columns, layout$layoutType, gridColumns) {
            if ( layout$layoutType === 'grid' )
              return `span ${Math.min(gridColumns, layout$columns)}`;
            return 'initial';
          }),
          flex: this.slot(function(layout$layoutType, flexContainerType, flexValue) {
            if ( layout$layoutType === 'grid' ) return 'unset';
            return flexContainerType.flexPropertyValue(flexValue);
          })
        });
      }
    }
  ]
});
