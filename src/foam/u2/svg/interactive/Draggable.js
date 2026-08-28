/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.svg.interactive',
  name: 'Draggable',
  extends: 'foam.u2.Element',
  documentation: `
    A draggable element that positions itself using an SVG transform.
  `,

  imports: [
    'svg'
  ],

  properties: [
    ['nodeName', 'g'],
    {
      class: 'FObjectProperty',
      of: 'foam.u2.svg.Position',
      name: 'pos'
    },
    'dragState_'
  ],

  methods: [
    function render () {
      this.addEventListener('mousedown', this.onMouseDown);
      this.addEventListener('mousemove', this.onMouseMove);
      this.addEventListener('mouseup', this.onMouseUp);
      this.addEventListener('mouseleave', this.onMouseUp);
      this.pos.bind(this);
    },
    async function transformMouseEvent (evt) {
      const svg = await this.svg.el();
      const ctm = svg.getScreenCTM();
      return {
        x: (evt.clientX - ctm.e) / ctm.a,
        y: (evt.clientY - ctm.f) / ctm.d
      }
    }
  ],

  listeners: [
    async function onMouseDown (evt) {
      this.dragState = {
        dragOrigin: await this.transformMouseEvent(evt),
        selfOrigin: { x: this.pos.x, y: this.pos.y }
      };
    },
    async function onMouseMove (evt) {
      if ( ! this.dragState ) return;
      const current = await this.transformMouseEvent(evt);
      console.log(this.dragState, current)
      const diffX = current.x - this.dragState.dragOrigin.x;
      const diffY = current.y - this.dragState.dragOrigin.y;
      this.pos.x = this.dragState.selfOrigin.x + diffX;
      this.pos.y = this.dragState.selfOrigin.y + diffY;
    },
    function onMouseUp (evt) {
      this.dragState = undefined;
    }
  ]
});
