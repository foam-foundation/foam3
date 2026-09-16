/* eslint-disable one-var */
/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.fileDropZone',
  name: 'FilePreview',
  extends: 'foam.u2.View',

  documentation: `iframe for file preview,
  
  When data passed is an array, selected is used as the index for the file to display. 
  
  When data is a file the file is displayed.
  To show a complete file array wrap this view in an ArrayView.
  
  Set fullScreen to true when used inside a Popup for full-size preview.`,

  css: `
  ^container {
    margin: 0;
    padding: 0;
    flex-grow: 1;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    align-content: stretch;
    align-items: stretch;
  }

  ^fullScreen {
    width: 100%;
    height: 100%;
  }

  ^fullScreen ^container {
    width: 100% !important;
    max-height: none !important;
    height: 100%;
  }

  ^fullScreen ^container iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  ^fullScreen ^container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
  }

  ^tiffGallery {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  ^tiffPage {
    max-width: 100%;
    height: auto;
  }
  `,

  properties: [
    {
      name: 'selected'
    },
    {
      class: 'Boolean',
      name: 'fullScreen',
      value: false
    }
  ],

  methods: [
    async function render() {
      this.SUPER();

      await this
        .addClass(this.myClass())
        .enableClass(this.myClass('fullScreen'), this.fullScreen$)
        .start('div')
          .addClass('file-image-div' + this.id)
          .addClass(this.myClass('container'))
          .callIf( ! this.fullScreen, function() {
            this.style({
              'max-height': '45vh',
              'width': '28vw',
              'display': 'none'
            });
          })
          .callIf(this.fullScreen, function() {
            this.style({ 'display': 'none' });
          })
          .start('img')
            .addClass('file-image' + this.id)
            .style({
              'flex': 1,
              'object-fit': 'contain',
              'height': '100%',
              'max-width': '100%',
              'object-position': this.fullScreen ? 'center' : 'left'
            })
          .end()
        .end()
        .start()
          .addClass(this.myClass('container'))
          .addClass('file-iframe' + this.id)
          .style({
            'visibility': 'hidden',
            'display': 'none',
            'height': '0px',
            'width': '0px'
          })
        .end()
        .start('div')
          .addClass('file-text' + this.id)
          .style({
            'visibility': 'hidden',
            'display': 'none',
            'height': '0px',
            'width': '0px'
          })
        .end();

      this.showData();
      this.data$.sub(() => this.showData());
    },

    async function showData() {
      let iFrame = document.getElementsByClassName('file-iframe' + this.id)[0],
          image  = document.getElementsByClassName('file-image' + this.id)[0],
          div    = document.getElementsByClassName('file-image-div' + this.id)[0],
          p      = document.getElementsByClassName('file-text' + this.id)[0],
          url    = '',
          pos;

      iFrame.innerHTML     = '';
      iFrame.style.visibility = 'hidden';
      iFrame.style.display    = 'none';
      div.style.visibility    = 'hidden';
      div.style.display       = 'none';
      p.style.visibility      = 'hidden';

      // Reset any multi-page TIFF gallery from a previous render and restore the
      // single <img> the non-tiff branches rely on.
      let priorTiff = div.getElementsByClassName(this.myClass('tiffGallery'))[0];
      if ( priorTiff ) priorTiff.remove();
      if ( image ) image.style.display = '';

      let data;
      if ( Array.isArray(this.data) ) {
        if ( this.selected == undefined || this.selected == this.data.length ) {
          pos = this.data.length - 1;
        } else {
          pos = this.selected;
        }

        data = this.data[pos];
        if ( ! data ) return;
      } else {
        data = this.data;
      }

      let d = data.data;
      if ( ! d ) {
        url = data.address;
      } else {
        url = URL.createObjectURL(d.blob);
      }

      if ( data.mimeType === 'application/pdf' ) {
        var pdfframe     = document.createElement('iframe');
        pdfframe.src     = url;
        iFrame.appendChild(pdfframe);
        iFrame.style.visibility = 'visible';
        iFrame.style.display    = 'flex';
        iFrame.style.height     = '100%';
        iFrame.style.width      = '100%';
      } else if ( data.mimeType === 'plain/text' ) {
        let t    = await data.getText();
        let text = document.createTextNode(t);
        p.appendChild(text);
        p.style.visibility = 'visible';
        p.style.display    = 'block';
        p.style.height     = '100%';
        p.style.width      = '100%';
      } else if ( data.mimeType === 'image/tiff' && await this.renderTiff_(url, div, image) ) {
        // Handled: every TIFF page rendered as its own canvas. A browser <img>
        // shows only the first IFD of a multi-page TIFF (or nothing at all), so
        // the remaining pages would otherwise be invisible.
      } else {
        image.src            = url;
        div.style.visibility = 'visible';
        div.style.display    = 'flex';
      }
    },

    // Decode and paint every page of a (multi-page) TIFF. Returns true when at
    // least one page was rendered; false on any failure so the caller falls back
    // to the single <img> path (which still shows page one where the browser can).
    async function renderTiff_(url, div, image) {
      try {
        if ( ! await this.ensureUtif_() ) return false;

        let buffer = await fetch(url, { credentials: 'include' }).then(r => r.arrayBuffer());
        let pages  = UTIF.decode(buffer);
        if ( ! pages || ! pages.length ) return false;

        let gallery = document.createElement('div');
        gallery.className = this.myClass('tiffGallery');
        for ( let i = 0 ; i < pages.length ; i++ ) {
          let page = pages[i];
          UTIF.decodeImage(buffer, page);
          let rgba   = UTIF.toRGBA8(page);
          let width  = page.width  || ( page.t256 && page.t256[0] );
          let height = page.height || ( page.t257 && page.t257[0] );
          if ( ! width || ! height ) continue;

          let canvas       = document.createElement('canvas');
          canvas.className = this.myClass('tiffPage');
          canvas.width     = width;
          canvas.height    = height;
          canvas.getContext('2d').putImageData(
            new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
          gallery.appendChild(canvas);
        }
        if ( ! gallery.childElementCount ) return false;

        if ( image ) image.style.display = 'none';
        div.appendChild(gallery);
        div.style.visibility = 'visible';
        div.style.display    = 'flex';
        return true;
      } catch ( e ) {
        return false;
      }
    },

    // Load UTIF (TIFF decoder) on demand. Its CDN URL is whitelisted in
    // src/cspdirectives.jrl under the 'tiff' script-src key. installLib resolves
    // even when the script fails to load, so confirm the global before use.
    async function ensureUtif_() {
      if ( typeof UTIF !== 'undefined' ) return true;
      await foam.u2.JsLib.create({
        src: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js'
      }).installLib();
      return typeof UTIF !== 'undefined';
    }
  ]
});

