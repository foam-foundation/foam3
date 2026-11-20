/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'RelationshipPickerJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    The two halves of a *:* relationship's add/remove picker in a v3 DetailView.
    Going back: Relationship.browse_ calls stack.jump(stack.pos - 1) on the detail
    view's Stack, which delegates to the real stack, so its pos must be the real
    one or the jump lands on -2 and every view hides. The list: the relationship's
    DAO reads the junction store in select_, so a link added or removed must make
    its listeners read again.
  `,

  requires: [
    'foam.comics.v3.DetailView',
    'foam.core.auth.Group',
    'foam.core.auth.GroupPermissionJunction',
    'foam.core.auth.Permission',
    'foam.core.u2.navigation.Stack',
    'foam.dao.MDAO',
    'foam.u2.Element'
  ],

  methods: [
    async function runTest(x) {
      await this.stackFollowsDelegate(x);
      await this.backOnDetailViewClearsRoute(x);
      await this.linkChangeResetsListeners(x);
    },

    async function stackFollowsDelegate(x) {
      var real    = this.Stack.create({}, x);
      var wrapper = this.Stack.create({ delegate_: real }, x);
      wrapper.push(this.Element.create({}, x));
      wrapper.push(this.Element.create({}, x));
      x.test(wrapper.pos === 1, 'a delegating stack reads the real pos (1), got ' + wrapper.pos);
      x.test(wrapper.stack_ === real.stack_, 'a delegating stack reads the real stack_');

      await wrapper.jump(wrapper.pos - 1);
      x.test(real.pos === 0, 'jump(pos - 1) through the wrapper goes back one view, real pos ' + real.pos);
      x.test(real.current !== null, 'a view is current after going back');

      await wrapper.pop();
      x.test(real.pos === -1 && wrapper.pos === -1, 'pop() through the wrapper goes back one view too');

      wrapper.delegate_ = null;
      real.push(this.Element.create({}, x));
      x.test(wrapper.pos === -1, 'a stack without a delegate stops following the old one');
    },

    async function backOnDetailViewClearsRoute(x) {
      var real    = this.Stack.create({}, x);
      real.push(this.Element.create({}, x));
      var cleared = 0;
      var detailView = {
        stack: real,
        __subContext__: { stackPos: 0 },
        routeToMe: () => cleared++
      };
      var wrapper = this.DetailView.Stack.create({ delegate_: real }, x.createSubContext({ detailView: detailView }));
      wrapper.push(this.Element.create({}, x));
      await wrapper.jump(wrapper.pos - 1);
      x.test(cleared === 1, 'going back to the detail view clears its route');
    },

    async function linkChangeResetsListeners(x) {
      var ctx = x.createSubContext({
        groupDAO:                   this.MDAO.create({ of: this.Group }),
        permissionDAO:              this.MDAO.create({ of: this.Permission }),
        groupPermissionJunctionDAO: this.MDAO.create({ of: this.GroupPermissionJunction })
      });
      var group = await ctx.groupDAO.put(this.Group.create({ id: 'pickerTestGroup' }, ctx));
      var read  = await ctx.permissionDAO.put(this.Permission.create({ id: 'picker.read' }, ctx));
      await ctx.permissionDAO.put(this.Permission.create({ id: 'picker.write' }, ctx));

      var resets = 0;
      var links  = group.permissions.dao;
      var sub    = links.listen({ put: () => resets++, remove: () => resets++, reset: () => resets++ });
      // ProxyDAO's listener sends one reset as it starts.
      resets = 0;

      await group.permissions.add(read);
      x.test(resets > 0, 'adding a link tells the list to read again');
      x.test((await links.select()).array.length === 1, 'the list then reads the new link');

      resets = 0;
      await group.permissions.remove(read);
      x.test(resets > 0, 'removing a link tells the list to read again');
      x.test((await links.select()).array.length === 0, 'the list then reads no link');

      resets = 0;
      await ctx.groupPermissionJunctionDAO.put(this.GroupPermissionJunction.create({ sourceId: 'otherGroup', targetId: 'picker.write' }, ctx));
      x.test(resets === 0, "another group's link does not reset this list");

      sub.detach();
      resets = 0;
      await group.permissions.add(read);
      x.test(resets === 0, 'a detached listener hears nothing');
    }
  ]
});
