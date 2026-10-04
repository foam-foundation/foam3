/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'CarouselView',
  extends: 'foam.u2.View',

  todo: [' make border when borders are fixed'],
  documentation: 'View that renders an array of FObjects in a carousel',

  exports: ['as carousel'],

  css: `
    << {
      display: flex;
      width: 100%;
    }
    <<controlsAvailable {
      gap: 1.2rem;
    }
    <<slides {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      
      width: max-content;
      
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
    }
    <<slides::-webkit-scrollbar {
      height: 0;
    }
    <<slides > div {
      scroll-snap-align: center;
      flex-shrink: 0;
      width: 100%;
      transform-origin: center center;
      transform: scale(1);
      transition: transform 0.5s;
      position: relative;
      
      display: flex;
      justify-content: center;
      align-items: center;
    }
  `,

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      name: 'data'
    },
    // TODO: Imeplement this feture
    {
      class: 'Int',
      name: 'autoMoveDelay',
      documentation: 'When set, the carousel automoves to the next slide after defined time in ms unless the user is hovering over the view'
    },
    {
      class: 'Boolean',
      name: 'showControls',
      value: true
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'slideView',
      value: { class: 'foam.u2.CitationView' }
    },
    ['currentIndex_', 0],
    ['idArray_', []]
  ],

  methods: [
    function render() {
      this.data$.sub(() => { this.idArray_= []; });
      this.currentIndex_$.sub(this.scrollIntoView);
      var self = this;
      this.addClass()
        .enableClass(this.myClass('controlsAvailable'), this.showControls$)
        .style({ 'justify-content': this.data$.map(v => v.length > 1 ? 'space-between' : 'center') })
        .startContext({ data: this })
        .tag(this.GO_BACK)
        .forEach(this.data$, function(obj, idx) {
          var id = 'u' + obj.$UID;
          self.idArray_.push(id);
          this
            .addClass(self.myClass('slides'))
            .start(self.slideView, { of: obj?.cls_, data: obj, id: id})
              .addClass(self.myClass('slide'))
            .end();
        })
        .tag(this.GO_NEXT)
        .endContext();
    },
    function jumpTo(i) {
      this.currentIndex_ = i;
    },
    function next() {
      if ( this.currentIndex_ == this.data.length - 1 ) {
        this.currentIndex_ = 0;
      } else {
        this.currentIndex_++;
      }
    },
    function back() {
      if ( this.currentIndex_ == 0 ) {
        this.currentIndex_ = this.data.length - 1;
      } else {
        this.currentIndex_--;
      }
    }
  ],

  listeners: [
    function scrollIntoView() {
      let el = document.getElementById(this.idArray_[this.currentIndex_]);
      if ( !  el ) return;
      el.scrollIntoView(false);
    },
  ],

  actions: [
    {
      name: 'goNext',
      label: '',
      themeIcon: 'next',
      buttonStyle: 'TERTIARY',
      isAvailable: function(data, showControls) { return data.length > 1 && showControls; },
      code: function() {
       this.next();
      }
    },
    {
      name: 'goBack',
      label: '',
      themeIcon: 'back',
      buttonStyle: 'TERTIARY',
      isAvailable: function(data, showControls) { return data.length > 1 && showControls; },
      code: function() {
        this.back();
      }
    }
  ]

});