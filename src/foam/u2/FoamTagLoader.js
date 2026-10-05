/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Copyright 2018 The FOAM Authors.  All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: Add optional 'main' property to POM's and allow for POM's to be specified.
foam.CLASS({
  package: 'foam.u2',
  name: 'FoamTagLoader',

  documentation: `
    Converts <foam> tags in document into Views.

    A tag may opt into off-screen pausing:

      <foam class="com.acme.MyView" pauseoffscreen="true"></foam>

    which wraps the View in a foam.u2.borders.VisibilityBorder and creates it
    in that Border's sub-Context, so its timers and animations suspend while it
    is scrolled out of the viewport. Off by default.
  `,

  requires: [ 'foam.u2.borders.VisibilityBorder' ],

  imports: [ 'classloader', 'document', 'window' ],

  constants: [
    {
      type: 'String',
      name: 'PAUSE_ATTR',
      value: 'pauseoffscreen'
    }
  ],

  methods: [
    function init() {
      this.window.addEventListener('load', this.onLoad, false);
    },

    function findPropertyIC(cls, name) {
      var ps = cls.getAxiomsByClass(foam.lang.Property);
      for ( var i = 0 ; i < ps.length ; i++ ) {
        if ( name == ps[i].name.toLowerCase() ) return ps[i];
      }
    },

    function loadTag(el) {
      var clsName = el.getAttribute('class');
      this.classloader.load(clsName).then(cls => {
        // Wrap the tag before the View is built, so that the View is created
        // in the Border's sub-Context and picks up its decorated timers.
        var x   = this.wrapTag(el);
        var obj = cls.create(null, x);

        this.setAttributes(el, obj);

        if ( obj.element_ ) {
          el.parentNode.replaceChild(obj.element_, el);
          obj.load && obj.load();
          // Store view in global variable if named. Useful for testing.
          if ( obj.id ) globalThis[obj.id] = obj;
        } else if ( obj.promiseE ) {
          obj.promiseE().then(function(view) { this.installView(el, view); });
        } else if ( obj.toE ) {
          this.installView(el, obj.toE({}, obj));
        } else if ( ! foam.u2.Element.isInstance(obj) )  {
          // happens for U3
//           var view = foam.u2.detail.SectionedDetailView.create({data: obj, showActions: true});
          var view = foam.u2.DetailView.create({data: obj, showActions: true}, x);
          el.appendChild(view.element_);
          view.load();

//          this.installView(el, foam.u2.DetailView.create({data: obj, showActions: true}));
        }
      }, function(e) {
        console.error(e);
        console.error('Failed to load class: ', clsName);
      });
    },

    function installView(el, view) {
      var id = el.id;
      // skip install if element doesnt exist in DOM
      if ( ! this.document.getElementsByClassName(el.className).length ) return;
      // this.setAttributes(el, view);

      view.replaceElement_(el);
      view.load();

      // Store view in global variable if named. Useful for testing.
      if ( id ) globalThis[id] = view;
    },

    function setAttributes(el, obj) {
      for ( var j = 0 ; j < el.attributes.length ; j++ ) {
        var attr = el.attributes[j];
        if ( attr.name == this.PAUSE_ATTR ) continue;
        var p = this.findPropertyIC(obj.cls_, attr.name);
        if ( p ) p.set(obj, p.fromString(attr.value));
      }
    },

    function wrapTag(el) {
      /*
        If the tag opted into off-screen pausing, put a VisibilityBorder where
        the tag is and move the tag inside it. The install paths below all
        replace or append to 'el', so they end up inside the Border without
        needing to know about it. Returns the Context to create the View in.
      */
      // Present-and-not-"false" enables it, per HTML boolean attribute convention.
      var v = el.getAttribute(this.PAUSE_ATTR);
      if ( v == null || v.trim().toLowerCase() === 'false' ) return foam.__context__;

      var border = this.VisibilityBorder.create(null, foam.__context__);

      el.parentNode.replaceChild(border.element_, el);
      border.element_.appendChild(el);
      border.load();

      return border.__subContext__;
    }
  ],

  listeners: [
    function onLoad() {
      var els = Array.from(this.document.getElementsByTagName('foam'));
      this.window.removeEventListener('load', this.onLoad);

      els.forEach(this.loadTag.bind(this));
    }
  ]
});


foam.SCRIPT({
  package: 'foam.u2',
  name: 'FoamTagLoaderScript',
  requires: [ 'foam.u2.FoamTagLoader' ],
  flags: [ 'web' ],
  // TODO: globalThis.window check shouldn't be necessary
  code: function() { globalThis.window && foam.u2.FoamTagLoader.create(); }
});
