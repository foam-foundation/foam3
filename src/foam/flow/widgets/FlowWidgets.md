<flow name="FlowWidgets" category="DOC/DEV" spid="foam" description="FLOW widgets for documenting FOAM code: TabbedModelDocumentation, PropertyShortSummary, ModelSummary, EnumSummary, ApiShortSummary." keywords="flow widgets,documentation,modelsummary,knowledge"/>

# FLOW Widgets

These convenient widgets help with documenting FOAM code in FLOW.

## TabbedModelDocumentation

TabbedModelDocumentation allows you to display information about a model, and
allow the user to select between properties, methods, and a summary of the model.

`<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="properties" of="foam.core.cron.Cron"></foam>`

The above code would display the following:

<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="properties" of="foam.core.cron.Cron"></foam>

## PropertyShortSummary

PropertyShortSummary allows you to display a model's properties without
additional model information. This can be useful to point out a few
specific properties of a model being discussed.

For example, say you were documenting cron jobs and wanted to display
a few properties `Cron` has related to scheduling.

`<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.cron.Cron" whitelist="['schedule','scheduledTime']"></foam>`

The above code would display the following:

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.cron.Cron" whitelist="['schedule','scheduledTime']"></foam>

## ModelSummary

ModelSummary displays properties of the model itself, such as its
package, name, and documentation. The above table is a ModelSummary.

If we wanted to generate the ModelSummary for CRON, we could use the
following snippet:

`<foam class="foam.flow.widgets.ModelSummary" of="foam.core.cron.Cron" visibleModelProps="id,documentation"></foam>`

The above code would display the following:

<foam class="foam.flow.widgets.ModelSummary" of="foam.core.cron.Cron" visibleModelProps="id,documentation"></foam>

## EnumSummary

EnumSummary is used to document an enum.

`<foam class="foam.flow.widgets.EnumSummary" of="foam.core.crunch.AssociatedEntity"></foam>`

The above code would display the following:

<foam class="foam.flow.widgets.EnumSummary" of="foam.core.crunch.AssociatedEntity"></foam>

## ApiShortSummary

ApiShortSummary is used for documenting models from the perspective of use as an API.

## DocumentationIncomplete

The DocumentationIncomplete widget is a banner that can be used to indicate
sections in the document that aren't finished yet. The `status` attribute
indicates a level of completion - "todo" indicates that the section is
completely empty, whereas "wip" means it's incomplete. In the future, a status
called "old" could be added to indicate potentially outdated information.

`<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" isSection="true"></foam>`

The above code would display the following:

<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" isSection="true"></foam>

## SequenceSummary

SequenceSummary is a widget that can describe a method that returns an instance
of [foam.util.async.Sequence](/#admin.flowdoc::foam-util-async-doc).
In order for this to work, the specified method must return a Sequence when it
is called with no arguments, and it most do so synchronously (this should
always be sufficient, as the Sequence itself can run asynchronous operations).

`<foam class="foam.flow.widgets.SequenceSummary" of="foam.u2.crunch.CrunchController" method="createWizardSequence"></foam>`

The above code would display a table including all the steps in the sequence.
It will also indicate any steps that were removed after extending another
sequence.

Future work on SequenceSummary could include a way to specify arguments to the
method, allowing documentation for a variety of complex flows.
