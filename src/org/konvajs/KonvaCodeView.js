/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs',
  name: 'KonvaCodeView',
  extends: 'foam.u2.View',

  documentation: `Renders a markdown \`\`\`konva fence onto a Konva stage.

    The fence body is normally a JSON array of shape definitions. If
    'allowScript' is set, a body that isn't valid JSON is executed as
    JavaScript instead - only safe for developer-authored literals, see the
    property documentation.`,

  requires: [
    'org.konvajs.KonvaView'
  ],

  properties: [
    {
      class: 'String',
      name: 'data'
    },
    {
      class: 'String',
      name: 'error'
    },
    {
      class: 'Boolean',
      name: 'allowScript',
      documentation: `Executes the fence body as JavaScript when it isn't valid
        JSON. The script receives the FOAM context as 'x', which carries the
        session, every exported DAO and all services, so enabling this for
        markdown that a user can author is a privilege-level code injection.
        Leave off unless the markdown is a hardcoded literal.`
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this.start()
        .style({ border: '1px solid #ccc', margin: '10px 0' })
        .add(this.slot(function(error) {
          if ( error ) return this.E().style({ color: 'red', padding: '10px' }).add(error);
          return this.E().tag(self.KonvaView, {
            width:        600,
            height:       300,
            onStageReady: self.renderScene.bind(self)
          });
        }))
        .end();
    },

    function parseScene(stage, layer) {
      /** Returns an array of shape definitions, or null if the body drew onto
        the layer itself or failed. Sets 'error' on failure. **/
      try {
        return JSON.parse(this.data);
      } catch ( e ) {
        if ( ! this.allowScript ) {
          this.error = 'Invalid JSON: ' + e.message;
          return null;
        }
      }

      try {
        // Scope: provides 'x' (context), 'stage' and 'layer' to the script.
        var fn  = new Function('x', 'stage', 'layer', this.data);
        var ret = fn.call(this, this.__subContext__, stage, layer);

        // No return value means the script manipulated the stage directly.
        return typeof ret === 'undefined' ? null : ret;
      } catch ( scriptError ) {
        this.error = 'Invalid JSON & Script Error: ' + scriptError.message;
        return null;
      }
    },

    function renderScene(stage, layer) {
      var json = this.parseScene(stage, layer);

      if ( ! json ) {
        // Either an error, already reported, or a script that drew directly.
        if ( ! this.error ) layer.draw();
        return;
      }

      if ( ! Array.isArray(json) ) json = [ json ];

      // One Transformer for the layer, retargeted on click, rather than a new
      // one accumulating per click.
      var tr = new Konva.Transformer();
      layer.add(tr);

      json.forEach(def => {
        var clsName = def.class || 'Rect';
        var config  = { ...def };
        delete config.class;

        if ( ! Konva[clsName] ) {
          console.warn('KonvaCodeView: unknown Konva class:', clsName);
          return;
        }

        var node = new Konva[clsName](config);
        layer.add(node);

        if ( config.draggable ) {
          node.on('click', function() {
            tr.nodes([ node ]);
            layer.draw();
          });
        }
      });

      // Deselect when clicking the empty stage.
      stage.on('click tap', function(e) {
        if ( e.target === stage ) tr.nodes([]);
      });

      layer.draw();
    }
  ]
});
