<flow name="DAGView" category="DOC/DEV" spid="foam" description="DAGView renders a directed acyclic graph via SVG, with pluggable grid placement plans for node layout." keywords="dagview,graph,svg,placement plan,knowledge"/>

# DAGView

## What is DAGView?

DAGView renders a directed acyclic graph, such as the one shown in the
CrunchLab view. Unlike a tree view, multiple parent nodes can connect
to a common child node. The graph is rendered using SVG, but u2 Elements
may be nested inside it.

It is important to know that while DAGView is currently only used by CrunchLab,
it can be used with any FObject, and with various different grid placement plans,
to suit a wide variety of use cases. When DAGView isn't suitable, many of the
components it uses are still re-usable, such as ArrowLine and the
GridPlacementPlan interface.

<foam class="foam.flow.widgets.TabbedModelDocumentation" defaultTab="properties" of="foam.u2.svg.graph.DAGView"></foam>

## How the view is generated

The strategy for positioning nodes in the graph is decoupled from DAGView itself.
The `gridPlacement` property can be set to any implementor of GridPlacementPlan.
This is a simple interface that should map any FObject reference to a 2D
grid coordinate. A private property of DAGView defines a placement plan as
ArrowDisplaceCellsPlacementPlan which determines the pixel coordinates of each
FObject while accounting for the provided grid position.

The first method called when generating the view is `generateArrows`. This uses
the grid placement plan to determine how many rows each arrow needs to go down.
The method considers "lanes", which exist between rows and columns. The number
of lanes between any two rows or columns is dynamic, and depends on the number
of required lines to connect all nodes without visual ambiguity. There are also
lanes corresponding to the "enter" and "exit" side (top and bottom respectively)
of each node, such that multiple arrowheads can enter a node in cases where a
single arrowhead makes things visually ambiguous.

After arrows are generated, the internal ArrowDisplaceCellsPlacementPlan is
updated to create the correct gap sizes between each pair of rows and columns
to provide the correct amount of space for each lane.

The final step is simple; renderBoxes is called to render each node in the
pixel coordinate calculated by ArrowDisplaceCellsPlacementPlan, and renderArrows
is called to render each line/arrow through the correct sequence of lanes. The
result of this is the completed DAGView.

Also note that lanes can be shared by more than one arrow when doing so does not
result in visual ambiguity.
