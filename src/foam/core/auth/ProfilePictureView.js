/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'ProfilePictureView',
  extends: 'foam.u2.View',

  documentation: `
    A U2 view for displaying and managing a profile picture,
    supporting click-to-upload, drag-and-drop, and clear functionality.
  `,

  requires: [
    'foam.blob.Blob',
    'foam.core.fs.File',
    'foam.blob.BlobBlob',
    'foam.u2.tag.Image'
  ],

  css: `
    ^ {
      position: relative;
      width: 150px;
      height: 150px;
      border: 2px dashed #ccc;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      background-color: #f0f0f0;
      box-sizing: border-box; /* Include padding and border in the element's total width and height */
      transition: border-color 0.3s ease, background-color 0.3s ease;
    }

    ^RW:hover {
      border-color: #999;
    }

    /* Style for the actual image displayed inside the circular container */
    ^actual-image {
      width: 100%;
      height: 100%;
      border-radius: 50%; /* Ensure the inner image is also circular */
      object-fit: cover; /* Cover the container while maintaining aspect ratio */
      z-index: 1; /* Position below overlay but above the base background */
    }

    /* Styles for the background when no specific image is set (e.g., placeholder) */
    ^no-image {
      background-size: 50%; /* Make placeholder smaller, if it's a background image */
      background-repeat: no-repeat;
      background-position: center;
      background-size: cover;
      /* placeholderImage will be set directly in render() if data is null */
    }

    ^overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.4);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      font-size: 0.9em;
      text-align: center;
      border-radius: 50%;
      pointer-events: none; /* Allow clicks to pass through to the main element if overlay is transparent */
      z-index: 2; /* Position above the image */
    }

    ^RW:hover ^overlay {
      opacity: 1;
      pointer-events: all;
    }

    ^drag-over {
      border-color: #666;
      background-color: #e0e0e0;
    }

    ^clear-btn {
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(255, 255, 255, 0.7);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 1.2em;
      font-weight: bold;
      color: #333;
      cursor: pointer;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.3s ease, background-color 0.2s ease, color 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    ^RW:hover ^clear-btn {
      opacity: 1;
    }
    ^RW ^clear-btn:hover {
      background: white;
      color: #000;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.fs.File',
      name: 'data',
      documentation: 'The Blob representing the selected image file.'
    },
    {
      class: 'String',
      name: 'placeholderImage',
      documentation: 'URL for the image to display when no data is set.'
    },
    {
      class: 'String',
      name: 'accept',
      value: 'image/*',
      documentation: 'Accepted file types for upload.'
    },
    {
      class: 'Boolean',
      name: 'isDragging',
      documentation: 'True if a drag operation is currently over the component.',
      value: false
    },
    {
      name: 'fileInput_',
      documentation: 'Reference to the hidden file input element.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this
        .addClass() // Adds the base class `ProfilePictureView`
        .addClass(this.mode$.map(m => this.myClass(m.name)))
        .on('dragenter', this.onDragEnter)
        .on('dragleave', this.onDragLeave)
        .on('dragover',  this.onDragOver) // Essential to allow 'drop' event to fire
        .on('drop',      this.onDrop)
        .enableClass(this.myClass('no-image'), this.data$.map(d => !d))
        .style({
          'background-image': this.data$.map(d => !!d ? 'none' : `url(${this.placeholderImage})`)
        })
        .enableClass(this.myClass('drag-over'), this.isDragging$) // Add class for drag feedback

        // Hidden file input for click-to-upload
        .start('input', null, this.fileInput_$)
        .attrs({
          type: 'file',
          accept: this.accept
        })
        .style({ display: 'none' })
        .on('change', this.onFileSelected) // Listener for file selection
        .end()

        // Main image display using foam.u2.tag.Image
        .start(this.Image, {
          data$: this.slot(function(data$data, data$address) {
            return data$address || data$data
          })
        })
          .addClass(this.myClass('actual-image'))
          .attrs({ alt: 'Profile Picture' })
          .show(this.data$.map(d => !!d))
        .end()

        // Overlay for click-to-upload and drag-and-drop interactions
        .start('div')
          .addClass(this.myClass('overlay'))
          .enableClass(this.myClass('overlay-dragging', this.isDragging$))
          .add('Click or Drag & Drop')
          .br()
          .add('to upload image')
          .on('click',     this.onClickOverlay)
        .end()

        // Clear button
        .start('button')
          .addClass(this.myClass('clear-btn'))
          .add('×') // Unicode multiplication sign for 'X'
          .on('click', () => { this.clearImage() })
          .show(this.data$.map(d => !!d)) // Only show if an image is set
        .end()
      ;
    },
    function setData_(file) {
      this.data = this.File.create({
        filesize: file.size,
        mimeType: file.type,
        filename: file.name,
        data: this.BlobBlob.create({ blob: file })
      }, this);
    }
  ],

  listeners: [
    function onClickOverlay(e) {
      // Programmatically click the hidden file input element
      if ( this.mode == foam.u2.DisplayMode.RO) {
        return
      }
      e.stopPropagation();
      this.fileInput_.element_.click();
    },

    function onFileSelected(e) {
      if ( this.mode == foam.u2.DisplayMode.RO) {
        return
      }

      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.setData_(file);
        } else {
          console.warn('Selected file is not an image:', file.type);
        }
      }
      // Reset the input value to allow selecting the same file again immediately
      e.target.files = null;
    },

    function onDragEnter(e) {
      if ( this.mode == foam.u2.DisplayMode.RO) {
        return
      }

      e.preventDefault(); // Important: allows 'drop' event
      this.isDragging = true;
    },

    function onDragLeave(e) {
      if ( this.mode == foam.u2.DisplayMode.RO) {
        return
      }

      e.preventDefault();
      this.isDragging = false;
    },

    function onDragOver(e) {
      if ( this.mode == foam.u2.DisplayMode.RO) {
        return
      }

      e.preventDefault(); // Important: allows 'drop' event
      // No change to isDragging here; dragenter/dragleave manage this state
    },

    function onDrop(e) {
      if ( this.mode == foam.u2.DisplayMode.RO) {
        return
      }

      e.preventDefault();
      this.isDragging = false;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.setData_(file);
        } else {
          console.warn('Dropped file is not an image:', file.type);
        }
      }
    }
  ],

  actions: [
    {
      name: 'clearImage',
      label: 'Clear',
      code: function() {
        this.data = undefined;
      },
      isEnabled: function(data, mode) {
        return mode == foam.u2.DisplayMode.RW && !! data
      }
    }
  ]
});
