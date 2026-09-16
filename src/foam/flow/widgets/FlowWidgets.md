<flow name="FlowWidgets" category="DOC/DEV" spid="foam"/>
<title>FLOW Widgets</title>

<h1>FLOW Widgets</h1>

These convenient widgets help with documenting FOAM code in FLOW.

<h2>TabbedModelDocumentation</h2>

TabbedModelDocumentation allows you to display information about a model, and
allow the user to select between properties, methods, and a summary of the model.

<code>
<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="properties" of="foam.core.cron.Cron" />
</code>

The above code would display the following:

<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="properties" of="foam.core.cron.Cron" />

<h2>PropertyShortSummary</h2>

PropertyShortSummary allows you to display a model's properties without
additional model information. This can be useful to point out a few
specific properties of a model being discussed.

For example, say you were documenting cron jobs and wanted to display
a few properties `Cron` has related to scheduling.

<code>
<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.cron.Cron" whitelist="['schedule','scheduledTime']" />
</code>

The above code would display the following:

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.cron.Cron" whitelist="['schedule','scheduledTime']" />

<h2>ModelSummary</h2>

ModelSummary displays properties of the model itself, such as its
package, name, and documentation. The above table is a ModelSummary.

If we wanted to generate the ModelSummary for CRON, we could use the
following snippet:

<code>
<foam class="foam.flow.widgets.ModelSummary" of="foam.core.cron.Cron" visibleModelProps="id,documentation" />
</code>

The above code would display the following:

<foam class="foam.flow.widgets.ModelSummary" of="foam.core.cron.Cron" visibleModelProps="id,documentation" />


<h2>EnumSummary</h2>

EnumSummary is used to document an enum.

<code>
<foam class="foam.flow.widgets.EnumSummary" of="foam.core.crunch.AssociatedEntity" />
</code>

The above code would display the following:

<foam class="foam.flow.widgets.EnumSummary" of="foam.core.crunch.AssociatedEntity" />

<h2>ApiShortSummary</h2>

ApiShortSummary is used for documenting models from the perspective of use as an API.

<h2>DocumentationIncomplete</h2>

The DocumentationIncomplete widget is a banner that can be used to indicate
sections in the document that aren't finished yet. The `status` attribute
indicates a level of completion - "todo" indicates that the section is
completely empty, whereas "wip" means it's incomplete. In the future, a status
called "old" could be added to indicate potentially outdated information.

<code>
<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" isSection="true" />
</code>

The above code would display the following:

<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" isSection="true" />

<h2>SequenceSummary</h2>

SequenceSummary is a widget that can describe a method that returns an instance
of <a href="/#admin.flowdoc::foam-util-async-doc">foam.util.async.Sequence</a>.
In order for this to work, the specified method must return a Sequence when it
is called with no arguments, and it most do so synchronously (this should
always be sufficient, as the Sequence itself can run asynchronous operations).

<code>
<foam class="foam.flow.widgets.SequenceSummary" of="foam.u2.crunch.CrunchController" method="createWizardSequence" />
</code>

The above code would display a table including all the steps in the sequence.
It will also indicate any steps that were removed after extending another
sequence.

Future work on SequenceSummary could include a way to specify arguments to the
method, allowing documentation for a variety of complex flows.
