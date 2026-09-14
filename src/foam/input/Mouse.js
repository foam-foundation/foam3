/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.input',
  name: 'Mouse',

  imports: [ 'window' ],

  topics: [
    'down',
    'move',
    'touch',
    'up'
  ],

  properties: [
    'lastTouch',
    'x',
    'y',
    {
      name: 'element',
      postSet: function(old, e) {
        if ( old ) {
          old.removeEventListener('mousedown', this.onMouseDown);
          old.removeEventListener('mouseup',   this.onMouseUp);
          old.removeEventListener('mousemove', this.onMouseMove);
        }
        e.addEventListener('mousedown', this.onMouseDown);
        e.addEventListener('mouseup',   this.onMouseUp);
        e.addEventListener('mousemove', this.onMouseMove);
      }
    }
  ],

  methods: [
    function install(element) {
      this.ref = element;
    }
  ],

  listeners: [
    {
      name: 'onMouseDown',
      code: function(e) {
        var bounds = this.element.getBoundingClientRect();

        this.x = e.clientX - bounds.left;
        this.y = e.clientY - bounds.top;

        this.down.pub();

        if ( this.touch.hasListeners() ) {
          if ( this.lastTouch ) this.lastTouch.detach();

          this.lastTouch = foam.input.TouchEvent.create();
          this.lastTouch.onDetach(this.lastTouch.x$.follow(this.x$));
          this.lastTouch.onDetach(this.lastTouch.y$.follow(this.y$));

          this.touch.pub(this.lastTouch);

          if ( this.lastTouch && this.lastTouch.claimed ) e.preventDefault();
        }

        // While the mouse is down, track the movements and mouseup on the
        // entire window so it's tracked if/when the mouse leaves the element.
        this.window.addEventListener('mouseup',   this.onMouseUp);
        this.window.addEventListener('mousemove', this.onMouseMove);
      }
    },
    {
      name: 'onMouseUp',
      code: function(e) {
        this.up.pub();

        if ( this.lastTouch ) {
          this.lastTouch.detach();
          this.lastTouch = undefined;
        }

        this.window.removeEventListener('mouseup',   this.onMouseUp);
        this.window.removeEventListener('mousemove', this.onMouseMove);
      }
    },
    {
      name: 'onMouseMove',
      code: function(e) {
        if ( this.lastTouch ||
             this.hasListeners('propertyChange') ||
             this.move.hasListeners() ) {

          var bounds = this.element.getBoundingClientRect();

          this.x = e.clientX - bounds.left;
          this.y = e.clientY - bounds.top;

          this.move.pub();

          if ( this.lastTouch && this.lastTouch.claimed ) e.preventDefault();
        }
      }
    }
  ]
});
