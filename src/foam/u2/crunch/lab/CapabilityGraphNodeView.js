/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch.lab',
  name: 'CapabilityGraphNodeView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.crunch.CapabilityFeatureView'
  ],

  css: `
    foreignObject^{pointer-events:none;}
    ^div {
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;

      border-radius: 10px;
      box-shadow: 0 1px 5px 0 rgba(0, 0, 0, 0.2);
      border: solid 1px $borderLight;
      background-color: $backgroundDefault;

      overflow: hidden;
    }

    ^segment {
      border-bottom: 1px solid $borderStrong;
      background-color: $backgroundDefault;
      padding: 8px 0;
      text-align: center;
      margin-bottom: 8px;
      box-shadow: 0 1px 5px 0 rgba(0, 0, 0, 0.2);
    }
    ^segment.tiny {
      width: inherit;
    }
  `,

  properties: [
    {
      name: 'nodeName',
      value: 'foreignObject'
    },
    {
      name: 'size',
      class: 'Array',
      factory: () => [100, 100]
    },
    {
      name: 'position',
      class: 'Array',
      factory: () => [0, 0]
    },
    'capabilityClickedListener',
    'ucjClickedListener'
  ],

  methods: [
    function render() {
      var self = this;
      var dims = {
        width:  '' + this.size[0],
        height: '' + this.size[1],
      };
      var capability = this.data;
      var ucj = null;
      if ( Array.isArray(this.data) ) {
        capability = this.data[0];
        ucj = this.data[1];
      }
      this
        .attrs({
          ...dims,
        })
        .start('div', { namespace: 'http://www.w3.org/1999/xhtml' })
          .addClass(this.myClass('div'))
          .style({
            width: this.size[0],
            height: this.size[1],
          })
          .callIf(capability.icon, function () {
            this.style({
              'background-image': `url('${capability.icon}')`
            });
          })
          .start()
            .addClass('p-lg', this.myClass('segment')).addClass('title')
            .add(foam.String.labelize(capability.name))
          .end()
          .start('button')
            .addClass(this.myClass('segment')).addClass('p-xs', 'tiny')
            .add(capability.id)
            .on('click', function() {
              self.capabilityClickedListener(capability);
            })
          .end()
          .callIf(ucj !== null, function () {
            this
              .start('button')
                .addClass(self.myClass('segment'))
                .callIf(ucj.status.background, function () {
                  this.style({
                    'background-color': ucj.status.background,
                    'width': 'inherit'
                  })
                })
                .callIf(ucj.status.color, function () {
                  this.style({
                    'color': ucj.status.color,
                  })
                })
                .add(ucj.status.label)
                .on('click', function() {
                  self.ucjClickedListener(ucj);
                })
              .end()
              ;
          })
        .end()
        ;
    }
  ]
});
