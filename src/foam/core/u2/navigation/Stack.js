/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'Stack',
  extends: 'foam.u2.View',
  documentation: `
    A simple stack view for use with nested dao controllers and detailViews
  `,
  exports: ['as controlBorder'],
  requires: ['foam.u2.layout.Cols'],

  cssTokens: [
    {
      name: 'stickyBG',
      variantKey: 'color',
      value: function(e) { return e.ADJUST_ALPHA(e.TOKEN('$backgroundDefault'), 0.9) }
    }
  ],
  css:`
    ^ {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
      position: relative;
    }
    ^header-gap {
      gap: 1.6rem;
    }
    ^content {
      display: contents;
    }
    ^content > * {
      flex: 1;
      min-height: 0;
      height: 100%;
    }
    ^padding ^content > * {
      padding: 1.6rem;
      padding-top: 0;
    }
    ^browse-title {
      transition: all 0.2s ease;
      font-weight: $font-semi-bold;
      text-wrap-mode: nowrap;
    }
    ^header-container {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      z-index: 2;
      // sort of a hack to make css think this element is not always at the top;
      position: sticky;
      top: -1px;
      transition: all 0.2s ease;
    }
    ^header-container > .foam-u2-layout-Cols {
      align-items: center;
    }
    ^padding ^header-container {
      padding: calc(1.6rem + 1px);
      padding-bottom: 0px;
    }
    ^stuck {
      background: $stickyBG;
      backdrop-filter: blur(3px) opacity(0.8);
      transition: all 0.2s ease;
      gap: 0.4rem;
    }
    ^padding ^header-container^stuck {
      padding: 1rem;
    }
    ^stuck ^browse-title {
      font-size: 2.4rem;
    }
    ^stuck .h600, ^stuck {
      font-size: 1.2rem;
    }
    @media only screen and (min-width:  /*%DISPLAYWIDTH.MD%*/ 768px) {
      ^compact {
        width: clamp(32rem, 75%, 100rem);
        margin: auto;
      }
    }
    %CUSTOMCSS%;
  `,
  topics: ['stackReset', 'posUpdated', 'viewVisible'],
  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.u2.Element',
      name: 'stack_'
    },
    {
      class: 'Int',
      name: 'pos',
      value: -1
    },
    {
      name: 'current',
      expression: function(stack_, pos) {
        return stack_[pos];
      }
    },
    'trailingContainer', 
    { 
      class: 'Map', 
      name: 'specMap_',
      description: 'stores a map of preferred visibility specs of various stack views at different postions, such as title and properties like compact'
    },
    {
      class: 'Boolean',
      name: 'compact_',
      description: 'Reduces the max-width of the stack to be narrower than full screen, useful for control views like settings or to improve legibility of docs, accessed through setCompact method',
      expression: function(specMap_, pos) {
        return specMap_[pos]?.compact ?? false;
      }
    },
    // If set, takes over stack operations, useful for overriding stack behaviour in routers
    'delegate_', 
    'header_', ['stuck_', false], 'headerVisibility'
    // TODO: add stack default
  ],
  methods: [
    function render() {
      this.addClass()
      .enableClass(this.myClass('compact'), this.compact_$)
      .enableClass(this.myClass('padding'), this.headerVisibility$)
      .enableClass(this.myClass('header-gap'), this.headerVisibility$)
      .start('', {}, this.header_$)
        .addClass(this.myClass('header-container'))
        .enableClass(this.myClass('stuck'), this.stuck_$)
        .tag(foam.u2.stack.BreadcrumbView)
        .start(this.Cols)
          .start()
            .addClass('h200', this.myClass('browse-title'))
            .add(this.dynamic(function(pos, specMap_) {
              this.add(specMap_[pos]?.title);
            }))
          .end()
          .start('', {}, this.trailingContainer$).style({ display: 'contents'}).end()
        .end()
      .end()
      .start('', {}, this.content$).addClass(this.myClass('content')).end();
      this.addHeaderObserver();
      this.onDetach(this.stackReset.sub(() => { this.content?.removeAllChildren(); }))
      this.onDetach(this.posUpdated.sub((_, p, type) => {
        // this.current.hide();
        if ( type == 'new' )
          this.content.add(this.current);
        this.stack_.forEach(v => { 
          if ( v !== this.current ) {
            v.hide();
          } else {
            this.viewVisible.pub(this.pos);
            v.show();
          }
        })
      }))
    },
    async function addHeaderObserver() {
      const root = await this.el();
      const options = { root, threshold: [1.0] };
      let el = await this.header_.el();
      const isVisible = () => {
        let flag = false
        el.childNodes?.forEach(v => {
          if ( v.offsetHeight ) flag = true;
        })
        this.headerVisibility = flag;
      }
      isVisible()
      const observer = new IntersectionObserver(([e]) => { this.stuck_ = e.intersectionRatio < 1; }, options);
      const resize = new ResizeObserver(isVisible)
      observer.observe(el);
      resize.observe(el);
      this.onDetach(() => { observer.disconnect(); resize.disconnect(); })
    },
    function resetStack() {
      if ( this.delegate_ ) return this.delegate_.resetStack();
      this.stack_ = [];
      this.specMap_ = {};
      this.pos = -1;
      this.stackReset.pub();
    },
    function push(v, parent) {
      if ( this.delegate_ ) return this.delegate_.push(...arguments);
      if ( foam.u2.stack.StackBlock.isInstance(v) ) {
        console.warn('**************** Replace with just a view push');
        parent = v.parent;
        v = v.view;
      }
      if ( ! foam.u2.Element.isInstance(v) ) {
        // In case a view spec is pushed
        v = foam.u2.ViewSpec.createView(v, {}, parent, parent);
      }
      this.pos++;
      // if a view is overridden in the stack, actually remove it
      if ( this.stack_[this.pos] ) {
        this.stack_.splice(this.pos).forEach(v => v.remove())
      }
      v.stackPos = this.pos;
      this.stack_[this.pos] = v;
      this.posUpdated.pub('new');
      return v;
    },
    function set() {
      if ( this.delegate_ ) return this.delegate_.set();
      this.resetStack();
      return this.push(...arguments);
    },
    function jump(p) {
      if ( this.delegate_ ) return this.delegate_.jump(...arguments);
      this.stack_.splice(p + 1).forEach(v => v.remove());
      this.pos = p;
      this.posUpdated.pub('jump');
    },
    function setTitle(title, view) {
      if ( this.delegate_ ) return this.delegate_.setTitle(...arguments);
      this.setSpec_('title', title, view);
    },
    function setCompact(isCompact, view) {
      if ( this.delegate_ ) return this.delegate_.setCompact(...arguments);
      this.setSpec_('compact', isCompact, view);
    },
    function setSpec_(spec, value, view) {
      // Should never be called on anything that has a delegate
      if ( this.delegate_ ) return;
      let pos = view.__subContext__.stackPos ?? this.pos;
      this.specMap_[pos] = this.specMap_[pos] || {};
      this.specMap_[pos][spec] = value;
      if ( foam.lang.Slot.isInstance(value) ) {
        view.onDetach(() => { 
          if ( value == this.specMap_[this.pos]?.[spec] ) 
            this.specMap_[this.pos][spec] = null; 
        });
      }
      this.propertyChange.pub('specMap_', this.specMap_$);
    },
    function setTrailingContainer(view) {
      if ( this.delegate_ ) return this.delegate_.setTrailingContainer(...arguments);
      let pos = view.__subContext__.stackPos;
      view.show(this.pos$.map(v => v == pos));
      this.trailingContainer.add(view);
      return { detach: () => { this.trailingContainer.removeChild(view); }}
    }
  ]
});

foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'StackElementRefinement',
  refines: 'foam.u2.Element',
  documentation: 'Adds stack revelant props to elements allowing them to be pushed to the stack',
  exports: ['stackPos'],
  properties: [
    {
      class: 'Int',
      hidden: true,
      name: 'stackPos',
      factory: function() {
        return this.__context__.stackPos ?? undefined;
      }
    }
  ]
});
