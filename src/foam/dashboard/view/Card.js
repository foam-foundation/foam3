/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'Card',
  extends: 'foam.u2.View',

  imports: [
    'dashboardController?'
  ],

  exports: [
    'contentWidth as visualizationWidth',
    'contentHeight as visualizationHeight',
    'visualizationColors',
    'dataof as of',
  ],

  css: `
    << {
      border-radius: 10px;
      background: $backgroundDefault;
      box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
    }

    <<header {
      padding-left: 20px;
      padding-right: 16px;
      padding-top: 20px;
      padding-bottom: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  `,

  constants: [
    {
      name: 'SIZES',
      value: {
        TINY:    [176, 358],
        SMALL:   [312, '-'],
        SMEDIUM: [312, 358],
        MEDIUM:  [424, 356],
        LMEDIUM: [570, 450],
        LARGE:   [936, 528],
        XLARGE:  [1580, 698]
      }
    }
  ],

  properties: [
    {
      name: 'size',
      expression: function(data$size) { return data$size || 'MEDIUM' }
    },
    {
      name: 'width',
      expression: function(size) {
        return this.SIZES[size?.name]?.[0];
      }
    },
    {
      name: 'height',
      expression: function(size) {
        return this.SIZES[size?.name]?.[1];
      }
    },
    {
      name: 'contentWidth',
      expression: function(width) {
        return width;
      }
    },
    {
      name: 'contentHeight',
      expression: function(height) {
        // 70 is height of header as dictated by the ^header CSS class
        return height - 60;
      }
    },
    {
      class: 'FObjectProperty',
      name: 'cardData'
    },
    {
      name: 'visualizationColors',
      expression: function(data$colors) {
        return data$colors;
      }
    },
    {
      name: 'dataof',
      expression: function(data$dao$of) {
        return data$dao$of;
      }
    },
  ],

  methods: [
    function init() {
      if ( this.dashboardController )
      this.onDetach(this.dashboardController.sub('dashboard', 'update', function() {
        this.data.update();
      }.bind(this)));
      this.data?.update?.();

      var view = this;

      this.
        style({
          width: this.slot(function(data$mode, width) {
            return data$mode == 'config' ? 'inherit' : ( width + 'px' );
          }),
          height: this.slot(function(data$mode, height) {
            return data$mode == 'config' ? 'fit-content' : ( height + 'px' );
          })
        }).
        addClass(this.myClass()).
        start('div').
        addClass('h500', this.myClass('header')).
        show(!!this.data?.label || !!this.data?.configView).
        start().
          style({ float: 'left' }).
          add(this.data?.label$).
        end().
        start().
          style({ float: 'right' }).
          tag(this.data?.configView).
        end().
        end('div').
        start('div').
        addClass(this.myClass('content')).
          tag('div', null, this.content$).
        end('div');
    }
  ]
});
