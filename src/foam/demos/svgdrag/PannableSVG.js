/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.svgdrag',
  name: 'PannableSVG',
  extends: 'foam.u2.Element',

  css: `
    ^ svg {
      border: 4px inset #808080;
      background-color: #FFF;
    }
  `,

  properties: [
    'drag',
    {
      name: 'viewMatrix',
      factory: function () {
        return new DOMMatrix();
      }
    },
    'viewContainer',
    'svg'
  ],

  methods: [
    function render () {
      const self = this.addClass();
      const svg = this.svg = this.start('svg');
      svg.attrs({
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 600 600',
        width: 600,
        height: 600
      });
      const g = self.viewContainer = svg.start('g')
      g.onDetach(g.state$.sub(() => {
        if ( g.state.cls_ != foam.u2.LoadedElementState ) return;
        this.initializeControls();
      }));
      const getShade = v =>
        (s => s.length < 2 ? '0'+s : s)((v % 256).toString(16));
      for ( let x = 0 ; x < 2000 ; x += 30 )
      for ( let y = 0 ; y < 2000 ; y += 30 )
        g
          .start('rect')
            .attrs({
              width: '20',
              height: '20',
              x, y,
              fill: '#CC' + getShade(x) + getShade(y)
            })
          .end()

    },
    async function initializeControls() {
      const self = this;
      const svg = this.svg;
      const viewContainer = await self.viewContainer.el_();
      svg.on('pointerdown', function (evt) {
        self.drag = { x: evt.offsetX, y: evt.offsetY };
      })
      svg.on('pointerup', function (evt) {
        self.drag = undefined;
      })
      svg.on('mouseleave', function (evt) {
        self.drag = undefined;
      })
      svg.on('pointermove', function (evt) {
        if ( ! self.drag ) return;
        let [dx, dy] = [
          evt.offsetX - self.drag.x,
          evt.offsetY - self.drag.y];
        self.drag.x = evt.offsetX;
        self.drag.y = evt.offsetY;
        self.viewMatrix.preMultiplySelf(new DOMMatrix().translateSelf(dx, dy));
        viewContainer.style.transform = self.viewMatrix.toString();
      });
    }
  ]

});
